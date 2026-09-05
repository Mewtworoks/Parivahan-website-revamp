"""
Function-tools for the LL journey copilot.

The agent is a *citizen-side* voice copilot that guides someone through the
Learner Licence journey in Hindi/English. It is wired to the same backend
state as the test and the booking engine, so it can actually act — not just
chat.

The schema here is deliberately model-agnostic: a flat list of name /
description / JSON-Schema parameters, which is the shape every current
function-calling API accepts with at most a reshuffle. ``voice_agent`` nests it
into the Chat Completions shape in ``_chat_tools()``; a speech-to-speech
Realtime session would take it nearly as-is.

What actually ships is **OpenAI's gpt-oss-20b**, an open-weight model, served
over NVIDIA NIM's OpenAI-compatible endpoint. That is a deliberate choice for a
government deployment rather than a fallback: the weights are open, so the same
agent can run on hardware inside the country with no citizen utterance leaving
it, and the marginal cost per district is compute rather than per-token billing.
Swapping the base URL and model in .env is the whole migration to a hosted API.

Two ways to drive it:
  * Server-side (what the frontend uses) — POST /agent/voice/turn. The key
    stays in FastAPI, and state-changing tools are held behind an on-screen
    confirmation. See voice_agent.py.
  * Client-side, if you own the model socket — GET /agent/tools for this
    schema, then POST /agent/dispatch {tool, arguments} on each function call
    and hand the result back to the model.
"""

from __future__ import annotations

import hashlib
import re
from datetime import date, timedelta

from . import booking_engine as be
from . import engine
from . import signals
from .booking_engine import AlreadyBooked, SlotPassed, SlotTaken
from .booking_models import AppStatus, LicenceKind
from .models import PASS_THRESHOLD, QUESTIONS_PER_TEST
from .seed_scenarios import SCENARIOS, scenario_by_id

DEFAULT_RTO = "mh01"

_ISO_DATE = re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})$")
_SLASHED = re.compile(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$")
_SPOKEN = re.compile(r"(\d{1,2})\s+([a-zऀ-ॿ]+)\s+(\d{4})$", re.IGNORECASE)
_SPOKEN_FIRST = re.compile(r"([a-zऀ-ॿ]+)\s+(\d{1,2}),?\s+(\d{4})$", re.IGNORECASE)
_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun",
     "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}

# This is a Hindi-first service and "11 अप्रैल 2008" is the most likely way
# anyone will say a date to it. Without these the whole utterance fell through
# to the model, which read it back, stored nothing, and then asked for the date
# of birth again on the next turn — the exact loop this parser exists to end.
_MONTHS_HI = {
    "जनवरी": 1, "फरवरी": 2, "फ़रवरी": 2, "मार्च": 3, "अप्रैल": 4, "अप्रेल": 4,
    "मई": 5, "जून": 6, "जुलाई": 7, "अगस्त": 8,
    "सितंबर": 9, "सितम्बर": 9, "अक्टूबर": 10, "अक्तूबर": 10,
    "नवंबर": 11, "नवम्बर": 11, "दिसंबर": 12, "दिसम्बर": 12,
}

# Devanagari digits, which a Hindi keyboard and some recognisers produce.
_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def _month_number(word: str) -> int | None:
    """A month named in either script, or None."""
    if word in _MONTHS_HI:
        return _MONTHS_HI[word]
    return _MONTHS.get(word[:3].lower())


# The same three shapes, findable anywhere in a sentence rather than anchored to
# both ends of it. People do not answer with a bare date: "ok, 11 April 2008",
# "it's 11/04/2008", "haan, 11 अप्रैल 2008". Every one of those fell through to
# the model, which read the date back approvingly and stored nothing — so the
# next turn asked for the date of birth again.
_LOOSE_DATES = (
    re.compile(r"(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)"),
    re.compile(r"(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?!\d)"),
    re.compile(r"(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+([a-zऀ-ॿ]+),?\s+(\d{4})(?!\d)",
               re.IGNORECASE),
    re.compile(r"\b([a-zऀ-ॿ]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)",
               re.IGNORECASE),
)


def find_date(text: str) -> str | None:
    """
    A date of birth sitting inside a longer sentence.

    Strict about what counts — a day, a real month and a four-digit year, all
    together — so it cannot pick "2008" out of "I finished school in 2008" and
    call it a birthday. Everything it finds is handed to ``normalise_dob``,
    which still refuses impossible and future dates.
    """
    if not text:
        return None
    cleaned = str(text).translate(_DEVANAGARI_DIGITS)
    for index, pattern in enumerate(_LOOSE_DATES):
        found = pattern.search(cleaned)
        if not found:
            continue
        if index == 0:
            return normalise_dob(f"{found[1]}-{found[2]}-{found[3]}")
        if index == 1:
            return normalise_dob(f"{found[1]}/{found[2]}/{found[3]}")
        if index == 2:
            return normalise_dob(f"{found[1]} {found[2]} {found[3]}")
        return normalise_dob(f"{found[1]} {found[2]}, {found[3]}")
    return None


def normalise_dob(raw: str | None) -> str | None:
    """
    A date of birth as the citizen said it, turned into the one shape stored.

    Saarthi used to demand "YYYY-MM-DD" out loud, which is a machine's question
    and not one anybody says to a person. Accepting what they actually say is
    the fix; the format then never has to be mentioned at all.

    Day-first for slashed dates, because that is how a date is written and read
    in India — 04/11/2008 is the fourth of November. The ambiguous half of that
    is why a two-digit year is refused outright rather than guessed at.

    Returns None when it cannot be read confidently, which the caller turns back
    into a question rather than a stored guess: a wrong date of birth locks
    somebody out of their own application at the tracker.
    """
    if not raw:
        return None
    text = str(raw).strip().translate(_DEVANAGARI_DIGITS).lower().replace("  ", " ")

    def build(year: int, month: int, day: int) -> str | None:
        try:
            value = date(year, month, day)
        except ValueError:
            return None
        # A birth date in the future, or before anyone alive, is a
        # transcription slip and not something to file an application under.
        if not (date(1900, 1, 1) <= value <= date.today()):
            return None
        return value.isoformat()

    iso = _ISO_DATE.match(text)
    if iso:
        return build(int(iso[1]), int(iso[2]), int(iso[3]))

    slashed = _SLASHED.match(text)
    if slashed:
        return build(int(slashed[3]), int(slashed[2]), int(slashed[1]))

    spoken = _SPOKEN.match(text)
    if spoken:
        month = _month_number(spoken[2])
        return build(int(spoken[3]), month, int(spoken[1])) if month else None

    first = _SPOKEN_FIRST.match(text)
    if first:
        month = _month_number(first[1])
        return build(int(first[3]), month, int(first[2])) if month else None

    return None

# --- The JSON schema the model is given --------------------------------------

AGENT_TOOL_SCHEMA = [
    {
        "type": "function",
        "name": "get_journey_status",
        "description": "Get the citizen's current stage in the LL/DL journey "
                       "so the agent knows what to guide them toward next.",
        "parameters": {
            "type": "object",
            "properties": {
                "citizen_id": {"type": "string"},
            },
            "required": ["citizen_id"],
        },
    },
    {
        "type": "function",
        "name": "explain_ll_step",
        "description": "Explain a step of the Learner Licence process in plain "
                       "language (documents, fee, test format, pass criteria).",
        "parameters": {
            "type": "object",
            "properties": {
                "step": {
                    "type": "string",
                    "enum": ["eligibility", "documents", "fee", "test_format",
                             "pass_criteria", "after_pass"],
                },
                "language": {"type": "string", "enum": ["en", "hi"]},
            },
            "required": ["step"],
        },
    },
    {
        "type": "function",
        "name": "start_practice_test",
        "description": "Start a practice run of the scenario LL test for the "
                       "citizen and return the first scenario.",
        "parameters": {
            "type": "object",
            "properties": {"citizen_id": {"type": "string"}},
            "required": ["citizen_id"],
        },
    },
    {
        "type": "function",
        "name": "list_competencies",
        "description": "List the driving-judgment competencies the test covers, "
                       "so the agent can tell the citizen what to prepare.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "list_offices",
        "description": "List the RTO offices that can take this application and "
                       "its test, nearest first, with how busy each is right "
                       "now. Call this whenever the citizen names a city or "
                       "state, before applying — the office is fixed on the "
                       "application, and the wizard asks for it first for the "
                       "same reason.",
        "parameters": {
            "type": "object",
            "properties": {
                "state": {"type": "string",
                          "description": "Optional state name, e.g. Bihar or "
                                         "Maharashtra. Omit for every office."},
            },
        },
    },
    {
        "type": "function",
        "name": "apply_for_licence",
        "description": "Fill in and submit the citizen's licence application "
                       "(retry-safe). This is the form being completed on their "
                       "behalf, so do not call it until you have asked for and "
                       "been told every required field — an application filed "
                       "with details the citizen never gave is not their "
                       "application. Ask for them a couple at a time, in plain "
                       "words, and read the full name and date of birth back "
                       "before you call this. Everything the form needs beyond "
                       "these fields is filled with the prototype's synthetic "
                       "sample data, which the reply names so you can say so.",
        "parameters": {
            "type": "object",
            "properties": {
                "citizen_ref": {"type": "string",
                                "description": "Ignored — the service supplies "
                                               "this from the session."},
                "licence_kind": {"type": "string", "enum": ["learner", "permanent"]},
                "full_name": {"type": "string",
                              "description": "The citizen's full name as they "
                                             "said it, e.g. 'Anita Kulkarni'."},
                "dob": {"type": "string",
                        "description": "Date of birth as YYYY-MM-DD. Ask for it "
                                       "plainly; it is what the tracker later "
                                       "authenticates the application against."},
                "state": {"type": "string",
                          "description": "The state whose RTO will take the "
                                         "test, e.g. Maharashtra or Bihar."},
                "licence_classes": {
                    "type": "array", "items": {"type": "string"},
                    "description": "Vehicle classes, e.g. ['MCWG'] for a "
                                   "two-wheeler, ['LMV-NT'] for a car, or both. "
                                   "Ask which they want to ride or drive.",
                },
                "phone": {"type": "string",
                          "description": "Optional ten-digit mobile number. "
                                         "Never ask for an OTP."},
                "rto_id": {"type": "string",
                           "description": "Optional office id from list_offices. "
                                          "Omit to use the state's nearest."},
            },
            "required": ["licence_kind", "full_name", "dob", "state",
                         "licence_classes"],
        },
    },
    {
        "type": "function",
        "name": "find_slot_days",
        "description": "List the days this office is taking test appointments, "
                       "with how many places are left on each. Call this when "
                       "the citizen asks which days are free, or when the day "
                       "they wanted is full — so the day offered instead is a "
                       "real one and not a guess.",
        "parameters": {"type": "object", "properties": {"rto_id": {"type": "string"}}},
    },
    {
        "type": "function",
        "name": "find_slots",
        "description": "List the free test appointment times at an RTO on one "
                       "day, so the agent can read them to the citizen. Pass "
                       "the day the citizen asked for; omitting it means today. "
                       "One entry per time — a time that is not listed has no "
                       "free inspector left on that day.",
        "parameters": {
            "type": "object",
            "properties": {
                "rto_id": {"type": "string"},
                "date": {
                    "type": "string",
                    "description": "The day to search, as YYYY-MM-DD. Defaults "
                                   "to today. The reply carries the bookable "
                                   "window if the day asked for is outside it.",
                },
            },
        },
    },
    {
        "type": "function",
        "name": "book_slot",
        "description": "Book a specific test appointment for the citizen's "
                       "application. Atomic — one slot, one person.",
        "parameters": {
            "type": "object",
            "properties": {
                "application_id": {"type": "string"},
                "slot_id": {"type": "string"},
            },
            "required": ["application_id", "slot_id"],
        },
    },
    {
        "type": "function",
        "name": "check_in",
        "description": "The citizen has arrived at the RTO — issue their live "
                       "queue token. Safe to call twice; returns the same token.",
        "parameters": {
            "type": "object",
            "properties": {"application_id": {"type": "string"}},
            "required": ["application_id"],
        },
    },
    {
        "type": "function",
        "name": "check_queue",
        "description": "Tell the citizen their live position, assigned tester and "
                       "wait estimate on the day of the test.",
        "parameters": {
            "type": "object",
            "properties": {"token_id": {"type": "string"}},
            "required": ["token_id"],
        },
    },
]


# --- Dispatcher: executes a tool call from the agent ---------------------

# Minimal static content for the demo. In production, explain_ll_step should
# RAG over the Motor Vehicles Act / RRR (your DocuAgent pattern).
_LL_STEPS = {
    "eligibility": {
        "en": "You must be at least 18 for a car/motorcycle (16 for a 50cc "
              "moped with guardian consent) and pass a basic vision check.",
        "hi": "कार/मोटरसाइकिल के लिए न्यूनतम 18 वर्ष (अभिभावक की सहमति से 50cc "
              "मोपेड के लिए 16) और एक बुनियादी दृष्टि जाँच आवश्यक है।",
    },
    "documents": {
        "en": "Proof of age, proof of address, Form 1 self-declaration of "
              "fitness, and passport photos. Aadhaar enables faceless flow.",
        "hi": "आयु प्रमाण, पता प्रमाण, फ़ॉर्म 1 फ़िटनेस घोषणा, और पासपोर्ट फ़ोटो। "
              "आधार से पूरी प्रक्रिया बिना दफ़्तर जाए हो जाती है।",
    },
    # Real numbers, read off an actual e-receipt: Rs.150 grant per class plus a
    # Rs.50 test fee charged once, so two classes come to Rs.350 rather than
    # Rs.400. Stated here because an agent with no figure to quote invents one —
    # it told a citizen a learner licence costs "about Rs.2,000".
    # This is a prototype and payment is out of scope, so there is no figure to
    # quote. Say that plainly: given nothing at all, the model filled the gap
    # and told a citizen a learner licence costs "about Rs.2,000".
    "fee": {
        "en": "The fee is worked out and charged after all your details are "
              "filled in. This is a prototype, so no real payment is taken and "
              "no amount is quoted up front.",
        "hi": "आपके सारे विवरण भरने के बाद शुल्क की गणना होती है और तभी लिया जाता "
              "है। यह एक प्रोटोटाइप है, इसलिए कोई वास्तविक भुगतान नहीं होता और "
              "पहले से कोई रकम नहीं बताई जाती।",
    },
    # Interpolated from the constants the test actually runs on. These read "15
    # questions, 9 to pass" while the service served 10 and passed at 6, so the
    # agent was telling citizens the wrong format with total confidence.
    # Carries the pass mark as well as the count. Asked "how many questions and
    # how many to pass", the agent read this step alone and then guessed the
    # threshold — it told a citizen they needed all ten right.
    "test_format": {
        "en": f"{QUESTIONS_PER_TEST} questions, and {PASS_THRESHOLD} correct is a "
              "pass. In our reimagined test each is a short driving scenario — you "
              "watch it, then choose the safest action.",
        "hi": f"{QUESTIONS_PER_TEST} प्रश्न, और {PASS_THRESHOLD} सही होने पर आप पास "
              "हैं। हमारे नए टेस्ट में हर प्रश्न एक छोटा ड्राइविंग दृश्य है — उसे "
              "देखें, फिर सबसे सुरक्षित कार्य चुनें।",
    },
    "pass_criteria": {
        "en": f"You must answer at least {PASS_THRESHOLD} of {QUESTIONS_PER_TEST} "
              "correctly (60%) to pass.",
        "hi": f"पास होने के लिए {QUESTIONS_PER_TEST} में से कम से कम "
              f"{PASS_THRESHOLD} सही (60%) चाहिए।",
    },
    # The conditions are stated because they are law, not advice. Asked to
    # explain the process, the agent finished with "you can drive immediately" —
    # a learner may not drive alone at all, and this is the one thing it must
    # never get wrong.
    "after_pass": {
        "en": "You download your Learner Licence, valid six months. You may not "
              "drive alone on it: the vehicle needs an L plate and a licensed "
              "holder of the same class must be beside you. After at least 30 "
              "days as a learner, and within 180, you apply for the permanent "
              "driving licence.",
        "hi": "आप अपना लर्नर लाइसेंस डाउनलोड करें, जो छह महीने वैध है। इस पर अकेले "
              "गाड़ी चलाना मना है: वाहन पर L प्लेट और आपके साथ उसी श्रेणी का "
              "लाइसेंसधारी होना ज़रूरी है। कम से कम 30 दिन और 180 दिन के भीतर "
              "स्थायी ड्राइविंग लाइसेंस के लिए आवेदन करें।",
    },
}

# What the agent should push the citizen toward, per application status. Written
# as something to say, not as a recipe: the agent reads this field and is told
# never to name a tool, so "find_slots, then book_slot" was a line it had to
# translate away from on every turn — and sometimes did not.
_NEXT_ACTION = {
    AppStatus.SUBMITTED: "Wait for document verification — it is automatic.",
    # Not the appointment. The learner's test is taken online, so a verified
    # application's next step is the fee and then the test itself; the driving
    # test is a month further on and only becomes the answer at ISSUED below.
    # This line used to send everybody straight to a slot grid.
    AppStatus.VERIFIED: "Pay the fee, then take the learner's test online.",
    AppStatus.ISSUED: "Learner's licence issued. The driving test can be booked "
                      "thirty days from now.",
    AppStatus.SLOT_BOOKED: "Arrive at the RTO at your slot time, then check in.",
    AppStatus.CHECKED_IN: "You are in the queue — watch your token and ETA.",
    AppStatus.COMPLETED: "Driving test done. Download the licence from the receipt.",
    AppStatus.REJECTED: "Application rejected — see the ledger for the reason.",
}


def _stable_idempotency_key(citizen_ref: str, kind: LicenceKind, rto_id: str) -> str:
    """
    Derive the key from the request itself so an agent that repeats a call —
    the model retries, the citizen says "apply" twice, the socket drops — gets
    the same application back. A fresh uuid per call would silently defeat
    guarantee #1 for every agent-initiated apply.
    """
    payload = f"{citizen_ref}|{kind.value}|{rto_id}"
    return "agent:" + hashlib.sha256(payload.encode()).hexdigest()[:32]


def _inspector(tester_id: str) -> str:
    """
    The inspector's name, for anything the agent may read out loud.

    Tool results are spoken to the citizen, so they must not carry internal
    identifiers: "mh01_t1" is a database key, not something a person can act on.
    Falls back to the id only if the catalogue has no such tester, which would
    itself be a bug worth seeing rather than hiding.
    """
    tester = be.get_tester(tester_id)
    return tester.name if tester else tester_id


def _office_name(rto_id: str) -> str:
    """The office as the citizen would name it, never the row key."""
    office = next((r for r in be.list_rtos() if r.id == rto_id), None)
    return office.name if office else rto_id


def missing_application_details(name: str, dob: str | None, state: str,
                                 classes: list[str]) -> list[dict]:
    """
    Which answers the citizen has not given yet, each with the question to ask.

    The question text travels with the field so the model has something to say
    rather than a field name to paraphrase — "dob" read aloud to somebody who
    cannot read the form is not a question.
    """
    missing: list[dict] = []
    if len(name.split()) < 2:
        missing.append({"field": "full_name",
                        "ask": "What is your full name, first name and surname?",
                        "ask_hi": "आपका पूरा नाम क्या है — नाम और सरनेम?"})
    # No "format" key. It was here, and the model read it out — "What's your
    # DOB? (Use the format YYYY-MM-DD)" is a machine interrogating a person.
    # normalise_dob accepts what people actually say, so there is nothing to
    # explain.
    if not normalise_dob(dob):
        missing.append({"field": "dob",
                        "ask": "What is your date of birth? The day, the month "
                               "and the year is fine.",
                        "ask_hi": "आपकी जन्मतिथि क्या है? दिन, महीना और साल बता दीजिए।"})
    if not state:
        missing.append({"field": "state",
                        "ask": "Which state will you take the test in?",
                        "ask_hi": "आप किस राज्य में टेस्ट देंगे?"})
    if not classes:
        missing.append({"field": "licence_classes",
                        "ask": "Do you want to ride a two-wheeler, drive a car, "
                               "or both?",
                        "ask_hi": "आपको दोपहिया चलाना है, कार चलानी है, या दोनों?",
                        "options": ["MCWG", "LMV-NT"]})
    return missing


# --- Reading a spoken answer without asking the model -----------------------
#
# Every question the form asks has an answer the service can read for itself.
# Sending "Sehaj Gaba" to a language model to be told it is a name costs eight
# to thirty-five seconds and, twice in two recorded transcripts, came back as
# "which day would you like to book?" instead. The model is worth its latency
# for "next Thursday morning"; it is not worth it for four fixed questions.

# States and union territories, so somebody in Kerala is not told they must be
# in Maharashtra. list_rtos() already falls back to the Maharashtra offices for
# a state with no offices modelled, which is what the picker does too.
_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry",
]

# Said aloud, or typed by somebody who does not spell it the way the list does.
#
# Cities matter as much as states: nobody says "I will take the test in
# Maharashtra", they say Mumbai or Patna. And the Devanagari entries are not
# decoration — this is a Hindi-first service, "पटना में लाइसेंस बनवाना है" is the
# most likely sentence anyone will say to it, and without them that citizen was
# silently filed in Mumbai.
_STATE_ALIASES = {
    "mh": "Maharashtra", "maharastra": "Maharashtra", "bombay": "Maharashtra",
    "mumbai": "Maharashtra", "pune": "Maharashtra", "nagpur": "Maharashtra",
    "thane": "Maharashtra", "nashik": "Maharashtra", "andheri": "Maharashtra",
    "wadala": "Maharashtra", "borivali": "Maharashtra",
    "महाराष्ट्र": "Maharashtra", "मुंबई": "Maharashtra", "मुम्बई": "Maharashtra",
    "पुणे": "Maharashtra", "नागपुर": "Maharashtra", "अंधेरी": "Maharashtra",
    "वडाला": "Maharashtra", "बोरीवली": "Maharashtra", "ठाणे": "Maharashtra",
    "br": "Bihar", "patna": "Bihar", "darbhanga": "Bihar",
    "samastipur": "Bihar", "muzaffarpur": "Bihar",
    "बिहार": "Bihar", "पटना": "Bihar", "दरभंगा": "Bihar",
    "समस्तीपुर": "Bihar", "मुज़फ़्फ़रपुर": "Bihar",
    # Gaya is deliberately absent, in both scripts. It is a city in Bihar and
    # it is also the commonest past-tense verb in Hindi — "form bhar gaya",
    # "ho gaya", "भर गया" — so the alias filed people in Bihar for saying that
    # something was done. No office in the catalogue serves Gaya, so the alias
    # bought nothing and cost a wrong state, silently.
    "up": "Uttar Pradesh", "lucknow": "Uttar Pradesh", "kanpur": "Uttar Pradesh",
    "उत्तर प्रदेश": "Uttar Pradesh", "लखनऊ": "Uttar Pradesh", "कानपुर": "Uttar Pradesh",
    "mp": "Madhya Pradesh", "bhopal": "Madhya Pradesh", "indore": "Madhya Pradesh",
    "मध्य प्रदेश": "Madhya Pradesh", "भोपाल": "Madhya Pradesh", "इंदौर": "Madhya Pradesh",
    "new delhi": "Delhi", "दिल्ली": "Delhi", "नई दिल्ली": "Delhi", "ncr": "Delhi",
    "bengaluru": "Karnataka", "bangalore": "Karnataka", "mysore": "Karnataka",
    "कर्नाटक": "Karnataka", "बेंगलुरु": "Karnataka", "बैंगलोर": "Karnataka",
    "chennai": "Tamil Nadu", "madras": "Tamil Nadu", "coimbatore": "Tamil Nadu",
    "तमिलनाडु": "Tamil Nadu", "चेन्नई": "Tamil Nadu",
    "hyderabad": "Telangana", "तेलंगाना": "Telangana", "हैदराबाद": "Telangana",
    "kolkata": "West Bengal", "calcutta": "West Bengal",
    "कोलकाता": "West Bengal", "पश्चिम बंगाल": "West Bengal",
    "ahmedabad": "Gujarat", "surat": "Gujarat", "vadodara": "Gujarat",
    "गुजरात": "Gujarat", "अहमदाबाद": "Gujarat", "सूरत": "Gujarat",
    "jaipur": "Rajasthan", "jodhpur": "Rajasthan",
    "राजस्थान": "Rajasthan", "जयपुर": "Rajasthan",
    "kochi": "Kerala", "cochin": "Kerala", "thiruvananthapuram": "Kerala",
    "केरल": "Kerala", "कोच्चि": "Kerala",
    "chandigarh": "Chandigarh", "चंडीगढ़": "Chandigarh",
    "amritsar": "Punjab", "ludhiana": "Punjab", "पंजाब": "Punjab", "अमृतसर": "Punjab",
    "ap": "Andhra Pradesh", "tn": "Tamil Nadu", "wb": "West Bengal",
    "j&k": "Jammu and Kashmir", "srinagar": "Jammu and Kashmir",
    "हरियाणा": "Haryana", "gurgaon": "Haryana", "gurugram": "Haryana",
    "असम": "Assam", "guwahati": "Assam", "ओडिशा": "Odisha", "bhubaneswar": "Odisha",
    "झारखंड": "Jharkhand", "ranchi": "Jharkhand", "छत्तीसगढ़": "Chhattisgarh",
    "उत्तराखंड": "Uttarakhand", "dehradun": "Uttarakhand", "गोवा": "Goa",
    "हिमाचल": "Himachal Pradesh", "shimla": "Himachal Pradesh",
}

_TWO_WHEELER = re.compile(
    r"\b(two[\s-]?wheeler|2[\s-]?wheeler|motor\s?cycle|motorcycle|bike|scooter|"
    r"scooty|mcwg|mc)\b|दोपहिया|मोटरसाइकिल|बाइक|स्कूटर", re.IGNORECASE)
_FOUR_WHEELER = re.compile(
    r"\b(four[\s-]?wheeler|4[\s-]?wheeler|car|lmv([\s-]?nt)?|jeep|van)\b|"
    r"कार|चारपहिया|गाड़ी|गाडी", re.IGNORECASE)
_BOTH = re.compile(r"\b(both|either|all|two and four|dono)\b|दोनों", re.IGNORECASE)

# Lead-ins people put in front of a name. Stripped rather than parsed: the
# citizen said "my name is Sehaj Gaba", and the answer is the tail.
# A correction opens with a word or two of hesitation — "actually, my name is
# …", "no, sorry, my name is …" — and the lead-in has to survive that, or the
# wrong spelling stays on the form because the sentence did not start the way
# the pattern expected.
_NAME_LEADIN = re.compile(
    r"^\s*(?:(?:actually|no|sorry|wait|um|uh|okay|ok|arre|nahi|अरे|नहीं|माफ़?\s*कीजिए)[,]?\s+){0,2}"
    r"(?:(?:my|the)\s+(?:full\s+)?name\s+(?:is|'s)|i\s+am|i'?m|this\s+is|"
    r"it\s+is|its|it's|name|mera\s+naam|naam|main"
    r"|मेरा\s+(?:पूरा\s+)?नाम|नाम)\s*", re.IGNORECASE)
_NAME_TRAILER = re.compile(
    r"\s*(?:hai|hoon|he|hu|hun|है|हैं|हूँ|हूं)\s*[.।!]?\s*$", re.IGNORECASE)
# A name is letters, and the apostrophes and hyphens that appear in real ones.
_NAME_OK = re.compile(r"^[A-Za-zऀ-ॿ][A-Za-zऀ-ॿ'.\-]*$")

# Never eaten as an answer. Somebody who says "what does this cost?" halfway
# through the form is asking a question, not naming themselves — and a service
# that files "What Does This Cost" as a legal name has done something much worse
# than take an extra turn.
_QUESTION_WORD = re.compile(
    r"^\s*(what|why|how|when|where|which|who|can|could|should|do|does|did|is|"
    r"are|am|will|would|tell|show|explain|help|please|sorry|no|not|wait|stop|"
    r"cancel|change|kya|kyu|kyun|kaise|kab|kahan|kaun|kitna|kitne|batao|"
    r"bataiye|dikhao|nahi|nahin|ruko|mujhe)\b", re.IGNORECASE)
_HINDI_QUESTION = re.compile(r"क्या|कैसे|कब|कहाँ|कहां|कौन|कितना|कितने|नहीं|बताओ|बताइए|दिखाओ")


def looks_like_a_question(text: str) -> bool:
    """
    Whether this should go to the model rather than be read as an answer.

    Deliberately generous. A question mistaken for an answer stores something
    false under the citizen's name; an answer mistaken for a question costs one
    model call. Those are not comparable, so the doubt goes one way.
    """
    stripped = (text or "").strip()
    if "?" in stripped or "？" in stripped:
        return True
    return bool(_QUESTION_WORD.match(stripped) or _HINDI_QUESTION.search(stripped))


# Words that are never part of a name, however much a phrase looks like one.
# "apply aur slot" and "puri prakriya samjhaiye" are both two-to-four alphabetic
# words, and both were read as names before this list existed — which would have
# filed an application under "Apply Aur Slot".
_NOT_A_NAME = {
    "apply", "application", "licence", "license", "learner", "form", "slot",
    "slots", "book", "booking", "test", "exam", "status", "track", "queue",
    "token", "help", "please", "thanks", "thank", "yes", "no", "ok", "okay",
    "sure", "hello", "hi", "hey", "namaste", "saarthi", "sarthi", "want",
    "need", "know", "tell", "show", "give", "start", "begin", "cancel", "stop",
    "wait", "again", "aur", "aor", "karo", "karna", "chahiye", "batao",
    "bataiye", "dikhao", "samjhaiye", "samjhao", "prakriya", "mujhe", "mera",
    "meri", "main", "aap", "hai", "hain", "kar", "kya", "abhi", "phir",
    "day", "date", "time", "office", "rto", "fee", "fees", "documents",
    "लाइसेंस", "आवेदन", "फॉर्म", "फ़ॉर्म", "स्लॉट", "टेस्ट", "मदद", "नमस्ते",
    "चाहिए", "बताओ", "दिखाओ", "करो", "हाँ", "नहीं", "ठीक",
}


def _read_name(text: str) -> tuple[str, bool] | None:
    """
    A name, and whether the citizen said outright that it was one.

    The flag matters more than it looks. "Sehaj Gaba" is a name when we have
    just asked for one and an unknown phrase when we have not — the parser
    cannot tell those apart, and the caller can. "My name is Sehaj Gaba"
    announces itself either way.
    """
    stripped = text.strip()
    announced = bool(_NAME_LEADIN.match(stripped))
    candidate = _NAME_TRAILER.sub("", _NAME_LEADIN.sub("", stripped)).strip(" .,।")
    parts = [p for p in candidate.split() if p]
    # Two to four words. One is a first name and the form needs a surname; five
    # is a sentence that happened to contain no digits.
    if not 2 <= len(parts) <= 4:
        return None
    if not all(_NAME_OK.match(p) for p in parts):
        return None
    if any(p.lower().strip(".'-") in _NOT_A_NAME for p in parts):
        return None
    # Capitalised, because this ends up printed on an application. Typing is
    # lower case far more often than speech is, and "sehaj gaba" on a licence
    # looks like a service that did not care. A word that already carries an
    # internal capital is left alone — DSouza and McLeod are spelled that way on
    # purpose and title-casing would quietly correct somebody's name.
    return " ".join(p if p[1:] != p[1:].lower() else p.capitalize()
                    for p in parts), announced


# Two-letter aliases are registration codes, and every one of them is also an
# ordinary word or the tail of one. A word boundary is not enough for them:
# "up" is in "I want to sign up for a learner licence" and in "fill up the
# form", and both of those filed the citizen in Uttar Pradesh without ever
# saying so — the state is read from every utterance while it is outstanding,
# stored, and written to the draft in silence.
#
# So a short alias has to be the whole answer rather than merely present in it.
# Somebody who means the code says it on its own or with a word or two around
# it; nobody says "MH" in the middle of a sentence about signing up.
_SHORT_ALIAS_LIMIT = 3
_ALIAS_ALONE = re.compile(r"^[^\wऀ-ॿ]*(?P<word>[\wऀ-ॿ&]+)[^\wऀ-ॿ]*$")


def _read_state(text: str) -> str | None:
    lowered = " ".join(text.lower().split()).strip(" .,?!।")
    alone = _ALIAS_ALONE.match(lowered)
    bare = alone.group("word") if alone else None
    for alias, state in _STATE_ALIASES.items():
        if len(alias) < _SHORT_ALIAS_LIMIT:
            # "mh", "up", "br", "ap", "mp", "tn", "wb": only when the citizen
            # said that and nothing else.
            if bare == alias:
                return state
            continue
        if re.search(rf"(?<![\wऀ-ॿ]){re.escape(alias)}(?![\wऀ-ॿ])",
                     lowered):
            return state
    # Longest first, so "Andhra Pradesh" is not swallowed by a shorter match.
    #
    # Bounded like the aliases above rather than by substring. Without the
    # boundary "goa" matched inside "my goal is to drive", which is a state
    # recorded from a sentence that names none.
    for state in sorted(_STATES, key=len, reverse=True):
        if re.search(rf"(?<![\wऀ-ॿ]){re.escape(state.lower())}(?![\wऀ-ॿ])", lowered):
            return state
    return None


def _read_classes(text: str) -> list[str] | None:
    if _BOTH.search(text):
        return ["MCWG", "LMV-NT"]
    two, four = bool(_TWO_WHEELER.search(text)), bool(_FOUR_WHEELER.search(text))
    if two and four:
        return ["MCWG", "LMV-NT"]
    if two:
        return ["MCWG"]
    if four:
        return ["LMV-NT"]
    return None


# Places whose office the citizen would name in Hindi. The Latin spellings come
# out of the catalogue itself below, so only the script it does not store needs
# writing down.
_OFFICE_ALIASES_HI = {
    "पटना": "Patna", "दरभंगा": "Darbhanga", "समस्तीपुर": "Samastipur",
    "मुंबई": "Mumbai", "मुम्बई": "Mumbai", "अंधेरी": "Andheri",
    "वडाला": "Wadala", "बोरीवली": "Borivali",
}


def read_office(text: str) -> str | None:
    """
    The office the citizen actually named, not merely the state it is in.

    Mapping a city to a state and then taking that state's nearest office is a
    quiet way to send somebody somewhere else: "Patna" became Bihar became
    Samastipur, which is a ninety-kilometre difference and the whole reason the
    wizard asks for the office before anything else. If they said a place this
    service has an office in, that is the office.

    Read off the catalogue rather than a second hardcoded map, so an office that
    is added or renamed is matched without anyone remembering to update a list.
    """
    lowered = " ".join((text or "").lower().split())
    if not lowered:
        return None
    for hindi, latin in _OFFICE_ALIASES_HI.items():
        if hindi in lowered:
            lowered += " " + latin.lower()

    best: tuple[int, str] | None = None
    for office in be.list_rtos():
        # The area is the most specific thing the catalogue holds — "Andheri
        # West, Mumbai" distinguishes three offices that share a city. Its first
        # word counts too: nobody says "Andheri West", they say Andheri.
        area = office.area.split(",")[0].strip()
        places = {area, area.split()[0] if area else "", office.city}
        for place in places:
            token = place.strip().lower()
            if token and re.search(rf"(?<![\w]){re.escape(token)}(?![\w])", lowered):
                # Longest match wins, so "Andheri" is not lost to "Mumbai".
                if best is None or len(token) > best[0]:
                    best = (len(token), office.id)
    return best[1] if best else None


def read_answer(field: str, text: str, prompted: bool = False) -> object | None:
    """
    Read one spoken answer to one form question, or return None.

    None means "not confident", and the caller sends the turn to the model
    instead of storing a guess. That distinction is the whole safety argument
    here: a wrong date of birth is not a small error, it locks somebody out of
    their own application at the tracker, where the date is what authenticates
    them.

    ``prompted`` says the service asked this exact question on the previous
    turn. It only gates the name, because the name is the only answer with no
    shape of its own: a date is a date and "two-wheeler" is a vehicle class, but
    any two words could be a name. Unprompted, the citizen has to say so —
    otherwise "puri prakriya samjhaiye" is filed as somebody's legal name.
    """
    text = (text or "").strip()
    if not text or looks_like_a_question(text):
        return None
    if field == "full_name":
        found = _read_name(text)
        if found is None:
            return None
        name, announced = found
        return name if (prompted or announced) else None
    if field == "dob":
        # normalise_dob is strict — it refuses two-digit years and impossible
        # dates — so trying the whole utterance and then the tail is safe.
        cleaned = re.sub(
            r"^\s*(?:(?:my|meri|mera)\s+)?"
            r"(?:date\s+of\s+birth|dob|birthday|born|janm\s*tithi"
            r"|मेरी\s+जन्म\s*तिथि|जन्म\s*तिथि|जन्म\s*दिन|जन्मतिथि|जन्मदिन)"
            r"\s*(?:is|on|hai|है|:)?\s*", "", text, flags=re.IGNORECASE)
        # "11 अप्रैल 2008 है" — the trailing copula breaks the anchored match.
        cleaned = re.sub(r"\s*(?:hai|hain|है|हैं|को|में)\s*[.।!]?\s*$", "",
                         cleaned, flags=re.IGNORECASE)
        return (normalise_dob(cleaned.strip(" .,?!।"))
                or normalise_dob(text)
                # Last: the date somewhere inside a longer sentence.
                or find_date(text))
    if field == "state":
        return _read_state(text)
    if field == "licence_classes":
        return _read_classes(text)
    return None


def _default_rto_for(state: str) -> str:
    """
    The nearest office in the state the citizen named.

    Without this, saying "Bihar" still filed the application in Mumbai — the
    office is fixed on the application and decides where they have to travel,
    so guessing it from a constant is the one default that is not harmless.
    ``list_rtos`` already falls back to Maharashtra for a state with no offices
    modelled, which is the same thing the picker does.
    """
    if not state:
        return DEFAULT_RTO
    offices = be.list_rtos(state)
    return offices[0].id if offices else DEFAULT_RTO


def existing_journey(citizen_ref: str) -> dict:
    """
    The application this citizen already has, if any, and where it was filed.

    A voice session used to learn an application id only from a tool it had run
    itself, so someone who filled in the wizard and then opened Saarthi to book
    was told to apply first. Taking that answer created a second application at
    the default office, and the appointment then hung off a record the tracker
    was not showing.
    """
    app_obj = be.latest_application_for(citizen_ref)
    if app_obj is None:
        return {}
    found: dict = {
        "application_id": app_obj.id, "rto_id": app_obj.rto_id,
        "token_id": app_obj.token_id,
        # The rest is for the opening line. A session that knows only an id can
        # say "you have an application" and nothing more, so it either says
        # something useless or asks a tool — and asking a tool to open a
        # conversation is the ten seconds this whole change is about removing.
        "application_no": app_obj.display_no,
        "applicant_name": app_obj.applicant_name,
        "status": app_obj.status.value,
        "office": _office_name(app_obj.rto_id),
        "next_action": _NEXT_ACTION.get(app_obj.status, ""),
    }
    if app_obj.booking_id:
        booking = be.get_booking(app_obj.booking_id)
        if booking:
            found["appointment"] = {
                "date": booking.slot_date.isoformat(),
                "day": booking.slot_date.strftime("%A %d %B"),
                "time": booking.start.strftime("%H:%M"),
                "tester": _inspector(booking.tester_id),
                "office": _office_name(booking.rto_id),
            }
    return found


def pending_details(tool: str, args: dict) -> dict:
    """
    What a gated action will actually do, resolved here from the ids it holds.

    The confirmation gate used to hand the model nothing but a generic label, so
    the sentence spoken before the button was pressed was invented: it offered
    "10:15 with Inspector A", passed a different row's slot_id, and then read the
    real booking back as Inspector C on another date. Resolving the appointment
    from the id the citizen is about to confirm means the sentence before the
    press and the booking after it cannot disagree.

    ``unavailable`` says the id cannot be booked at all, so the caller can send
    the model back to find_slots instead of showing a button that must fail.
    """
    if tool != "book_slot":
        return {}

    # An application holds one appointment. Caught here, the agent can say which
    # one on the same turn; left to the booking call, the citizen presses a
    # button and is told afterwards that it did nothing.
    app_obj = be.get_application(str(args.get("application_id") or ""))
    if app_obj is not None and app_obj.booking_id:
        held = be.get_booking(app_obj.booking_id)
        if held is not None:
            return {"unavailable": "already_booked",
                    "date": held.slot_date.isoformat(),
                    "day": held.slot_date.strftime("%a %d %b"),
                    "time": held.start.strftime("%H:%M"),
                    "tester": _inspector(held.tester_id),
                    "office": _office_name(held.rto_id)}

    slot = be.get_slot(str(args.get("slot_id") or ""))
    if slot is None:
        return {"unavailable": "unknown"}
    if not slot.is_free:
        return {"unavailable": "taken"}
    if be._too_late(slot.slot_date, slot.start):
        return {"unavailable": "passed"}
    return {
        "date": slot.slot_date.isoformat(),
        "day": slot.slot_date.strftime("%a %d %b"),
        "time": slot.start.strftime("%H:%M"),
        "tester": _inspector(slot.tester_id),
        # Named because the office is not implied by the application: the slot
        # carries its own, and a citizen who asked about another city can be
        # holding an appointment three hundred kilometres from the one they
        # applied at without a word being said about it.
        "office": _office_name(slot.rto_id),
    }


def dispatch_tool(tool: str, args: dict) -> dict:
    """
    Run one agent tool, and note it if it raises.

    Wrapped rather than recorded at each of the twelve call sites, because a
    signal that depends on somebody remembering to add it at the thirteenth is
    not a signal. What is stored is the tool and the exception's class name —
    never the message, which carries slot ids, application numbers and, on a
    bad day, whatever the citizen typed.
    """
    try:
        return _dispatch(tool, args)
    except Exception as exc:                      # noqa: BLE001 - re-raised below
        signals.record("tool.error", str(args.get("citizen_id") or ""),
                       tool=tool, error=type(exc).__name__)
        raise


def _dispatch(tool: str, args: dict) -> dict:
    if tool == "get_journey_status":
        cid = args["citizen_id"]
        app_obj = be.latest_application_for(cid)
        if app_obj is None:
            attempt = engine.latest_attempt_for(cid)
            return {
                "citizen_id": cid,
                "stage": "not_started",
                "practice_attempts": 1 if attempt else 0,
                "next_action": "Apply for the licence, and try the practice "
                               "scenario test while you wait.",
            }

        out = {
            "citizen_id": cid,
            "stage": app_obj.status.value,
            "application_id": app_obj.id,
            "application_no": app_obj.display_no,
            "licence_kind": app_obj.licence_kind.value,
            # The office travels with the application, so a session that picks
            # this up cannot go on to search another office's slot grid.
            "rto_id": app_obj.rto_id,
            "office": _office_name(app_obj.rto_id),
            "next_action": _NEXT_ACTION.get(app_obj.status, "Check your ledger."),
            "last_event": app_obj.ledger[-1].note if app_obj.ledger else None,
        }
        if app_obj.booking_id:
            b = be.get_booking(app_obj.booking_id)
            if b:
                out["appointment"] = {"date": str(b.slot_date),
                                      "day": b.slot_date.strftime("%a %d %b"),
                                      "time": b.start.strftime("%H:%M"),
                                      "tester": _inspector(b.tester_id),
                                      "office": _office_name(b.rto_id)}
        if app_obj.token_id:
            out["queue"] = be.queue_status(app_obj.token_id)
        return out

    if tool == "explain_ll_step":
        step = args["step"]
        lang = args.get("language", "en")
        if step not in _LL_STEPS:
            return {"error": f"Unknown step: {step}",
                    "known_steps": sorted(_LL_STEPS)}
        texts = _LL_STEPS[step]
        return {"step": step, "language": lang if lang in texts else "en",
                "text": texts.get(lang, texts["en"])}

    if tool == "start_practice_test":
        attempt = engine.build_test(args["citizen_id"])
        first_id = engine.next_scenario_id(attempt)
        return {
            "attempt_id": attempt.id,
            "total_questions": len(attempt.scenario_ids),
            "first_scenario": engine.serve_scenario(
                attempt.id, scenario_by_id(first_id)).model_dump(),
        }

    if tool == "list_competencies":
        comps = sorted({s.competency.value for s in SCENARIOS})
        return {"competencies": comps}

    if tool == "list_offices":
        state = args.get("state") or None
        offices = []
        for office in be.list_rtos(state):
            pressure = be.office_pressure(office.id)
            offices.append({"rto_id": office.id, "name": office.name,
                            "area": office.area, "state": office.state,
                            "km": office.km, "load": pressure["load"],
                            "wait_minutes": pressure["wait_minutes"]})
        return {"state": state, "offices": offices}

    if tool == "apply_for_licence":
        kind = LicenceKind(args.get("licence_kind", "learner"))
        state = (args.get("state") or "").strip()
        rto = args.get("rto_id") or _default_rto_for(state)
        citizen_ref = args["citizen_ref"]
        name = (args.get("full_name") or "").strip()
        # Read as the citizen said it, stored the one way everything else reads.
        dob = normalise_dob(args.get("dob"))
        classes = [c for c in (args.get("licence_classes") or []) if c]

        # The schema's "required" list is advice to the model, not a rule the
        # service enforces — a model that skipped the questions still got an
        # application, blank where the citizen's details should be. That is the
        # exact thing this tool was rewritten to stop, so the check lives here
        # too. Returned rather than raised: the model needs to go and ask, not
        # to see a failure it will apologise for and abandon.
        missing = missing_application_details(name, dob, state, classes)
        if missing:
            return {
                "needs": [m["field"] for m in missing],
                "ask_for": missing,
                "error": ("The form cannot be filed yet. Ask the citizen for "
                          "these in plain words, one or two at a time, then "
                          "call this tool again with all of them."),
            }

        key = _stable_idempotency_key(citizen_ref, kind, rto)
        app_obj = be.apply(citizen_ref, kind, rto, key, dob=dob,
                           applicant_name=name or None, licence_classes=classes)
        return {
            "application_id": app_obj.id, "application_no": app_obj.display_no,
            "status": app_obj.status.value,
            "rto_id": app_obj.rto_id, "office": _office_name(app_obj.rto_id),
            "applicant_name": app_obj.applicant_name,
            "licence_classes": app_obj.licence_classes,
            # What the citizen actually told us, so the browser can put it into
            # the same form the wizard uses and they can see their own answers
            # rather than take Saarthi's word for what was filed.
            "form_prefill": {
                "state": state or None, "rto": app_obj.rto_id,
                "full_name": name or None, "dob": dob,
                "phone": (args.get("phone") or "").strip() or None,
                "classes": classes,
            },
            # Said out loud, every time. The ledger row already reads
            # "Documents verified (mock)"; until now the only place that
            # qualifier did not reach was the one sentence a citizen actually
            # hears, which is the sentence that matters most.
            "verification": "mocked",
            "disclosure": (
                "No document, Aadhaar or OTP check was performed — verification "
                "is simulated in this prototype. Every field beyond the name, "
                "date of birth, state and vehicle class is the prototype's own "
                "sample data, not the citizen's."
            ),
            "next_action": _NEXT_ACTION.get(app_obj.status, "")}

    if tool == "find_slot_days":
        rto = args.get("rto_id") or DEFAULT_RTO
        return {"rto_id": rto, "office": _office_name(rto),
                "days": [{"date": d["date"], "day": d["label"], "left": d["left"]}
                         for d in be.slot_days(rto)]}

    if tool == "find_slots":
        rto = args.get("rto_id") or DEFAULT_RTO
        today = date.today()
        last = today + timedelta(days=be.SLOT_DAYS_AHEAD - 1)
        # Carried on every reply, including the errors: told only "no", the
        # model guesses which days exist. Told the window, it can offer one.
        window = {"bookable_from": today.isoformat(), "bookable_to": last.isoformat()}

        asked = args.get("date")
        if asked:
            try:
                on = date.fromisoformat(str(asked).strip())
            except ValueError:
                return {"error": f"Could not read the date {asked!r}. Use YYYY-MM-DD.",
                        "slots": [], **window}
            if not today <= on <= last:
                return {"error": "That day is outside the days this office is "
                                 "taking appointments for.", "slots": [], **window}
        else:
            on = today

        # One entry per start time, not one per inspector. Three 10:15 entries
        # that differ only by an opaque id is what made the model offer "10:15
        # with Inspector A" and then book Inspector C's row: it cannot keep a
        # name and a uuid paired across a turn, so it is only ever given one
        # id per time and told whose it is.
        by_time: dict[str, list] = {}
        for slot in be.list_free_slots(rto, on):
            by_time.setdefault(slot.start.strftime("%H:%M"), []).append(slot)

        return {
            # The day travels with every slot. Without it the model spoke the
            # date the citizen had asked for, which was not the day it booked.
            "date": on.isoformat(),
            "day": on.strftime("%a %d %b"),
            "rto_id": rto,
            "office": _office_name(rto),
            "slots": [{"slot_id": free[0].id, "time": start, "date": on.isoformat(),
                       "tester": _inspector(free[0].tester_id), "left": len(free)}
                      for start, free in sorted(by_time.items())],
            **window,
        }

    if tool == "book_slot":
        try:
            b = be.book_slot(args["application_id"], args["slot_id"])
        except SlotTaken:
            return {"ok": False, "reason": "That time was just taken — pick another."}
        except AlreadyBooked:
            return {"ok": False, "reason": "You already have an appointment booked."}
        except SlotPassed:
            return {"ok": False, "reason": "That time has already passed. Look up the slots again."}
        except KeyError as e:
            return {"ok": False, "reason": str(e)}
        # booking_id is for the caller, not for speech: the panel needs it to put
        # an appointment made by talking on the same screens as one made in the
        # wizard, which otherwise still read "no slot booked" afterwards.
        return {"ok": True, "booking_id": b.id, "date": str(b.slot_date),
                "day": b.slot_date.strftime("%a %d %b"),
                "time": b.start.strftime("%H:%M"), "tester": _inspector(b.tester_id),
                "office": _office_name(b.rto_id)}

    if tool == "check_in":
        try:
            t = be.check_in(args["application_id"])
        except KeyError:
            return {"ok": False, "reason": "No appointment found to check in against."}
        return {"ok": True, "token_id": t.id, "token_number": t.number,
                "tester": _inspector(t.tester_id)}

    if tool == "check_queue":
        try:
            return be.queue_status(args["token_id"])
        except KeyError:
            return {"error": "No active queue token found."}

    raise KeyError(tool)

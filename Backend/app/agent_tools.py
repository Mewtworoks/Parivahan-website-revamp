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
from .booking_engine import AlreadyBooked, SlotPassed, SlotTaken
from .booking_models import AppStatus, LicenceKind
from .models import PASS_THRESHOLD, QUESTIONS_PER_TEST
from .seed_scenarios import SCENARIOS, scenario_by_id

DEFAULT_RTO = "mh01"

# The tracker authenticates a lookup on the date of birth, so a model that
# writes "11 April 2008" into the field files an application nobody can find
# again. Checked rather than parsed loosely: guessing between 04-11 and 11-04 is
# how somebody ends up locked out of their own application.
_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")

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
    AppStatus.VERIFIED: "Choose a day and time for the driving test appointment.",
    AppStatus.SLOT_BOOKED: "Arrive at the RTO at your slot time, then check in.",
    AppStatus.CHECKED_IN: "You are in the queue — watch your token and ETA.",
    AppStatus.COMPLETED: "Test done. Download the licence from the receipt.",
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


def _missing_application_details(name: str, dob: str | None, state: str,
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
                        "ask": "What is your full name, first name and surname?"})
    if not dob or not _ISO_DATE.fullmatch(dob):
        missing.append({"field": "dob",
                        "ask": "What is your date of birth? Say the day, the "
                               "month and the year.",
                        "format": "YYYY-MM-DD"})
    if not state:
        missing.append({"field": "state",
                        "ask": "Which state will you take the test in?"})
    if not classes:
        missing.append({"field": "licence_classes",
                        "ask": "Do you want to ride a two-wheeler, drive a car, "
                               "or both?",
                        "options": ["MCWG", "LMV-NT"]})
    return missing


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
    return {"application_id": app_obj.id, "rto_id": app_obj.rto_id,
            "token_id": app_obj.token_id}


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
        dob = (args.get("dob") or "").strip() or None
        classes = [c for c in (args.get("licence_classes") or []) if c]

        # The schema's "required" list is advice to the model, not a rule the
        # service enforces — a model that skipped the questions still got an
        # application, blank where the citizen's details should be. That is the
        # exact thing this tool was rewritten to stop, so the check lives here
        # too. Returned rather than raised: the model needs to go and ask, not
        # to see a failure it will apologise for and abandon.
        missing = _missing_application_details(name, dob, state, classes)
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

"""Hindi-first voice orchestration for Saarthi.

The browser only handles microphone transcription and speech playback.  It never
receives the NVIDIA API key and it never calls licence tools directly.  This
module keeps a short-lived demo conversation, asks NVIDIA's OpenAI-compatible
chat endpoint to choose a tool, and runs that tool through the existing
``dispatch_tool`` gate.

State-changing actions are deliberately two-step: the model can request them,
but this service queues them until the citizen presses the visible confirmation
button in the frontend.  A model retry therefore cannot silently submit an
application, book an appointment, or check the citizen in.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from . import conversations as convo_store
from . import drafts, signals
from .agent_tools import (
    AGENT_TOOL_SCHEMA,
    DEFAULT_RTO,
    _default_rto_for,
    _office_name,
    dispatch_tool,
    existing_journey,
    looks_like_a_question,
    missing_application_details,
    pending_details,
    read_answer,
    read_office,
)

log = logging.getLogger("saarthi")

NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "openai/gpt-oss-20b")
SESSION_TTL_MINUTES = 30
# Booking honestly costs three lookups before the action — which office, which
# day, which time — and at four the agent ran out mid-journey and fell back on
# an apology. The rate limit, not this, is what caps the bill.
MAX_TOOL_ROUNDS = 6

# Every turn is a paid upstream call on an endpoint with no login in front of
# it, so both a single conversation and a single caller are capped. The limits
# are set well above a real citizen talking through the journey — that took
# about eight turns end to end — and well below anything that runs up a bill.
RATE_WINDOW_MINUTES = 5
TURNS_PER_SESSION = 25
TURNS_PER_CALLER = 60

SYSTEM_PROMPT = """
You are Saarthi, a warm, concise voice guide for an independent Parivahan
learner-licence prototype. Help with the licence journey using the available
tools. Keep each answer under three short spoken sentences.

Answer in the language the citizen just used, and hold it. Hindi gets Hindi,
English gets English, and mixed Hindi-English (Hinglish) gets Hinglish. Do not
switch language between turns unless the citizen switches first — reading one
reply in Hindi and the next in English is hard to follow when it is spoken
aloud. Default to simple Hinglish if you cannot tell.

This is a synthetic-data demo. Never ask for Aadhaar, PAN, OTPs, passwords,
bank/card details, or any real personal data. If a citizen offers one anyway,
do not just refuse — tell them warmly that you do not need it and never will,
then say what the service does need and carry on with the journey. A bare "I
can't help with that" leaves someone who was trying to cooperate stuck and
suspicious. Never claim to be a government service. Tell citizens they do not
need a dalal or agent: the portal can show their real demo application state,
appointment, and queue itself.

When the citizen wants to apply, book a slot, or check in, call the tool
straight away. Do not ask permission in words first, and never write anything
like "(Confirm button)" in your reply: the service itself holds the action and
shows the citizen a confirmation button, and nothing runs until they press it.
Asking instead of calling leaves them stuck, because the button only appears
once you have called the tool.

Until they press it, nothing has happened. Say what you are about to do, not
that it is done: "I will create your application, please confirm" — never "your
application is ready" while it is still waiting on them.

If the citizen says they want a licence, start filling the form on that turn.
Do not open by asking which part they need help with — they told you. There is
nothing to book, check into or track until an application exists, so every
other step depends on this one.

You are filling the form for them. That is the point of you: somebody who
cannot read a nine-stage form, or does not want to type one on a phone, can
answer four questions out loud instead. So ask for the details rather than
inventing them:

  * their full name
  * their date of birth
  * which state they will take the test in
  * what they want to ride or drive — a two-wheeler (MCWG), a car (LMV-NT), or
    both
  * their mobile number, if they want to give one — it is optional, and never
    ask for an OTP

Ask for one or two at a time in plain words, not as a list read aloud.

Call apply_for_licence the moment the citizen gives you any of those answers,
with whatever you heard on that turn. You are not holding the form — the
service is. Every call writes what you send onto the form and hands back what
is still outstanding, so a partial call is right and expected; nothing is filed
until every answer is there. Do not wait until you have all of them, and do not
reply to an answer without calling the tool. A turn where they told you
something and you only spoke back is a turn where their answer was thrown away,
and it is how the same question gets asked twice.

If they refuse an answer, say plainly that the form cannot be filed without it.

When the application comes back, say the disclosure the tool gives you, in your
own words and in their language. Never say the application was "verified"
without it. Nothing was checked against any government record: no document, no
Aadhaar, no OTP. Everything the form needs beyond what they told you is the
prototype's sample data. A citizen who thinks a real check happened has been
misled, and this service does not do that even when the truth is less
impressive.

Then tell them the form is filled and offer the next step — booking the test
slot. Do not book it in the same breath; let them say yes first.

Never invent a number or a rule. Ages, deadlines, question counts, validity
periods and what a learner is allowed to do all come from a tool — call
explain_ll_step and quote what it returns. If you do not have it, say so and
offer to look it up. Never guess what the law permits: a learner may not drive
alone, and telling someone otherwise puts them on the road illegally.

The journey is short and always in this order. Apply. Book a test slot. Check in
on the day. Read the live queue. Nothing later works until the step before it is
done, so drive it forward one step at a time and say which step they are on.

Applying fixes the office. If the citizen names a city or a state, call
list_offices and apply at the one they meant; otherwise apply and say which
office it is. Do not ask them to choose from six offices unprompted — that is
the slowest possible way to start.

Booking is: which day, then which time, then book. find_slot_days gives the days
and how many places each has left. find_slots gives the times on one day — pass
the date the citizen asked for. Then pass that slot's slot_id to book_slot. If
you already know the day, go straight to find_slots; do not spend a turn asking
what you can look up.

Never state a date, a time, an inspector or an office that a tool did not just
give you. Read back what came out of the tool, including when you are saying no.
If a time the citizen asked for is not in the list, it is full: say so for the
day you actually searched, then offer what did come back. Guessing is not a
small error here — someone arrives at the office on the wrong morning.

When a tool gives an error, that error is the answer. Say it plainly in their
language and do the next useful thing it points at.

You are being spoken aloud. Never say an id of any kind — no slot_id, no
application id, no token id, no rto_id, no long code. Name an office by its
name, and an application by its number (SS-2026-004182). Ids are for your tool
calls only. Write plain spoken sentences, never JSON, lists of codes, or
markdown.

Offering times, say the day and the times — "on Thursday there is 9:30, 10:15
and 11". The office assigns the inspector, so naming one against every time
sounds like a choice they have to make and it is not. Name the inspector once
the appointment is made, and whenever you read a booked appointment back.

Never name a tool or function to the citizen. They cannot run anything: you
run the tools. Say "I will check you in" or "let me look at the queue", never
"run check_in" or "call read_live_queue".

A slot is when to arrive; a token is the place in the line once they are there.
When reading the queue, lead with position_in_lane and the inspector's name,
then the wait. The token number is issued across the whole office, so never
present it as a position — "you are third in the hall but next with Inspector
C" is right, "you are number three and nobody is ahead" sounds like a mistake.
""".strip()

MUTATING_TOOLS = {"apply_for_licence", "book_slot", "check_in"}

# The answers the citizen gives to fill the form, accumulated on the session.
_FORM_FIELDS = ("full_name", "dob", "state", "licence_classes", "phone")

# Tools that only make sense once there is an application to attach them to.
# Saarthi asked "which day would you like to book your test slot?" while it was
# still three answers short of a filled form, which derails the one thing it was
# in the middle of doing. There is nothing to book a slot against yet, so these
# send it back to the form instead of answering.
_NEEDS_APPLICATION = {"find_slot_days", "find_slots"}

# A reply that promises to do one of the gated things. The model mostly calls
# the tool, but roughly one turn in four it announces the action in words and
# calls nothing — "I'll start your learner licence application" — so no
# confirmation button appears and the citizen is left waiting for something that
# was never queued. Matched only to decide whether to ask once more; the reply
# itself is never rewritten on the strength of it.
_PROMISED_ACTION = re.compile(
    r"\b(i(?:'| wi)?ll|i am going to|let me|main)\b[^.!?]{0,60}"
    r"\b(start|create|submit|appl(?:y|ying)|book|reserve|check(?:ing)? you in)\b"
    r"|\b(आवेदन|अर्ज़ी)\b[^।.!?]{0,40}\b(कर|बना|शुरू)"
    r"|\b(बुक|चेक ?इन)\b[^।.!?]{0,30}\b(कर|कर्?ता|करूँ|करूंगा)",
    re.IGNORECASE,
)


@dataclass
class PendingAction:
    tool: str
    arguments: dict[str, Any]
    label: str


@dataclass
class VoiceSession:
    id: str
    citizen_ref: str
    messages: list[dict[str, Any]] = field(default_factory=list)
    application_id: str | None = None
    token_id: str | None = None
    # The office the application was filed at. Slot searches default to it, so
    # talking about another city cannot quietly move where the test is taken.
    rto_id: str | None = None
    pending: PendingAction | None = None
    # Every form answer the citizen has given so far, accumulated by the service
    # rather than remembered by the model.
    #
    # This is the fix for the worst thing Saarthi did: asked for a name, told
    # "Sehaj Gaba", it replied "which day would you like to book your test
    # slot?" — it had lost the thread of what it was collecting, skipped three
    # questions, and only noticed the gap when the citizen asked outright. A
    # model that has to hold four answers across four turns will sometimes drop
    # them. A dict cannot.
    form_answers: dict[str, Any] = field(default_factory=dict)
    # The form field the service asked about on the previous turn.
    #
    # It is what makes a bare "Sehaj Gaba" readable as a name. Any two words
    # look like a name, so unprompted the parser must refuse them — "puri
    # prakriya samjhaiye" is three alphabetic words and was briefly filed as
    # one. Knowing we just asked is the context that makes the guess safe.
    asked_field: str | None = None
    # What Saarthi last put on the table: "days", "day", or "time:2026-08-27".
    # "Yes", "Thursday" and "the 9:30 one" mean nothing without it.
    offered: str | None = None
    # Which language to answer in, decided from the citizen's last message.
    language: str | None = None
    turn_stamps: list[datetime] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Idle time, not total time: a citizen still talking after half an hour must
    # not have the conversation pulled out from under them mid-confirmation.
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# A write-through cache over the `conversations` table, not the only copy.
# Reading every turn back out of the database would be honest and pointless —
# the same process usually answers the next turn seconds later — but a restart
# must not end a conversation, so nothing lives here alone.
_SESSIONS: dict[str, VoiceSession] = {}

# How far back to look for a conversation this citizen was already having, when
# the browser arrives with no session id: a new device, cleared storage, or a
# reload after the server restarted.
RESUME_WINDOW_MINUTES = 180


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _purge_expired() -> None:
    """Evict the in-memory copies. The rows outlive this and are read back."""
    cutoff = _now() - timedelta(minutes=SESSION_TTL_MINUTES)
    for session_id in [key for key, value in _SESSIONS.items() if value.last_seen < cutoff]:
        _SESSIONS.pop(session_id, None)


def _persist(session: VoiceSession) -> None:
    """
    Store the conversation after every turn.

    Cheap — one row, one small JSON blob — and it is what makes a backend
    restart mid-journey survivable. Failures are logged and swallowed: losing
    durability is bad, but failing the citizen's turn because we could not write
    a cache row is worse.
    """
    try:
        convo_store.save({
            "id": session.id,
            "citizen_ref": session.citizen_ref,
            "messages": session.messages,
            "language": session.language,
            "application_id": session.application_id,
            "rto_id": session.rto_id,
            "token_id": session.token_id,
            "offered": session.offered,
            "pending": ({"tool": session.pending.tool,
                         "arguments": session.pending.arguments,
                         "label": session.pending.label}
                        if session.pending else None),
            "created_at": db_stamp(session.created_at),
            "last_seen": db_stamp(session.last_seen),
        })
    except Exception:  # noqa: BLE001 - see docstring
        log.exception("could not persist conversation %s", session.id[:8])


def db_stamp(value: datetime) -> str:
    return value.isoformat()


def _hydrate(row: dict[str, Any]) -> VoiceSession:
    """Rebuild a session from its stored row."""
    session = VoiceSession(id=row["id"], citizen_ref=row["citizen_ref"])
    session.messages = row["messages"]
    session.language = row["language"]
    session.application_id = row["application_id"]
    session.rto_id = row["rto_id"]
    session.token_id = row["token_id"]
    session.offered = row.get("offered")
    if row.get("pending"):
        session.pending = PendingAction(**row["pending"])
    session.created_at = datetime.fromisoformat(row["created_at"])
    session.last_seen = datetime.fromisoformat(row["last_seen"])
    # The form answers are the draft's, not the conversation's. Two
    # conversations by the same person are the same half-filled form.
    session.form_answers = drafts.load(session.citizen_ref)
    session.asked_field = drafts.current_field(session.citizen_ref)
    _SESSIONS[session.id] = session
    return session


def start_session(citizen_ref: str, language: str = "en") -> VoiceSession:
    """
    Open a conversation, already knowing everything the record can tell us.

    Nothing here calls the model. The opening line is composed from stored state
    precisely because the first turn used to cost five to fifty-five seconds to
    produce a sentence the service could have written itself.
    """
    _purge_expired()
    citizen_ref = citizen_ref[:120]

    # Somebody who was mid-conversation and lost their session id — a reload
    # after a restart, a second device — carries on rather than starting over.
    stored = convo_store.latest_for(citizen_ref, RESUME_WINDOW_MINUTES)
    session = _hydrate(stored) if stored else VoiceSession(
        id=str(uuid.uuid4()), citizen_ref=citizen_ref)

    # A confirmation does not survive into a new panel. Reloading in front of
    # the button must keep it — that is what persisting `pending` is for, and
    # `_session_or_404` restores it — but opening Saarthi fresh an hour later
    # must not. Resumed, it answered every turn with "press the confirmation
    # button first" for an action the citizen had long stopped asking for, and
    # there was no way out of it except cancelling something they did not
    # remember requesting. The answers are still on the draft, so the form
    # picks up where it was; only the button goes.
    if session.pending:
        log.info("dropping a confirmation resumed from an older conversation")
        session.pending = None

    # Pick up a journey already in progress before the first word is spoken.
    # Without it a citizen who filled in the wizard and then opened Saarthi to
    # book was told to apply first, and taking that answer filed a second
    # application at the default office — so the appointment ended up on a
    # record the tracker was not showing.
    resumed = existing_journey(citizen_ref)
    session.application_id = resumed.get("application_id") or session.application_id
    session.rto_id = resumed.get("rto_id") or session.rto_id
    session.token_id = resumed.get("token_id") or session.token_id
    if not session.form_answers:
        session.form_answers = drafts.load(citizen_ref)
    if session.language is None:
        session.language = ("Reply in Hindi, in Devanagari script." if language == "hi"
                            else "Reply in English.")

    session.last_seen = _now()
    _SESSIONS[session.id] = session
    _persist(session)
    return session


def end_session(session_id: str) -> None:
    """
    Forget the conversation. Called when the citizen signs out.

    The draft is deliberately kept: it is keyed to their number, so signing back
    in resumes the form. The transcript is not kept, because it holds the name
    and date of birth of whoever was just here.
    """
    _SESSIONS.pop(session_id, None)
    convo_store.drop(session_id)


_CALLER_HITS: dict[str, list[datetime]] = {}


def _charge_rate(bucket: dict[str, list[datetime]], key: str, limit: int, message: str) -> None:
    """
    Record one paid turn against a bucket, or refuse it.

    A plain sliding window over timestamps: old hits fall out of the list as
    they age past the window, so nothing has to be swept on a timer.
    """
    cutoff = _now() - timedelta(minutes=RATE_WINDOW_MINUTES)
    hits = [stamp for stamp in bucket.get(key, []) if stamp > cutoff]
    if len(hits) >= limit:
        bucket[key] = hits
        raise HTTPException(429, message)
    hits.append(_now())
    bucket[key] = hits


def _charge_turn(session: VoiceSession, caller: str | None) -> None:
    _charge_rate(_CALLER_HITS, caller or "unknown", TURNS_PER_CALLER,
                 "Too many voice requests from here. Wait a few minutes.")
    session.turn_stamps = [s for s in session.turn_stamps
                           if s > _now() - timedelta(minutes=RATE_WINDOW_MINUTES)]
    if len(session.turn_stamps) >= TURNS_PER_SESSION:
        raise HTTPException(429, "Saarthi needs a short break. Try again in a few minutes.")
    session.turn_stamps.append(_now())


def _session_or_404(session_id: str) -> VoiceSession:
    _purge_expired()
    session = _SESSIONS.get(session_id)
    if session is None:
        # Not in this process's cache. That used to be the end of the
        # conversation, which meant a backend restart — or a second uvicorn
        # worker picking up the turn — told the citizen their session had
        # expired mid-sentence. It is a row; read it.
        stored = convo_store.load(session_id)
        session = _hydrate(stored) if stored else None
    if not session:
        raise HTTPException(404, "Voice session expired. Start Saarthi again.")
    session.last_seen = _now()
    return session


def _chat_tools() -> list[dict[str, Any]]:
    """Convert the Realtime tool shape to Chat Completions' nested shape."""
    tools: list[dict[str, Any]] = []
    for tool in AGENT_TOOL_SCHEMA:
        name = tool["name"]
        properties = dict(tool.get("parameters", {}).get("properties", {}))
        required = list(tool.get("parameters", {}).get("required", []))

        # Saarthi derives sensitive/internal identifiers from its server session.
        for hidden in ("citizen_id", "citizen_ref", "application_id", "token_id"):
            properties.pop(hidden, None)
            if hidden in required:
                required.remove(hidden)

        tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": tool["description"],
                "parameters": {"type": "object", "properties": properties, "required": required},
            },
        })
    return tools


def _form_state(session: VoiceSession) -> tuple[list[dict], dict[str, Any]]:
    """What the citizen has answered so far, and what is still outstanding."""
    answers = session.form_answers
    missing = missing_application_details(
        str(answers.get("full_name") or ""),
        answers.get("dob"),
        str(answers.get("state") or ""),
        list(answers.get("licence_classes") or []),
    )
    return missing, answers


def _finish_the_form_first(session: VoiceSession) -> dict[str, Any]:
    """The redirect handed back when a slot tool is reached mid-form."""
    missing, answers = _form_state(session)
    return {
        "blocked": "There is no application yet, so there is nothing to book.",
        "have": {k: v for k, v in answers.items() if v},
        "needs": [m["field"] for m in missing],
        "ask_for": missing,
        "next": ("Finish filling the form first. Ask the citizen the next "
                 "outstanding question, then file the application. Do not "
                 "mention days, times or slots until it is filed."),
    }


_MOCK_DISCLOSURE = {
    "en": ("No documents were actually checked — verification is simulated in "
           "this prototype."),
    "hi": ("कोई दस्तावेज़ वास्तव में जाँचा नहीं गया — इस प्रोटोटाइप में सत्यापन नकली है।"),
}


def _with_disclosure(reply: str, result: dict[str, Any], language: str | None) -> str:
    """
    Make sure "verified" is never said on its own.

    The tool hands the model a disclosure and the prompt tells it to pass it on,
    and it still said "your application has been created and verified" with
    nothing after it. That sentence invites a citizen to believe a government
    record was checked, and none was — so the service appends the qualifier
    itself rather than trusting the model to remember it. Skipped when the reply
    already carries it, so nobody is told twice.
    """
    if result.get("verification") != "mocked":
        return reply
    hindi = bool(language and "in Hindi" in language)
    note = _MOCK_DISCLOSURE["hi" if hindi else "en"]
    lowered = reply.lower()
    if "simulat" in lowered or "नकली" in reply or "prototype" in lowered:
        return reply
    return f"{reply.rstrip()} {note}"


def _next_question(session: VoiceSession) -> str | None:
    """
    The next outstanding form question, in the citizen's language.

    Spoken by the service rather than the model: it is the one sentence where
    getting it wrong costs the citizen a repeated question, and there is nothing
    for a language model to add to "what is your date of birth?".
    """
    missing, _ = _form_state(session)
    if not missing:
        session.asked_field = None
        return None
    item = missing[0]
    # Remembered so the answer that comes back can be read without the model.
    session.asked_field = item["field"]
    hindi = bool(session.language and "in Hindi" in session.language)
    return item.get("ask_hi") if hindi and item.get("ask_hi") else item["ask"]


def _form_steer(session: VoiceSession) -> str:
    """
    The state of the form, restated on every single turn.

    The model was asked to hold four answers across four turns and did not: told
    a name, it jumped straight to offering test slots, and only noticed three
    missing fields when the citizen asked whether the form was done. Repeating
    the state as the freshest instruction in the conversation is what stops
    that — it never has to remember, only to read.
    """
    if session.application_id:
        return ("The application is already filed. Do not ask for the name, "
                "date of birth, state or vehicle class again, and do not offer "
                "to fill the form. The next step is booking the test slot.")

    missing, answers = _form_state(session)
    if not missing:
        return ("Every answer needed for the form has been given. File the "
                "application now — do not ask anything further first.")

    have = ", ".join(f"{k} = {v}" for k, v in answers.items() if v) or "nothing yet"
    ask = missing[0]["ask"]
    return (
        "The form is not filed yet. "
        f"Already answered and stored: {have}. "
        f"Still needed: {', '.join(m['field'] for m in missing)}. "
        "If the citizen's last message answered any of these, call "
        "apply_for_licence NOW with that answer — replying without calling it "
        "throws the answer away and you will ask for it again. "
        # The turns that reach the model at all are the ones the service could
        # not answer, which are mostly questions. Told only to ask the next form
        # question, it looked up the fee, said nothing about it, and asked for a
        # date of birth — and did the same to "can I drive alone on a learner
        # licence?", which is a question about the law that deserves an answer.
        "If they asked you something, answer it first, in one or two sentences. "
        f"Then ask this, in the citizen's language: \"{ask}\" "
        "Do not ask again for anything already answered. Do not offer or "
        "mention test slots, days or times until the application is filed. "
        "Never say a date format such as YYYY-MM-DD out loud — accept the date "
        "however they say it."
    )


# --------------------------------------------------------------------------
# The form spine, spoken by the service
#
# Two recorded transcripts, same shape both times: told a name, Saarthi replied
# "which day would you like to book your test slot?" — three answers short of a
# filled form. The second time it went further and said "your application is
# ready" when no application existed, then refused to say the application number
# it had just invented.
#
# Everything built to stop that gated *tool calls*. In both transcripts the
# model called no tools at all. It simply talked, and nothing checked whether
# what it said matched the state the service knew it was in.
#
# So the service stops asking. While the form is being filled, these four
# questions, the confirmation, and the result are composed here — from answers
# we hold — and the model is not consulted. It keeps everything it is actually
# good at: explanations, corrections, objections, and the day-and-time
# negotiation, where "next Thursday morning" is worth paying a round trip for.
# --------------------------------------------------------------------------

def _hindi(session: VoiceSession) -> bool:
    return bool(session.language and "in Hindi" in session.language)


def _say(session: VoiceSession, en: str, hi: str) -> str:
    return hi if _hindi(session) else en


# Someone asking for the journey to start, rather than asking about it.
# "Can you help me apply with the licence" opens with a question word and is not
# a question; "what is a learner licence" opens the same way and is. The
# difference is whether they named an action they want taken for them.
_WANTS_TO_APPLY = re.compile(
    r"\b(i want|i need|i'?d like|help me|can you help|please help|let'?s|start|"
    r"begin|apply|make|get|do)\b[^.?!]{0,40}"
    r"\b(licen[cs]e|ll|learner|appl(?:y|ication)|form|register)\b"
    r"|\b(appl(?:y|ication))\b[^.?!]{0,30}\b(licen[cs]e|ll|learner)\b"
    r"|\b(mujhe|main|mera)\b[^.?!]{0,40}\b(licen[cs]e|licence|ll|banwana|banana|chahiye)\b"
    # A bare imperative, on its own. Anchored at both ends so it cannot swallow
    # "apply aur slot", which names two steps and is the model's to untangle.
    r"|^\s*(appl(?:y|ication)|register|शुरू\s*कर(?:ो|ें)?|आवेदन)\s*[.!।]?\s*$"
    r"|लाइसेंस[^।?]{0,25}(बनवाना|बनाना|चाहिए|करना|लेना)"
    r"|आवेदन[^।?]{0,25}(करना|करन|चाहिए|भरना)"
    r"|फ़?ॉर्म[^।?]{0,25}(भरना|भरन|चाहिए)",
    re.IGNORECASE,
)

# Questions the record answers exactly. These are the ones the model gets most
# confidently wrong, because a plausible answer and a correct one look identical
# to it — it told a citizen "your application is ready" when none existed, and
# then refused to say the number.
_ASKS_NUMBER = re.compile(
    r"\b(application|reference|file)\s*(number|no|id)\b|\bmy number\b"
    r"|आवेदन\s*(संख्या|नंबर)|एप्लिकेशन\s*नंबर", re.IGNORECASE)
_ASKS_FORM_DONE = re.compile(
    r"\b(is|has)\b[^.?!]{0,25}\b(form|application)\b[^.?!]{0,25}"
    r"\b(fill|filled|complete|completed|done|ready|submitted)\b"
    r"|\bform\s+(fully\s+)?(filled|complete|done)\b"
    r"|फ़?ॉर्म[^।?]{0,20}(भर\s*गया|पूरा|तैयार)"
    r"|आवेदन[^।?]{0,20}(पूरा|तैयार|हो\s*गया)", re.IGNORECASE)
_ASKS_STATUS = re.compile(
    r"\b(status|track|tracking|progress|stage|where.{0,20}application)\b"
    r"|\bwhat'?s? (?:the )?(?:track|status)\b"
    r"|स्थिति|स्टेटस|ट्रैक", re.IGNORECASE)
# Deliberately requires an interrogative. A bare "my slot" also appears in
# "book my slot", which is a request to act, not a question about a booking —
# answering it from the record would swallow the one turn that should reach the
# booking flow.
_ASKS_APPOINTMENT = re.compile(
    r"\b(when|what time|which day|what day)\b[^.?!]{0,30}\b(test|slot|appointment|exam)\b"
    r"|\b(when|what|where|is)\b[^.?!]{0,20}\bmy (test|slot|appointment)\b"
    r"|\bmy (test|slot|appointment)\b[^.?!]{0,20}\b(when|what time)\b"
    r"|टेस्ट\s*(कब|कौन)|स्लॉट\s*कब|अपॉइंटमेंट\s*कब", re.IGNORECASE)

# A reply that wandered off the form. Narrow on purpose: it must catch the model
# *offering to book* and *claiming an application exists*, and must not catch a
# straight answer that happens to mention the word "slot" — somebody asking
# "what is the process?" deserves the real answer, which names every step.
#
# Every alternative requires the reply to be *offering*, not describing. A
# pattern that fired on the words "book a test slot" ate the honest answer to
# "what is the whole process?" — which names every step, booking included.
# The negative lookahead is not a nicety. Without it "What is your date of
# birth?" — the service's own question — matched as an offer to book, so the
# guard discarded the correct reply and replaced it with itself, spending a
# round trip and logging a failure that had not happened.
_OFFERS_BOOKING = re.compile(
    r"\b(which|what)\b[^.?!]{0,40}\b(day|date|time|slot)\b(?!\s+of\s+birth)[^.?!]{0,40}\?"
    r"|\b(let'?s|shall (?:we|i)|would you like (?:to|me to)|i can|we can|i'?ll|"
    r"i will|i am going to)\b[^.?!]{0,35}\b(book|schedule|reserve)\b"
    r"|कौन[^।?]{0,25}दिन|स्लॉट\s*बुक\s*कर|टेस्ट\s*बुक\s*कर", re.IGNORECASE)
_CLAIMS_APPLICATION = re.compile(
    r"\b(?:your|the)?\s*(application|form)\b[^.?!]{0,30}"
    r"\b(?:is|has been|was|'s|are)\b[^.?!]{0,25}"
    r"\b(ready|created|filed|submitted|complete|completed|done|filled|verified|registered)\b"
    r"|\b(?:i have|i'?ve|we have|we'?ve)\b[^.?!]{0,25}"
    r"\b(created|filed|submitted|registered)\b[^.?!]{0,25}\b(application|form)\b"
    r"|आवेदन[^।?]{0,25}(तैयार|बन\s*गया|जमा|पूरा|हो\s*गया)", re.IGNORECASE)

_CLASS_WORDS = {
    "MCWG": ("a two-wheeler", "दोपहिया"),
    "LMV-NT": ("a car", "कार"),
}

# States read back inside a Hindi sentence. The stored value is the Latin name,
# because that is what the office catalogue and the wizard both key on — but
# "मेरे पास अनीता कुलकर्णी, Bihar, दोपहिया है" is a sentence in two scripts, and
# a trilingual service should not read one out. Anything unlisted falls back to
# the stored name, which is legible if inelegant.
_STATE_HI = {
    "Maharashtra": "महाराष्ट्र", "Bihar": "बिहार", "Delhi": "दिल्ली",
    "Uttar Pradesh": "उत्तर प्रदेश", "Madhya Pradesh": "मध्य प्रदेश",
    "Karnataka": "कर्नाटक", "Tamil Nadu": "तमिलनाडु", "Telangana": "तेलंगाना",
    "West Bengal": "पश्चिम बंगाल", "Gujarat": "गुजरात", "Rajasthan": "राजस्थान",
    "Kerala": "केरल", "Punjab": "पंजाब", "Haryana": "हरियाणा", "Assam": "असम",
    "Odisha": "ओडिशा", "Jharkhand": "झारखंड", "Chhattisgarh": "छत्तीसगढ़",
    "Uttarakhand": "उत्तराखंड", "Goa": "गोवा", "Chandigarh": "चंडीगढ़",
    "Himachal Pradesh": "हिमाचल प्रदेश", "Jammu and Kashmir": "जम्मू और कश्मीर",
}


_MONTHS_HI_OUT = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
                  "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"]


def _spoken_date(iso: str | None, hindi: bool = False) -> str:
    """
    A stored date read back the way somebody would say it.

    The month is named in the language of the sentence it lands in. "जन्म
    11 April 2008" is one sentence in two scripts, which is exactly what a
    trilingual service should not read out loud.
    """
    if not iso:
        return ""
    try:
        when = date.fromisoformat(iso)
    except ValueError:
        return str(iso)
    if hindi:
        return f"{when.day} {_MONTHS_HI_OUT[when.month - 1]} {when.year}"
    return when.strftime("%d %B %Y").lstrip("0")


def _spoken_classes(session: VoiceSession, classes: list[str]) -> str:
    words = [_CLASS_WORDS.get(c, (c, c))[1 if _hindi(session) else 0] for c in classes]
    if not words:
        return ""
    if len(words) == 1:
        return words[0]
    joiner = " और " if _hindi(session) else " and "
    return joiner.join(words)


def opening_line(session: VoiceSession) -> str:
    """
    What Saarthi says before the citizen has said anything — from the record.

    Read in order of how far along the journey is, because the useful sentence
    is always about the furthest step reached. Costs one database read and no
    model call, which is the entire point: the first turn used to be the slowest
    one in the conversation, and it was spent producing a greeting.
    """
    found = existing_journey(session.citizen_ref)

    if session.token_id:
        try:
            queue = dispatch_tool("check_queue", {"token_id": session.token_id})
            if not queue.get("error"):
                return _say(
                    session,
                    f"You are checked in. You are number "
                    f"{queue.get('position_in_lane', '')} in "
                    f"{queue.get('tester', 'your inspector')}'s line, about "
                    f"{queue.get('eta_minutes', '')} minutes to wait.",
                    f"आप चेक-इन हो चुके हैं। {queue.get('tester', 'आपके निरीक्षक')} की "
                    f"कतार में आपका नंबर {queue.get('position_in_lane', '')} है, "
                    f"लगभग {queue.get('eta_minutes', '')} मिनट का इंतज़ार।")
        except (KeyError, ValueError):
            pass

    appointment = found.get("appointment")
    if appointment:
        return _say(
            session,
            f"Welcome back. Your test is {appointment['day']} at "
            f"{appointment['time']}, with {appointment['tester']} at "
            f"{appointment['office']}. Say check in when you get there.",
            f"वापस स्वागत है। आपका टेस्ट {appointment['day']} को "
            f"{appointment['time']} बजे, {appointment['tester']} के साथ "
            f"{appointment['office']} में है। पहुँचकर कहिए कि चेक-इन करना है।")

    if found.get("application_id"):
        return _say(
            session,
            f"Welcome back. Your application {found.get('application_no', '')} is "
            f"filed at {found.get('office', 'your office')}. The next step is "
            "booking your test — shall I show you the days?",
            f"वापस स्वागत है। आपका आवेदन {found.get('application_no', '')} "
            f"{found.get('office', '')} में दर्ज है। अगला कदम है टेस्ट बुक करना — "
            "दिन दिखाऊँ?")

    # A form started and not finished. This is the sentence the whole draft
    # table exists for: somebody who answered two questions and closed the tab
    # is picked up where they stopped rather than asked all four again.
    if session.form_answers:
        missing, _ = _form_state(session)
        given = _spoken_given(session)
        if missing:
            session.asked_field = missing[0]["field"]
            return _say(
                session,
                f"Welcome back. We were filling your form and I already have "
                f"{given}. {missing[0]['ask']}",
                f"वापस स्वागत है। हम आपका फ़ॉर्म भर रहे थे और मेरे पास "
                f"{given} है। {missing[0].get('ask_hi') or missing[0]['ask']}")
        return _say(
            session,
            f"Welcome back. I have everything I need — {given}. Shall I file "
            "your application?",
            f"वापस स्वागत है। मेरे पास सब कुछ है — {given}। क्या मैं आपका आवेदन "
            "दर्ज कर दूँ?")

    # Nothing on record. Open with the first question rather than an offer to
    # help: they opened Saarthi, so they have already said they want help, and a
    # turn spent confirming that is a turn nobody needed.
    session.asked_field = "full_name"
    return _say(
        session,
        "Hello, I am Saarthi. I can fill your learner-licence form for you — "
        "just answer four questions out loud. What is your full name, first "
        "name and surname?",
        "नमस्ते, मैं सारथी हूँ। मैं आपका लर्नर लाइसेंस फ़ॉर्म भर सकता हूँ — बस चार "
        "सवालों के जवाब बोलिए। आपका पूरा नाम क्या है — नाम और सरनेम?")


def _spoken_given(session: VoiceSession) -> str:
    """The answers already held, read back so the citizen can check them."""
    answers = session.form_answers
    parts: list[str] = []
    if answers.get("full_name"):
        parts.append(str(answers["full_name"]))
    if answers.get("dob"):
        parts.append(_say(session, f"born {_spoken_date(str(answers['dob']))}",
                          f"जन्म {_spoken_date(str(answers['dob']), True)}"))
    if answers.get("state"):
        state = str(answers["state"])
        parts.append(_STATE_HI.get(state, state) if _hindi(session) else state)
    if answers.get("licence_classes"):
        parts.append(_spoken_classes(session, list(answers["licence_classes"])))
    joiner = ", " if len(parts) < 3 else ", "
    return joiner.join(parts) if parts else _say(session, "nothing yet", "अभी कुछ नहीं")


def _known_answer(session: VoiceSession, text: str) -> str | None:
    """
    Questions with one exact answer already in the database.

    These are answered here rather than by the model because the model answered
    all four of them wrong in one recorded conversation: it claimed an
    application was ready when none existed, refused to say a number the prompt
    explicitly permits, and twice ignored the question to offer a slot instead.
    A plausible answer and a correct one are indistinguishable to it; they are
    not indistinguishable to a SELECT.
    """
    asks_number = bool(_ASKS_NUMBER.search(text))
    asks_done = bool(_ASKS_FORM_DONE.search(text))
    asks_status = bool(_ASKS_STATUS.search(text))
    asks_when = bool(_ASKS_APPOINTMENT.search(text))
    if not (asks_number or asks_done or asks_status or asks_when):
        return None

    found = existing_journey(session.citizen_ref)

    if not found.get("application_id"):
        # Nothing filed. Say so, and say what is still needed — this is the
        # sentence that should have been spoken instead of "your application
        # is ready", which is the worst line in either transcript: a citizen
        # who believes it stops, and nothing is waiting for them.
        missing, _ = _form_state(session)
        if missing:
            session.asked_field = missing[0]["field"]
            return _say(
                session,
                f"Not yet — your form is not filed. I still need "
                f"{_spoken_missing(session, missing)}. {missing[0]['ask']}",
                f"अभी नहीं — आपका फ़ॉर्म दर्ज नहीं हुआ है। मुझे अभी "
                f"{_spoken_missing(session, missing)} चाहिए। "
                f"{missing[0].get('ask_hi') or missing[0]['ask']}")
        return _say(
            session,
            "Not yet. I have all your answers but the application is not filed. "
            "Shall I file it now?",
            "अभी नहीं। मेरे पास आपके सारे जवाब हैं पर आवेदन दर्ज नहीं हुआ। "
            "क्या अभी दर्ज कर दूँ?")

    number = found.get("application_no", "")
    if asks_number:
        return _say(session,
                    f"Your application number is {number}.",
                    f"आपका आवेदन नंबर {number} है।")

    appointment = found.get("appointment")
    if asks_when:
        if appointment:
            return _say(
                session,
                f"Your test is {appointment['day']} at {appointment['time']}, "
                f"with {appointment['tester']} at {appointment['office']}.",
                f"आपका टेस्ट {appointment['day']} को {appointment['time']} बजे, "
                f"{appointment['tester']} के साथ {appointment['office']} में है।")
        return _say(session,
                    "You have no appointment yet. Shall I show you the days?",
                    "अभी कोई अपॉइंटमेंट नहीं है। दिन दिखाऊँ?")

    if asks_done:
        return _say(session,
                    f"Yes — your form is filed. It is application {number}, and "
                    f"the next step is {found.get('next_action', 'booking your test')}",
                    f"हाँ — आपका फ़ॉर्म दर्ज हो गया है। आवेदन {number}, और अगला कदम है "
                    f"{found.get('next_action', 'टेस्ट बुक करना')}")

    # Status.
    line = _say(session,
                f"Application {number} at {found.get('office', '')}. "
                f"{found.get('next_action', '')}",
                f"आवेदन {number}, {found.get('office', '')}। "
                f"{found.get('next_action', '')}")
    if appointment:
        line += _say(session,
                     f" Your test is {appointment['day']} at {appointment['time']}.",
                     f" आपका टेस्ट {appointment['day']} को {appointment['time']} बजे है।")
    return line.strip()


def _spoken_missing(session: VoiceSession, missing: list[dict]) -> str:
    names = {
        "full_name": ("your full name", "आपका पूरा नाम"),
        "dob": ("your date of birth", "आपकी जन्मतिथि"),
        "state": ("the state", "राज्य"),
        "licence_classes": ("what you want to drive", "आप क्या चलाना चाहते हैं"),
    }
    words = [names.get(m["field"], (m["field"], m["field"]))[1 if _hindi(session) else 0]
             for m in missing]
    if len(words) == 1:
        return words[0]
    joiner = " और " if _hindi(session) else " and "
    return ", ".join(words[:-1]) + joiner + words[-1]


def _confirm_sentence(session: VoiceSession) -> str:
    """
    What is about to be filed, read back before the button is pressed.

    Four facts the citizen can check against the button. The model used to
    compose this, which cost fifteen seconds and produced "I will create your
    application, please confirm" — true, and impossible to check.
    """
    answers = session.form_answers
    # The same derivation the tool call will use, so the office named before the
    # press and the office on the record cannot disagree.
    office = session.rto_id or _default_rto_for(str(answers.get("state") or ""))
    return _say(
        session,
        f"I will file your application for {answers.get('full_name', '')}, born "
        f"{_spoken_date(str(answers.get('dob') or ''))}, at "
        f"{_office_name(office)}, for "
        f"{_spoken_classes(session, list(answers.get('licence_classes') or []))}. "
        "Press confirm and I will send it.",
        f"मैं {answers.get('full_name', '')} के लिए आवेदन दर्ज करूँगा — जन्म "
        f"{_spoken_date(str(answers.get('dob') or ''), True)}, "
        f"{_office_name(office)}, "
        f"{_spoken_classes(session, list(answers.get('licence_classes') or []))} के लिए। "
        "पुष्टि दबाइए और मैं भेज दूँगा।")


def _queue_application(session: VoiceSession) -> dict[str, Any]:
    """Every answer is in. Raise the confirmation button, saying what it will do."""
    args = _tool_arguments(session, "apply_for_licence", {})
    session.pending = PendingAction(tool="apply_for_licence", arguments=args,
                                    label=_action_label("apply_for_licence"))
    return {
        "reply": _confirm_sentence(session),
        "tool_events": [{"tool": "apply_for_licence", "status": "awaiting_confirmation"}],
        "pending_confirmation": {"label": session.pending.label},
    }


def _store_answers(session: VoiceSession, picked: dict[str, Any]) -> dict[str, Any]:
    """Keep what was just said, then ask the next question or offer to file."""
    session.form_answers.update(picked)
    missing, answers = _form_state(session)
    asking = missing[0]["field"] if missing else None
    try:
        drafts.save(session.citizen_ref, answers, asking)
    except Exception:  # noqa: BLE001 - a lost draft must not lose the turn
        log.exception("could not save draft for %s", session.citizen_ref[:6])
    if not missing:
        return _queue_application(session)
    question = _next_question(session) or ""
    return {"reply": question,
            "tool_events": [{"tool": "apply_for_licence", "status": "collecting"}]}


def _fast_reply(session: VoiceSession, text: str) -> dict[str, Any] | None:
    """
    Answer this turn without the model, or return None and let the model have it.

    Only the turns whose answer the service already holds are taken: the four
    form questions, the confirmation, and the handful of questions the database
    answers exactly. Everything else — explanations, corrections, objections,
    picking a day — falls through, because that is what the model is for.
    """
    # Answered from the record whatever else is going on. Somebody asking "what
    # is my application number?" mid-form is asking a real question, and the
    # answer is either the number or "not yet, and here is what is missing".
    known = _known_answer(session, text)
    if known:
        return {"reply": known, "tool_events": []}

    if session.application_id:
        return _fast_booking(session, text)

    missing, _ = _form_state(session)

    # Answers already complete but never filed — a draft finished in an earlier
    # conversation. Offer to file rather than asking a fifth question.
    if not missing:
        return _queue_application(session)

    # Every outstanding field, not only the one just asked. "I want a learner
    # licence in Patna for a two-wheeler" answers three questions in one breath,
    # and asking them again one at a time is exactly the kind of form-filling
    # this is meant to replace. The office matters most of the three: it decides
    # where the citizen has to travel, and dropping it files them in Mumbai.
    picked = {
        m["field"]: value
        for m in missing
        if (value := read_answer(m["field"], text,
                                 prompted=session.asked_field == m["field"])) is not None
    }

    # A correction to something already answered. "Actually my name is Sehaj
    # Singh Gaba" is not a question and not an outstanding field, so without
    # this it fell through to the model and the wrong spelling stayed on the
    # form. Only fields the citizen announces are re-read — an unannounced
    # phrase cannot overwrite an answer that is already there.
    for done in _FORM_FIELDS:
        if done in picked or done not in session.form_answers:
            continue
        corrected = read_answer(done, text, prompted=False)
        if corrected is not None and corrected != session.form_answers[done]:
            picked[done] = corrected

    if picked:
        # A named place fixes the office outright. Left to the state alone,
        # "Patna" resolves to Bihar and then to Bihar's nearest office, which is
        # Samastipur — ninety kilometres from where they said they would be.
        if "state" in picked and not session.rto_id:
            session.rto_id = read_office(text)
        return _store_answers(session, picked)

    # They asked for the journey to start. Start it, rather than spending ten
    # seconds having the model say "sure, I can help" first.
    if _WANTS_TO_APPLY.search(text):
        return {"reply": _next_question(session) or "", "tool_events": []}

    # An answer we could not read, to a question we definitely asked. Note where
    # it happened — a field people keep failing to answer is a badly worded
    # question, and that is worth knowing — then let the model try.
    if not looks_like_a_question(text) and session.asked_field:
        # missing[0] rather than a local named `field`: this module imports
        # dataclasses.field at the top, and the local that used to shadow it
        # went away with the single-field version of this branch — leaving the
        # function object itself being handed to json.dumps.
        signals.record("form.unparsed", session.citizen_ref,
                       field=missing[0]["field"], reason="not_understood")
    return None


# --------------------------------------------------------------------------
# The booking spine, for the same reason as the form
#
# Handed a day list reading `left: 16, 18, 18, 18, 18`, the model told a citizen
# "all the days I checked are full right now" and offered to look at next week.
# The tool was right and the reply was wrong, which is the failure this whole
# change is about: reading a list back is not a judgement call, and a service
# that has the list should not be asking anybody's opinion of it.
#
# What stays with the model is the part that is genuinely hard — "next Thursday
# morning", "any time after lunch", "the one with the earlier inspector". Only
# the things that resolve cleanly are taken here.
# --------------------------------------------------------------------------

_AFFIRMATIVE = re.compile(
    r"^\s*(yes|yeah|yep|ya|sure|ok|okay|please|go ahead|show me|do it|"
    r"haan|han|ji|theek|thik|bilkul)\b[^a-zऀ-ॿ]*$"
    r"|^\s*(हाँ|हां|जी|ठीक|बिल्कुल|दिखाओ|दिखाइए)\b", re.IGNORECASE)
_ASKS_DAYS = re.compile(
    r"\b(show|list|which|what)\b[^.?!]{0,30}\b(day|days|date|dates)\b"
    r"|\b(book|schedule|reserve)\b[^.?!]{0,25}\b(slot|test|appointment|it)\b"
    r"|\b(free|available|open)\b[^.?!]{0,20}\b(day|days|slot|slots)\b"
    r"|दिन[^।?]{0,15}(दिखा|बता)|स्लॉट[^।?]{0,15}(दिखा|बता)|टेस्ट\s*बुक",
    re.IGNORECASE)

_WEEKDAYS = {d.lower(): i for i, d in enumerate(
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])}
_WEEKDAYS_HI = {"सोमवार": 0, "मंगलवार": 1, "बुधवार": 2, "गुरुवार": 3,
                "शुक्रवार": 4, "शनिवार": 5, "रविवार": 6}
_EARLIEST = re.compile(r"\b(earliest|first|soonest|asap|any|whenever|sabse pehle)\b"
                       r"|सबसे\s*पहल|जल्दी", re.IGNORECASE)
_MORNING = re.compile(r"\b(morning|am|before lunch)\b|सुबह", re.IGNORECASE)
_AFTERNOON = re.compile(r"\b(afternoon|evening|pm|after lunch)\b|दोपहर|शाम", re.IGNORECASE)
_CLOCK = re.compile(r"(?<!\d)(\d{1,2})[:.\s]?(\d{2})?\s*(am|pm)?(?!\d)", re.IGNORECASE)


def _read_day(text: str, days: list[dict]) -> str | None:
    """Which of the offered days the citizen meant, or None to ask the model."""
    lowered = " ".join(text.lower().split())
    open_days = [d for d in days if d.get("left")]
    if not open_days:
        return None
    if _EARLIEST.search(lowered):
        return open_days[0]["date"]
    if re.search(r"\btomorrow\b|कल", lowered):
        target = (date.today() + timedelta(days=1)).isoformat()
        return target if any(d["date"] == target for d in open_days) else None
    if re.search(r"\btoday\b|आज", lowered):
        target = date.today().isoformat()
        return target if any(d["date"] == target for d in open_days) else None

    for day in open_days:
        when = date.fromisoformat(day["date"])
        weekday = when.strftime("%A").lower()
        month = when.strftime("%B").lower()
        # The ISO date, the weekday, or the day number beside its month —
        # "the 27th" alone is left to the model, because a citizen who says it
        # in a week with two 27s is not being precise and neither should we be.
        if (day["date"] in lowered
                or re.search(rf"\b{weekday}\b", lowered)
                or any(hi in text and _WEEKDAYS_HI[hi] == when.weekday()
                       for hi in _WEEKDAYS_HI)
                or re.search(rf"\b{when.day}(?:st|nd|rd|th)?\s+{month[:3]}", lowered)
                or re.search(rf"\b{month[:3]}[a-z]*\s+{when.day}\b", lowered)):
            return day["date"]
    return None


def _read_time(text: str, slots: list[dict]) -> str | None:
    """Which of the offered times, as a slot id, or None."""
    if not slots:
        return None
    lowered = " ".join(text.lower().split())
    if _EARLIEST.search(lowered):
        return slots[0]["slot_id"]

    for found in _CLOCK.finditer(lowered):
        hour, minute, half = int(found[1]), found[2] or "00", (found[3] or "").lower()
        if half == "pm" and hour < 12:
            hour += 12
        if half == "am" and hour == 12:
            hour = 0
        wanted = f"{hour:02d}:{minute}"
        for slot in slots:
            if slot["time"] == wanted:
                return slot["slot_id"]
        # Said "9" and meant 09:30, when 09:30 is the only nine on offer.
        same_hour = [s for s in slots if s["time"].startswith(f"{hour:02d}:")]
        if len(same_hour) == 1 and not found[2]:
            return same_hour[0]["slot_id"]

    if _MORNING.search(lowered):
        early = [s for s in slots if s["time"] < "12:00"]
        return early[0]["slot_id"] if early else None
    if _AFTERNOON.search(lowered):
        late = [s for s in slots if s["time"] >= "12:00"]
        return late[0]["slot_id"] if late else None
    return None


def _speak_days(session: VoiceSession) -> dict[str, Any]:
    """Read the office's open days back, exactly as the engine reports them."""
    found = dispatch_tool("find_slot_days",
                          {"rto_id": session.rto_id or DEFAULT_RTO})
    open_days = [d for d in found["days"] if d.get("left")]
    events = [{"tool": "find_slot_days", "status": "complete", "result": found}]
    if not open_days:
        session.offered = None
        return {"reply": _say(session,
                              f"{found['office']} has nothing free in the next few days.",
                              f"{found['office']} में अगले कुछ दिनों में कुछ खाली नहीं है।"),
                "tool_events": events}

    listed = ", ".join(f"{d['day']} ({d['left']} left)" for d in open_days[:5])
    listed_hi = ", ".join(f"{d['day']} ({d['left']} बचे)" for d in open_days[:5])
    session.offered = "day"
    return {"reply": _say(session,
                          f"At {found['office']} these days are open: {listed}. "
                          "Which one suits you?",
                          f"{found['office']} में ये दिन खुले हैं: {listed_hi}। "
                          "आपको कौन सा ठीक रहेगा?"),
            "tool_events": events}


def _speak_times(session: VoiceSession, on: str) -> dict[str, Any]:
    """Read one day's free times back."""
    found = dispatch_tool("find_slots",
                          {"rto_id": session.rto_id or DEFAULT_RTO, "date": on})
    events = [{"tool": "find_slots", "status": "complete", "result": found}]
    times = found.get("slots") or []
    if not times:
        session.offered = "day"
        return {"reply": _say(session,
                              f"{found.get('day', on)} is full. Say another day and "
                              "I will look again.",
                              f"{found.get('day', on)} भरा हुआ है। दूसरा दिन बताइए, "
                              "मैं फिर देखता हूँ।"),
                "tool_events": events}

    listed = ", ".join(t["time"] for t in times)
    session.offered = f"time:{on}"
    return {"reply": _say(session,
                          f"On {found['day']} there is {listed}. Which time?",
                          f"{found['day']} को {listed} खाली हैं। कौन सा समय?"),
            "tool_events": events}


def _queue_booking(session: VoiceSession, slot_id: str) -> dict[str, Any] | None:
    """Raise the confirmation for one appointment, naming what it will make."""
    args = _tool_arguments(session, "book_slot", {"slot_id": slot_id})
    details = pending_details("book_slot", args)
    if details.get("unavailable"):
        return None                      # let the model explain; it has the case
    session.pending = PendingAction(tool="book_slot", arguments=args,
                                    label=_action_label("book_slot", details))
    session.offered = None
    return {
        "reply": _say(session,
                      f"I will book {details['day']} at {details['time']} with "
                      f"{details['tester']} at {details['office']}. Press confirm.",
                      f"मैं {details['day']} को {details['time']} बजे "
                      f"{details['tester']} के साथ {details['office']} में बुक करूँगा। "
                      "पुष्टि दबाइए।"),
        "tool_events": [{"tool": "book_slot", "status": "awaiting_confirmation"}],
        "pending_confirmation": {"label": session.pending.label},
    }


def _fast_booking(session: VoiceSession, text: str) -> dict[str, Any] | None:
    """
    The booking half, for the turns that resolve without a judgement call.

    Anything ambiguous returns None and the model handles it, which is where
    "next Thursday, some time after lunch" belongs.
    """
    if not session.application_id or session.token_id:
        return None
    # An application holds one appointment; a second request is a question about
    # the first, and _known_answer already answers that.
    booked = existing_journey(session.citizen_ref).get("appointment")
    if booked:
        return None

    affirmative = bool(_AFFIRMATIVE.match(text))

    if session.offered == "day":
        days = dispatch_tool("find_slot_days",
                             {"rto_id": session.rto_id or DEFAULT_RTO})["days"]
        chosen = _read_day(text, days)
        if chosen:
            # "The earliest morning slot" names a day and a time in one breath.
            # Resolving only the day and then asking "which time?" throws half
            # of what they said away and makes the service look like it was not
            # listening. Not for a question, though — "which is the earliest
            # day?" wants to be told, not booked.
            if not looks_like_a_question(text):
                times = dispatch_tool(
                    "find_slots", {"rto_id": session.rto_id or DEFAULT_RTO,
                                   "date": chosen}).get("slots") or []
                at_once = _read_time(text, times)
                if at_once:
                    queued = _queue_booking(session, at_once)
                    if queued:
                        return queued
            return _speak_times(session, chosen)

    if session.offered and session.offered.startswith("time:"):
        on = session.offered.split(":", 1)[1]
        times = dispatch_tool("find_slots",
                              {"rto_id": session.rto_id or DEFAULT_RTO,
                               "date": on}).get("slots") or []
        slot_id = _read_time(text, times)
        if slot_id:
            return _queue_booking(session, slot_id)
        # Still on this day, but they named another one.
        days = dispatch_tool("find_slot_days",
                             {"rto_id": session.rto_id or DEFAULT_RTO})["days"]
        moved = _read_day(text, days)
        if moved and moved != on:
            return _speak_times(session, moved)

    # "Yes" only means the days when the days were what was offered.
    if _ASKS_DAYS.search(text) or (affirmative and session.offered == "days"):
        return _speak_days(session)
    return None


def _guard_reply(session: VoiceSession, reply: str, events: list[dict]) -> str:
    """
    Refuse to speak a reply that contradicts what the service knows.

    The last line, not the mechanism — by the time this runs the form spine has
    already been answered without the model. It exists because in two recorded
    conversations the model reached for booking unprompted while the form was
    three answers short, and once told a citizen "your application is ready"
    when no application existed. A citizen can catch a wrong date. They cannot
    catch that, and if they believe it they stop and wait for something that is
    never coming.
    """
    if session.application_id or not reply:
        return reply

    # The model was told to ask the outstanding question and did. Replacing
    # that with itself costs a round trip and files a failure that never
    # happened, so it is checked before anything else.
    outstanding = _next_question(session)
    if outstanding and outstanding in reply:
        return reply

    if _CLAIMS_APPLICATION.search(reply):
        reason = "claimed_application"
    elif _OFFERS_BOOKING.search(reply):
        reason = "offered_booking"
    else:
        return reply

    missing, _ = _form_state(session)
    if not missing:
        return reply

    log.warning("discarded a reply that %s while the form was unfilled: %r",
                reason, reply[:120])
    signals.record("form.offtrack", session.citizen_ref,
                   field=missing[0]["field"], reason=reason)
    events.append({"tool": "guard", "status": "corrected"})
    session.asked_field = missing[0]["field"]
    return _say(
        session,
        f"Let us finish your form first. {missing[0]['ask']}",
        f"पहले फ़ॉर्म पूरा कर लेते हैं। {missing[0].get('ask_hi') or missing[0]['ask']}")


def _turn_context(language: str | None, form: str = "") -> str:
    """
    The things that have to be the freshest instruction in the conversation:
    what day it is, where the form has got to, and which language to answer in.

    The model has no clock. Asked for "the 25th" it still has to hand find_slots
    a YYYY-MM-DD, and with nothing to count from it invented one — so the tool
    searched a different day than the citizen had asked about and the reply
    quoted a third. ``date.today()`` deliberately, not UTC: this must be the same
    day the booking engine builds its slot grids for.
    """
    today = date.today()
    note = (f"Today is {today.strftime('%A, %d %B %Y')} ({today.isoformat()}). "
            "Work out any day the citizen names from this, and pass it to "
            "find_slots as YYYY-MM-DD. That format is for the tool only — never "
            "say it, or any other format, to the citizen.")
    parts = [note, form, language]
    return " ".join(p for p in parts if p)


def _call_nvidia(messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None,
                 language: str | None = None, form: str = "") -> dict[str, Any]:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise HTTPException(503, "Voice agent is not configured. Set NVIDIA_API_KEY on the server.")

    payload: dict[str, Any] = {
        "model": NVIDIA_MODEL,
        # The date and language steer go last, after the whole conversation: a
        # rule in the system prompt is many turns away by the time it matters,
        # and the model kept answering English questions in Hindi.
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages,
                     {"role": "system", "content": _turn_context(language, form)}],
        # Low: the same sentence twice matters less than the same *decision*
        # twice. At 0.3 the opening turn sometimes asked which step the citizen
        # wanted instead of starting the application, which stalls the journey
        # in front of whoever is watching.
        "temperature": 0.1,
        # Devanagari costs far more tokens per character than Latin text, and at
        # 350 a Hindi reply was being cut off mid-sentence.
        "max_tokens": 700,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    # One retry: a single dropped connection mid-journey would otherwise end the
    # turn with an error the citizen can do nothing about. The log line matters
    # as much as the retry — the generic 502 text alone told us nothing about
    # why a turn failed.
    response = None
    for attempt in range(2):
        try:
            response = httpx.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                # Generous on read, tight on connect. A turn that decides to
                # call a tool reasons for noticeably longer than one that just
                # answers, and 45s was cutting those off — the citizen got "could
                # not reach the language service" for the turns that were doing
                # the most work. An unreachable host still fails in seconds.
                timeout=httpx.Timeout(90.0, connect=10.0),
            )
            break
        except httpx.HTTPError as exc:
            log.warning("NVIDIA request failed (attempt %d/2): %r", attempt + 1, exc)
            if attempt:
                raise HTTPException(502, "Saarthi could not reach the language service.") from exc

    assert response is not None
    if response.status_code >= 400:
        log.warning("NVIDIA returned %d: %s", response.status_code, response.text[:400])
        raise HTTPException(502, "Saarthi language service returned an error.")

    try:
        return response.json()["choices"][0]["message"]
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(502, "Saarthi received an invalid language-service response.") from exc


def _tool_arguments(session: VoiceSession, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
    args = dict(arguments)
    if tool in {"get_journey_status", "start_practice_test"}:
        args["citizen_id"] = session.citizen_ref
    if tool == "apply_for_licence":
        # Keep whatever this call actually supplied, then put every answer the
        # citizen has ever given back on top of it. The model has to carry only
        # the newest answer; if it forgets the earlier three they are still here.
        # A re-answered field overwrites the old one, so a correction sticks.
        session.form_answers.update(
            {k: v for k, v in args.items()
             if k in _FORM_FIELDS and v not in (None, "", [])})
        args.update(session.form_answers)
        # Answers the model captured are the citizen's answers too, so they go
        # to the same place as the ones read here — otherwise a conversation
        # that happened to go through the model would not be resumable.
        try:
            outstanding, _ = _form_state(session)
            drafts.save(session.citizen_ref, session.form_answers,
                        outstanding[0]["field"] if outstanding else None)
        except Exception:  # noqa: BLE001 - a lost draft must not lose the turn
            log.exception("could not save draft for %s", session.citizen_ref[:6])
        args["citizen_ref"] = session.citizen_ref
        args.setdefault("licence_kind", "learner")
        # The state decides the office when nothing else has. This used to
        # default to mh01 outright, which was survivable only because the model
        # was expected to call list_offices and pass an rto_id first — and the
        # service now fills the form without it. Somebody who says "Patna" must
        # not be given an appointment in Mumbai.
        args.setdefault("rto_id",
                        session.rto_id or _default_rto_for(str(args.get("state") or "")))
    # Slot searches follow the application's office unless the citizen asked for
    # a different one by name. Defaulting to mh01 regardless is how someone who
    # applied in Samastipur was read Andheri's times and booked there.
    if tool in {"find_slots", "find_slot_days"}:
        args.setdefault("rto_id", session.rto_id or DEFAULT_RTO)
    if tool in {"book_slot", "check_in"}:
        if not session.application_id:
            raise ValueError("No application is active yet. Apply first.")
        args["application_id"] = session.application_id
    if tool == "check_queue":
        if not session.token_id:
            raise ValueError("No queue token yet. Check in at the RTO first.")
        args["token_id"] = session.token_id
    return args


def _remember_ids(session: VoiceSession, result: dict[str, Any]) -> None:
    if result.get("application_id"):
        session.application_id = str(result["application_id"])
        # Only an application fixes the office. find_slot_days and find_slots
        # report an rto_id too, and taking it from those would let "what's free
        # in Patna?" repoint a Mumbai application at Patna's grid.
        if result.get("rto_id"):
            session.rto_id = str(result["rto_id"])
    if result.get("token_id"):
        session.token_id = str(result["token_id"])


def _action_label(tool: str, details: dict[str, Any] | None = None) -> str:
    if tool == "apply_for_licence":
        return "Create your learner-licence application"
    if tool == "book_slot":
        # Name the appointment on the button too — the same four facts the
        # wizard's confirm card shows. "Book the selected test appointment"
        # gives the citizen nothing to check the spoken sentence against, which
        # is precisely how a wrong date and inspector got past them: what they
        # pressed and what they heard were unrelated strings.
        if details and details.get("time"):
            return (f"Book {details['day']}, {details['time']} with "
                    f"{details['tester']} at {details['office']}")
        return "Book the selected test appointment"
    if tool == "check_in":
        return "Check in and issue your live queue token"
    return tool.replace("_", " ").capitalize()


# What to tell the model when the slot it chose cannot be booked. Raised before
# the gate rather than after the press: a confirmation button that is certain to
# fail costs the citizen a turn and tells them nothing they can act on.
def _unbookable(details: dict[str, Any]) -> str:
    reason = details["unavailable"]
    if reason == "already_booked":
        # The one case with something to say rather than something to retry, so
        # it is said here in full: the citizen asking to book again is usually
        # someone who does not believe the first one worked.
        return (f"This application already holds an appointment on {details['day']} "
                f"at {details['time']} with {details['tester']} at "
                f"{details['office']}. Tell the citizen that, in their language, "
                "rather than booking anything.")
    if reason == "passed":
        return ("That time has already gone today. Look up the slots again and offer "
                "one that is still ahead.")
    if reason == "taken":
        return "That time has just been taken. Look up the slots again and offer another one."
    return ("That appointment is not on offer. Look up the slots again and pass "
            "one of the slot ids they come back with.")


def _tool_message(call_id: str, result: dict[str, Any]) -> dict[str, Any]:
    return {"role": "tool", "tool_call_id": call_id, "content": json.dumps(result, ensure_ascii=False)}


_ROMAN_HINDI = {
    "mujhe", "mera", "meri", "mere", "main", "aap", "aapka", "kya", "kyu", "hai",
    "hain", "ho", "hoon", "karo", "kar", "karna", "karni", "kijiye", "chahiye",
    "kab", "kaise", "kahan", "kaun", "nahi", "haan", "jaldi", "batao", "bataiye",
    "dikhao", "dikhaiye", "pahunch", "pahuncha", "gaya", "gayi", "banwana",
    "chahta", "chahti", "theek", "acha", "phir", "abhi", "bhi", "aur", "wala",
    "baari", "samay", "din", "paisa", "kitna", "kitne", "lena", "dena", "milega",
}


def _language_steer(text: str) -> str | None:
    """
    Pin the reply to the language of this message, decided here rather than
    left to the model.

    Asked in English it kept answering in Hindi, and a prompt rule alone did not
    hold it — the instruction sits far back in a long conversation while the
    citizen's words are right there. Deciding per turn and restating it as the
    last instruction before the reply is what actually holds.
    """
    if any("ऀ" <= ch <= "ॿ" for ch in text):
        return "Reply in Hindi, in Devanagari script."
    words = {w.strip(".,!?;:").lower() for w in text.split()}
    if words & _ROMAN_HINDI:
        return ("Reply in Hinglish — romanised Hindi in Latin script, the way the "
                "citizen just wrote. Do not use Devanagari and do not switch to "
                "plain English.")
    return "Reply in English."


# Every line the service speaks itself, rather than getting from the model. They
# are reached whenever the answer channel comes back empty, which is often enough
# to matter: asked "I want a learner licence" in English, the citizen was told
# "कृपया स्क्रीन पर पुष्टि करें" because the fallback was a hardcoded Hindi
# string. The whole point of the per-turn language steer is defeated if the
# service's own words ignore it.
_FALLBACKS: dict[str, dict[str, str]] = {
    "press_confirm_first": {
        "en": "Press the confirmation button on screen first, or cancel it and ask me something new.",
        "hi": "पहले स्क्रीन पर दिख रहे पुष्टि बटन को दबाइए, या रद्द करके नया सवाल पूछिए।",
    },
    "ready_to_help": {
        "en": "I am here to help with your licence.",
        "hi": "मैं आपकी मदद के लिए तैयार हूँ।",
    },
    "please_confirm": {
        "en": "Please confirm on screen.",
        "hi": "कृपया स्क्रीन पर पुष्टि करें।",
    },
    "must_pause": {
        "en": "I have to stop at this step for now. Please say that again.",
        "hi": "मुझे अभी एक कदम पर रुकना होगा। कृपया फिर से कहिए।",
    },
    "done_see_screen": {
        "en": "Done. The details are on screen.",
        "hi": "हो गया। स्क्रीन पर विवरण देखिए।",
    },
    # Said twice that it would act and called nothing both times. The citizen
    # must not be left holding "I will create your application, please confirm"
    # when there is no button and nothing was queued — the one outcome the
    # confirmation gate exists to prevent.
    "could_not_start": {
        "en": "Sorry — I could not start that just now, and nothing has been "
              "submitted. Please say it again, or use the form on screen.",
        "hi": "क्षमा करें — मैं अभी वह शुरू नहीं कर सका, और कुछ भी जमा नहीं हुआ है। "
              "कृपया दोबारा कहिए, या स्क्रीन पर दिए फ़ॉर्म का उपयोग कीजिए।",
    },
}


def _fallback(key: str, language: str | None) -> str:
    """
    The service's own words, in the language this turn was decided to be in.

    ``language`` is the steer sentence built by ``_language_steer``, so Hindi is
    the only one that names a script; Hinglish and English both take the Latin
    line, which is the right call for romanised Hindi too.
    """
    variants = _FALLBACKS[key]
    return variants["hi"] if language and "in Hindi" in language else variants["en"]


def _clean_tool_name(raw: str | None) -> str:
    """
    Strip gpt-oss harmony channel markers out of a function name.

    The model emits names like ``book_slot<|channel|>commentary``. Left alone
    that fails as an unknown tool, and the model burns one of its few rounds
    re-issuing the same call with a clean name — on a mutating tool that is a
    round it may not have to spare.
    """
    name = (raw or "").strip()
    for marker in ("<|", "\n", " "):
        name = name.split(marker, 1)[0]
    return name


# Harmony artefacts that show up inside content when the model means to call a
# tool but has none offered: a literal <call to=functions.x>{...}</call>, or a
# bare channel token. Spoken aloud these are gibberish, so they never ship.
_CALL_MARKUP = re.compile(r"<call\b[^>]*>.*?(?:</call>|$)", re.DOTALL | re.IGNORECASE)
_CHANNEL_TOKEN = re.compile(r"<\|[^|]*\|>")


def _spoken_text(message: dict[str, Any]) -> str:
    """
    What to actually say — the answer channel, stripped of machinery.

    ``reasoning_content`` is deliberately ignored. gpt-oss can return an empty
    ``content`` with its scratchpad populated, and speaking that reads the
    model's deliberation and the system prompt out to the citizen: "User wants
    slot. We should pick one. But guidelines say...". Silence handled by the
    caller is better than that.

    The markup strip matters on the final tool-free call: with no tools offered
    the model still wants one, so it writes the call into its answer and the
    citizen hears "<call to=functions.explain_ll_step>...".
    """
    text = message.get("content") or ""
    text = _CALL_MARKUP.sub("", text)
    text = _CHANNEL_TOKEN.sub("", text)
    return text.strip()


def _nudge_for_speech(session: VoiceSession) -> str:
    """
    Ask once more for a spoken sentence when the answer channel came back empty.

    Cheaper than leaving the citizen with a canned line, and bounded to a single
    extra call so an empty reply cannot turn into a loop.
    """
    session.messages.append({
        "role": "user",
        "content": "Say that to me in one or two short spoken sentences. No ids, no JSON.",
    })
    return _spoken_text(_call_nvidia(session.messages, None, session.language, _form_steer(session)))


def _parse_tool_arguments(raw: str | None) -> dict[str, Any]:
    try:
        value = json.loads(raw or "{}")
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        return {}


def _run_tool_calls(session: VoiceSession, tool_calls: list[dict[str, Any]],
                    events: list[dict[str, Any]]) -> None:
    """
    Answer every tool call in the batch, in order.

    The transport requires exactly one tool message per requested call id. A
    turn that leaves any of them unanswered is rejected by the model endpoint on
    every subsequent request, so a single batch of parallel calls would end the
    conversation for good — and the citizen would be told an action failed after
    it had already run. Each call therefore gets a result even once the turn is
    gated; the ones behind the gate are told they were deferred rather than
    being quietly executed while the citizen is still deciding.
    """
    for call in tool_calls:
        function = call.get("function") or {}
        tool = _clean_tool_name(function.get("name"))
        call_id = call.get("id") or str(uuid.uuid4())

        if session.pending:
            result: dict[str, Any] = {
                "deferred": True,
                "reason": f"Waiting for the citizen to confirm: {session.pending.label}",
            }
            events.append({"tool": tool or "unknown", "status": "deferred"})
            session.messages.append(_tool_message(call_id, result))
            continue

        try:
            args = _tool_arguments(session, tool, _parse_tool_arguments(function.get("arguments")))
            if tool in _NEEDS_APPLICATION and not session.application_id:
                # Not an error to apologise for — a redirect back to the step the
                # citizen is actually on, carrying the next question to ask.
                result = _finish_the_form_first(session)
                events.append({"tool": tool, "status": "redirected"})
                session.messages.append(_tool_message(call_id, result))
                continue
            # A half-filled form is not an action to confirm. Called with two of
            # four answers, this used to raise a confirmation button reading
            # "Create your learner-licence application" — offering to file
            # something that cannot be filed. Instead it collects: the answers
            # land on the session and the reply carries the next question.
            if tool == "apply_for_licence" and _form_state(session)[0]:
                result = dispatch_tool(tool, args)
                events.append({"tool": tool, "status": "collecting"})
                session.messages.append(_tool_message(call_id, result))
                continue

            if tool in MUTATING_TOOLS:
                details = pending_details(tool, args)
                if details.get("unavailable"):
                    raise ValueError(_unbookable(details))
                session.pending = PendingAction(tool=tool, arguments=args,
                                                label=_action_label(tool, details))
                # The resolved appointment goes back to the model, not just the
                # label: asked to turn a bare "requires_confirmation" into a
                # spoken sentence it had nothing to read the date, time and
                # inspector off, so it supplied its own and got all three wrong.
                result = {"requires_confirmation": True, "label": session.pending.label,
                          **({"appointment": details} if details else {})}
                events.append({"tool": tool, "status": "awaiting_confirmation"})
            else:
                result = dispatch_tool(tool, args)
                _remember_ids(session, result)
                events.append({"tool": tool, "status": "complete"})
        except (KeyError, ValueError) as exc:
            result = {"error": str(exc)}
            events.append({"tool": tool or "unknown", "status": "error"})
        session.messages.append(_tool_message(call_id, result))


def _reply(session: VoiceSession, user_text: str,
           charge: Any = None) -> dict[str, Any]:
    if session.pending:
        return {
            "reply": _fallback("press_confirm_first", session.language),
            "tool_events": [],
            "pending_confirmation": {"label": session.pending.label},
        }

    session.messages.append({"role": "user", "content": user_text[:1000]})
    # Restated on every turn, right after what the citizen said, so the language
    # decision is the freshest instruction in the conversation.
    session.language = _language_steer(user_text)

    # Everything the service already knows the answer to is answered here, with
    # no upstream call at all. That is the four form questions, the
    # confirmation, and the questions the record answers exactly — six or seven
    # round trips of eight to fifty-five seconds each, on the one journey the
    # whole site exists for. The transcript still gets both sides, so the model
    # has the full conversation whenever a turn does reach it.
    fast = _fast_reply(session, user_text)
    if fast is not None:
        session.messages.append({"role": "assistant", "content": fast["reply"]})
        return fast

    # Charged here, not at the top of the turn. The limits exist because every
    # turn used to be a paid upstream call on an endpoint with no login in front
    # of it — and most turns no longer are. Charging for the ones the service
    # answers itself meant somebody filling in a form by voice could exhaust
    # their budget without the language service being touched once, and be told
    # to wait a few minutes by a service that had done no work.
    if charge is not None:
        charge()

    events: list[dict[str, Any]] = []
    # Only ever spent once per turn, so a model that keeps promising instead of
    # calling cannot loop the citizen — it gets one correction, then whatever it
    # says stands.
    nudged_to_act = False

    for _ in range(MAX_TOOL_ROUNDS):
        message = _call_nvidia(session.messages, _chat_tools(), session.language, _form_steer(session))
        tool_calls = message.get("tool_calls") or []
        session.messages.append({
            "role": "assistant",
            "content": message.get("content") or "",
            **({"tool_calls": tool_calls} if tool_calls else {}),
        })
        if not tool_calls:
            spoken = _spoken_text(message)

            # Said it would act, but ran nothing. Left alone this is the worst
            # outcome the gate can produce: the citizen is told their
            # application is being created, no button appears because nothing
            # was queued, and the next turn the model believes it already did it.
            if spoken and not nudged_to_act and not events and _PROMISED_ACTION.search(spoken):
                nudged_to_act = True
                log.info("model promised an action without calling a tool; asking again")
                session.messages.append({
                    "role": "system",
                    "content": ("You said you would do that but called no tool, so nothing has "
                                "happened and the citizen has no confirmation button. Call the "
                                "tool now. Do not describe it again."),
                })
                continue

            # Nudged already and it still only talked about acting. Saying so
            # plainly beats letting the promise stand: the citizen would wait
            # for a button that is never coming, and believe an application
            # exists that does not.
            if spoken and nudged_to_act and not events and _PROMISED_ACTION.search(spoken):
                log.warning("model promised an action twice without calling a tool")
                return {"reply": _fallback("could_not_start", session.language),
                        "tool_events": events}

            spoken = spoken or _nudge_for_speech(session)
            spoken = _guard_reply(session, spoken, events)
            return {"reply": spoken or _fallback("ready_to_help", session.language),
                    "tool_events": events}

        _run_tool_calls(session, tool_calls, events)

        # Collecting a form answer: say the next question ourselves.
        #
        # The service already knows exactly what is outstanding and how to ask
        # it, so sending the conversation back to the model to paraphrase that
        # costs another ten to eighteen seconds and can come back wrong — it was
        # re-asking questions already answered, which is what started all this.
        # Deterministic, instant, and the same words every time.
        if any(e["status"] == "collecting" for e in events):
            question = _next_question(session)
            if question:
                session.messages.append({"role": "assistant", "content": question})
                return {"reply": question, "tool_events": events}

        if session.pending:
            # Let the model turn the confirmation request into spoken language.
            final = _call_nvidia(session.messages, None, session.language, _form_steer(session))
            session.messages.append({"role": "assistant", "content": _spoken_text(final)})
            return {
                "reply": _spoken_text(final) or _fallback("please_confirm", session.language),
                "tool_events": events,
                "pending_confirmation": {"label": session.pending.label},
            }

    # Rounds spent, but the model has been gathering facts the whole way — a
    # broad question ("explain the whole process") legitimately costs four
    # lookups. Ask once more with no tools offered, so it has to answer in
    # words with what it already has instead of the citizen getting an apology.
    last = _call_nvidia(session.messages, None, session.language, _form_steer(session))
    spoken = _guard_reply(session, _spoken_text(last), events)
    session.messages.append({"role": "assistant", "content": spoken})
    return {"reply": spoken or _fallback("must_pause", session.language),
            "tool_events": events}


_VERIFIED_CLAIM = re.compile(r"\bverif(?:ied|ication)\b|सत्यापित|वेरिफ", re.IGNORECASE)


def _qualify_verified(reply: str, session: VoiceSession) -> str:
    """
    Never let "verified" stand alone, on any turn.

    The confirmation itself is handled where the result is known, but the model
    keeps saying it afterwards too — asked "is my form fully filled?" it
    answered "your application is fully filled and verified". Nothing was
    checked against any government record, and a citizen has no way to know that
    from the sentence. Applied at the turn boundary so no reply path can miss it.
    """
    if not (reply and session.application_id and _VERIFIED_CLAIM.search(reply)):
        return reply
    return _with_disclosure(reply, {"verification": "mocked"}, session.language)


def turn(session_id: str, transcript: str, caller: str | None = None) -> dict[str, Any]:
    session = _session_or_404(session_id)
    # Only when a call will actually be made. A turn refused because an action
    # is awaiting confirmation costs nothing upstream, and neither does one the
    # service answers from the record — so neither eats the caller's budget.
    answer = _reply(session, transcript,
                    None if session.pending else lambda: _charge_turn(session, caller))
    answer["reply"] = _qualify_verified(answer.get("reply", ""), session)
    _persist(session)
    return {"session_id": session.id, **answer}


def _applied_sentence(session: VoiceSession, result: dict[str, Any]) -> str:
    """
    What happened, said by the service rather than described by the model.

    Composed here for two reasons. It removes the last upstream call on the
    apply journey — the citizen presses Confirm and hears the answer at once,
    rather than watching a spinner for ten seconds after the work is already
    done. And it makes the mock-verification disclosure structural: the model
    was handed that sentence, told to pass it on, and dropped it twice in one
    conversation. Somebody who believes a government record was checked has been
    misled by this service, and no amount of prompting has been enough to stop
    that happening.
    """
    number = result.get("application_no", "")
    office = result.get("office", "")
    disclosure = _MOCK_DISCLOSURE["hi" if _hindi(session) else "en"]
    return _say(
        session,
        f"Done — your application {number} is filed at {office}. {disclosure} "
        "The next step is booking your test. Shall I show you the days?",
        f"हो गया — आपका आवेदन {number} {office} में दर्ज हो गया है। {disclosure} "
        "अगला कदम है टेस्ट बुक करना। दिन दिखाऊँ?")


def confirm(session_id: str, caller: str | None = None) -> dict[str, Any]:
    session = _session_or_404(session_id)
    pending = session.pending
    if not pending:
        raise HTTPException(409, "There is no action awaiting confirmation.")

    session.pending = None
    try:
        result = dispatch_tool(pending.tool, pending.arguments)
        _remember_ids(session, result)
    except (KeyError, ValueError) as exc:
        result = {"error": str(exc)}

    # The application is the one action whose result the service can state
    # exactly, so it does. No upstream call, no charge, and the disclosure is
    # part of the sentence rather than something a model is asked to remember.
    if pending.tool == "apply_for_licence" and result.get("application_id"):
        try:
            drafts.clear(session.citizen_ref)
        except Exception:  # noqa: BLE001 - the application is filed either way
            log.exception("could not clear draft for %s", session.citizen_ref[:6])
        reply = _applied_sentence(session, result)
        # The reply ends "shall I show you the days?", so a bare "yes" on the
        # next turn has something to mean.
        session.offered = "days"
        session.messages.append({"role": "assistant", "content": reply})
        _persist(session)
        return {"session_id": session.id, "reply": reply,
                "tool_events": [{"tool": pending.tool, "status": "complete",
                                 "result": result}]}

    # The appointment, read back from what was actually booked rather than
    # narrated. The model has invented a date, a time and an inspector here
    # before — all three wrong, all three after the booking had already been
    # made, so the sentence and the record disagreed about the same event.
    if pending.tool == "book_slot" and result.get("ok"):
        session.offered = None
        reply = _say(
            session,
            f"Booked — {result['day']} at {result['time']}, with "
            f"{result['tester']} at {result['office']}. Arrive a little early "
            "and say check in when you get there.",
            f"बुक हो गया — {result['day']} को {result['time']} बजे, "
            f"{result['tester']} के साथ {result['office']} में। थोड़ा जल्दी "
            "पहुँचिए और वहाँ पहुँचकर कहिए कि चेक-इन करना है।")
        session.messages.append({"role": "assistant", "content": reply})
        _persist(session)
        return {"session_id": session.id, "reply": reply,
                "tool_events": [{"tool": pending.tool, "status": "complete",
                                 "result": result}]}

    # Everything else is narrated by the model, so it costs a call.
    _charge_turn(session, caller)

    # End the transcript on a user turn that asks for speech. Handing the model
    # its own assistant message full of JSON made it carry on writing JSON
    # instead of talking to the citizen.
    session.messages.append({
        "role": "user",
        "content": (f"I pressed Confirm. The service ran {pending.tool} and it returned: "
                    f"{json.dumps(result, ensure_ascii=False)}. Tell me in one or two spoken "
                    "sentences what happened and what I should do next. No ids, no JSON."),
    })
    final = _call_nvidia(session.messages, None, session.language, _form_steer(session))
    reply = _spoken_text(final) or _fallback("done_see_screen", session.language)
    reply = _with_disclosure(reply, result, session.language)
    session.messages.append({"role": "assistant", "content": reply})
    _persist(session)
    return {"session_id": session.id, "reply": reply, "tool_events": [{"tool": pending.tool, "status": "complete", "result": result}]}


def cancel_pending(session_id: str) -> dict[str, Any]:
    """Discard a requested action; cancelling in the UI must cancel server state too."""
    session = _session_or_404(session_id)
    if not session.pending:
        return {"session_id": session.id, "cancelled": False}
    session.pending = None
    _persist(session)
    return {"session_id": session.id, "cancelled": True}

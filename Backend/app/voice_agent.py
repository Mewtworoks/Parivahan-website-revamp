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

from .agent_tools import (
    AGENT_TOOL_SCHEMA,
    DEFAULT_RTO,
    dispatch_tool,
    existing_journey,
    pending_details,
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

If the citizen says they want a licence, start the application on that turn.
Do not open by asking which part they need help with — they told you. There is
nothing to book, check into or track until an application exists, so every
other step depends on this one.

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
    # Which language to answer in, decided from the citizen's last message.
    language: str | None = None
    turn_stamps: list[datetime] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Idle time, not total time: a citizen still talking after half an hour must
    # not have the conversation pulled out from under them mid-confirmation.
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_SESSIONS: dict[str, VoiceSession] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _purge_expired() -> None:
    cutoff = _now() - timedelta(minutes=SESSION_TTL_MINUTES)
    for session_id in [key for key, value in _SESSIONS.items() if value.last_seen < cutoff]:
        _SESSIONS.pop(session_id, None)


def start_session(citizen_ref: str) -> VoiceSession:
    _purge_expired()
    session = VoiceSession(id=str(uuid.uuid4()), citizen_ref=citizen_ref[:120])
    # Pick up a journey already in progress before the first word is spoken.
    # Without it a citizen who filled in the wizard and then opened Saarthi to
    # book was told to apply first, and taking that answer filed a second
    # application at the default office — so the appointment ended up on a
    # record the tracker was not showing.
    resumed = existing_journey(session.citizen_ref)
    session.application_id = resumed.get("application_id")
    session.rto_id = resumed.get("rto_id")
    session.token_id = resumed.get("token_id")
    _SESSIONS[session.id] = session
    return session


def end_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)


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


def _turn_context(language: str | None) -> str:
    """
    The two things that have to be the freshest instruction in the conversation:
    what day it is, and which language to answer in.

    The model has no clock. Asked for "the 25th" it still has to hand find_slots
    a YYYY-MM-DD, and with nothing to count from it invented one — so the tool
    searched a different day than the citizen had asked about and the reply
    quoted a third. ``date.today()`` deliberately, not UTC: this must be the same
    day the booking engine builds its slot grids for.
    """
    today = date.today()
    note = (f"Today is {today.strftime('%A, %d %B %Y')} ({today.isoformat()}). "
            "Work out any day the citizen names from this, and pass it to "
            "find_slots as YYYY-MM-DD.")
    return f"{note} {language}" if language else note


def _call_nvidia(messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None,
                 language: str | None = None) -> dict[str, Any]:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise HTTPException(503, "Voice agent is not configured. Set NVIDIA_API_KEY on the server.")

    payload: dict[str, Any] = {
        "model": NVIDIA_MODEL,
        # The date and language steer go last, after the whole conversation: a
        # rule in the system prompt is many turns away by the time it matters,
        # and the model kept answering English questions in Hindi.
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages,
                     {"role": "system", "content": _turn_context(language)}],
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
                timeout=45,
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
        args["citizen_ref"] = session.citizen_ref
        args.setdefault("licence_kind", "learner")
        args.setdefault("rto_id", session.rto_id or DEFAULT_RTO)
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
    return _spoken_text(_call_nvidia(session.messages, None, session.language))


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


def _reply(session: VoiceSession, user_text: str) -> dict[str, Any]:
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
    events: list[dict[str, Any]] = []
    # Only ever spent once per turn, so a model that keeps promising instead of
    # calling cannot loop the citizen — it gets one correction, then whatever it
    # says stands.
    nudged_to_act = False

    for _ in range(MAX_TOOL_ROUNDS):
        message = _call_nvidia(session.messages, _chat_tools(), session.language)
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
            return {"reply": spoken or _fallback("ready_to_help", session.language),
                    "tool_events": events}

        _run_tool_calls(session, tool_calls, events)

        if session.pending:
            # Let the model turn the confirmation request into spoken language.
            final = _call_nvidia(session.messages, None, session.language)
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
    last = _call_nvidia(session.messages, None, session.language)
    spoken = _spoken_text(last)
    session.messages.append({"role": "assistant", "content": spoken})
    return {"reply": spoken or _fallback("must_pause", session.language),
            "tool_events": events}


def turn(session_id: str, transcript: str, caller: str | None = None) -> dict[str, Any]:
    session = _session_or_404(session_id)
    # Charged before the model is called, and only when a call will actually be
    # made: a turn refused because an action is awaiting confirmation costs
    # nothing upstream, so it must not eat the caller's budget either.
    if not session.pending:
        _charge_turn(session, caller)
    return {"session_id": session.id, **_reply(session, transcript)}


def confirm(session_id: str, caller: str | None = None) -> dict[str, Any]:
    session = _session_or_404(session_id)
    pending = session.pending
    if not pending:
        raise HTTPException(409, "There is no action awaiting confirmation.")

    # Confirming narrates the result through the model, so it costs a call too.
    _charge_turn(session, caller)
    session.pending = None
    try:
        result = dispatch_tool(pending.tool, pending.arguments)
        _remember_ids(session, result)
    except (KeyError, ValueError) as exc:
        result = {"error": str(exc)}

    # End the transcript on a user turn that asks for speech. Handing the model
    # its own assistant message full of JSON made it carry on writing JSON
    # instead of talking to the citizen.
    session.messages.append({
        "role": "user",
        "content": (f"I pressed Confirm. The service ran {pending.tool} and it returned: "
                    f"{json.dumps(result, ensure_ascii=False)}. Tell me in one or two spoken "
                    "sentences what happened and what I should do next. No ids, no JSON."),
    })
    final = _call_nvidia(session.messages, None, session.language)
    reply = _spoken_text(final) or _fallback("done_see_screen", session.language)
    session.messages.append({"role": "assistant", "content": reply})
    return {"session_id": session.id, "reply": reply, "tool_events": [{"tool": pending.tool, "status": "complete", "result": result}]}


def cancel_pending(session_id: str) -> dict[str, Any]:
    """Discard a requested action; cancelling in the UI must cancel server state too."""
    session = _session_or_404(session_id)
    if not session.pending:
        return {"session_id": session.id, "cancelled": False}
    session.pending = None
    return {"session_id": session.id, "cancelled": True}

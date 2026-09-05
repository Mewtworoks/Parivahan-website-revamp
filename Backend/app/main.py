"""
FastAPI backend for the reimagined Parivahan LL/DL journey.

Three real failures of the current portal, three fixed flows:
  * silent/buggy apply      -> POST /apply is idempotent, status always readable
  * "come in the morning"   -> fixed slot grid, atomically booked
  * pile-ups and no info    -> live queue token with a recomputed ETA

Endpoints:
  POST /apply                          idempotent apply (retry-safe)
  GET  /application/{id}               transparency ledger
  GET  /application/{id}/receipt       tamper-evident proof-of-journey
  GET  /citizen/{ref}/application      latest application for a citizen
  GET  /slots                          free fixed time-slots
  POST /book                           atomic hold; 409 if just taken
  POST /checkin/{app_id}               issue live queue token
  GET  /queue/{token_id}               position + tester + live ETA
  POST /tester/{id}/call-next          advance the queue
  GET  /rto/{id}/board                 waiting-hall / tester dashboard
  POST /test/start                     begin a scenario test (see / for the count)
  GET  /test/{attempt_id}/next         next scenario (answer stripped)
  POST /test/{attempt_id}/answer       submit an answer, get feedback
  GET  /test/{attempt_id}/result       final result + competency breakdown
  POST /test/{attempt_id}/proctor      proctoring subsystem posts events
  GET  /agent/tools                    function-tool schema for the copilot
  POST /agent/dispatch                 execute an agent tool call

Run:  python main.py      (or: uvicorn app.main:app --reload)
"""

from __future__ import annotations

import logging
import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# .env.example tells you to copy it to .env, so .env has to be read — and read
# before any module below it calls os.getenv at import time. A real environment
# variable already set in the shell wins, which is what a deployment expects.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from . import booking_engine as be
from . import engine
from . import identity
from . import proofs
from . import signals
from .agent_tools import AGENT_TOOL_SCHEMA, DEFAULT_RTO, dispatch_tool
from . import voice_agent
from .booking_engine import AlreadyBooked, SlotPassed, SlotTaken
from .booking_models import LicenceKind
from .models import AttemptStatus, PASS_THRESHOLD, QUESTIONS_PER_TEST
from .seed_scenarios import SCENARIOS, scenario_by_id

log = logging.getLogger(__name__)

app = FastAPI(
    title="Parivahan LL/DL Journey — Reimagined",
    description="Idempotent apply, atomic slot booking, live queue, scenario test.",
    version="1.0.0",
)

# Explicit origins keep credentialed requests working; "*" is the hackathon
# default so a teammate's dev server on any port can call in.
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # A wildcard origin with credentials is rejected by browsers, so only
    # allow credentials when the origins are named.
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------- request bodies -------------------------------

class StartBody(BaseModel):
    citizen_id: str  # Aadhaar-linked ref; real auth handled upstream


class AnswerBody(BaseModel):
    scenario_id: str
    chosen_option_id: str
    time_taken_s: float = Field(0.0, ge=0)


class ProctorBody(BaseModel):
    flag: str


class DispatchBody(BaseModel):
    tool: str
    arguments: dict = Field(default_factory=dict)


class VoiceStartBody(BaseModel):
    citizen_ref: str = Field(..., min_length=1, max_length=120)
    # Which language to open in. The greeting is composed before the citizen has
    # said anything, so there is nothing to detect it from — and greeting an
    # English reader in Hindi is an invitation to answer in Hindi, which is not
    # what they chose.
    language: str = Field("en", max_length=8)
    # What the citizen already chose at sign-in. Optional, and seeded only into
    # a gap — asking somebody for their state a second time because the agent
    # keeps a draft the rest of the site cannot see is the service failing to
    # talk to itself.
    #
    # The office travels with it or not at all. A state on its own resolves to
    # the first office in that state, which for Bihar is Samastipur — ninety
    # kilometres from Patna, and exactly the mistake `read_office` exists to
    # prevent.
    state: str | None = Field(None, max_length=60)
    rto_id: str | None = Field(None, max_length=40)


class VoiceTurnBody(BaseModel):
    session_id: str
    transcript: str = Field(..., min_length=1, max_length=1000)
    # Sent on every turn, not just at the start, so switching the picker
    # mid-conversation takes effect on the next reply.
    language: str = Field("en", max_length=8)


class VoiceConfirmBody(BaseModel):
    session_id: str
    language: str = Field("en", max_length=8)


class ApplyBody(BaseModel):
    citizen_ref: str
    licence_kind: LicenceKind
    rto_id: str = DEFAULT_RTO
    idempotency_key: str      # client-generated; makes retries safe
    # Carried so the tracker can authenticate a lookup by number + DOB, and
    # so the slip and receipt can be rendered from server state.
    dob: str | None = None
    applicant_name: str | None = None
    licence_classes: list[str] = Field(default_factory=list)


class BookBody(BaseModel):
    application_id: str
    slot_id: str


# Open the store — a previous run's applications, bookings and queue are
# already in it, because the database is the state rather than a copy of it.
# Then seed, which fills in any office or day it does not yet have and is safe
# to run over live data, and safe to run from two workers at once.
be.restore()
be.seed_catalogue()


# --------------------- Journey: apply -> book -> queue ---------------------

def _application_view(a) -> dict:
    """One shape for an application, wherever it is looked up from."""
    out = {
        "application_id": a.id,
        "application_no": a.display_no,
        "status": a.status.value,
        "licence_kind": a.licence_kind.value,
        "rto_id": a.rto_id,
        "applicant_name": a.applicant_name,
        "dob": a.dob,
        "licence_classes": a.licence_classes,
        "created_at": a.created_at.isoformat(),
        "booking_id": a.booking_id,
        "token_id": a.token_id,
        "ledger": [e.model_dump() for e in a.ledger],
    }
    rto = next((r for r in be.list_rtos() if r.id == a.rto_id), None)
    if rto:
        out["rto"] = {"id": rto.id, "name": rto.name, "area": rto.area,
                      "state": rto.state}
    if a.booking_id:
        b = be.get_booking(a.booking_id)
        if b:
            out["booking"] = {
                "booking_id": b.id,
                "date": str(b.slot_date),
                "label": b.slot_date.strftime("%a %d %b"),
                "time": b.start.strftime("%I:%M %p").lstrip("0").lower(),
                "tester_id": b.tester_id,
            }
    if a.token_id:
        # A token the application still points at but the store no longer holds
        # is survivable; a 500 on the tracker is not. `POST /demo/reset` clears
        # the tokens while a browser goes on holding the id it was given, so the
        # one screen whose whole purpose is "always readable, never a blank" was
        # answering the reset button with a stack trace. The queue is the part
        # that is missing, so the queue is the part that is left out.
        try:
            out["queue"] = be.queue_status(a.token_id)
        except KeyError:
            log.info("application %s points at a token that is gone", a.id)
    return out


@app.post("/apply", tags=["journey"])
def apply(body: ApplyBody):
    """Resilient, idempotent application. Retry-safe by design."""
    try:
        app_obj = be.apply(body.citizen_ref, body.licence_kind, body.rto_id,
                           body.idempotency_key, dob=body.dob,
                           applicant_name=body.applicant_name,
                           licence_classes=body.licence_classes)
    except PermissionError as e:
        # A key that already created somebody else's application. Refused rather
        # than answered, because the answer would be that person's record.
        raise HTTPException(403, e.args[0])
    return _application_view(app_obj)


@app.get("/application/{app_id}", tags=["journey"])
def application_status(app_id: str):
    """
    Transparency: the full journey ledger, always readable.

    Deliberately ungated, unlike the by-number lookup below, and the difference
    is the identifier rather than the data. `app_id` is a v4 uuid — 122 bits, not
    enumerable — so holding one is itself the evidence you were given it. The
    display number is sequential (SS-2026-004182, then ...183), so anyone can
    count through the office's applications; that path is the one that has to ask
    for a date of birth.

    A uuid as a bearer capability is right for a prototype and is not an
    authentication story. In production this sits behind the same Aadhaar/mobile
    session the rest of the portal uses, and this endpoint checks it belongs to
    the caller.
    """
    a = be.get_application(app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    return _application_view(a)


@app.get("/application/by-number/{application_no}", tags=["journey"])
def application_by_number(application_no: str, dob: str | None = None):
    """
    Tracker lookup — application number plus date of birth, the two things the
    citizen is given on the slip. A wrong DOB is a 404, never a partial reveal.
    """
    a = be.find_by_number(application_no, dob)
    if not a:
        raise HTTPException(404, "No application matches that number and date of birth")
    return _application_view(a)


@app.get("/application/{app_id}/receipt", tags=["journey"])
def receipt(app_id: str):
    """
    Tamper-evident proof-of-journey. The hash chain means no one — no clerk,
    no middleman — can alter, insert, or drop a step without chain_valid
    flipping to false. This is the citizen's proof they earned their pass.
    """
    a = be.get_application(app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    return a.receipt()


@app.get("/citizen/{citizen_ref}/application", tags=["journey"])
def latest_application(citizen_ref: str):
    """Resume where you left off — no need to remember an application id."""
    a = be.latest_application_for(citizen_ref)
    if not a:
        raise HTTPException(404, "No application for this citizen")
    return application_status(a.id)


@app.get("/rtos", tags=["journey"])
def rtos(state: str | None = None):
    """
    The offices an applicant can choose, nearest first. `wait` and `load` are
    computed from the live queues, so "Light day" means the lanes are actually
    short right now rather than a fixture saying so.
    """
    out = []
    for r in be.list_rtos(state):
        p = be.office_pressure(r.id)
        out.append({
            "id": r.id, "name": r.name, "area": r.area, "state": r.state,
            "km": r.km, "load": p["load"],
            "wait": f"Avg wait once you arrive: {p['wait_minutes']} min",
            "wait_minutes": p["wait_minutes"], "waiting_now": p["waiting"],
            "lanes": p["lanes"],
        })
    return {"state": state, "count": len(out), "rtos": out}


@app.get("/slots/days", tags=["journey"])
def slot_days(rto_id: str = DEFAULT_RTO):
    """The bookable date strip, with a real count of what is left per day."""
    return {"rto_id": rto_id, "days": be.slot_days(rto_id)}


@app.get("/slots/times", tags=["journey"])
def slot_times(rto_id: str = DEFAULT_RTO, on: date | None = None):
    """
    The time strip for one day. Times are grouped across inspectors: the
    applicant picks when, the system picks the lane.
    """
    when = on or date.today()
    return {"rto_id": rto_id, "date": str(when),
            "times": be.slot_times(rto_id, when)}


@app.get("/slots", tags=["journey"])
def free_slots(rto_id: str = DEFAULT_RTO, on: date | None = None):
    """Free fixed time-slots, earliest first."""
    when = on or date.today()
    slots = be.list_free_slots(rto_id, when)
    return {"rto_id": rto_id, "date": str(when), "count": len(slots),
            "slots": [{"slot_id": s.id, "start": s.start.strftime("%H:%M"),
                       "tester_id": s.tester_id} for s in slots[:50]]}


def _note_lost_slot(application_id: str, slot_id: str, reason: str) -> None:
    """
    Note that somebody reached a slot and did not get it.

    Reads the office and day back off the slot rather than trusting the caller,
    and stays silent if either lookup fails — a citizen who has just lost a slot
    is the worst possible person to hand a second error to.
    """
    try:
        slot = be.get_slot(slot_id)
        app_obj = be.get_application(application_id)
        signals.record("slot.lost", app_obj.citizen_ref if app_obj else "",
                       rto_id=slot.rto_id if slot else None,
                       day=str(slot.slot_date) if slot else None,
                       reason=reason)
    except Exception:  # noqa: BLE001 - telemetry must not break the reply
        pass


@app.post("/book", tags=["journey"])
def book(body: BookBody):
    """Atomically hold a fixed time-slot. One winner per slot, guaranteed."""
    try:
        b = be.book_slot(body.application_id, body.slot_id)
    except SlotTaken:
        # Recorded here rather than inside book_slot: that claim runs inside
        # BEGIN IMMEDIATE, and a signal written there would be a transaction
        # opened inside a transaction. The losing side is also the only side
        # worth counting — an office that loses races is an office short an
        # inspector, which is the whole point of keeping the number.
        _note_lost_slot(body.application_id, body.slot_id, "taken")
        raise HTTPException(409, "That slot was just taken — pick another.")
    except AlreadyBooked:
        raise HTTPException(409, "This application already holds an appointment.")
    except SlotPassed:
        _note_lost_slot(body.application_id, body.slot_id, "passed")
        raise HTTPException(409, "That time has already passed — pick a later one.")
    except KeyError as e:
        # e.args[0], not str(e): str() on a KeyError includes the repr of the
        # key, so the detail reached the browser as "'Unknown slot'" — quotes
        # and all — and got rendered to the citizen that way.
        raise HTTPException(404, e.args[0])
    tester = be.get_tester(b.tester_id)
    return {"booking_id": b.id, "start": b.start.strftime("%H:%M"),
            "time": b.start.strftime("%I:%M %p").lstrip("0").lower(),
            "tester_id": b.tester_id, "tester": tester.name if tester else None,
            "date": str(b.slot_date), "label": b.slot_date.strftime("%a %d %b")}


@app.post("/checkin/{application_id}", tags=["journey"])
def checkin(application_id: str):
    """On arrival: issue a live queue token. Safe to call twice."""
    try:
        t = be.check_in(application_id)
    except KeyError as e:
        # Shown to the citizen verbatim on the tracker, so it has to read as a
        # sentence rather than as a repr. See the note on /book above.
        raise HTTPException(400, e.args[0])
    return {"token_id": t.id, "token_number": t.number, "tester_id": t.tester_id}


@app.get("/queue/{token_id}", tags=["journey"])
def queue(token_id: str):
    """What the citizen watches on their phone: position + live ETA."""
    try:
        return be.queue_status(token_id)
    except KeyError:
        raise HTTPException(404, "Token not found")


@app.post("/tester/{tester_id}/call-next", tags=["journey"])
def call_next(tester_id: str):
    """Tester-side: finish current, call next. Advances everyone's ETA."""
    if be.get_tester(tester_id) is None:
        raise HTTPException(404, "Tester not found")
    nxt = be.call_next(tester_id)
    return {"now_serving": nxt.number if nxt else None}


@app.get("/rto/{rto_id}/board", tags=["journey"])
def board(rto_id: str):
    """Waiting-hall display: every lane, who is being served, how deep."""
    return be.rto_board(rto_id)


# ----------------------------- Scenario test -------------------------------

@app.post("/test/start", tags=["test"])
def start_test(body: StartBody):
    try:
        attempt = engine.build_test(body.citizen_id)
    except engine.BankTooSmall as e:
        raise HTTPException(503, f"Scenario bank not ready: {e}")
    return {
        "attempt_id": attempt.id,
        "total_questions": len(attempt.scenario_ids),
        "pass_threshold": PASS_THRESHOLD,
    }


@app.get("/test/{attempt_id}/next", tags=["test"])
def next_question(attempt_id: str):
    attempt = engine.get_attempt(attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    sid = engine.next_scenario_id(attempt)
    if sid is None:
        return {"done": True, "index": attempt.current_index}
    scenario = scenario_by_id(sid)
    return {
        "done": False,
        "index": attempt.current_index,
        "total": len(attempt.scenario_ids),
        # Options are permuted per attempt so the answer's position tells the
        # candidate nothing — see engine.serve_scenario.
        "scenario": engine.serve_scenario(attempt_id, scenario).model_dump(),
    }


@app.post("/test/{attempt_id}/answer", tags=["test"])
def answer_question(attempt_id: str, body: AnswerBody):
    attempt = engine.get_attempt(attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    try:
        rec = engine.submit_answer(
            attempt, body.scenario_id, body.chosen_option_id, body.time_taken_s
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    scenario = scenario_by_id(body.scenario_id)
    if not rec.correct:
        # The one signal with a curriculum behind it: which competency the most
        # people get wrong is what a road-safety syllabus should be reading, and
        # nobody needs a name attached to answer it. The chosen option is kept
        # because "everyone picks the same wrong answer" and "everyone guesses
        # differently" are different problems with different fixes.
        signals.record("test.wrong", attempt.citizen_id,
                       competency=scenario.competency.value,
                       scenario_id=body.scenario_id,
                       chosen_option_id=body.chosen_option_id)
    # A pass is the end of the learner's journey, so it belongs on the sealed
    # record rather than only in the browser that happened to be open. Recorded
    # here rather than in the result route because this is the mutation — the
    # answer that finishes the attempt — and a GET should not write.
    #
    # Never allowed to break the answer. Somebody who has just passed being
    # shown a 500 instead of their result is a far worse failure than a missing
    # ledger row, and `record_learner_pass` is idempotent, so a retry costs
    # nothing.
    if attempt.status == AttemptStatus.PASSED:
        try:
            be.record_learner_pass(attempt.citizen_id)
        except Exception:  # noqa: BLE001 - the result is the citizen's, the row is ours
            log.exception("could not record the pass for attempt %s", attempt_id)

    return {
        "correct": rec.correct,
        # feedback teaches, per the "learning not just pass/fail" goal
        "correct_option_id": scenario.correct_option_id,
        "explanation": scenario.explanation,
        "mv_act_ref": scenario.mv_act_ref,
        "score_so_far": attempt.score,
        "answered": attempt.current_index,
        "total": len(attempt.scenario_ids),
        "status": attempt.status.value,
    }


@app.get("/test/{attempt_id}/result", tags=["test"])
def result(attempt_id: str):
    attempt = engine.get_attempt(attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    return {
        "status": attempt.status.value,
        "score": attempt.score,
        "total": len(attempt.scenario_ids),
        "pass_threshold": PASS_THRESHOLD,
        "proctor_flags": attempt.proctor_flags,
        # what to go practise, instead of a bare fail
        "by_competency": attempt.competency_breakdown(),
    }


@app.post("/test/{attempt_id}/proctor", tags=["test"])
def proctor(attempt_id: str, body: ProctorBody):
    attempt = engine.get_attempt(attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    engine.record_proctor_event(attempt, body.flag)
    return {"status": attempt.status.value, "flags": attempt.proctor_flags}


# ------------------------- AI voice agent wiring ---------------------------

@app.get("/agent/tools", tags=["agent"])
def agent_tools():
    """
    Function-tool schema, for a client that owns its own model socket.

    The frontend does not need this — it talks to /agent/voice/*, which keeps
    the key server-side. Exposed because the schema is model-agnostic and the
    same tools should be drivable from a Realtime session someone else holds.
    """
    return {"tools": AGENT_TOOL_SCHEMA}


@app.post("/agent/dispatch", tags=["agent"])
def agent_dispatch(body: DispatchBody):
    """The Realtime agent calls a tool -> your client forwards it here."""
    try:
        return dispatch_tool(body.tool, body.arguments)
    except KeyError as e:
        raise HTTPException(400, f"Unknown tool or missing argument: {e}")


def _caller(request: Request) -> str | None:
    """
    Who to bill a voice turn to, for rate limiting only.

    Behind a proxy the socket address is the proxy, so the forwarded chain's
    first hop is preferred when one is present. This is not identity and is
    never stored on the conversation — it is spoofable, and only decides who
    gets throttled.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


# --------------------------- Identity (a stand-in) -------------------------
# Not authentication — app/identity.py says so at length and so does the screen
# that uses it. Its whole job is to give the wizard, the agent and the tracker
# one `citizen_ref` instead of three, so `latest_application_for()` can find the
# journey somebody already started.


class PhoneBody(BaseModel):
    phone: str = Field(..., min_length=6, max_length=20)


class VerifyBody(BaseModel):
    phone: str = Field(..., min_length=6, max_length=20)
    code: str = Field(..., min_length=1, max_length=8)


@app.post("/identity/request-code", tags=["identity"])
def identity_request_code(body: PhoneBody):
    """
    Issue a sign-in code — and return it, because nothing here sends an SMS.

    The response says `delivered: false` and carries a note explaining why, so a
    client cannot present this as a real one-time password without ignoring the
    field that tells it not to.
    """
    try:
        return identity.request_code(body.phone)
    except identity.BadPhone as exc:
        raise HTTPException(400, str(exc))


@app.post("/identity/verify", tags=["identity"])
def identity_verify(body: VerifyBody):
    """Exchange the code for the reference the rest of the journey is keyed on."""
    try:
        return identity.verify(body.phone, body.code)
    except identity.BadPhone as exc:
        raise HTTPException(400, str(exc))
    except identity.BadCode as exc:
        raise HTTPException(401, str(exc))


@app.post("/agent/voice/start", tags=["agent"])
def agent_voice_start(body: VoiceStartBody):
    """
    Open a Saarthi conversation, resuming one already in progress.

    The greeting comes back with it, composed from what the record already says
    about this citizen — an appointment, a filed application, a half-finished
    form — and costs no upstream call. The opening turn used to be the slowest
    one in the conversation, and it was spent producing "hello, I am Saarthi".
    """
    session = voice_agent.start_session(body.citizen_ref, body.language,
                                        known_state=body.state,
                                        known_rto=body.rto_id)
    return {
        "session_id": session.id,
        "expires_in_minutes": voice_agent.SESSION_TTL_MINUTES,
        "greeting": voice_agent.opening_line(session),
        # Whether this picked up something already under way, so the panel can
        # show the transcript it has rather than opening on a blank one.
        "resumed": bool(session.application_id or session.form_answers),
    }


@app.post("/agent/voice/turn", tags=["agent"])
def agent_voice_turn(body: VoiceTurnBody, request: Request):
    """Send recognised speech to NVIDIA and return Saarthi's spoken reply."""
    return voice_agent.turn(body.session_id, body.transcript, _caller(request), body.language)


@app.post("/agent/voice/confirm", tags=["agent"])
def agent_voice_confirm(body: VoiceConfirmBody, request: Request):
    """Execute Saarthi's pending state-changing action after a citizen confirms."""
    return voice_agent.confirm(body.session_id, _caller(request), body.language)


@app.post("/agent/voice/cancel", tags=["agent"])
def agent_voice_cancel(body: VoiceConfirmBody):
    """Discard the voice action the citizen chose not to confirm."""
    return voice_agent.cancel_pending(body.session_id)


@app.delete("/agent/voice/{session_id}", status_code=204, tags=["agent"])
def agent_voice_end(session_id: str):
    voice_agent.end_session(session_id)


# ------------------------- proofs (the demo panel) -------------------------
# The three hard guarantees are invisible on the happy path. These run them for
# real against the engine and report what happened, so they can be watched.

@app.post("/proof/idempotent-apply", tags=["proof"])
def proof_idempotent_apply():
    """Submit the same application twice, as a dropped connection does."""
    return proofs.idempotent_apply()


@app.post("/proof/slot-race", tags=["proof"])
def proof_slot_race(contenders: int = 8):
    """Genuine simultaneous bookings at one slot. Exactly one may win."""
    return proofs.slot_race(max(2, min(contenders, 32)))


@app.post("/proof/booking-load", tags=["proof"])
def proof_booking_load(applicants: int = 120):
    """A rush: more people than slots, all pressing together. Prices the guarantee."""
    return proofs.booking_load(max(2, min(applicants, 400)))


@app.post("/proof/ledger-tamper", tags=["proof"])
def proof_ledger_tamper():
    """Edit a recorded event and show the receipt reporting it."""
    return proofs.ledger_tamper()


# -------------------------- what the service learns --------------------------

@app.get("/signals/summary", tags=["proof"])
def signals_summary(limit: int = 20):
    """
    Where people fail, in aggregate, with no way back to who they were.

    Deliberately unauthenticated. Every row behind this is an HMAC of a citizen
    reference and an allowlisted handful of fields — there is nothing here to
    protect, and a service that says it learns from failure should be able to
    show the working. See app/signals.py for what makes that a property rather
    than a promise.
    """
    return signals.summary(max(1, min(limit, 50)))


@app.post("/demo/reset", tags=["proof"])
def demo_reset():
    """
    Back to a clean slate: no applications, no bookings, an empty queue.

    After a walkthrough the first slot of the day is held and tokens are already
    issued, so the next run reads as someone else's leftovers.
    """
    be.reset_state()
    return {"reset": True, "offices": len(be.list_rtos())}


# ------------------------------- meta --------------------------------------

@app.get("/", tags=["meta"])
def root():
    return {
        "status": "online",
        "service": "Parivahan LL/DL journey — reimagined",
        "docs": "/docs",
        "questions_per_test": QUESTIONS_PER_TEST,
        "pass_threshold": PASS_THRESHOLD,
        "scenario_bank": len(SCENARIOS),
    }


@app.get("/api/health", tags=["meta"])
def health_check():
    """Kept at the path the frontend scaffold already probes."""
    return {"status": "healthy", "service": "Parivahan Backend",
            "rtos": [r.id for r in be.list_rtos()]}

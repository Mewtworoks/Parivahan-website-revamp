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
  POST /test/start                     begin a 15-scenario test
  GET  /test/{attempt_id}/next         next scenario (answer stripped)
  POST /test/{attempt_id}/answer       submit an answer, get feedback
  GET  /test/{attempt_id}/result       final result + competency breakdown
  POST /test/{attempt_id}/proctor      proctoring subsystem posts events
  GET  /agent/tools                    OpenAI Realtime function-tool schema
  POST /agent/dispatch                 execute an agent tool call

Run:  python main.py      (or: uvicorn app.main:app --reload)
"""

from __future__ import annotations

import os
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import booking_engine as be
from . import engine
from .agent_tools import AGENT_TOOL_SCHEMA, DEFAULT_RTO, dispatch_tool
from .booking_engine import AlreadyBooked, SlotTaken
from .booking_models import LicenceKind
from .models import PASS_THRESHOLD, QUESTIONS_PER_TEST
from .seed_scenarios import SCENARIOS, scenario_by_id

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


# Seed every office the UI can offer, with grids for the days ahead.
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
        out["queue"] = be.queue_status(a.token_id)
    return out


@app.post("/apply", tags=["journey"])
def apply(body: ApplyBody):
    """Resilient, idempotent application. Retry-safe by design."""
    app_obj = be.apply(body.citizen_ref, body.licence_kind, body.rto_id,
                       body.idempotency_key, dob=body.dob,
                       applicant_name=body.applicant_name,
                       licence_classes=body.licence_classes)
    return _application_view(app_obj)


@app.get("/application/{app_id}", tags=["journey"])
def application_status(app_id: str):
    """Transparency: the full journey ledger, always readable."""
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


@app.post("/book", tags=["journey"])
def book(body: BookBody):
    """Atomically hold a fixed time-slot. One winner per slot, guaranteed."""
    try:
        b = be.book_slot(body.application_id, body.slot_id)
    except SlotTaken:
        raise HTTPException(409, "That slot was just taken — pick another.")
    except AlreadyBooked:
        raise HTTPException(409, "This application already holds an appointment.")
    except KeyError as e:
        raise HTTPException(404, str(e))
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
        raise HTTPException(400, str(e))
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
    """Function-tool schema to register with the OpenAI Realtime session."""
    return {"tools": AGENT_TOOL_SCHEMA}


@app.post("/agent/dispatch", tags=["agent"])
def agent_dispatch(body: DispatchBody):
    """The Realtime agent calls a tool -> your client forwards it here."""
    try:
        return dispatch_tool(body.tool, body.arguments)
    except KeyError as e:
        raise HTTPException(400, f"Unknown tool or missing argument: {e}")


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

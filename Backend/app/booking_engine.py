"""
The engine that makes the flow *not break*.

Three guarantees, each answering one real failure of the current system:

  1. Idempotent apply — retrying a submit (flaky network, impatient user)
     never creates duplicates and never loses the application. The status is
     always readable. This is what stops the retry-storm that overloads infra.

  2. Atomic slot booking — under concurrency, a fixed time-slot goes to
     exactly one applicant. No double-booking, ever. Proven by a concurrency
     test in tests/test_concurrency.py.

  3. Live queue with recomputed ETA — on the day, each applicant has a token,
     a named tester and a wait estimate that updates as the tester clears people.

In-memory + a threading.Lock for the demo. In production the same shapes map
to Postgres with a UNIQUE constraint on (slot_id) and SELECT ... FOR UPDATE /
INSERT ... ON CONFLICT for the atomic booking — noted inline where it matters.
"""

from __future__ import annotations

import threading
import uuid
from datetime import date, datetime, time, timedelta, timezone

from .booking_models import (
    Application,
    AppStatus,
    Booking,
    LicenceKind,
    QueueToken,
    RTO,
    Slot,
    Tester,
    TokenStatus,
)

# ---- in-memory stores (swap for Postgres tables in prod) -----------------
_APPS: dict[str, Application] = {}
_APPS_BY_IDEM: dict[str, str] = {}          # idempotency_key -> application_id
_APPS_BY_CITIZEN: dict[str, list[str]] = {} # citizen_ref -> application ids, oldest first
_APPS_BY_NUMBER: dict[str, str] = {}        # display_no -> application_id
_RTOS: dict[str, RTO] = {}
_TESTERS: dict[str, Tester] = {}
_SLOTS: dict[str, Slot] = {}
_SLOT_DAYS: set[tuple[str, date]] = set()   # (rto_id, date) grids already built
_BOOKINGS: dict[str, Booking] = {}
_TOKENS: dict[str, QueueToken] = {}
_TOKEN_SEQ: dict[str, int] = {}             # rto_id -> last token number

# Application numbers start here so the first one issued reads SS-2026-004182,
# the number the UI copy and the seeded tracker example both use.
_APP_SEQ = 4181

# The offices the UI offers. Two states are modelled; the rest of the state
# list in the picker falls back to the Maharashtra set, same as the frontend.
RTO_CATALOGUE: list[dict] = [
    {"id": "mh01", "name": "Andheri RTO (MH-01)", "area": "Andheri West, Mumbai",
     "city": "Mumbai", "state": "Maharashtra", "km": 3.2},
    {"id": "mh02", "name": "Wadala RTO (MH-02)", "area": "Wadala East, Mumbai",
     "city": "Mumbai", "state": "Maharashtra", "km": 8.6},
    {"id": "mh03", "name": "Borivali RTO (MH-47)", "area": "Borivali East, Mumbai",
     "city": "Mumbai", "state": "Maharashtra", "km": 14.1},
    {"id": "br33", "name": "DTO, Samastipur (BR-33)", "area": "Samastipur, Bihar",
     "city": "Samastipur", "state": "Bihar", "km": 4.1},
    {"id": "br06", "name": "DTO, Darbhanga (BR-06)", "area": "Darbhanga, Bihar",
     "city": "Darbhanga", "state": "Bihar", "km": 38.5},
    {"id": "br01", "name": "DTO, Patna (BR-01)", "area": "Patna, Bihar",
     "city": "Patna", "state": "Bihar", "km": 92.0},
]

# Three inspectors per office, so a time slot can show a realistic "n left".
_TESTER_TEMPLATE = [("Inspector A", 12), ("Inspector B", 10), ("Inspector C", 14)]

# How many days ahead the booking grid runs.
SLOT_DAYS_AHEAD = 6

# One lock guards the mutations that must be atomic. In Postgres this is the
# row lock / unique constraint; here a single process lock is faithful enough
# to demonstrate the guarantee.
_LOCK = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SlotTaken(Exception):
    """Two applicants raced for one slot; this one lost."""


class AlreadyBooked(Exception):
    """The application already holds a slot — cancel before rebooking."""


# --------------------------------------------------------------------------
# Seed a demo RTO with testers, and build slot grids on demand
# --------------------------------------------------------------------------

def seed_demo(rto_id: str = "mh01", when: date | None = None) -> RTO:
    """
    Register one RTO + its inspectors, and build its slot grid for `when`.
    Ids in RTO_CATALOGUE get their real name, area and distance; anything else
    (tests use throwaway ids) gets a generic office so the guarantees can still
    be exercised in isolation.

    Safe to call repeatedly — it never duplicates an RTO, an inspector, or a
    day's grid.
    """
    with _LOCK:
        rto = _RTOS.get(rto_id)
        if rto is None:
            spec = next((r for r in RTO_CATALOGUE if r["id"] == rto_id), None)
            rto = RTO(**spec) if spec else RTO(
                id=rto_id, name=f"RTO {rto_id}", city="—", area="—")
            _RTOS[rto.id] = rto

        for i, (name, mins) in enumerate(_TESTER_TEMPLATE, start=1):
            tid = f"{rto_id}_t{i}"
            if tid not in _TESTERS:
                _TESTERS[tid] = Tester(id=tid, name=name, rto_id=rto_id,
                                       avg_test_minutes=mins)

        _build_grid_locked(rto, when or date.today())
        return rto


def seed_catalogue(when: date | None = None) -> list[RTO]:
    """Register every office the UI can offer, with grids for the days ahead."""
    start = when or date.today()
    out = [seed_demo(spec["id"], start) for spec in RTO_CATALOGUE]
    for spec in RTO_CATALOGUE:
        for offset in range(1, SLOT_DAYS_AHEAD):
            ensure_day(spec["id"], start + timedelta(days=offset))
    return out


def slot_grid_times(rto: RTO) -> list[time]:
    """The fixed start times an office offers, lunch closure excluded."""
    grid: list[time] = []
    cur = datetime.combine(date.min, rto.open_time)
    end = datetime.combine(date.min, rto.close_time)
    while cur < end:
        at = cur.time()
        if not (rto.lunch_from <= at < rto.lunch_to):
            grid.append(at)
        cur += timedelta(minutes=rto.slot_minutes)
    return grid


def _build_grid_locked(rto: RTO, when: date) -> None:
    """Create every fixed slot for one RTO-day. Caller holds _LOCK."""
    if (rto.id, when) in _SLOT_DAYS:
        return

    for tester in [t for t in _TESTERS.values() if t.rto_id == rto.id]:
        for start in slot_grid_times(rto):
            s = Slot(id=str(uuid.uuid4()), rto_id=rto.id, tester_id=tester.id,
                     slot_date=when, start=start)
            _SLOTS[s.id] = s

    _SLOT_DAYS.add((rto.id, when))


def ensure_day(rto_id: str, when: date) -> None:
    """
    Make sure a day's slot grid exists. Without this, a server that started
    yesterday serves an empty /slots today — the grid was seeded once, for
    the date of import. Cheap no-op once the day is built.
    """
    if (rto_id, when) in _SLOT_DAYS:
        return
    with _LOCK:
        rto = _RTOS.get(rto_id)
        if rto is not None:
            _build_grid_locked(rto, when)


def list_rtos(state: str | None = None) -> list[RTO]:
    """
    Offices for a state, nearest first. Unmodelled states fall back to the
    Maharashtra set — the same behaviour the UI's rtosFor() had.
    """
    offices = [r for r in _RTOS.values() if r.id in {s["id"] for s in RTO_CATALOGUE}]
    if state:
        matching = [r for r in offices if r.state == state]
        offices = matching or [r for r in offices if r.state == "Maharashtra"]
    return sorted(offices, key=lambda r: r.km)


def office_pressure(rto_id: str) -> dict:
    """
    Live load for an office: how deep its queues are right now and what that
    means as a wait. Drives the "Light day / Busy" pill and the wait line the
    applicant reads before choosing where to go — real numbers, not a label
    someone typed into a fixture.
    """
    testers = [t for t in _TESTERS.values() if t.rto_id == rto_id]
    if not testers:
        return {"waiting": 0, "load": "light", "wait_minutes": 0, "lanes": 0}

    per_lane = []
    for tester in testers:
        depth = len([t for t in _tester_queue(tester.id)
                     if t.status == TokenStatus.WAITING])
        per_lane.append(depth * tester.avg_test_minutes)
    waiting = sum(
        len([t for t in _tester_queue(x.id) if t.status == TokenStatus.WAITING])
        for x in testers
    )
    # You would join the shortest lane, so that lane's clear-out time is the wait.
    wait_minutes = min(per_lane) if per_lane else 0
    baseline = min(t.avg_test_minutes for t in testers)
    return {
        "waiting": waiting,
        "lanes": len(testers),
        "wait_minutes": max(wait_minutes, baseline),
        "load": "busy" if wait_minutes >= baseline * 3 else "light",
    }


def slot_days(rto_id: str, from_day: date | None = None) -> list[dict]:
    """
    The date strip: one entry per bookable day with how many slots are actually
    left. A day showing 0 is genuinely full, so the UI can disable it honestly.
    """
    start = from_day or date.today()
    out = []
    for offset in range(SLOT_DAYS_AHEAD):
        day = start + timedelta(days=offset)
        ensure_day(rto_id, day)
        left = len([s for s in _SLOTS.values()
                    if s.rto_id == rto_id and s.slot_date == day and s.is_free])
        out.append({
            "date": day.isoformat(),
            "label": day.strftime("%a %d %b"),
            "left": left,
        })
    return out


def slot_times(rto_id: str, on: date) -> list[dict]:
    """
    The time strip for one day. Slots at the same time across inspectors are
    grouped, because the applicant picks a time and the system picks the lane.
    """
    ensure_day(rto_id, on)
    rto = _RTOS.get(rto_id)
    grid = slot_grid_times(rto) if rto else []
    out = []
    for start in grid:
        free = sorted(
            (s for s in _SLOTS.values()
             if s.rto_id == rto_id and s.slot_date == on and s.start == start and s.is_free),
            key=lambda s: s.tester_id,
        )
        out.append({
            "time": start.strftime("%I:%M %p").lstrip("0").lower(),
            "start": start.strftime("%H:%M"),
            "left": len(free),
            # The id the UI books. None when the time is full.
            "slot_id": free[0].id if free else None,
        })
    return out


def get_tester(tester_id: str) -> Tester | None:
    return _TESTERS.get(tester_id)


# --------------------------------------------------------------------------
# 1. Resilient, idempotent apply
# --------------------------------------------------------------------------

def apply(citizen_ref: str, licence_kind: LicenceKind, rto_id: str,
          idempotency_key: str, dob: str | None = None,
          applicant_name: str | None = None,
          licence_classes: list[str] | None = None) -> Application:
    """
    Submit an application. Safe to call repeatedly with the same
    idempotency_key — you always get the SAME application back, never a
    duplicate. This is the core fix for silent-failure + retry-storms.
    """
    global _APP_SEQ
    with _LOCK:
        existing_id = _APPS_BY_IDEM.get(idempotency_key)
        if existing_id:
            return _APPS[existing_id]           # idempotent: return prior result

        _APP_SEQ += 1
        created = _now()
        app = Application(
            id=str(uuid.uuid4()),
            display_no=f"SS-{created.year}-{_APP_SEQ:06d}",
            citizen_ref=citizen_ref,
            licence_kind=licence_kind,
            rto_id=rto_id,
            idempotency_key=idempotency_key,
            created_at=created,
            dob=dob,
            applicant_name=applicant_name,
            licence_classes=licence_classes or [],
        )
        app.log(AppStatus.SUBMITTED, "Application received.", _now())
        # Mock document verification — instant pass for the demo.
        app.log(AppStatus.VERIFIED, "Documents verified (mock).", _now())
        _APPS[app.id] = app
        _APPS_BY_IDEM[idempotency_key] = app.id
        _APPS_BY_NUMBER[app.display_no] = app.id
        _APPS_BY_CITIZEN.setdefault(citizen_ref, []).append(app.id)
        return app


def get_application(app_id: str) -> Application | None:
    return _APPS.get(app_id)


def find_by_number(display_no: str, dob: str | None = None) -> Application | None:
    """
    Tracker lookup: application number, authenticated by date of birth the way
    the real portal does. A wrong DOB is a miss, not a partial disclosure.
    """
    app_id = _APPS_BY_NUMBER.get(display_no.strip().upper())
    if app_id is None:
        return None
    app = _APPS[app_id]
    if dob and app.dob and app.dob != dob:
        return None
    return app


def latest_application_for(citizen_ref: str) -> Application | None:
    """Most recent application for a citizen. Backs the agent's status tool."""
    ids = _APPS_BY_CITIZEN.get(citizen_ref)
    return _APPS[ids[-1]] if ids else None


def get_booking(booking_id: str) -> Booking | None:
    return _BOOKINGS.get(booking_id)


# --------------------------------------------------------------------------
# 2. Atomic slot booking (no double-booking under concurrency)
# --------------------------------------------------------------------------

def list_free_slots(rto_id: str, on: date | None = None) -> list[Slot]:
    """Free slots, earliest first, so a caller can take slots[0] and be right."""
    if on is not None:
        ensure_day(rto_id, on)
    free = [
        s for s in _SLOTS.values()
        if s.rto_id == rto_id and s.is_free and (on is None or s.slot_date == on)
    ]
    return sorted(free, key=lambda s: (s.slot_date, s.start, s.tester_id))


def book_slot(application_id: str, slot_id: str) -> Booking:
    """
    Atomically hold a slot for an application. If two requests race for the
    same slot, exactly one wins; the other gets SlotTaken. In Postgres this is
    a UNIQUE(slot_id) + INSERT ... ON CONFLICT DO NOTHING, or SELECT FOR UPDATE.
    """
    with _LOCK:
        slot = _SLOTS.get(slot_id)
        if slot is None:
            raise KeyError("Unknown slot")

        app = _APPS.get(application_id)
        if app is None:
            raise KeyError("Unknown application")

        if app.booking_id is not None:
            # Guard the mirror image of double-booking: one application
            # silently holding two slots and stranding the first one.
            raise AlreadyBooked(f"Application {application_id} already has a slot")

        if not slot.is_free:
            raise SlotTaken(f"Slot {slot_id} already booked")

        # claim it
        slot.booked_by_application = application_id
        booking = Booking(
            id=str(uuid.uuid4()),
            application_id=application_id,
            slot_id=slot.id,
            rto_id=slot.rto_id,
            tester_id=slot.tester_id,
            slot_date=slot.slot_date,
            start=slot.start,
            created_at=_now(),
        )
        _BOOKINGS[booking.id] = booking
        app.booking_id = booking.id
        # The ledger is shown to the citizen, so name the inspector rather than
        # leaking an internal id into copy they have to read.
        tester = _TESTERS.get(slot.tester_id)
        who = tester.name if tester else slot.tester_id
        app.log(AppStatus.SLOT_BOOKED,
                f"Appointment held for {slot.start.strftime('%I:%M %p').lstrip('0').lower()}"
                f" with {who}.",
                _now())
        return booking


# --------------------------------------------------------------------------
# 3. On-the-day live queue with recomputed ETA
# --------------------------------------------------------------------------

def check_in(application_id: str) -> QueueToken:
    """
    Applicant arrives -> issue a token in their tester's queue. Idempotent:
    checking in twice (double tap, refresh) returns the same token instead of
    burning a second number and pushing the queue out.
    """
    with _LOCK:
        app = _APPS.get(application_id)
        if app is None or app.booking_id is None:
            raise KeyError("No booking to check in against")
        if app.token_id is not None:
            return _TOKENS[app.token_id]

        booking = _BOOKINGS[app.booking_id]
        _TOKEN_SEQ[booking.rto_id] = _TOKEN_SEQ.get(booking.rto_id, 0) + 1
        token = QueueToken(
            id=str(uuid.uuid4()),
            application_id=application_id,
            rto_id=booking.rto_id,
            tester_id=booking.tester_id,
            number=_TOKEN_SEQ[booking.rto_id],
            checked_in_at=_now(),
        )
        _TOKENS[token.id] = token
        app.token_id = token.id
        app.log(AppStatus.CHECKED_IN, f"Checked in. Token #{token.number}.", _now())
        return token


def get_token(token_id: str) -> QueueToken | None:
    return _TOKENS.get(token_id)


def _tester_queue(tester_id: str) -> list[QueueToken]:
    q = [t for t in _TOKENS.values()
         if t.tester_id == tester_id and t.status in (TokenStatus.WAITING, TokenStatus.IN_TEST)]
    return sorted(q, key=lambda t: t.number)


def queue_status(token_id: str) -> dict:
    """What the citizen sees on their phone: position, tester, live ETA."""
    token = _TOKENS.get(token_id)
    if token is None:
        raise KeyError("Unknown token")
    tester = _TESTERS[token.tester_id]
    q = _tester_queue(token.tester_id)

    # Everyone before us who isn't finished yet — split into the one currently
    # being tested vs. those still waiting, because they cost different time.
    before = [t for t in q if t.number < token.number]
    waiting_ahead = [t for t in before if t.status == TokenStatus.WAITING]
    in_test_ahead = [t for t in before if t.status == TokenStatus.IN_TEST]

    people_ahead = len(waiting_ahead) + len(in_test_ahead)
    # Full test time for each still-waiting person ahead; assume the in-test
    # person is on average halfway done.
    eta_min = int(len(waiting_ahead) * tester.avg_test_minutes
                  + len(in_test_ahead) * tester.avg_test_minutes * 0.5)

    return {
        "token_id": token.id,
        "token_number": token.number,
        "tester": tester.name,
        "status": token.status.value,
        "people_ahead": people_ahead,
        "eta_minutes": eta_min,
        "someone_in_test": bool(in_test_ahead),
    }


def call_next(tester_id: str) -> QueueToken | None:
    """Tester-side: finish current (if any) and call the next waiting token."""
    with _LOCK:
        q = _tester_queue(tester_id)
        # mark any in-test as done
        for t in q:
            if t.status == TokenStatus.IN_TEST:
                t.status = TokenStatus.DONE
                t.finished_at = _now()
                app = _APPS.get(t.application_id)
                if app:
                    app.log(AppStatus.COMPLETED, "Test completed.", _now())
        # start next waiting
        for t in sorted(q, key=lambda x: x.number):
            if t.status == TokenStatus.WAITING:
                t.status = TokenStatus.IN_TEST
                t.started_at = _now()
                return t
        return None


def rto_board(rto_id: str) -> dict:
    """
    The waiting-hall display / tester dashboard: who each inspector is
    serving and how deep their queue is. Same numbers the citizen sees on
    their phone, so there is one shared truth instead of a shouted queue.
    """
    lanes = []
    for tester in sorted((t for t in _TESTERS.values() if t.rto_id == rto_id),
                         key=lambda t: t.id):
        q = _tester_queue(tester.id)
        serving = next((t for t in q if t.status == TokenStatus.IN_TEST), None)
        waiting = [t for t in q if t.status == TokenStatus.WAITING]
        lanes.append({
            "tester_id": tester.id,
            "tester": tester.name,
            "now_serving": serving.number if serving else None,
            "waiting": len(waiting),
            "next_numbers": [t.number for t in waiting[:5]],
            "avg_test_minutes": tester.avg_test_minutes,
        })
    return {"rto_id": rto_id, "lanes": lanes}

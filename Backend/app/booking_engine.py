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

All three are enforced by the database, not by this file. Every mutation below
runs inside ``db.transaction()`` (BEGIN IMMEDIATE), and every claim it makes has
a constraint behind it — ``UNIQUE(idempotency_key)``, ``UNIQUE(slot_id)``, a
composite primary key on the ledger. See app/db.py for why: the previous version
of this module held a ``threading.Lock``, which is a guarantee only for as long
as the server runs one process.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError

from . import db
from .booking_models import (
    Application,
    AppStatus,
    Booking,
    JourneyEvent,
    LicenceKind,
    QueueToken,
    RTO,
    Slot,
    Tester,
    TokenStatus,
)

log = logging.getLogger(__name__)

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

# How long before a slot starts it stops being bookable. A time already gone is
# obviously wrong to offer — at ten past three the picker was still offering
# 9:30 this morning — but so is one starting in four minutes, because nobody can
# be at the office by then. The lead time is what makes an appointment keepable.
BOOKING_LEAD_MINUTES = 30

# Application numbers start here so the first one issued reads SS-2026-004182,
# the number the UI copy and the seeded tracker example both use.
_APP_SEQ_START = 4181

# Sorts an orphaned token — one whose booking cannot be found — to the back of
# the lane rather than to the front, which is where a NULL would otherwise land.
_NO_APPOINTMENT = "99:99"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SlotTaken(Exception):
    """Two applicants raced for one slot; this one lost."""


class AlreadyBooked(Exception):
    """The application already holds a slot — cancel before rebooking."""


class SlotPassed(Exception):
    """The slot's start time has gone, or is too soon to travel to."""


# --------------------------------------------------------------------------
# Row <-> model
# --------------------------------------------------------------------------

def _rto(row) -> RTO:
    return RTO(id=row["id"], name=row["name"], city=row["city"], state=row["state"],
               area=row["area"], km=row["km"],
               open_time=db.t_in(row["open_time"]), close_time=db.t_in(row["close_time"]),
               slot_minutes=row["slot_minutes"],
               lunch_from=db.t_in(row["lunch_from"]), lunch_to=db.t_in(row["lunch_to"]))


def _tester(row) -> Tester:
    return Tester(id=row["id"], name=row["name"], rto_id=row["rto_id"],
                  avg_test_minutes=row["avg_test_minutes"])


def _slot(row) -> Slot:
    return Slot(id=row["id"], rto_id=row["rto_id"], tester_id=row["tester_id"],
                slot_date=db.d_in(row["slot_date"]), start=db.t_in(row["start"]),
                booked_by_application=row["booked_by_application"])


def _booking(row) -> Booking:
    return Booking(id=row["id"], application_id=row["application_id"],
                   slot_id=row["slot_id"], rto_id=row["rto_id"],
                   tester_id=row["tester_id"], slot_date=db.d_in(row["slot_date"]),
                   start=db.t_in(row["start"]), created_at=db.ts_in(row["created_at"]))


def _token(row) -> QueueToken:
    return QueueToken(id=row["id"], application_id=row["application_id"],
                      rto_id=row["rto_id"], tester_id=row["tester_id"],
                      number=row["number"], status=TokenStatus(row["status"]),
                      checked_in_at=db.ts_in(row["checked_in_at"]),
                      started_at=db.ts_in(row["started_at"]),
                      finished_at=db.ts_in(row["finished_at"]))


def _application(conn, row) -> Application:
    """
    An application with its whole chain attached.

    The ledger is read in one go rather than lazily, because every caller that
    holds an Application either prints the receipt or appends to it, and a
    half-loaded chain would verify as tampered.
    """
    events = conn.execute(
        select(db.ledger).where(db.ledger.c.application_id == row["id"])
        .order_by(db.ledger.c.seq)).mappings().all()
    return Application(
        id=row["id"], display_no=row["display_no"], citizen_ref=row["citizen_ref"],
        licence_kind=LicenceKind(row["licence_kind"]), rto_id=row["rto_id"],
        status=AppStatus(row["status"]), idempotency_key=row["idempotency_key"],
        created_at=db.ts_in(row["created_at"]), dob=row["dob"],
        applicant_name=row["applicant_name"],
        licence_classes=json.loads(row["licence_classes"]),
        booking_id=row["booking_id"], token_id=row["token_id"],
        ledger=[JourneyEvent(seq=e["seq"], at=db.ts_in(e["at"]),
                             status=AppStatus(e["status"]), note=e["note"],
                             prev_hash=e["prev_hash"], hash=e["hash"])
                for e in events],
    )


def _load_application(conn, app_id: str) -> Application | None:
    row = conn.execute(
        select(db.applications).where(db.applications.c.id == app_id)).mappings().first()
    return _application(conn, row) if row else None


def _append_ledger(conn, app: Application, status: AppStatus, note: str) -> None:
    """
    Record one event and persist the tail of the chain.

    Insert-only, and only the rows that are new: the ledger's primary key would
    refuse a rewrite of an existing position, which is the point — an event that
    has been recorded cannot be edited through this path at all.
    """
    from_seq = len(app.ledger)
    app.log(status, note, _now())
    conn.execute(db.ledger.insert(), [
        {"application_id": app.id, "seq": e.seq, "at": db.ts_out(e.at),
         "status": e.status.value, "note": e.note, "prev_hash": e.prev_hash,
         "hash": e.hash}
        for e in app.ledger if e.seq >= from_seq
    ])
    conn.execute(db.applications.update()
                 .where(db.applications.c.id == app.id)
                 .values(status=app.status.value))


# --------------------------------------------------------------------------
# Seed a demo RTO with testers, and build slot grids on demand
# --------------------------------------------------------------------------

def _seed_locked(conn, rto_id: str, when: date) -> RTO:
    """Caller is inside a write transaction."""
    row = conn.execute(
        select(db.rtos).where(db.rtos.c.id == rto_id)).mappings().first()
    if row is None:
        spec = next((r for r in RTO_CATALOGUE if r["id"] == rto_id), None)
        rto = RTO(**spec) if spec else RTO(
            id=rto_id, name=f"RTO {rto_id}", city="—", area="—")
        conn.execute(db.rtos.insert().values(
            id=rto.id, name=rto.name, city=rto.city, state=rto.state, area=rto.area,
            km=rto.km, open_time=db.t_out(rto.open_time),
            close_time=db.t_out(rto.close_time), slot_minutes=rto.slot_minutes,
            lunch_from=db.t_out(rto.lunch_from), lunch_to=db.t_out(rto.lunch_to)))
    else:
        rto = _rto(row)

    have = {r["id"] for r in conn.execute(
        select(db.testers.c.id).where(db.testers.c.rto_id == rto_id)).mappings()}
    new = [{"id": f"{rto_id}_t{i}", "name": name, "rto_id": rto_id,
            "avg_test_minutes": mins}
           for i, (name, mins) in enumerate(_TESTER_TEMPLATE, start=1)
           if f"{rto_id}_t{i}" not in have]
    if new:
        conn.execute(db.testers.insert(), new)

    _build_grid_locked(conn, rto, when)
    return rto


def seed_demo(rto_id: str = "mh01", when: date | None = None) -> RTO:
    """
    Register one RTO + its inspectors, and build its slot grid for `when`.
    Ids in RTO_CATALOGUE get their real name, area and distance; anything else
    (tests use throwaway ids) gets a generic office so the guarantees can still
    be exercised in isolation.

    Safe to call repeatedly — it never duplicates an RTO, an inspector, or a
    day's grid.
    """
    with db.transaction() as conn:
        return _seed_locked(conn, rto_id, when or date.today())


def seed_catalogue(when: date | None = None) -> list[RTO]:
    """
    Register every office the UI can offer, with grids for the days ahead.

    One transaction for all of it: six offices times six days was thirty-six
    separate write locks at startup, each one a fsync, and the server took
    visibly longer to answer its first request than to serve the next hundred.
    """
    start = when or date.today()
    with db.transaction() as conn:
        out = [_seed_locked(conn, spec["id"], start) for spec in RTO_CATALOGUE]
        for spec in RTO_CATALOGUE:
            rto = next(r for r in out if r.id == spec["id"])
            for offset in range(1, SLOT_DAYS_AHEAD):
                _build_grid_locked(conn, rto, start + timedelta(days=offset))
    return out


def _cutoff() -> tuple[str, str]:
    """
    Today, and the earliest start still bookable on it — as the strings the slot
    rows are stored in.

    One definition, used by both the Python check and the SQL filter, so the two
    cannot drift: an hour where the list offered a time that booking then
    refused would be worse than either rule alone.
    """
    now = datetime.now()
    return (now.date().isoformat(),
            (now + timedelta(minutes=BOOKING_LEAD_MINUTES)).strftime("%H:%M"))


def _too_late(slot_date: date, start: time) -> bool:
    """
    Whether this start time has effectively gone for the day.

    Only today is ever in question: a future day is entirely open, and a past
    day entirely closed. Local time deliberately, to match the ``date.today()``
    the grids are built against — comparing a wall-clock grid to UTC would move
    the cutoff by hours.
    """
    today, cutoff = _cutoff()
    day = slot_date.isoformat()
    if day > today:
        return False
    if day < today:
        return True
    return start.strftime("%H:%M") < cutoff


def _still_bookable():
    """The same rule as ``_too_late``, as a WHERE clause."""
    today, cutoff = _cutoff()
    return or_(db.slots.c.slot_date > today,
               and_(db.slots.c.slot_date == today, db.slots.c.start >= cutoff))


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


def _build_grid_locked(conn, rto: RTO, when: date) -> None:
    """Create every fixed slot for one RTO-day. Caller is in a write transaction."""
    day = db.d_out(when)
    marked = conn.execute(select(db.slot_days).where(
        and_(db.slot_days.c.rto_id == rto.id, db.slot_days.c.day == day))).first()
    if marked:
        return

    tester_ids = [r["id"] for r in conn.execute(
        select(db.testers.c.id).where(db.testers.c.rto_id == rto.id)
        .order_by(db.testers.c.id)).mappings()]
    rows = [{"id": str(uuid.uuid4()), "rto_id": rto.id, "tester_id": tid,
             "slot_date": day, "start": db.t_out(start),
             "booked_by_application": None}
            for tid in tester_ids for start in slot_grid_times(rto)]
    if rows:
        conn.execute(db.slots.insert(), rows)
    conn.execute(db.slot_days.insert().values(rto_id=rto.id, day=day))


def ensure_day(rto_id: str, when: date) -> None:
    """
    Make sure a day's slot grid exists. Without this, a server that started
    yesterday serves an empty /slots today — the grid was seeded once, for
    the date of import.

    The existence check is a read, so the common case — the grid is already
    there — never takes the write lock. Six of these run per date strip.
    """
    day = db.d_out(when)
    with db.read() as conn:
        if conn.execute(select(db.slot_days).where(
                and_(db.slot_days.c.rto_id == rto_id,
                     db.slot_days.c.day == day))).first():
            return
        row = conn.execute(
            select(db.rtos).where(db.rtos.c.id == rto_id)).mappings().first()
    if row is None:
        return
    with db.transaction() as conn:
        _build_grid_locked(conn, _rto(row), when)


def list_rtos(state: str | None = None) -> list[RTO]:
    """
    Offices for a state, nearest first. Unmodelled states fall back to the
    Maharashtra set — the same behaviour the UI's rtosFor() had.
    """
    catalogue = [s["id"] for s in RTO_CATALOGUE]
    with db.read() as conn:
        rows = conn.execute(select(db.rtos).where(db.rtos.c.id.in_(catalogue))
                            .order_by(db.rtos.c.km)).mappings().all()
    offices = [_rto(r) for r in rows]
    if state:
        matching = [r for r in offices if r.state == state]
        offices = matching or [r for r in offices if r.state == "Maharashtra"]
    return offices


def office_pressure(rto_id: str) -> dict:
    """
    Live load for an office: how deep its queues are right now and what that
    means as a wait. Drives the "Light day / Busy" pill and the wait line the
    applicant reads before choosing where to go — real numbers, not a label
    someone typed into a fixture.
    """
    with db.read() as conn:
        testers = [_tester(r) for r in conn.execute(
            select(db.testers).where(db.testers.c.rto_id == rto_id)).mappings()]
        if not testers:
            return {"waiting": 0, "load": "light", "wait_minutes": 0, "lanes": 0}
        depths = {r["tester_id"]: r["n"] for r in conn.execute(
            select(db.tokens.c.tester_id, func.count().label("n"))
            .where(and_(db.tokens.c.rto_id == rto_id,
                        db.tokens.c.status == TokenStatus.WAITING.value))
            .group_by(db.tokens.c.tester_id)).mappings()}

    per_lane = [depths.get(t.id, 0) * t.avg_test_minutes for t in testers]
    waiting = sum(depths.get(t.id, 0) for t in testers)
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
    days = [start + timedelta(days=offset) for offset in range(SLOT_DAYS_AHEAD)]
    for day in days:
        ensure_day(rto_id, day)

    # Counts what is still bookable, not what exists. Today read "18 left" at
    # three in the afternoon by counting a morning that had gone.
    with db.read() as conn:
        counts = {r["slot_date"]: r["n"] for r in conn.execute(
            select(db.slots.c.slot_date, func.count().label("n"))
            .where(and_(db.slots.c.rto_id == rto_id,
                        db.slots.c.slot_date.in_([db.d_out(d) for d in days]),
                        db.slots.c.booked_by_application.is_(None),
                        _still_bookable()))
            .group_by(db.slots.c.slot_date)).mappings()}

    return [{"date": day.isoformat(),
             "label": day.strftime("%a %d %b"),
             "left": counts.get(db.d_out(day), 0)}
            for day in days]


def slot_times(rto_id: str, on: date) -> list[dict]:
    """
    The time strip for one day. Slots at the same time across inspectors are
    grouped, because the applicant picks a time and the system picks the lane.
    """
    ensure_day(rto_id, on)
    with db.read() as conn:
        row = conn.execute(
            select(db.rtos).where(db.rtos.c.id == rto_id)).mappings().first()
        if row is None:
            return []
        grid = slot_grid_times(_rto(row))
        free = conn.execute(
            select(db.slots.c.start, db.slots.c.id)
            .where(and_(db.slots.c.rto_id == rto_id,
                        db.slots.c.slot_date == db.d_out(on),
                        db.slots.c.booked_by_application.is_(None)))
            .order_by(db.slots.c.start, db.slots.c.tester_id)).mappings().all()

    by_start: dict[str, list[str]] = {}
    for r in free:
        by_start.setdefault(r["start"], []).append(r["id"])

    out = []
    for start in grid:
        # A time that has gone is dropped from the strip rather than shown full:
        # "9:30 am · Full" at three in the afternoon invites someone to wait for
        # it to free up, when what has actually happened is that it is over.
        if _too_late(on, start):
            continue
        ids = by_start.get(db.t_out(start), [])
        out.append({
            "time": start.strftime("%I:%M %p").lstrip("0").lower(),
            "start": start.strftime("%H:%M"),
            "left": len(ids),
            # The id the UI books. None when the time is full.
            "slot_id": ids[0] if ids else None,
        })
    return out


def get_tester(tester_id: str) -> Tester | None:
    with db.read() as conn:
        row = conn.execute(
            select(db.testers).where(db.testers.c.id == tester_id)).mappings().first()
    return _tester(row) if row else None


def get_slot(slot_id: str) -> Slot | None:
    """
    Look a slot up by id, so a caller holding one can say what it actually is.

    The agent needs this before it books: the id is opaque, and describing an
    appointment from anything other than the row it is about to claim is how a
    citizen gets told one time and given another.
    """
    with db.read() as conn:
        row = conn.execute(
            select(db.slots).where(db.slots.c.id == slot_id)).mappings().first()
    return _slot(row) if row else None


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

    Two things enforce that, deliberately. The lookup below settles it inside
    one write transaction; ``UNIQUE(idempotency_key)`` settles it even if that
    transaction is somehow not isolated — on another engine, at another
    isolation level, under a future edit to this function. The second retry then
    reads the winner's row rather than raising at the caller.
    """
    try:
        with db.transaction() as conn:
            existing = conn.execute(
                select(db.applications)
                .where(db.applications.c.idempotency_key == idempotency_key)
            ).mappings().first()
            if existing:
                # The key is the retry guarantee, so it settles this outright —
                # but only for the citizen it was issued to. Without the second
                # check, a key is a bearer token for whatever it created, and
                # the agent derives its keys from the citizen reference, which
                # is a phone number. Knowing somebody's number was enough to
                # read their name, date of birth, ledger and appointment back.
                if existing["citizen_ref"] != citizen_ref:
                    raise PermissionError("That idempotency key belongs to another citizen.")
                return _application(conn, existing)   # idempotent: prior result

            # Deliberately *not* "one application per citizen" here. That is a
            # product rule, and this function's guarantee is a different and
            # narrower one: the same key always returns the same application. A
            # new key is a new intent, and `POST /proof/idempotent-apply` exists
            # to demonstrate exactly that — a citizen who genuinely wants a
            # second application, for another class of vehicle or after a lapse,
            # is entitled to file one. Stopping somebody re-walking the wizard by
            # accident is the job of the gate in the browser, which knows what
            # the citizen was trying to do; the engine only knows what it was
            # asked for.

            seq = db.next_value(conn, "app_seq", start=_APP_SEQ_START)
            created = _now()
            app = Application(
                id=str(uuid.uuid4()),
                display_no=f"SS-{created.year}-{seq:06d}",
                citizen_ref=citizen_ref,
                licence_kind=licence_kind,
                rto_id=rto_id,
                idempotency_key=idempotency_key,
                created_at=created,
                dob=dob,
                applicant_name=applicant_name,
                licence_classes=licence_classes or [],
            )
            conn.execute(db.applications.insert().values(
                id=app.id, seq=seq, display_no=app.display_no,
                citizen_ref=app.citizen_ref, licence_kind=app.licence_kind.value,
                rto_id=app.rto_id, status=app.status.value,
                idempotency_key=app.idempotency_key,
                created_at=db.ts_out(app.created_at), dob=app.dob,
                applicant_name=app.applicant_name,
                licence_classes=json.dumps(app.licence_classes),
                booking_id=None, token_id=None))
            _append_ledger(conn, app, AppStatus.SUBMITTED, "Application received.")
            # Mock document verification — instant pass for the demo.
            _append_ledger(conn, app, AppStatus.VERIFIED, "Documents verified (mock).")
            return app
    except IntegrityError:
        with db.read() as conn:
            row = conn.execute(
                select(db.applications)
                .where(db.applications.c.idempotency_key == idempotency_key)
            ).mappings().first()
            if row is None:
                raise
            return _application(conn, row)


def get_application(app_id: str) -> Application | None:
    with db.read() as conn:
        return _load_application(conn, app_id)


def find_by_number(display_no: str, dob: str | None = None) -> Application | None:
    """
    Tracker lookup: application number, authenticated by date of birth the way
    the real portal does. A wrong DOB is a miss, not a partial disclosure.
    """
    with db.read() as conn:
        row = conn.execute(
            select(db.applications)
            .where(db.applications.c.display_no == display_no.strip().upper())
        ).mappings().first()
        if row is None:
            return None
        if dob and row["dob"] and row["dob"] != dob:
            return None
        return _application(conn, row)


def latest_application_for(citizen_ref: str) -> Application | None:
    """Most recent application for a citizen. Backs the agent's status tool."""
    with db.read() as conn:
        row = conn.execute(
            select(db.applications)
            .where(db.applications.c.citizen_ref == citizen_ref)
            .order_by(db.applications.c.seq.desc()).limit(1)).mappings().first()
        return _application(conn, row) if row else None


def record_learner_pass(citizen_ref: str) -> Application | None:
    """
    Record on the application that the citizen passed the theory test.

    The attempt store already holds the score; what it does not hold is any link
    back to the application, so nothing on the server could answer "has this
    person finished the learner's journey?" — the question the driving-test
    screen and Saarthi both have to ask before offering an appointment. Until
    this existed the pass lived only in the browser, which meant clearing site
    data lost a licence.

    Returns None when the citizen has no learner application, which is an
    ordinary state: the theory test can be taken by anyone, including somebody
    practising before they apply.

    Idempotent by status rather than by the ledger's primary key. That key
    refuses a *rewrite* at a position already taken; it does not refuse a second
    event appended at the next one. So answering the last question twice would
    record two passes unless the guard is explicit.
    """
    with db.transaction() as conn:
        row = conn.execute(
            select(db.applications)
            .where(and_(db.applications.c.citizen_ref == citizen_ref,
                        db.applications.c.licence_kind == LicenceKind.LL.value))
            .order_by(db.applications.c.seq.desc()).limit(1)).mappings().first()
        if row is None:
            return None
        app = _application(conn, row)
        if app.status == AppStatus.ISSUED:
            return app
        _append_ledger(conn, app, AppStatus.ISSUED,
                       "Theory test passed. Learner's licence issued.")
        return app


def get_booking(booking_id: str) -> Booking | None:
    with db.read() as conn:
        row = conn.execute(
            select(db.bookings).where(db.bookings.c.id == booking_id)).mappings().first()
    return _booking(row) if row else None


# --------------------------------------------------------------------------
# 2. Atomic slot booking (no double-booking under concurrency)
# --------------------------------------------------------------------------

def list_free_slots(rto_id: str, on: date | None = None) -> list[Slot]:
    """Free slots, earliest first, so a caller can take slots[0] and be right."""
    if on is not None:
        ensure_day(rto_id, on)
    where = [db.slots.c.rto_id == rto_id,
             db.slots.c.booked_by_application.is_(None),
             _still_bookable()]
    if on is not None:
        where.append(db.slots.c.slot_date == db.d_out(on))
    with db.read() as conn:
        rows = conn.execute(
            select(db.slots).where(and_(*where))
            .order_by(db.slots.c.slot_date, db.slots.c.start,
                      db.slots.c.tester_id)).mappings().all()
    return [_slot(r) for r in rows]


def book_slot(application_id: str, slot_id: str) -> Booking:
    """
    Atomically hold a slot for an application. If two requests race for the same
    slot, exactly one wins; the other gets SlotTaken.

    The claim is a conditional UPDATE — ``SET booked_by = ? WHERE id = ? AND
    booked_by IS NULL`` — so the winner is decided by how many rows it changed,
    not by a check that happened earlier and might no longer be true. Behind
    that, ``UNIQUE(slot_id)`` on bookings makes a second holder impossible even
    if this statement were got wrong.
    """
    try:
        with db.transaction() as conn:
            slot_row = conn.execute(
                select(db.slots).where(db.slots.c.id == slot_id)).mappings().first()
            if slot_row is None:
                raise KeyError("Unknown slot")
            slot = _slot(slot_row)

            app = _load_application(conn, application_id)
            if app is None:
                raise KeyError("Unknown application")

            if app.booking_id is not None:
                # Guard the mirror image of double-booking: one application
                # silently holding two slots and stranding the first one.
                raise AlreadyBooked(f"Application {application_id} already has a slot")

            # Checked here rather than only in the pickers, because a slot id can
            # be held for a while — a page left open over lunch, a voice turn
            # that took a few rounds — and hiding a time in the list is not the
            # same as refusing to sell it.
            if _too_late(slot.slot_date, slot.start):
                raise SlotPassed(f"Slot {slot_id} has already started or is too soon")

            claimed = conn.execute(
                db.slots.update()
                .where(and_(db.slots.c.id == slot_id,
                            db.slots.c.booked_by_application.is_(None)))
                .values(booked_by_application=application_id))
            if claimed.rowcount != 1:
                raise SlotTaken(f"Slot {slot_id} already booked")

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
            conn.execute(db.bookings.insert().values(
                id=booking.id, application_id=booking.application_id,
                slot_id=booking.slot_id, rto_id=booking.rto_id,
                tester_id=booking.tester_id, slot_date=db.d_out(booking.slot_date),
                start=db.t_out(booking.start),
                created_at=db.ts_out(booking.created_at)))
            conn.execute(db.applications.update()
                         .where(db.applications.c.id == application_id)
                         .values(booking_id=booking.id))
            app.booking_id = booking.id

            # The ledger is shown to the citizen, so name the inspector rather
            # than leaking an internal id into copy they have to read.
            who = conn.execute(
                select(db.testers.c.name)
                .where(db.testers.c.id == slot.tester_id)).scalar() or slot.tester_id
            _append_ledger(
                conn, app, AppStatus.SLOT_BOOKED,
                f"Appointment held for {slot.start.strftime('%I:%M %p').lstrip('0').lower()}"
                f" with {who}.")
            return booking
    except IntegrityError as exc:
        # Only reachable if the conditional UPDATE let two claims through, which
        # the constraint then refuses. Reported as the loss it is.
        raise SlotTaken(f"Slot {slot_id} already booked") from exc


# --------------------------------------------------------------------------
# 3. On-the-day live queue with recomputed ETA
# --------------------------------------------------------------------------

def check_in(application_id: str) -> QueueToken:
    """
    Applicant arrives -> issue a token in their tester's queue. Idempotent:
    checking in twice (double tap, refresh) returns the same token instead of
    burning a second number and pushing the queue out.
    """
    with db.transaction() as conn:
        app = _load_application(conn, application_id)
        if app is None or app.booking_id is None:
            raise KeyError("There is no appointment to check in against yet — book a test slot first.")
        if app.token_id is not None:
            row = conn.execute(
                select(db.tokens).where(db.tokens.c.id == app.token_id)).mappings().first()
            if row is not None:
                return _token(row)

        booking_row = conn.execute(
            select(db.bookings).where(db.bookings.c.id == app.booking_id)).mappings().first()
        if booking_row is None:
            raise KeyError("There is no appointment to check in against yet — book a test slot first.")
        booking = _booking(booking_row)

        number = db.next_value(conn, f"token_seq:{booking.rto_id}")
        token = QueueToken(
            id=str(uuid.uuid4()),
            application_id=application_id,
            rto_id=booking.rto_id,
            tester_id=booking.tester_id,
            number=number,
            checked_in_at=_now(),
        )
        conn.execute(db.tokens.insert().values(
            id=token.id, application_id=token.application_id, rto_id=token.rto_id,
            tester_id=token.tester_id, number=token.number,
            status=token.status.value, checked_in_at=db.ts_out(token.checked_in_at),
            started_at=None, finished_at=None))
        conn.execute(db.applications.update()
                     .where(db.applications.c.id == application_id)
                     .values(token_id=token.id))
        app.token_id = token.id
        _append_ledger(conn, app, AppStatus.CHECKED_IN,
                       f"Checked in. Token #{token.number}.")
        return token


def get_token(token_id: str) -> QueueToken | None:
    with db.read() as conn:
        row = conn.execute(
            select(db.tokens).where(db.tokens.c.id == token_id)).mappings().first()
    return _token(row) if row else None


def _lane_query(tester_id: str):
    """
    One inspector's line, in the order they will actually be called.

    Ordered by the time each person was booked for, not by when they walked in.
    Arrival order alone meant someone with a 3:30 appointment who turned up at
    dawn took token #1 and stood ahead of the 9:30 appointment — the exact
    "come early and hover" behaviour a booked slot is supposed to abolish, and
    a direct contradiction of what the slot screen promises. The token number
    still breaks ties, so two people booked for the same time are called in the
    order they arrived.

    An outer join, not an inner one: a token whose booking has gone must still
    appear in its lane. It sorts to the back rather than to the front, which is
    where the NULL would otherwise put it.
    """
    joined = db.tokens.outerjoin(
        db.bookings, db.bookings.c.application_id == db.tokens.c.application_id)
    return (select(db.tokens).select_from(joined)
            .where(and_(db.tokens.c.tester_id == tester_id,
                        db.tokens.c.status.in_((TokenStatus.WAITING.value,
                                                TokenStatus.IN_TEST.value))))
            .order_by(func.coalesce(db.bookings.c.start, _NO_APPOINTMENT),
                      db.tokens.c.number))


def _tester_queue(tester_id: str) -> list[QueueToken]:
    with db.read() as conn:
        return [_token(r) for r in conn.execute(_lane_query(tester_id)).mappings()]


def queue_status(token_id: str) -> dict:
    """What the citizen sees on their phone: position, tester, live ETA."""
    with db.read() as conn:
        row = conn.execute(
            select(db.tokens).where(db.tokens.c.id == token_id)).mappings().first()
        if row is None:
            raise KeyError("Unknown token")
        token = _token(row)
        tester_row = conn.execute(
            select(db.testers).where(db.testers.c.id == token.tester_id)).mappings().first()
        # A token whose inspector is gone is still a token, and the citizen
        # holding it is still standing in the hall. `_tester(None)` raised a
        # TypeError out of a read that the tracker polls every four seconds, so
        # a catalogue edit turned a live queue into a repeating 500. Fall back to
        # the default test length and say the inspector is not yet assigned.
        if tester_row is None:
            log.warning("token %s names inspector %s, which is not in the catalogue",
                        token.id, token.tester_id)
            tester = Tester(id=token.tester_id, name="To be assigned",
                            rto_id=token.rto_id)
        else:
            tester = _tester(tester_row)
        q = [_token(r) for r in conn.execute(_lane_query(token.tester_id)).mappings()]

    # Everyone before us who isn't finished yet — split into the one currently
    # being tested vs. those still waiting, because they cost different time.
    #
    # Taken from the position in the ordered lane rather than by comparing token
    # numbers: the lane is ordered by appointment time now, so a lower token
    # number no longer means someone is ahead of you.
    index = next((i for i, t in enumerate(q) if t.id == token.id), len(q))
    before = q[:index]
    waiting_ahead = [t for t in before if t.status == TokenStatus.WAITING]
    in_test_ahead = [t for t in before if t.status == TokenStatus.IN_TEST]

    people_ahead = len(waiting_ahead) + len(in_test_ahead)
    # Full test time for each still-waiting person ahead; assume the in-test
    # person is on average halfway done.
    eta_min = int(len(waiting_ahead) * tester.avg_test_minutes
                  + len(in_test_ahead) * tester.avg_test_minutes * 0.5)

    return {
        "token_id": token.id,
        # Issued per office, in arrival order: the number called across the hall.
        "token_number": token.number,
        "tester": tester.name,
        "status": token.status.value,
        # Position is per inspector, because that is the line you actually stand
        # in. Reporting the office-wide number next to a lane-scoped count reads
        # as a contradiction — "you are number 3, nobody is ahead of you" — so
        # say the place in the lane outright rather than leaving it to be
        # inferred from the token number.
        "position_in_lane": len(before) + 1,
        "lane_size": len(q),
        "people_ahead": people_ahead,
        "eta_minutes": eta_min,
        "someone_in_test": bool(in_test_ahead),
    }


def call_next(tester_id: str) -> QueueToken | None:
    """Tester-side: finish current (if any) and call the next waiting token."""
    with db.transaction() as conn:
        q = [_token(r) for r in conn.execute(_lane_query(tester_id)).mappings()]
        # mark any in-test as done
        for t in q:
            if t.status == TokenStatus.IN_TEST:
                conn.execute(db.tokens.update().where(db.tokens.c.id == t.id)
                             .values(status=TokenStatus.DONE.value,
                                     finished_at=db.ts_out(_now())))
                app = _load_application(conn, t.application_id)
                if app:
                    _append_ledger(conn, app, AppStatus.COMPLETED, "Test completed.")
        # Start the next waiting one. `q` already comes back in call order —
        # re-sorting by token number here would have put arrival order back in
        # charge and undone the ordering above.
        for t in q:
            if t.status == TokenStatus.WAITING:
                started = _now()
                conn.execute(db.tokens.update().where(db.tokens.c.id == t.id)
                             .values(status=TokenStatus.IN_TEST.value,
                                     started_at=db.ts_out(started)))
                t.status = TokenStatus.IN_TEST
                t.started_at = started
                return t
        return None


def rto_board(rto_id: str) -> dict:
    """
    The waiting-hall display / tester dashboard: who each inspector is
    serving and how deep their queue is. Same numbers the citizen sees on
    their phone, so there is one shared truth instead of a shouted queue.
    """
    with db.read() as conn:
        testers = [_tester(r) for r in conn.execute(
            select(db.testers).where(db.testers.c.rto_id == rto_id)
            .order_by(db.testers.c.id)).mappings()]
        lanes = []
        for tester in testers:
            q = [_token(r) for r in conn.execute(_lane_query(tester.id)).mappings()]
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


# --------------------------------------------------------------------------
# Lifecycle
# --------------------------------------------------------------------------

def restore() -> bool:
    """
    Open the database and say whether a previous run left anything in it.

    There is nothing to load: the file *is* the state, so a restart resumes by
    connecting. The return value only tells the startup log whether this is a
    fresh install or a demo already in progress.
    """
    return db.is_populated()


def reset_state() -> None:
    """
    Drop everything and re-seed from scratch.

    A demo needs a way back to a clean slate — after a run the first slot of the
    day is taken and tokens are already issued, which makes the next walkthrough
    read as someone else's leftovers.
    """
    with db.transaction() as conn:
        db.reset(conn)
    seed_catalogue()

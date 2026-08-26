"""
State has to survive a restart: a demo that resets mid-judging has failed.

And it has to survive a *second process*, which is the part the old JSON
snapshot could not do. The guarantees used to rest on a ``threading.Lock``, so
they were true of one worker and quietly false of two. The last three tests here
start real subprocesses against the same database and check that the claims hold
between them — if they ever stop holding, this build is back to promising
something it cannot deliver.
"""

import os
import subprocess
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from conftest import BOOKABLE_DAY  # noqa: E402
from app import booking_engine as be  # noqa: E402
from app import db  # noqa: E402
from app.booking_models import AppStatus, LicenceKind  # noqa: E402


def _restart() -> None:
    """
    A restart in miniature: drop every open connection, the way stopping the
    process does. Nothing is cached between calls — each one reads the database
    — so reconnecting is the whole of what a restart changes.
    """
    db.engine().dispose()


def _in_a_separate_process(body: str, timeout: int = 60, **env_extra) -> subprocess.Popen:
    """
    Run a snippet against the same database, in its own interpreter.

    Not a thread. A thread would share this process's lock, its connection pool
    and its module state, which is precisely the thing under test — the previous
    engine passed every threaded test and would still have double-booked across
    two uvicorn workers.
    """
    env = {**os.environ, "DATABASE_URL": db.url(), "BACKEND": str(BACKEND),
           "PYTHONIOENCODING": "utf-8", **env_extra}
    env.pop("STATE_FILE", None)
    return subprocess.Popen(
        [sys.executable, "-c", "import os, sys; sys.path.insert(0, os.environ['BACKEND'])\n" + body],
        cwd=str(BACKEND), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8",
    )


def _output(proc: subprocess.Popen, timeout: int = 60) -> str:
    out, err = proc.communicate(timeout=timeout)
    assert proc.returncode == 0, f"child failed:\n{err}"
    return out.strip()


# --------------------------------------------------------------------------
# Survives a restart
# --------------------------------------------------------------------------

def test_a_whole_journey_survives_a_restart():
    be.seed_catalogue()
    app = be.apply("persist-citizen", LicenceKind.LL, "mh01", "persist-key-1",
                   dob="2008-03-14")
    slot = be.list_free_slots("mh01", BOOKABLE_DAY)[0]
    be.book_slot(app.id, slot.id)
    token = be.check_in(app.id)
    chain_head = be.get_application(app.id).ledger[-1].hash

    _restart()

    revived = be.get_application(app.id)
    assert revived is not None
    assert revived.display_no == app.display_no
    assert revived.status == AppStatus.CHECKED_IN
    # The hash chain has to come back intact, or the receipt's whole claim is void.
    assert revived.verify_ledger() is True
    assert revived.ledger[-1].hash == chain_head

    assert be.queue_status(token.id)["token_number"] == token.number
    # And the tracker can still find it the way a citizen would.
    assert be.find_by_number(app.display_no, "2008-03-14") is not None


def test_a_booked_slot_is_still_booked_after_a_restart():
    be.seed_catalogue()
    app = be.apply("persist-slot", LicenceKind.LL, "mh02", "persist-key-2")
    slot = be.list_free_slots("mh02", BOOKABLE_DAY)[0]
    be.book_slot(app.id, slot.id)

    _restart()

    assert be.get_slot(slot.id).is_free is False, "a restart handed a held slot back out"
    assert slot.id not in {s.id for s in be.list_free_slots("mh02", BOOKABLE_DAY)}


def test_the_application_counter_does_not_reissue_numbers():
    be.seed_catalogue()
    first = be.apply("persist-seq", LicenceKind.LL, "mh01", "persist-key-3").display_no
    _restart()
    second = be.apply("persist-seq-2", LicenceKind.LL, "mh01", "persist-key-4").display_no
    assert second != first, "the counter reset, so two applications share a number"


# --------------------------------------------------------------------------
# The guarantees are constraints, not conventions
# --------------------------------------------------------------------------

def test_the_database_refuses_a_second_application_on_one_idempotency_key():
    """
    Not `be.apply` twice — that path is tested elsewhere and could be made to
    work by a Python check alone. This writes straight past the engine, the way
    a second service or a careless migration would, and the database still says
    no.
    """
    app = be.apply("constraint-idem", LicenceKind.LL, "mh01", "constraint-key-1")
    with pytest.raises(IntegrityError):
        with db.transaction() as conn:
            conn.execute(db.applications.insert().values(
                id="forged-1", seq=999999, display_no="SS-2026-999999",
                citizen_ref="constraint-idem", licence_kind="learner", rto_id="mh01",
                status="submitted", idempotency_key=app.idempotency_key,
                created_at="2026-01-01T00:00:00+00:00", dob=None,
                applicant_name=None, licence_classes="[]",
                booking_id=None, token_id=None))


def test_the_database_refuses_a_second_booking_on_one_slot():
    be.seed_catalogue()
    app = be.apply("constraint-slot", LicenceKind.LL, "mh03", "constraint-key-2")
    slot = be.list_free_slots("mh03", BOOKABLE_DAY)[0]
    booking = be.book_slot(app.id, slot.id)

    with pytest.raises(IntegrityError):
        with db.transaction() as conn:
            conn.execute(db.bookings.insert().values(
                id="forged-2", application_id="somebody-else", slot_id=booking.slot_id,
                rto_id="mh03", tester_id="mh03_t1",
                slot_date=db.d_out(BOOKABLE_DAY), start="09:30",
                created_at="2026-01-01T00:00:00+00:00"))


def test_the_ledger_refuses_an_event_written_over_an_existing_one():
    """
    The anti-corruption claim in its strongest form. Editing a recorded event
    through the engine is impossible because the engine only inserts; editing it
    around the engine is impossible because the position is a primary key. What
    is left to a forger is deleting and rewriting the whole tail, which changes
    the chain head the citizen already holds.
    """
    app = be.apply("constraint-ledger", LicenceKind.LL, "mh01", "constraint-key-3")
    with pytest.raises(IntegrityError):
        with db.transaction() as conn:
            conn.execute(db.ledger.insert().values(
                application_id=app.id, seq=0,
                at="2026-01-01T00:00:00+00:00", status="verified",
                note="Documents verified after payment received in cash.",
                prev_hash="", hash="0" * 64))


# --------------------------------------------------------------------------
# Across processes — what the lock could never do
# --------------------------------------------------------------------------

_RACER = """
import os, time
from app import booking_engine as be
at = float(os.environ["RACE_AT"])
while time.time() < at:
    time.sleep(0.002)
try:
    be.book_slot(os.environ["APP_ID"], os.environ["SLOT_ID"])
    print("won")
except (be.SlotTaken, be.AlreadyBooked):
    print("lost")
"""


@pytest.mark.slow
def test_separate_processes_cannot_sell_the_same_slot():
    """
    Six interpreters, one slot, released together.

    This is the test the previous engine could not have passed. Its lock lived
    in one process, so `uvicorn --workers 2` would have sold this slot twice and
    every threaded test in the suite would still have been green.
    """
    be.seed_demo("rto_mp_race", BOOKABLE_DAY)
    slot = be.list_free_slots("rto_mp_race", BOOKABLE_DAY)[0]
    apps = [be.apply(f"mp{i}", LicenceKind.LL, "rto_mp_race", f"mp-race-{i}")
            for i in range(6)]

    # A shared wall-clock start, so the children contend rather than queue: they
    # spend their interpreter startup before the barrier, not during the race.
    at = time.time() + 4.0
    children = [_in_a_separate_process(_RACER, APP_ID=a.id, SLOT_ID=slot.id,
                                       RACE_AT=str(at)) for a in apps]
    results = [_output(c) for c in children]

    assert results.count("won") == 1, f"double-booked across processes: {results}"
    assert results.count("lost") == 5
    # And the winner is recorded, not merely reported.
    assert be.get_slot(slot.id).booked_by_application in {a.id for a in apps}


_RETRIER = """
import os
from app import booking_engine as be
from app.booking_models import LicenceKind
a = be.apply(os.environ["REF"], LicenceKind.LL, "mh01", os.environ["KEY"])
print(a.display_no)
"""


@pytest.mark.slow
def test_separate_processes_retrying_one_submit_get_one_application():
    """The idempotency guarantee, held by the database rather than by a dict
    that only the worker which created it can see."""
    be.seed_catalogue()
    key = "cross-process-retry-key"
    children = [_in_a_separate_process(_RETRIER, REF="cross-retry", KEY=key)
                for _ in range(4)]
    numbers = {_output(c) for c in children}
    assert len(numbers) == 1, f"a retry created a second application: {numbers}"


_READER = """
import os
from app import booking_engine as be
a = be.find_by_number(os.environ["NO"], os.environ["DOB"])
print("missing" if a is None else f"{a.status.value}|{a.verify_ledger()}")
"""


@pytest.mark.slow
def test_another_process_reads_the_same_journey():
    """
    What a second uvicorn worker would see. The old snapshot loaded once at
    import, so a worker started before a booking never learned about it.
    """
    be.seed_catalogue()
    app = be.apply("cross-read", LicenceKind.LL, "mh01", "cross-read-key",
                   dob="2007-11-02")
    slot = be.list_free_slots("mh01", BOOKABLE_DAY)[0]
    be.book_slot(app.id, slot.id)
    be.check_in(app.id)

    seen = _output(_in_a_separate_process(_READER, NO=app.display_no, DOB="2007-11-02"))
    assert seen == "checked_in|True"


def test_a_day_that_has_gone_is_not_resurrected_by_a_restart():
    """A restart must not hand yesterday's grid back to the picker."""
    gone = date.today() - timedelta(days=1)
    be.ensure_day("mh01", gone)
    _restart()
    with db.read() as conn:
        built = conn.execute(select(db.slots.c.id).where(
            and_(db.slots.c.rto_id == "mh01",
                 db.slots.c.slot_date == db.d_out(gone)))).first()
    assert built is not None, "the grid itself should still be on disk"
    assert not [s for s in be.list_free_slots("mh01", gone)], \
        "a passed day came back as bookable capacity"

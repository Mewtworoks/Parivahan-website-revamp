"""
Proves the two backend guarantees that fix the real-world failures:
  1. Idempotent apply: 50 retries -> 1 application.
  2. Atomic booking: 40 threads racing one slot -> exactly 1 winner.

Run either way:
    pytest                                  (from the Backend directory)
    python tests/test_concurrency.py        (prints the proof for a demo)
"""

import concurrent.futures as cf
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import booking_engine as be           # noqa: E402
from app.booking_engine import SlotTaken       # noqa: E402
from app.booking_models import LicenceKind     # noqa: E402


def test_idempotent_apply_dedupes_retries():
    key = "same-key-retried"
    ids = [be.apply("cit_1", LicenceKind.LL, "rto_x", key).id for _ in range(50)]
    unique = len(set(ids))
    print(f"idempotency: 50 submits (same key) -> {unique} application(s)")
    assert unique == 1, "retries created duplicates!"


def test_distinct_keys_create_distinct_applications():
    """The flip side: idempotency must not collapse genuinely new submits."""
    ids = {be.apply("cit_2", LicenceKind.LL, "rto_x", f"key-{i}").id for i in range(5)}
    assert len(ids) == 5


def test_atomic_booking_has_exactly_one_winner():
    be.seed_demo("rto_race")
    slot = be.list_free_slots("rto_race")[0]
    apps = [be.apply(f"c{i}", LicenceKind.LL, "rto_race", f"race-i{i}")
            for i in range(40)]

    def grab(a):
        try:
            be.book_slot(a.id, slot.id)
            return True
        except SlotTaken:
            return False

    win = lose = 0
    with cf.ThreadPoolExecutor(max_workers=40) as ex:
        for ok in ex.map(grab, apps):
            win += ok
            lose += (not ok)
    print(f"atomic booking: 40 racing threads -> {win} winner, {lose} rejected")
    assert win == 1 and lose == 39, "double-booking occurred!"

    # And the losers are still free to book elsewhere — no state was corrupted.
    assert be.list_free_slots("rto_race"), "the race consumed unrelated slots"


def test_seed_demo_is_idempotent():
    """Re-seeding the same RTO-day must not duplicate the slot grid."""
    be.seed_demo("rto_reseed")
    first = len(be.list_free_slots("rto_reseed"))
    be.seed_demo("rto_reseed")
    assert len(be.list_free_slots("rto_reseed")) == first


if __name__ == "__main__":
    test_idempotent_apply_dedupes_retries()
    test_distinct_keys_create_distinct_applications()
    test_atomic_booking_has_exactly_one_winner()
    test_seed_demo_is_idempotent()
    print("GUARANTEES HOLD ✅")

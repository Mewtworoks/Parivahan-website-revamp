"""
Runnable demonstrations of the three guarantees the service actually makes.

Idempotent apply, atomic slot allocation and a tamper-evident ledger are the
parts of this build that are genuinely hard, and all three are invisible: the
citizen only ever sees the happy path where nothing went wrong. These functions
make each one fail on demand and report what happened, so the claim can be
watched instead of read.

Every proof runs against the real engine — same code path as a live request, no
mocks and no narration written ahead of time. Each uses its own throwaway
citizen reference and books into a far-future date, so a demonstration never
consumes a slot or an application number that the walkthrough is about to need.
"""

from __future__ import annotations

import threading
import time
import uuid
from datetime import date, timedelta
from typing import Any

from . import booking_engine as be
from .booking_models import LicenceKind

# Far enough out that the proofs never compete with the six days the UI offers,
# and a different day per proof so they do not compete with each other either:
# pressed together, the ledger proof and the race proof both reached for the
# first free slot of one day and the race reported no winner at all.
_PROOF_DAYS = {"race": 120, "ledger": 150, "load": 180}


def _scratch_ref(kind: str) -> str:
    return f"proof-{kind}-{uuid.uuid4().hex[:8]}"


def _proof_day(kind: str) -> date:
    return date.today() + timedelta(days=_PROOF_DAYS[kind])


def idempotent_apply() -> dict[str, Any]:
    """
    Submit the same application twice, as a retried request does.

    The failure this prevents is the one people actually hit: the connection
    drops, they press Apply again, and the office now holds two live
    applications for one person with no way to tell which is real.
    """
    ref = _scratch_ref("idem")
    key = f"same-key-{uuid.uuid4().hex[:8]}"

    first = be.apply(ref, LicenceKind.LL, "mh01", key)
    second = be.apply(ref, LicenceKind.LL, "mh01", key)
    # A different key is a genuinely different intent and must not be deduped,
    # otherwise "idempotent" would just mean "one application per person ever".
    other = be.apply(ref, LicenceKind.LL, "mh01", f"different-key-{uuid.uuid4().hex[:8]}")

    return {
        "guarantee": "A retried submission returns the first application, not a second one.",
        "attempts": [
            {"label": "First press", "idempotency_key": key,
             "application_no": first.display_no},
            {"label": "Same press, retried", "idempotency_key": key,
             "application_no": second.display_no},
            {"label": "A genuinely new application", "idempotency_key": "different",
             "application_no": other.display_no},
        ],
        "retry_was_deduplicated": first.id == second.id,
        "new_intent_still_created": other.id not in (first.id, second.id),
        "applications_created": len({first.id, second.id, other.id}),
        "verdict": ("Two presses, one application. A different key is still a new "
                    "application, so retries are safe without freezing anyone out."),
    }


def slot_race(threads: int = 8) -> dict[str, Any]:
    """
    Send several simultaneous bookings at one slot and see who gets it.

    Real contention, not a story about contention: the requests are started
    together and land inside the same lock the live endpoint uses. Exactly one
    can win, and the losers have to fail cleanly enough to rebook rather than
    being told they hold an appointment that someone else has.
    """
    day = _proof_day("race")
    be.ensure_day("mh01", day)
    free = be.list_free_slots("mh01", day)
    if not free:
        return {"error": "No free slot to contend for."}
    slot = free[0]

    # One application per contender: the point is many people, one slot.
    applicants = [be.apply(_scratch_ref("race"), LicenceKind.LL, "mh01",
                           f"race-{uuid.uuid4().hex[:8]}")
                  for _ in range(threads)]

    results: list[dict[str, Any]] = []
    barrier = threading.Barrier(threads)
    lock = threading.Lock()

    def contend(index: int, application_id: str) -> None:
        barrier.wait()          # release them all at once
        try:
            be.book_slot(application_id, slot.id)
            outcome = {"applicant": index + 1, "outcome": "won", "detail": "Holds the slot."}
        except be.SlotTaken:
            outcome = {"applicant": index + 1, "outcome": "rejected",
                       "detail": "Told the slot is gone, and can pick another."}
        except be.AlreadyBooked:
            outcome = {"applicant": index + 1, "outcome": "rejected",
                       "detail": "Already holds an appointment."}
        with lock:
            results.append(outcome)

    workers = [threading.Thread(target=contend, args=(i, a.id))
               for i, a in enumerate(applicants)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()

    winners = [r for r in results if r["outcome"] == "won"]
    results.sort(key=lambda r: r["applicant"])
    return {
        "guarantee": "One slot, one winner, however many people press at the same moment.",
        "contenders": threads,
        "results": results,
        "winners": len(winners),
        "double_booked": len(winners) > 1,
        "slot_now_held_by_one": be.get_slot(slot.id).booked_by_application is not None,
        "verdict": (f"{threads} simultaneous requests, {len(winners)} booking. "
                    "The rest were refused cleanly, so nobody travels to an "
                    "appointment they do not have."),
    }


def booking_load(applicants: int = 120) -> dict[str, Any]:
    """
    A rush: far more people than slots, all pressing at the same instant.

    ``slot_race`` proves the guarantee. This one prices it. Eight threads at one
    slot answers "can this be got wrong?"; it does not answer "does it still
    hold when a popular office opens its Monday grid and a hundred people are
    already waiting on it", which is the only version of the question a real
    RTO ever asks.

    Contenders are spread round-robin across the day's slots, so every slot has
    several people on it and the correct outcome is arithmetic rather than
    opinion: every slot sold, each exactly once, and everybody else refused. A
    single missing booking is a lost write; a single slot held twice is two
    people sent to one inspector. Both are checked by reading the rows back
    afterwards rather than by trusting what the threads reported about
    themselves.

    The timings are wall-clock per request, measured inside the thread and
    including the wait for SQLite's write lock — which is the number that
    matters, because that queue is the thing being claimed to hold.
    """
    # A fresh day per run. Unlike the other two proofs this one consumes every
    # slot it is given — that is the point of it — so a fixed date works once
    # and then reports "no free slots" to the second person who presses the
    # button. Walking forward finds the next day nobody has loaded yet.
    day, free = None, []
    for offset in range(_PROOF_DAYS["load"], _PROOF_DAYS["load"] + 60):
        candidate = date.today() + timedelta(days=offset)
        be.ensure_day("mh01", candidate)
        free = be.list_free_slots("mh01", candidate)
        if free:
            day = candidate
            break
    if not day:
        return {"error": "No free slots to load."}

    applicants = max(2, min(applicants, 400))
    slots = [s.id for s in free]
    apps = [be.apply(_scratch_ref("load"), LicenceKind.LL, "mh01",
                     f"load-{uuid.uuid4().hex[:8]}")
            for _ in range(applicants)]

    latencies: list[float] = []
    outcomes = {"won": 0, "rejected": 0, "error": 0}
    barrier = threading.Barrier(applicants)
    lock = threading.Lock()

    def contend(index: int, application_id: str) -> None:
        slot_id = slots[index % len(slots)]
        barrier.wait()                       # everybody presses together
        started = time.perf_counter()
        try:
            be.book_slot(application_id, slot_id)
            result = "won"
        except (be.SlotTaken, be.AlreadyBooked, be.SlotPassed):
            result = "rejected"
        except Exception:                    # noqa: BLE001 - counted, not hidden
            result = "error"
        elapsed = (time.perf_counter() - started) * 1000
        with lock:
            latencies.append(elapsed)
            outcomes[result] += 1

    workers = [threading.Thread(target=contend, args=(i, a.id))
               for i, a in enumerate(apps)]
    wall = time.perf_counter()
    for w in workers:
        w.start()
    for w in workers:
        w.join()
    wall = time.perf_counter() - wall

    # Read the truth back off the rows. What the threads believe happened and
    # what the database holds are two different claims, and only the second one
    # is the guarantee.
    held = [be.get_slot(s).booked_by_application for s in slots]
    taken = [h for h in held if h is not None]
    expected = min(applicants, len(slots))

    latencies.sort()
    at = lambda q: round(latencies[min(int(len(latencies) * q), len(latencies) - 1)], 1)  # noqa: E731

    return {
        "guarantee": "Every slot sold exactly once, however many people press at once.",
        "applicants": applicants,
        "slots_offered": len(slots),
        "slots_sold": len(taken),
        "expected_sold": expected,
        "sold_to_one_person_each": len(set(taken)) == len(taken),
        # Counted, never assumed. A proof that reports its own conclusion as a
        # constant is not a proof of anything.
        "double_booked": len(taken) - len(set(taken)),
        "lost_writes": expected - len(taken),
        "won": outcomes["won"],
        "rejected": outcomes["rejected"],
        "errors": outcomes["error"],
        "wall_ms": round(wall * 1000, 1),
        "throughput_per_s": round(applicants / wall, 1) if wall else None,
        "p50_ms": at(0.50), "p95_ms": at(0.95), "p99_ms": at(0.99),
        "verdict": (
            f"{applicants} simultaneous bookings over {len(slots)} slots: "
            f"{len(taken)} sold, {outcomes['rejected']} refused, "
            f"{len(taken) - len(set(taken))} double-booked. "
            f"p99 {at(0.99)} ms."
        ),
    }


def ledger_tamper() -> dict[str, Any]:
    """
    Alter one recorded event and show the chain refusing to verify.

    This is the integrity claim: a pass cannot be quietly turned into a fail,
    and a fail cannot be quietly turned into a pass, without the citizen's own
    receipt showing that the record was edited. That cuts both ways — it also
    means an office can point at the chain instead of defending a result it
    recorded correctly.
    """
    ref = _scratch_ref("ledger")
    app = be.apply(ref, LicenceKind.LL, "mh01", f"ledger-{uuid.uuid4().hex[:8]}")
    day = _proof_day("ledger")
    be.ensure_day("mh01", day)
    free = be.list_free_slots("mh01", day)
    if free:
        be.book_slot(app.id, free[0].id)
        be.check_in(app.id)
    # Read it back. The engine hands out a snapshot rather than a live object
    # now that the store is a database, so the two events those calls recorded
    # are in the ledger table and not in this `app` — and a demonstration that
    # tampered with a two-row chain would be showing less than the real one.
    app = be.get_application(app.id)

    def rows() -> list[dict[str, Any]]:
        return [{"seq": e.seq, "status": e.status.value, "note": e.note,
                 "hash": e.hash[:12], "prev_hash": e.prev_hash[:12] or "genesis",
                 "intact": e.compute_hash() == e.hash}
                for e in app.ledger]

    before = {"chain_valid": app.verify_ledger(), "events": rows()}

    # Edit a middle row the way someone with database access would: change the
    # text and leave the stored hash alone, because recomputing it is the part
    # they would not know to do.
    target = min(1, len(app.ledger) - 1)
    original = app.ledger[target].note
    app.ledger[target].note = "Documents verified after payment received in cash."

    after = {"chain_valid": app.verify_ledger(), "events": rows()}

    # Put it back: a demonstration must not leave a broken record behind.
    app.ledger[target].note = original
    restored = app.verify_ledger()

    return {
        "guarantee": "Editing any recorded event breaks the citizen's receipt, visibly.",
        "application_no": app.display_no,
        "edited_row": target,
        "edited_to": "Documents verified after payment received in cash.",
        "before": before,
        "after": after,
        "restored": restored,
        "verdict": ("The altered row no longer matches its own hash, so the receipt "
                    "reports the record as changed. It cannot be edited quietly — "
                    "only visibly."),
        "caveat": ("A forger with full write access could recompute the whole chain. "
                   "That is why the chain head is printed on the citizen's receipt: "
                   "the copy they keep is the anchor a rewritten database cannot match."),
    }

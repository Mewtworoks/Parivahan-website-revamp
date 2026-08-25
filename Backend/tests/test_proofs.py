"""
The demo panel must demonstrate, not assert.

Each proof runs the real engine, so these tests check that the guarantee
actually holds when the proof exercises it — a panel that reported success
regardless would be worse than no panel.
"""

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app import booking_engine as be  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def test_idempotent_apply_proof_shows_one_application_for_two_presses():
    body = client.post("/proof/idempotent-apply").json()
    assert body["retry_was_deduplicated"] is True
    assert body["new_intent_still_created"] is True
    assert body["applications_created"] == 2, "retry deduped, new intent still created"
    first, retried = body["attempts"][0], body["attempts"][1]
    assert first["application_no"] == retried["application_no"]
    assert body["attempts"][2]["application_no"] != first["application_no"]


def test_slot_race_proof_has_exactly_one_winner():
    body = client.post("/proof/slot-race?contenders=8").json()
    assert body["contenders"] == 8
    assert body["winners"] == 1, f"{body['winners']} winners for one slot"
    assert body["double_booked"] is False
    assert body["slot_now_held_by_one"] is True
    # Everyone who lost has to be told cleanly, or they travel to nothing.
    losers = [r for r in body["results"] if r["outcome"] == "rejected"]
    assert len(losers) == 7 and all(r["detail"] for r in losers)


def test_slot_race_contender_count_is_bounded():
    """An unbounded thread count from a query string is a free denial of service."""
    assert client.post("/proof/slot-race?contenders=9999").json()["contenders"] == 32
    assert client.post("/proof/slot-race?contenders=0").json()["contenders"] == 2


def test_ledger_tamper_proof_breaks_then_restores_the_chain():
    body = client.post("/proof/ledger-tamper").json()
    assert body["before"]["chain_valid"] is True
    assert body["after"]["chain_valid"] is False, "editing a row did not break the chain"
    # The edited row must be the one that reports itself broken.
    edited = body["edited_row"]
    assert body["after"]["events"][edited]["intact"] is False
    assert body["before"]["events"][edited]["intact"] is True
    # And the demonstration must not leave a corrupted record behind.
    assert body["restored"] is True
    assert body["caveat"], "the honest limit of the claim is missing"


def test_proofs_do_not_consume_the_slots_the_demo_needs():
    """
    A proof that books into the days the UI offers would eat the appointment
    the walkthrough is about to make.
    """
    from datetime import date
    before = len(be.list_free_slots("mh01", date.today()))
    client.post("/proof/slot-race?contenders=4")
    client.post("/proof/ledger-tamper")
    assert len(be.list_free_slots("mh01", date.today())) == before


def test_proofs_pressed_together_do_not_steal_each_others_slot():
    """
    All three buttons pressed at once is a normal thing to do.

    Sharing one proof day, the ledger proof took the first free slot the race
    proof had already targeted, and the race then reported no winner at all —
    the panel showed its own guarantee failing.
    """
    import threading

    outcomes: dict[str, Any] = {}
    lock = threading.Lock()

    def press(name: str, path: str) -> None:
        body = client.post(path).json()
        with lock:
            outcomes[name] = body

    threads = [
        threading.Thread(target=press, args=("race", "/proof/slot-race?contenders=6")),
        threading.Thread(target=press, args=("ledger", "/proof/ledger-tamper")),
        threading.Thread(target=press, args=("idem", "/proof/idempotent-apply")),
    ]
    for th in threads:
        th.start()
    for th in threads:
        th.join()

    assert outcomes["race"].get("winners") == 1, \
        f"race lost its slot to another proof: {outcomes['race']}"
    assert outcomes["ledger"]["after"]["chain_valid"] is False
    assert outcomes["idem"]["retry_was_deduplicated"] is True


def test_demo_reset_clears_the_journey_but_keeps_the_offices():
    client.post("/proof/idempotent-apply")
    assert be._APPS, "nothing to reset"
    body = client.post("/demo/reset").json()
    assert body["reset"] is True
    assert be._APPS == {} and be._BOOKINGS == {} and be._TOKENS == {}
    # The catalogue and its slot grids have to come back, or the UI has no
    # offices to offer and the next demo cannot start.
    assert body["offices"] >= 3
    from datetime import date
    assert be.list_free_slots("mh01", date.today()), "reset left no bookable slots"

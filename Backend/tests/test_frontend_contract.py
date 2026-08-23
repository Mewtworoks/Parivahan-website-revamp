"""
The contract the React app depends on. Every test here corresponds to a screen:
if one of these breaks, a page in the UI breaks with it.

Run:  pytest    (from the Backend directory)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient           # noqa: E402

from app.main import app                            # noqa: E402
from app.models import PASS_THRESHOLD, QUESTIONS_PER_TEST  # noqa: E402
from app.seed_scenarios import SCENARIOS            # noqa: E402

client = TestClient(app)

APPLY = {
    "citizen_ref": "9820011121", "licence_kind": "learner", "rto_id": "mh01",
    "idempotency_key": "contract-key-1", "dob": "2005-04-12",
    "applicant_name": "Rehan Mirza", "licence_classes": ["LMV-NT", "MCWG"],
}


def _apply(**over):
    return client.post("/apply", json={**APPLY, **over}).json()


# ------------------------------------------- the legal shell the copy states

def test_test_shell_is_ten_questions_six_to_pass():
    """The UI copy says ten questions, six to pass. The server must agree."""
    assert QUESTIONS_PER_TEST == 10
    assert PASS_THRESHOLD == 6
    started = client.post("/test/start", json={"citizen_id": "cit_shell"}).json()
    assert started["total_questions"] == 10
    assert started["pass_threshold"] == 6


def test_option_position_is_not_a_shortcut():
    """
    Every scenario is authored with its correct option first. If that order
    were served as-is, always tapping the top answer would pass the test.
    """
    assert all(s.correct_option_id == s.options[0].id for s in SCENARIOS), \
        "seed bank no longer authors the correct option first — update this test"

    attempt = client.post("/test/start", json={"citizen_id": "cit_shuffle"}).json()["attempt_id"]
    first_positions = []
    for _ in range(QUESTIONS_PER_TEST):
        served = client.get(f"/test/{attempt}/next").json()["scenario"]
        truth = next(s for s in SCENARIOS if s.id == served["id"]).correct_option_id
        first_positions.append([o["id"] for o in served["options"]].index(truth))
        # Answer whatever is displayed first — the naive strategy.
        client.post(f"/test/{attempt}/answer", json={
            "scenario_id": served["id"],
            "chosen_option_id": served["options"][0]["id"], "time_taken_s": 1.0,
        })

    assert len(set(first_positions)) > 1, \
        f"correct answer always at position {first_positions[0]} — position leaks the answer"
    result = client.get(f"/test/{attempt}/result").json()
    assert result["score"] < QUESTIONS_PER_TEST, \
        "always picking the first option scored full marks"


def test_served_option_order_is_stable_across_refetches():
    """A refresh must not rearrange the answers under the candidate."""
    attempt = client.post("/test/start", json={"citizen_id": "cit_stable"}).json()["attempt_id"]
    once = client.get(f"/test/{attempt}/next").json()["scenario"]
    twice = client.get(f"/test/{attempt}/next").json()["scenario"]
    assert [o["id"] for o in once["options"]] == [o["id"] for o in twice["options"]]


def test_questions_carry_hindi_for_the_language_toggle():
    attempt = client.post("/test/start", json={"citizen_id": "cit_hi"}).json()["attempt_id"]
    scenario = client.get(f"/test/{attempt}/next").json()["scenario"]
    assert scenario["prompt_hi"]
    assert all(o["label_hi"] for o in scenario["options"])


# ----------------------------------------------------- the office list (step 1)

def test_offices_match_the_lists_the_ui_offers():
    mh = client.get("/rtos", params={"state": "Maharashtra"}).json()["rtos"]
    br = client.get("/rtos", params={"state": "Bihar"}).json()["rtos"]
    assert [o["id"] for o in mh] == ["mh01", "mh02", "mh03"]
    assert [o["id"] for o in br] == ["br33", "br06", "br01"]
    # Nearest first, and each row carries what the Tile renders.
    assert mh == sorted(mh, key=lambda o: o["km"])
    for office in mh:
        assert office["name"] and office["area"] and office["wait"]
        assert office["load"] in {"light", "busy"}


def test_unmodelled_state_falls_back_to_maharashtra():
    """Same behaviour the UI's rtosFor() had, so the picker is never empty."""
    out = client.get("/rtos", params={"state": "Kerala"}).json()["rtos"]
    assert [o["id"] for o in out] == ["mh01", "mh02", "mh03"]


def test_office_load_reflects_real_queue_depth():
    before = next(o for o in client.get("/rtos").json()["rtos"] if o["id"] == "mh03")
    app_obj = _apply(rto_id="mh03", idempotency_key="load-probe")
    slot = client.get("/slots", params={"rto_id": "mh03"}).json()["slots"][0]
    client.post("/book", json={"application_id": app_obj["application_id"],
                               "slot_id": slot["slot_id"]})
    client.post(f"/checkin/{app_obj['application_id']}")
    after = next(o for o in client.get("/rtos").json()["rtos"] if o["id"] == "mh03")
    assert after["waiting_now"] == before["waiting_now"] + 1


# --------------------------------------------------- application number + slip

def test_application_number_is_human_quotable_and_stable():
    first = _apply(idempotency_key="number-key")
    again = _apply(idempotency_key="number-key")
    no = first["application_no"]
    assert no.startswith("SS-") and len(no.split("-")) == 3
    assert again["application_no"] == no, "a retry minted a second number"
    assert first["created_at"], "the slip needs a submission date"
    assert first["rto"]["name"], "the slip needs the office name"


def test_tracker_needs_the_number_and_the_date_of_birth():
    app_obj = _apply(idempotency_key="tracker-key", dob="2005-04-12")
    no = app_obj["application_no"]
    assert client.get(f"/application/by-number/{no}",
                      params={"dob": "2005-04-12"}).status_code == 200
    # The number alone must not be enough to read someone's application.
    assert client.get(f"/application/by-number/{no}",
                      params={"dob": "1990-01-01"}).status_code == 404
    assert client.get("/application/by-number/SS-2026-999999",
                      params={"dob": "2005-04-12"}).status_code == 404


# ------------------------------------------------------------ the slot page

def test_date_strip_and_time_strip_fit_the_existing_grid():
    days = client.get("/slots/days", params={"rto_id": "mh01"}).json()["days"]
    assert len(days) == 6, "the UI renders a six-day strip"
    assert all(len(d["label"].split()) == 3 for d in days), days[0]["label"]

    times = client.get("/slots/times",
                       params={"rto_id": "mh01", "on": days[1]["date"]}).json()["times"]
    assert len(times) == 6, "the UI renders a six-time grid"
    # The counter shuts over lunch, so nothing may start inside that window.
    assert all(not x["start"].startswith(("12:", "13:")) for x in times)
    # Anything shown as available must be bookable.
    assert all(x["slot_id"] for x in times if x["left"] > 0)
    assert all(x["slot_id"] is None for x in times if x["left"] == 0)


def test_counts_drop_as_slots_are_taken():
    app_obj = _apply(idempotency_key="count-key")
    days = client.get("/slots/days", params={"rto_id": "mh02"}).json()["days"]
    day = days[2]["date"]
    before = client.get("/slots/times", params={"rto_id": "mh02", "on": day}).json()["times"][0]
    client.post("/book", json={"application_id": app_obj["application_id"],
                               "slot_id": before["slot_id"]})
    after = client.get("/slots/times", params={"rto_id": "mh02", "on": day}).json()["times"][0]
    assert after["left"] == before["left"] - 1


def test_application_view_carries_booking_and_queue_for_the_status_page():
    app_obj = _apply(idempotency_key="view-key")
    app_id = app_obj["application_id"]
    assert "booking" not in app_obj and "queue" not in app_obj

    slot = client.get("/slots", params={"rto_id": "mh01"}).json()["slots"][0]
    client.post("/book", json={"application_id": app_id, "slot_id": slot["slot_id"]})
    booked = client.get(f"/application/{app_id}").json()
    assert booked["booking"]["label"] and booked["booking"]["time"]

    client.post(f"/checkin/{app_id}")
    checked_in = client.get(f"/application/{app_id}").json()
    assert checked_in["queue"]["token_number"] >= 1
    assert checked_in["queue"]["tester"]

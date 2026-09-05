"""
End-to-end journey over the HTTP surface: apply -> slots -> book -> check in
-> queue -> tester calls next -> tamper-evident receipt. Plus the ledger
tamper check and a full scenario test run, however long QUESTIONS_PER_TEST is.

Run:  pytest    (from the Backend directory)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest                                       # noqa: E402
from fastapi.testclient import TestClient           # noqa: E402

from conftest import BOOKABLE_DAY, applicant
from app import booking_engine as be                # noqa: E402
from app.agent_tools import DEFAULT_RTO             # noqa: E402
from app.main import app                            # noqa: E402
from app.models import PASS_THRESHOLD, QUESTIONS_PER_TEST  # noqa: E402
from app.seed_scenarios import SCENARIOS, sanity_check, scenario_by_id  # noqa: E402

client = TestClient(app)


def test_scenario_bank_is_valid():
    """A bad seed edit fails here, not in front of a judge."""
    sanity_check()


def test_apply_is_idempotent_over_http():
    body = {"citizen_ref": "cit_http", "licence_kind": "learner",
            "rto_id": DEFAULT_RTO, "idempotency_key": "http-key-1"}
    first = client.post("/apply", json=body).json()
    second = client.post("/apply", json=body).json()
    assert first["application_id"] == second["application_id"]
    assert first["status"] == "verified"


def test_full_journey_to_tamper_evident_receipt():
    apply_res = client.post("/apply", json={
        "citizen_ref": "cit_journey", "licence_kind": "learner",
        "rto_id": DEFAULT_RTO, "idempotency_key": "journey-key-1",
    })
    assert apply_res.status_code == 200
    app_id = apply_res.json()["application_id"]

    slots = client.get("/slots", params={"rto_id": DEFAULT_RTO, "on": BOOKABLE_DAY.isoformat()}).json()
    assert slots["count"] > 0
    slot_id = slots["slots"][0]["slot_id"]

    booked = client.post("/book", json={"application_id": app_id,
                                        "slot_id": slot_id})
    assert booked.status_code == 200
    tester_id = booked.json()["tester_id"]

    # Booking the same slot again must be refused, not silently duplicated.
    assert client.post("/book", json={"application_id": app_id,
                                      "slot_id": slot_id}).status_code == 409

    token = client.post(f"/checkin/{app_id}").json()
    # Checking in twice returns the same token, it does not burn a number.
    assert client.post(f"/checkin/{app_id}").json()["token_id"] == token["token_id"]

    q = client.get(f"/queue/{token['token_id']}").json()
    assert q["token_number"] == token["token_number"]
    assert q["status"] == "waiting"
    assert q["eta_minutes"] >= 0

    board = client.get(f"/rto/{DEFAULT_RTO}/board").json()
    assert any(lane["tester_id"] == tester_id for lane in board["lanes"])

    called = client.post(f"/tester/{tester_id}/call-next").json()
    assert called["now_serving"] is not None

    # Once the tester clears this token, the journey reaches completed.
    client.post(f"/tester/{tester_id}/call-next")
    receipt = client.get(f"/application/{app_id}/receipt").json()
    assert receipt["chain_valid"] is True
    statuses = [e["status"] for e in receipt["events"]]
    assert statuses == ["submitted", "verified", "slot_booked",
                        "checked_in", "completed"]


def test_ledger_tampering_is_detected():
    """
    The anti-corruption claim, actually exercised: rewrite a recorded event
    behind the API's back and the receipt must report chain_valid == false.

    The edit goes into the ledger table directly, which is both the real threat
    model — somebody with database access, not somebody with a Python reference
    — and the only tampering that still means anything. The engine hands out a
    snapshot, so editing what `get_application` returned would prove nothing
    about what the next request reads.
    """
    from sqlalchemy import and_ as _and

    from app import db

    res = client.post("/apply", json={
        "citizen_ref": "cit_tamper", "licence_kind": "learner",
        "rto_id": DEFAULT_RTO, "idempotency_key": "tamper-key-1",
    }).json()
    app_id = res["application_id"]
    assert be.get_application(app_id).verify_ledger() is True

    with db.transaction() as conn:
        conn.execute(db.ledger.update()
                     .where(_and(db.ledger.c.application_id == app_id,
                                 db.ledger.c.seq == 0))
                     .values(note="Bribe accepted — approved."))

    assert be.get_application(app_id).verify_ledger() is False
    assert client.get(f"/application/{app_id}/receipt").json()["chain_valid"] is False


def test_unknown_ids_are_404_not_500():
    assert client.get("/application/nope").status_code == 404
    assert client.get("/queue/nope").status_code == 404
    assert client.get("/test/nope/result").status_code == 404
    assert client.post("/tester/nope/call-next").status_code == 404


def test_full_test_run_serves_unique_scenarios_and_scores():
    start = client.post("/test/start", json={"citizen_id": "cit_test"}).json()
    attempt_id = start["attempt_id"]
    assert start["total_questions"] == QUESTIONS_PER_TEST
    assert start["pass_threshold"] == PASS_THRESHOLD

    served, correct = [], 0
    for _ in range(QUESTIONS_PER_TEST):
        nxt = client.get(f"/test/{attempt_id}/next").json()
        assert nxt["done"] is False
        sc_public = nxt["scenario"]
        assert "correct_option_id" not in sc_public, "answer leaked to the client"
        served.append(sc_public["id"])

        # Answer everything correctly so the pass path is exercised.
        truth = scenario_by_id(sc_public["id"]).correct_option_id
        ans = client.post(f"/test/{attempt_id}/answer", json={
            "scenario_id": sc_public["id"],
            "chosen_option_id": truth,
            "time_taken_s": 3.5,
        }).json()
        assert ans["correct"] is True
        correct += 1
        assert ans["score_so_far"] == correct

    assert len(set(served)) == QUESTIONS_PER_TEST, "a question was repeated"
    assert client.get(f"/test/{attempt_id}/next").json()["done"] is True

    result = client.get(f"/test/{attempt_id}/result").json()
    assert result["status"] == "passed"
    assert result["score"] == QUESTIONS_PER_TEST
    assert sum(v["correct"] for v in result["by_competency"].values()) == QUESTIONS_PER_TEST


def test_out_of_order_and_bogus_answers_are_rejected():
    attempt_id = client.post("/test/start",
                             json={"citizen_id": "cit_order"}).json()["attempt_id"]
    expected = client.get(f"/test/{attempt_id}/next").json()["scenario"]["id"]
    wrong_scenario = next(s.id for s in SCENARIOS if s.id != expected)

    assert client.post(f"/test/{attempt_id}/answer", json={
        "scenario_id": wrong_scenario, "chosen_option_id": "a", "time_taken_s": 1,
    }).status_code == 400

    assert client.post(f"/test/{attempt_id}/answer", json={
        "scenario_id": expected, "chosen_option_id": "does_not_exist",
        "time_taken_s": 1,
    }).status_code == 400


def test_proctor_violation_voids_the_attempt():
    attempt_id = client.post("/test/start",
                             json={"citizen_id": "cit_proctor"}).json()["attempt_id"]
    res = client.post(f"/test/{attempt_id}/proctor",
                      json={"flag": "identity_mismatch"}).json()
    assert res["status"] == "voided"

    sid = client.get(f"/test/{attempt_id}/next").json()["scenario"]["id"]
    assert client.post(f"/test/{attempt_id}/answer", json={
        "scenario_id": sid, "chosen_option_id": "a", "time_taken_s": 1,
    }).status_code == 400


# ----------------------------- the voice agent -----------------------------

def _dispatch(tool, **arguments):
    res = client.post("/agent/dispatch", json={"tool": tool, "arguments": arguments})
    assert res.status_code == 200, res.text
    return res.json()


def test_agent_tool_schema_matches_the_dispatcher():
    """Every advertised tool must actually dispatch — no dead schema entries."""
    tools = client.get("/agent/tools").json()["tools"]
    names = {t["name"] for t in tools}
    assert names, "no tools advertised"
    for t in tools:
        assert t["parameters"]["type"] == "object"
    # A tool the model could call but the backend cannot run is a live failure.
    assert names == {
        "get_journey_status", "explain_ll_step", "start_practice_test",
        "list_competencies", "list_offices", "apply_for_licence",
        "find_slot_days", "find_slots", "book_slot", "check_in", "check_queue",
    }


def test_agent_apply_is_retry_safe():
    """
    A fresh idempotency key per agent call would defeat guarantee #1 — the
    model retrying its own tool call would create duplicate applications.
    """
    a = _dispatch("apply_for_licence", **applicant("cit_agent"))
    b = _dispatch("apply_for_licence", **applicant("cit_agent"))
    assert a["application_id"] == b["application_id"]


def test_agent_walks_the_journey_and_reports_real_status():
    cid = "cit_agent_flow"
    assert _dispatch("get_journey_status", citizen_id=cid)["stage"] == "not_started"

    applied = _dispatch("apply_for_licence", **applicant(cid))
    app_id = applied["application_id"]
    assert _dispatch("get_journey_status", citizen_id=cid)["stage"] == "verified"

    slot = _dispatch("find_slots", date=BOOKABLE_DAY.isoformat())["slots"][0]
    assert _dispatch("book_slot", application_id=app_id, slot_id=slot["slot_id"])["ok"]
    # Losing the race is reported as advice, not as an exception to the model.
    retry = _dispatch("book_slot", application_id=app_id, slot_id=slot["slot_id"])
    assert retry["ok"] is False and retry["reason"]

    status = _dispatch("get_journey_status", citizen_id=cid)
    assert status["stage"] == "slot_booked"
    assert status["appointment"]["time"] == slot["time"]

    token = _dispatch("check_in", application_id=app_id)
    assert token["ok"] is True
    assert _dispatch("check_queue", token_id=token["token_id"])["token_number"] \
        == token["token_number"]
    assert _dispatch("get_journey_status", citizen_id=cid)["stage"] == "checked_in"


def test_agent_explains_steps_in_both_languages():
    en = _dispatch("explain_ll_step", step="pass_criteria", language="en")
    hi = _dispatch("explain_ll_step", step="pass_criteria", language="hi")
    # Read off the shell the test actually runs on rather than hardcoded: this
    # line asserted "9 of 15" long after the test became 10 questions passing
    # at 6, so it was pinning the wrong answer in place.
    assert str(PASS_THRESHOLD) in en["text"] and en["language"] == "en"
    assert hi["text"] != en["text"] and hi["language"] == "hi"
    assert "error" in _dispatch("explain_ll_step", step="not_a_step")


def test_unknown_agent_tool_is_a_client_error():
    res = client.post("/agent/dispatch", json={"tool": "rm_rf", "arguments": {}})
    assert res.status_code == 400


def test_turning_up_early_does_not_jump_the_queue():
    """
    The lane is ordered by appointment, not by arrival.

    Token numbers are issued in arrival order, and the lane used to be sorted by
    them — so someone with a 3:30 appointment who came at dawn took token #1 and
    stood ahead of the 9:30 appointment. That is the "come early and hover"
    behaviour a booked slot exists to abolish, and it contradicted the promise
    on the booking screen that an appointment is not a queue token.
    """
    # Its own office, so a slot another test happened to take cannot decide
    # whether this one has two free times on one inspector.
    rto = "rto_queue_order"
    be.seed_demo(rto, BOOKABLE_DAY)
    lane = be.list_free_slots(rto, BOOKABLE_DAY)[0].tester_id
    on_that_lane = sorted(
        (s for s in be.list_free_slots(rto, BOOKABLE_DAY) if s.tester_id == lane),
        key=lambda s: s.start,
    )
    earliest, latest = on_that_lane[0], on_that_lane[-1]

    late_appt = be.apply("cit_dawn", be.LicenceKind.LL, rto, "queue-late")
    early_appt = be.apply("cit_ontime", be.LicenceKind.LL, rto, "queue-early")
    be.book_slot(late_appt.id, latest.id)
    be.book_slot(early_appt.id, earliest.id)

    # The later appointment arrives — and checks in — first.
    dawn_token = be.check_in(late_appt.id)
    ontime_token = be.check_in(early_appt.id)
    assert dawn_token.number < ontime_token.number, "arrival order still numbers the tokens"

    dawn = be.queue_status(dawn_token.id)
    ontime = be.queue_status(ontime_token.id)
    assert ontime["position_in_lane"] < dawn["position_in_lane"]
    assert ontime["people_ahead"] == 0 and ontime["eta_minutes"] == 0
    # And the inspector calls the earlier appointment, not the earlier arrival.
    assert be.call_next(lane).id == ontime_token.id


def _stale_slot_id() -> str:
    """A real slot on a day that has gone. Built rather than waited for, so the
    assertion does not depend on what time the suite happens to run."""
    from datetime import date, timedelta

    from sqlalchemy import and_, select

    from app import db

    gone = date.today() - timedelta(days=1)
    be.ensure_day("mh01", gone)
    # Read straight from the table: every engine accessor filters a passed day
    # out, which is the behaviour under test — there is no public call that
    # hands one back, and adding one purely for this test would be adding the
    # hole the test is here to prove is closed.
    with db.read() as conn:
        return conn.execute(
            select(db.slots.c.id).where(and_(db.slots.c.rto_id == "mh01",
                                             db.slots.c.slot_date == db.d_out(gone)))
        ).scalar()


def test_a_time_that_has_gone_is_not_offered():
    """
    The picker offered 9:30 this morning at ten past three in the afternoon,
    and counted those slots into the day's "18 left". A time already past is
    not capacity.
    """
    from datetime import date, timedelta
    gone = date.today() - timedelta(days=1)
    be.ensure_day("mh01", gone)

    assert be.list_free_slots("mh01", gone) == []
    assert be.slot_times("mh01", gone) == []
    # And the day strip counts only what can still be taken.
    today_row = next(d for d in be.slot_days("mh01")
                     if d["date"] == date.today().isoformat())
    still_open = len(be.list_free_slots("mh01", date.today()))
    assert today_row["left"] == still_open


def test_booking_a_time_that_has_gone_is_refused():
    """
    Hiding it in the list is not the same as refusing to sell it — a slot id
    can be held by a page left open, or by a voice turn that took a few rounds.
    """
    applied = client.post("/apply", json={
        "citizen_ref": "cit_stale", "licence_kind": "learner",
        "rto_id": "mh01", "idempotency_key": "stale-key-1",
    }).json()

    refused = client.post("/book", json={"application_id": applied["application_id"],
                                         "slot_id": _stale_slot_id()})
    assert refused.status_code == 409
    assert "passed" in refused.json()["detail"].lower()
    # Refused cleanly: the application is untouched and can still book properly.
    assert client.get(f"/application/{applied['application_id']}").json()["booking_id"] is None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))


def _pass_the_theory_test(citizen_ref: str) -> str:
    """Sit the whole test and answer every question correctly."""
    attempt_id = client.post("/test/start",
                             json={"citizen_id": citizen_ref}).json()["attempt_id"]
    for _ in range(QUESTIONS_PER_TEST):
        sc = client.get(f"/test/{attempt_id}/next").json()["scenario"]
        client.post(f"/test/{attempt_id}/answer", json={
            "scenario_id": sc["id"],
            "chosen_option_id": scenario_by_id(sc["id"]).correct_option_id,
            "time_taken_s": 2.0,
        })
    return attempt_id


def test_passing_the_theory_test_is_recorded_on_the_application():
    """
    The learner's journey ends at the online test, so the pass has to reach the
    sealed record. It used to live only in the browser: clearing site data lost
    a licence, and nothing on the server could answer whether this citizen had
    finished — which is what the driving-test screen and Saarthi have to ask
    before offering an appointment.
    """
    ref = "cit_pass_recorded"
    app_obj = be.apply(ref, be.LicenceKind.LL, DEFAULT_RTO, "pass-key-1",
                       dob="2000-04-11", applicant_name="Pass Recorded",
                       licence_classes=["MCWG"])
    assert be.get_application(app_obj.id).status.value == "verified"

    _pass_the_theory_test(ref)

    after = be.get_application(app_obj.id)
    assert after.status.value == "issued"
    assert "Theory test passed" in after.ledger[-1].note
    # The chain still has to verify — the pass is an appended event, not an edit.
    assert after.verify_ledger() is True


def test_the_pass_is_recorded_once_however_often_it_is_asked_for():
    """
    The ledger's composite key refuses a rewrite at a position already taken. It
    does not refuse a second event at the next one, so the guard against a
    double pass has to be an explicit status check rather than the schema.
    """
    ref = "cit_pass_twice"
    app_obj = be.apply(ref, be.LicenceKind.LL, DEFAULT_RTO, "pass-key-2",
                       dob="2000-04-11", applicant_name="Pass Twice",
                       licence_classes=["MCWG"])
    _pass_the_theory_test(ref)
    before = len(be.get_application(app_obj.id).ledger)

    be.record_learner_pass(ref)
    be.record_learner_pass(ref)

    assert len(be.get_application(app_obj.id).ledger) == before


def test_a_pass_without_an_application_is_not_an_error():
    """Anyone may sit the test — including somebody practising before applying."""
    assert be.record_learner_pass("cit_never_applied") is None


def test_an_idempotency_key_does_not_hand_over_another_citizens_application():
    """
    The key is the retry guarantee, and it used to be a bearer token as well:
    presenting one returned whatever it had created, whoever asked. The agent
    derives its keys from the citizen reference, which is a phone number — so
    knowing somebody's number was enough to read their name, date of birth,
    ledger and appointment back out of a public endpoint.
    """
    mine = {"citizen_ref": "cit_owner", "licence_kind": "learner",
            "rto_id": DEFAULT_RTO, "idempotency_key": "owned-key",
            "applicant_name": "Real Owner", "dob": "2000-01-01"}
    first = client.post("/apply", json=mine).json()
    assert first["applicant_name"] == "Real Owner"

    stolen = dict(mine, citizen_ref="cit_thief", applicant_name="Someone Else")
    refused = client.post("/apply", json=stolen)
    assert refused.status_code == 403
    assert "Real Owner" not in refused.text

    # The owner's own retry still returns the same application, unchanged.
    again = client.post("/apply", json=mine).json()
    assert again["application_id"] == first["application_id"]

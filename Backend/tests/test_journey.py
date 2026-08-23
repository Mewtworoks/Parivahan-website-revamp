"""
End-to-end journey over the HTTP surface: apply -> slots -> book -> check in
-> queue -> tester calls next -> tamper-evident receipt. Plus the ledger
tamper check and a full 15-scenario test run.

Run:  pytest    (from the Backend directory)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest                                       # noqa: E402
from fastapi.testclient import TestClient           # noqa: E402

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

    slots = client.get("/slots", params={"rto_id": DEFAULT_RTO}).json()
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
    The anti-corruption claim, actually exercised: rewrite a ledger note
    behind the API's back and the receipt must report chain_valid == false.
    """
    res = client.post("/apply", json={
        "citizen_ref": "cit_tamper", "licence_kind": "learner",
        "rto_id": DEFAULT_RTO, "idempotency_key": "tamper-key-1",
    }).json()
    app_obj = be.get_application(res["application_id"])
    assert app_obj.verify_ledger() is True

    app_obj.ledger[0].note = "Bribe accepted — approved."
    assert app_obj.verify_ledger() is False
    assert client.get(f"/application/{app_obj.id}/receipt").json()["chain_valid"] is False


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
        "list_competencies", "apply_for_licence", "find_slots", "book_slot",
        "check_in", "check_queue",
    }


def test_agent_apply_is_retry_safe():
    """
    A fresh idempotency key per agent call would defeat guarantee #1 — the
    model retrying its own tool call would create duplicate applications.
    """
    a = _dispatch("apply_for_licence", citizen_ref="cit_agent", licence_kind="learner")
    b = _dispatch("apply_for_licence", citizen_ref="cit_agent", licence_kind="learner")
    assert a["application_id"] == b["application_id"]


def test_agent_walks_the_journey_and_reports_real_status():
    cid = "cit_agent_flow"
    assert _dispatch("get_journey_status", citizen_id=cid)["stage"] == "not_started"

    applied = _dispatch("apply_for_licence", citizen_ref=cid, licence_kind="learner")
    app_id = applied["application_id"]
    assert _dispatch("get_journey_status", citizen_id=cid)["stage"] == "verified"

    slot = _dispatch("find_slots")["slots"][0]
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


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

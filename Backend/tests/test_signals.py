"""
The failure log, and the two properties that make it safe to keep.

It exists to answer "which competency do people fail most" and "where does the
form lose them" — real curriculum and service-design signals, both worth
showing. Neither needs a name attached, and attaching one would turn a useful
table into a liability.

So: the reference must not be reversible by somebody holding the table, and the
detail column must not accumulate whatever a caller happens to pass. Both are
asserted here rather than described in a comment, because "no personal
information" is a claim and a claim needs a test.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app import db, signals  # noqa: E402


def _rows(kind: str) -> list[dict]:
    with db.read() as conn:
        return [dict(r) for r in conn.execute(
            select(db.signals).where(db.signals.c.kind == kind)).mappings().all()]


def test_only_the_declared_fields_are_written(monkeypatch):
    """
    An allowlist, not a filter. A filter has to anticipate what to remove, and
    the field that eventually leaks is the one nobody thought of.
    """
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    signals.record("form.unparsed", "9820011021",
                   field="dob", reason="not_understood",
                   # Everything below is what must never survive.
                   transcript="I was born the year my brother finished school",
                   full_name="Sehaj Gaba", phone="9820011021", dob="2008-04-11")

    detail = json.loads(_rows("form.unparsed")[-1]["detail"])
    assert detail == {"field": "dob", "reason": "not_understood"}


def test_an_undeclared_kind_writes_nothing(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    before = len(_rows("something.new"))
    signals.record("something.new", "9820011021", anything="at all")
    assert len(_rows("something.new")) == before


def test_the_reference_is_not_a_bare_digest_of_the_number(monkeypatch):
    """
    An Indian mobile number is about four billion values. A plain sha256 is
    exhausted in seconds on a laptop, so a digest column is reversible by
    anyone holding this table and is not anonymisation at all.
    """
    import hashlib

    monkeypatch.setenv("SECRET_KEY", "server-side-secret")
    signals.record("form.abandoned", "9820011021", field="state")
    stored = _rows("form.abandoned")[-1]["citizen_hash"]

    naive = hashlib.sha256(b"9820011021").hexdigest()[:32]
    assert stored != naive
    # And the whole ten-digit space cannot be walked without the secret.
    assert stored not in {hashlib.sha256(f"98200110{n:02d}".encode()).hexdigest()[:32]
                          for n in range(100)}


def test_the_same_citizen_is_still_the_same_row(monkeypatch):
    """
    Anonymous is not the same as useless: "did this person fail twice" must
    stay answerable, or the aggregate cannot distinguish one frustrated citizen
    from twenty.
    """
    monkeypatch.setenv("SECRET_KEY", "server-side-secret")
    signals.record("form.reasked", "9820011021", field="dob")
    signals.record("form.reasked", "9820011021", field="state")
    signals.record("form.reasked", "9820011099", field="dob")

    hashes = [r["citizen_hash"] for r in _rows("form.reasked")]
    assert hashes[-3] == hashes[-2]
    assert hashes[-1] != hashes[-2]


def test_a_different_secret_gives_a_different_reference(monkeypatch):
    """Proof the secret is doing the work, and not decoration around a digest."""
    monkeypatch.setenv("SECRET_KEY", "one")
    signals.record("tool.error", "9820011021", tool="book_slot", error="SlotTaken")
    first = _rows("tool.error")[-1]["citizen_hash"]

    monkeypatch.setenv("SECRET_KEY", "two")
    signals.record("tool.error", "9820011021", tool="book_slot", error="SlotTaken")
    assert _rows("tool.error")[-1]["citizen_hash"] != first


def test_recording_never_raises(monkeypatch):
    """
    A citizen who has just failed something is the worst possible person to
    hand a second error to.
    """
    monkeypatch.setattr(db, "transaction", lambda: (_ for _ in ()).throw(RuntimeError("gone")))
    signals.record("test.wrong", "9820011021", competency="right_of_way")


def test_the_summary_answers_the_two_questions_it_exists_for(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    for _ in range(3):
        signals.record("test.wrong", "9820011021", competency="right_of_way",
                       scenario_id="sc-1", chosen_option_id="b")
    signals.record("test.wrong", "9820011099", competency="signals",
                   scenario_id="sc-2", chosen_option_id="a")
    signals.record("form.abandoned", "9820011021", field="dob")

    out = signals.summary()
    hardest = {c["name"]: c["count"] for c in out["hardest_competencies"]}
    assert hardest["right_of_way"] >= 3
    assert hardest["right_of_way"] > hardest.get("signals", 0)
    assert any(f["name"] == "dob" for f in out["stalling_fields"])


# --- the call sites ----------------------------------------------------------
#
# The table, the allowlist and the HMAC were all built and tested before
# anything wrote to them, so for a while the service collected two of the eight
# kinds it declares and the dashboard would have been honest and empty. These
# assert that the wiring exists, because a signal nobody records is a comment.

from fastapi.testclient import TestClient  # noqa: E402

from conftest import applicant  # noqa: E402
from app.agent_tools import dispatch_tool  # noqa: E402
from app.main import app  # noqa: E402
from app.seed_scenarios import scenario_by_id  # noqa: E402

client = TestClient(app)


def test_a_wrong_practice_answer_is_counted_against_its_competency(monkeypatch):
    """
    The one signal with a syllabus behind it. Which competency the most people
    get wrong is what a road-safety curriculum should be reading.
    """
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    attempt_id = client.post("/test/start",
                             json={"citizen_id": "sig-test"}).json()["attempt_id"]
    served = client.get(f"/test/{attempt_id}/next").json()["scenario"]
    scenario = scenario_by_id(served["id"])
    wrong = next(o["id"] for o in served["options"]
                 if o["id"] != scenario.correct_option_id)

    before = len(_rows("test.wrong"))
    client.post(f"/test/{attempt_id}/answer",
                json={"scenario_id": served["id"],
                      "chosen_option_id": wrong, "time_taken_s": 1.0})

    rows = _rows("test.wrong")
    assert len(rows) == before + 1
    detail = json.loads(rows[-1]["detail"])
    assert detail["competency"] == scenario.competency.value
    assert detail["chosen_option_id"] == wrong
    # The scenario text and the citizen's own id are not in here.
    assert set(detail) <= {"competency", "scenario_id", "chosen_option_id"}


def test_a_correct_answer_records_nothing():
    """The table is a failure log. A pass is not a failure."""
    attempt_id = client.post("/test/start",
                             json={"citizen_id": "sig-right"}).json()["attempt_id"]
    served = client.get(f"/test/{attempt_id}/next").json()["scenario"]
    scenario = scenario_by_id(served["id"])

    before = len(_rows("test.wrong"))
    client.post(f"/test/{attempt_id}/answer",
                json={"scenario_id": served["id"],
                      "chosen_option_id": scenario.correct_option_id,
                      "time_taken_s": 1.0})
    assert len(_rows("test.wrong")) == before


def test_the_losing_side_of_a_slot_race_is_recorded(monkeypatch):
    """
    An office that keeps losing races is an office short an inspector. That is
    only visible from the losing side, which is the side nobody is looking at.
    """
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    first = dispatch_tool("apply_for_licence", applicant("sig-race-a"))
    second = dispatch_tool("apply_for_licence", applicant("sig-race-b"))
    days = dispatch_tool("find_slot_days", {"rto_id": "mh01"})["days"]
    day = next(d for d in days if d["left"])["date"]
    slot = dispatch_tool("find_slots", {"rto_id": "mh01", "date": day})["slots"][0]

    before = len(_rows("slot.lost"))
    assert client.post("/book", json={"application_id": first["application_id"],
                                      "slot_id": slot["slot_id"]}).status_code == 200
    lost = client.post("/book", json={"application_id": second["application_id"],
                                      "slot_id": slot["slot_id"]})
    assert lost.status_code == 409

    rows = _rows("slot.lost")
    assert len(rows) == before + 1
    detail = json.loads(rows[-1]["detail"])
    assert detail == {"rto_id": "mh01", "day": day, "reason": "taken"}


def test_a_tool_that_raises_is_recorded_and_still_raises(monkeypatch):
    """
    Wrapped once around dispatch rather than added at each of the twelve call
    sites, so the thirteenth is covered by construction. The exception's class
    name is stored and its message is not — messages carry slot ids and
    application numbers, and on a bad day whatever the citizen typed.
    """
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    before = len(_rows("tool.error"))
    try:
        dispatch_tool("no_such_tool", {"citizen_id": "sig-tool"})
    except KeyError:
        pass
    else:
        raise AssertionError("the failure was swallowed instead of re-raised")

    rows = _rows("tool.error")
    assert len(rows) == before + 1
    assert json.loads(rows[-1]["detail"]) == {"tool": "no_such_tool",
                                              "error": "KeyError"}


def test_the_summary_endpoint_is_aggregate_only(monkeypatch):
    """
    Deliberately unauthenticated, so it must carry nothing that needs
    protecting: counts and names, never a row and never a reference.
    """
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    signals.record("test.wrong", "9820011021", competency="roundabout",
                   scenario_id="sc-9", chosen_option_id="c")

    body = client.get("/signals/summary").json()
    assert body["total"] >= 1
    assert {"kind", "count"} == set(body["by_kind"][0])
    assert any(c["name"] == "roundabout" for c in body["hardest_competencies"])

    flat = json.dumps(body)
    assert "citizen_hash" not in flat and "9820011021" not in flat
    assert "detail" not in flat

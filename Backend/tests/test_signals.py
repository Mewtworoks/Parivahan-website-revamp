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

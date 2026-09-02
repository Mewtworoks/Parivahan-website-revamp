"""
What went wrong, with no way back to who it happened to.

The value here is entirely in the aggregate. Which competency the most people
fail is a curriculum signal. Which form field they abandon at is a
service-design signal. Which office loses the most slot races says where to put
the next inspector. None of that needs a name attached, and attaching one would
turn a useful table into a liability.

Two things make the anonymity a property rather than a promise:

**The reference is an HMAC, not a hash.** An Indian mobile number is ten digits
starting 6-9 — about four billion values. A plain ``sha256(phone)`` is exhausted
in seconds on a laptop, so a digest column is reversible by anyone holding the
table and is not anonymisation at all. ``hmac(SECRET_KEY, ...)`` cannot be
reversed without a secret that lives only in the server's environment. The
column is still per-person, so "did the same citizen fail this twice" is
answerable; "which citizen" is not.

**The detail column is allowlisted per kind.** Not filtered, not sanitised —
allowlisted. Anything a caller passes that is not named below is dropped without
comment. That is deliberate: a filter has to anticipate what to remove, and the
thing that eventually leaks is the field nobody thought of. This way a new
caller passing ``transcript=...`` writes nothing, and the test below proves it.

There is no foreign key to any citizen table, and there must never be one.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select

from . import db

log = logging.getLogger("signals")

# What each kind of failure is allowed to record. Adding a key here is a
# deliberate act with a reviewer; passing one that is not here is a no-op.
ALLOWED: dict[str, tuple[str, ...]] = {
    # The practice test. Which competency, which scenario, what they picked.
    "test.wrong": ("competency", "scenario_id", "chosen_option_id"),
    # A form answer that could not be read. The field and the reason, never the
    # words — "I was born the year my brother finished school" is unreadable and
    # is also somebody's family.
    "form.unparsed": ("field", "reason"),
    # The same question asked twice. The clearest sign the flow is failing.
    "form.reasked": ("field",),
    # A form left unfinished, and where it stalled.
    "form.abandoned": ("field",),
    # A reply that wandered off the form and was discarded by the guard.
    "form.offtrack": ("field", "reason"),
    # The slot race, from the losing side.
    "slot.lost": ("rto_id", "day", "reason"),
    "tool.error": ("tool", "error"),
    "model.failed": ("reason", "status"),
}


def _reference(citizen_ref: str) -> str:
    """
    A stable, per-person, non-reversible reference.

    Falls back to a fixed development key when SECRET_KEY is unset, and says so
    once. Silently degrading to an unkeyed digest would be the worst outcome:
    the column would look identical and stop being anonymous.
    """
    secret = os.getenv("SECRET_KEY", "").strip()
    if not secret:
        if not getattr(_reference, "_warned", False):
            log.warning("SECRET_KEY unset — signal references use a development key. "
                        "Set it in .env before this table means anything.")
            _reference._warned = True  # type: ignore[attr-defined]
        secret = "parivahan-dev-only"
    digest = hmac.new(secret.encode(), (citizen_ref or "").encode(), hashlib.sha256)
    return digest.hexdigest()[:32]


def record(kind: str, citizen_ref: str, **fields: Any) -> None:
    """
    Note one failure. Never raises — telemetry must not break a journey.

    A citizen who has just failed something is the worst possible person to hand
    a second error to, so anything that goes wrong here is logged and swallowed.
    """
    try:
        allowed = ALLOWED.get(kind)
        if allowed is None:
            log.warning("unknown signal kind %r, dropped", kind)
            return
        detail = {k: v for k, v in fields.items() if k in allowed and v is not None}
        with db.transaction() as conn:
            conn.execute(db.signals.insert().values(
                id=str(uuid.uuid4()),
                at=db.ts_out(datetime.now(timezone.utc)),
                citizen_hash=_reference(citizen_ref),
                kind=kind,
                detail=json.dumps(detail, ensure_ascii=False),
            ))
    except Exception:  # noqa: BLE001 - see docstring
        log.exception("could not record signal %s", kind)


def summary(limit: int = 20) -> dict[str, Any]:
    """
    The two queries this table exists to answer.

    Kept here rather than in a notebook because a claim that the service learns
    from failure should be runnable, the same way the three guarantees are.
    """
    with db.read() as conn:
        by_kind = conn.execute(
            select(db.signals.c.kind, func.count().label("n"))
            .group_by(db.signals.c.kind)
            .order_by(func.count().desc())
        ).mappings().all()
        rows = conn.execute(
            select(db.signals.c.kind, db.signals.c.detail)
            # form.unparsed belongs here as much as any of them: "the service
            # could not read your answer to this field" is the clearest stall
            # there is, and leaving it out meant the field ranking stayed empty
            # while the commonest failure of all was being recorded.
            .where(db.signals.c.kind.in_(("test.wrong", "form.abandoned",
                                          "form.reasked", "form.offtrack",
                                          "form.unparsed")))
        ).mappings().all()

    competencies: dict[str, int] = {}
    fields: dict[str, int] = {}
    for row in rows:
        try:
            detail = json.loads(row["detail"])
        except ValueError:
            continue
        if row["kind"] == "test.wrong" and detail.get("competency"):
            competencies[detail["competency"]] = competencies.get(detail["competency"], 0) + 1
        if detail.get("field"):
            fields[detail["field"]] = fields.get(detail["field"], 0) + 1

    rank = lambda d: [{"name": k, "count": v}  # noqa: E731
                      for k, v in sorted(d.items(), key=lambda kv: -kv[1])][:limit]
    return {
        "total": sum(r["n"] for r in by_kind),
        "by_kind": [{"kind": r["kind"], "count": r["n"]} for r in by_kind],
        # "What should we teach harder?" and "where does the form lose people?",
        # both answerable without knowing who any of them were.
        "hardest_competencies": rank(competencies),
        "stalling_fields": rank(fields),
    }

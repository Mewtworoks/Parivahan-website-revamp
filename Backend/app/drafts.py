"""
The half-filled form, kept between conversations.

Why this exists at all: Saarthi's form answers used to live on a Python dict
with a thirty-minute timer. Somebody who gave their name and date of birth, then
closed the tab to look at the fee page, came back to a service that had never
heard of them and asked for both again. The answers were never ephemeral — only
where they were stored was.

Why it is not a row in ``applications``: an unfinished form is not an
application. Put one there and it gets a display number, a ledger chain, a place
in the tracker, and ``latest_application_for()`` hands it to the next session as
proof the citizen has already applied. One answered question would be enough to
lock somebody out of applying. A draft is a scratchpad; it is stored like one.

One row per citizen, overwritten. There is no history here on purpose — a
correction ("no, my name is spelled…") must replace the answer, not queue behind
it, and nothing downstream has any use for the wrong version.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from . import db

log = logging.getLogger("drafts")

# Only these are ever stored. Saarthi asks for four things and offers to take a
# fifth; anything else arriving here is a bug in the caller, and writing it
# would quietly widen what this table holds about a person.
FIELDS = ("full_name", "dob", "state", "licence_classes", "phone")


def load(citizen_ref: str) -> dict[str, Any]:
    """Every answer this citizen has given, or an empty dict."""
    if not citizen_ref:
        return {}
    with db.read() as conn:
        row = conn.execute(
            select(db.drafts).where(db.drafts.c.citizen_ref == citizen_ref)
        ).mappings().first()
    if row is None:
        return {}
    try:
        stored = json.loads(row["answers"])
    except ValueError:
        # A draft that cannot be read is not worth failing a conversation over.
        # Starting the form again is a mild annoyance; a 500 on "hello" is not.
        log.warning("unreadable draft for %s, ignoring", citizen_ref[:6])
        return {}
    return {k: v for k, v in stored.items() if k in FIELDS} if isinstance(stored, dict) else {}


def current_field(citizen_ref: str) -> str | None:
    """What was being asked when they walked away, for the resume greeting."""
    if not citizen_ref:
        return None
    with db.read() as conn:
        row = conn.execute(
            select(db.drafts.c.current_field)
            .where(db.drafts.c.citizen_ref == citizen_ref)
        ).mappings().first()
    return row["current_field"] if row else None


def save(citizen_ref: str, answers: dict[str, Any], asking: str | None = None) -> None:
    """
    Write the answers given so far, replacing whatever was there.

    Upsert by hand rather than with an ON CONFLICT clause: the dialects spell
    that three different ways and this file has no reason to care which engine
    it is on. The write is inside one transaction, so the delete-then-insert
    cannot be seen half-done by a reader.
    """
    if not citizen_ref:
        return
    keep = {k: v for k, v in answers.items() if k in FIELDS and v not in (None, "", [])}
    now = db.ts_out(datetime.now(timezone.utc))
    with db.transaction() as conn:
        conn.execute(db.drafts.delete().where(db.drafts.c.citizen_ref == citizen_ref))
        conn.execute(db.drafts.insert().values(
            citizen_ref=citizen_ref[:120],
            answers=json.dumps(keep, ensure_ascii=False),
            current_field=asking,
            updated_at=now,
        ))


def clear(citizen_ref: str) -> None:
    """
    Drop the draft. Called once the application is filed.

    Left behind, the next conversation would offer to resume a form that has
    already been submitted — and the citizen would reasonably conclude the
    submission did not work.
    """
    if not citizen_ref:
        return
    with db.transaction() as conn:
        conn.execute(db.drafts.delete().where(db.drafts.c.citizen_ref == citizen_ref))

"""
Saarthi conversations, stored rather than remembered.

``voice_agent`` used to keep these in a module-level dict. Three things followed
from that, and all three were visible in the demo:

  * a backend restart ended every conversation mid-sentence, including one in
    front of a confirmation button,
  * two uvicorn workers meant two dicts, so the turn that opened the session and
    the turn that answered it could land on different processes and disagree
    about whether an application existed,
  * the thirty-minute timer deleted work the citizen thought was saved.

The dict is still there as a write-through cache — reading a conversation back
out of the database on every turn would be honest and pointless, since the
common case is the same process answering the next turn a few seconds later.
What changed is that the dict is no longer the only copy.

``pending`` is stored with the rest. A reload in front of the confirmation
button used to leave the citizen holding an action they could neither confirm
nor cancel, which is the one outcome the confirmation gate exists to prevent.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from . import db

log = logging.getLogger("conversations")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def save(row: dict[str, Any]) -> None:
    """
    Write a conversation, replacing any earlier state for the same id.

    Delete-then-insert inside one transaction rather than a dialect-specific
    upsert, for the same reason as drafts: nothing here should know which engine
    it is running on.
    """
    with db.transaction() as conn:
        conn.execute(db.conversations.delete()
                     .where(db.conversations.c.id == row["id"]))
        conn.execute(db.conversations.insert().values(
            id=row["id"],
            citizen_ref=row["citizen_ref"][:120],
            messages=json.dumps(row.get("messages") or [], ensure_ascii=False),
            language=row.get("language"),
            application_id=row.get("application_id"),
            rto_id=row.get("rto_id"),
            token_id=row.get("token_id"),
            pending=(json.dumps(row["pending"], ensure_ascii=False)
                     if row.get("pending") else None),
            offered=row.get("offered"),
            created_at=row["created_at"],
            last_seen=row["last_seen"],
        ))


def load(conversation_id: str) -> dict[str, Any] | None:
    """One conversation by id, or None if it was never stored."""
    with db.read() as conn:
        row = conn.execute(
            select(db.conversations)
            .where(db.conversations.c.id == conversation_id)
        ).mappings().first()
    return _decode(row) if row else None


def latest_for(citizen_ref: str, within_minutes: int) -> dict[str, Any] | None:
    """
    The conversation this citizen was last having, if it is recent enough.

    Used when the browser arrives with no session id — a new device, cleared
    storage, or a reload after the server restarted. Picking the recent one back
    up is the difference between "carry on where we were" and "who are you?".
    """
    if not citizen_ref:
        return None
    cutoff = db.ts_out(_now() - timedelta(minutes=within_minutes))
    with db.read() as conn:
        row = conn.execute(
            select(db.conversations)
            .where(db.conversations.c.citizen_ref == citizen_ref)
            .where(db.conversations.c.last_seen > cutoff)
            .order_by(db.conversations.c.last_seen.desc())
        ).mappings().first()
    return _decode(row) if row else None


def drop(conversation_id: str) -> None:
    with db.transaction() as conn:
        conn.execute(db.conversations.delete()
                     .where(db.conversations.c.id == conversation_id))


def _decode(row: Any) -> dict[str, Any] | None:
    try:
        messages = json.loads(row["messages"])
        pending = json.loads(row["pending"]) if row["pending"] else None
    except ValueError:
        # A conversation that will not parse is worse than no conversation: it
        # would be handed to the model as its own history and derail the turn.
        log.warning("unreadable conversation %s, discarding", row["id"][:8])
        return None
    return {
        "id": row["id"],
        "citizen_ref": row["citizen_ref"],
        "messages": messages if isinstance(messages, list) else [],
        "language": row["language"],
        "application_id": row["application_id"],
        "rto_id": row["rto_id"],
        "token_id": row["token_id"],
        "pending": pending,
        "offered": row["offered"],
        "created_at": row["created_at"],
        "last_seen": row["last_seen"],
    }

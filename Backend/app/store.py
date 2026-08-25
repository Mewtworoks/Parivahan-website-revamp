"""
Disk persistence for the booking engine's in-memory stores.

The engine keeps everything in module-level dicts, which is fine until the
process restarts — and a demo that loses its applications halfway through a
judging session is a demo that failed. This module snapshots those dicts to a
single JSON file after each write and restores them at import.

A snapshot, not a database. Every model here is a Pydantic model, so the whole
state serialises and validates in one step, and a file that no longer matches
the code is discarded rather than half-loaded. The cost is that a write rewrites
the file; at prototype volumes that is microseconds and worth the simplicity.
Swapping this for Postgres means replacing this file, not the engine.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import Any, Callable

from pydantic import BaseModel

from .booking_models import RTO, Application, Booking, QueueToken, Slot, Tester

log = logging.getLogger("store")

# Set STATE_FILE=":memory:" to run without touching disk — the test suite does,
# so a test run never inherits or clobbers whatever the demo has built up.
_configured = os.getenv("STATE_FILE", "")
STATE_PATH: Path | None = (
    None if _configured == ":memory:"
    else Path(_configured) if _configured
    else Path(__file__).resolve().parents[1] / "state.json"
)

# Bumped whenever a model changes shape. An older file is dropped rather than
# coerced: a half-migrated application is worse than a clean start.
SCHEMA_VERSION = 1

# name -> the model each value in that dict is. Dicts of plain values (the
# lookup indexes and counters) are listed separately below because they need no
# validation on the way back in.
_MODEL_STORES: dict[str, type[BaseModel]] = {
    "_APPS": Application,
    "_RTOS": RTO,
    "_TESTERS": Tester,
    "_SLOTS": Slot,
    "_BOOKINGS": Booking,
    "_TOKENS": QueueToken,
}
_PLAIN_STORES = ("_APPS_BY_IDEM", "_APPS_BY_CITIZEN", "_APPS_BY_NUMBER", "_TOKEN_SEQ")
_COUNTERS = ("_APP_SEQ",)


def enabled() -> bool:
    return STATE_PATH is not None


def _snapshot(engine: Any) -> dict[str, Any]:
    state: dict[str, Any] = {"version": SCHEMA_VERSION}
    for name in _MODEL_STORES:
        state[name] = {k: v.model_dump(mode="json")
                       for k, v in getattr(engine, name).items()}
    for name in _PLAIN_STORES:
        state[name] = getattr(engine, name)
    for name in _COUNTERS:
        state[name] = getattr(engine, name)
    # A set of tuples has no JSON equivalent, so it goes out as pairs.
    state["_SLOT_DAYS"] = [[rto, str(day)] for rto, day in engine._SLOT_DAYS]
    return state


def save(engine: Any) -> None:
    """
    Write the whole state out, atomically.

    Written to a temporary file in the same directory and then renamed, so a
    crash mid-write leaves the previous good snapshot in place rather than a
    truncated file that fails to load on the next start.
    """
    if STATE_PATH is None:
        return
    try:
        payload = json.dumps(_snapshot(engine), ensure_ascii=False)
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        handle, tmp = tempfile.mkstemp(dir=str(STATE_PATH.parent), suffix=".tmp")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as f:
                f.write(payload)
            os.replace(tmp, STATE_PATH)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
    except Exception as exc:  # a failed save must never break the request
        log.warning("could not persist state: %r", exc)


def load(engine: Any) -> bool:
    """
    Restore a snapshot into the engine's dicts. True if anything was loaded.

    Mutates the existing dicts in place rather than rebinding them, because the
    engine's functions close over those objects by name at module level.
    """
    if STATE_PATH is None or not STATE_PATH.exists():
        return False
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        log.warning("state file unreadable, starting clean: %r", exc)
        return False

    if state.get("version") != SCHEMA_VERSION:
        log.warning("state file is version %s, expected %s — starting clean",
                    state.get("version"), SCHEMA_VERSION)
        return False

    try:
        for name, model in _MODEL_STORES.items():
            target = getattr(engine, name)
            target.clear()
            for key, raw in state.get(name, {}).items():
                target[key] = model.model_validate(raw)
        for name in _PLAIN_STORES:
            target = getattr(engine, name)
            target.clear()
            target.update(state.get(name, {}))
        for name in _COUNTERS:
            setattr(engine, name, state.get(name, getattr(engine, name)))
        engine._SLOT_DAYS.clear()
        engine._SLOT_DAYS.update(
            (rto, date.fromisoformat(day)) for rto, day in state.get("_SLOT_DAYS", []))
    except Exception as exc:
        # Half-restored state is the one outcome worth refusing outright.
        log.warning("state file did not match the models, starting clean: %r", exc)
        for name in _MODEL_STORES:
            getattr(engine, name).clear()
        for name in _PLAIN_STORES:
            getattr(engine, name).clear()
        engine._SLOT_DAYS.clear()
        return False

    log.info("restored %d applications from %s", len(engine._APPS), STATE_PATH)
    return True


def persisted(engine: Any) -> Callable[[Callable], Callable]:
    """
    Decorator: run the function, then snapshot.

    Applied at the engine's write boundaries so persistence is one line per
    mutating call rather than a save() sprinkled through the logic — and so a
    new write path cannot silently forget to persist.
    """
    def wrap(fn: Callable) -> Callable:
        def inner(*args, **kwargs):
            result = fn(*args, **kwargs)
            save(engine)
            return result
        inner.__name__ = fn.__name__
        inner.__doc__ = fn.__doc__
        return inner
    return wrap

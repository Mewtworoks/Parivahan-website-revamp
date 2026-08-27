"""
Data models for the resilient LL/DL journey: application -> slot -> queue.

Three pain points, three models:
  * Application  -> resilient apply flow (idempotent, status always visible)
  * Slot/Booking -> fixed time-slots, atomically allocated (no double-book)
  * QueueToken   -> on-the-day live queue with assigned tester + ETA

All personal fields are mock/synthetic. No real Aadhaar/PAN/OTP anywhere.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, time
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Application  (the resilient apply flow)
# --------------------------------------------------------------------------

class AppStatus(str, Enum):
    SUBMITTED = "submitted"        # received, idempotently
    VERIFIED = "verified"          # docs check passed (mock)
    SLOT_BOOKED = "slot_booked"    # test appointment held
    CHECKED_IN = "checked_in"      # arrived at RTO, in queue
    COMPLETED = "completed"        # test done
    REJECTED = "rejected"


class LicenceKind(str, Enum):
    LL = "learner"
    DL = "permanent"


class JourneyEvent(BaseModel):
    """
    Append-only, hash-chained transparency ledger row. Each event carries the
    hash of the one before it, so altering, inserting, or deleting any event
    breaks every hash after it — the receipt becomes verifiably tampered.
    The point is a record that stands on its own: proof a pass was earned and
    recorded, which nobody has to be trusted to vouch for — the applicant holds
    a receipt that verifies itself, and the office is equally protected by it,
    since a disputed result can be checked rather than argued about.
    """
    seq: int                              # position in the chain (0-based)
    at: datetime
    status: AppStatus
    note: str
    prev_hash: str                        # hash of the previous event ("" for genesis)
    hash: str = ""                        # this event's hash (computed on append)

    def compute_hash(self) -> str:
        payload = f"{self.seq}|{self.at.isoformat()}|{self.status.value}|{self.note}|{self.prev_hash}"
        return hashlib.sha256(payload.encode()).hexdigest()


class Application(BaseModel):
    id: str
    # The number the citizen is told to quote for everything after submission
    # ("SS-2026-004182"). The uuid `id` stays the internal key; this is the one
    # a human reads off an SMS, so the tracker looks up by it.
    display_no: str
    citizen_ref: str                      # mock id; real identity handled upstream
    licence_kind: LicenceKind
    rto_id: str
    status: AppStatus = AppStatus.SUBMITTED
    idempotency_key: str                  # dedupes retries from flaky networks
    created_at: datetime
    # Captured at apply time so the tracker can authenticate a lookup the way
    # the real portal does: application number + date of birth.
    dob: Optional[str] = None
    applicant_name: Optional[str] = None
    licence_classes: list[str] = Field(default_factory=list)
    ledger: list[JourneyEvent] = Field(default_factory=list)
    booking_id: Optional[str] = None
    token_id: Optional[str] = None

    def log(self, status: AppStatus, note: str, at: datetime) -> None:
        self.status = status
        seq = len(self.ledger)
        prev_hash = self.ledger[-1].hash if self.ledger else ""
        ev = JourneyEvent(seq=seq, at=at, status=status, note=note, prev_hash=prev_hash)
        ev.hash = ev.compute_hash()
        self.ledger.append(ev)

    def verify_ledger(self) -> bool:
        """Recompute the whole chain. Any tampering returns False."""
        prev = ""
        for i, ev in enumerate(self.ledger):
            if ev.seq != i or ev.prev_hash != prev:
                return False
            if ev.compute_hash() != ev.hash:
                return False
            prev = ev.hash
        return True

    def receipt(self) -> dict:
        """The citizen's tamper-evident proof-of-journey."""
        return {
            "application_id": self.id,
            "application_no": self.display_no,
            "licence_kind": self.licence_kind.value,
            "final_status": self.status.value,
            "chain_valid": self.verify_ledger(),
            "chain_head": self.ledger[-1].hash if self.ledger else "",
            "events": [
                {"seq": e.seq, "at": e.at.isoformat(), "status": e.status.value,
                 "note": e.note, "hash": e.hash[:16] + "…"}
                for e in self.ledger
            ],
        }


# --------------------------------------------------------------------------
# RTO / Tester / Slot  (fixed time-slot capacity model)
# --------------------------------------------------------------------------

class Tester(BaseModel):
    id: str
    name: str
    rto_id: str
    avg_test_minutes: int = 12            # drives ETA math


class RTO(BaseModel):
    id: str
    name: str
    city: str
    state: str = "Maharashtra"
    area: str = ""                       # "Andheri West, Mumbai"
    km: float = 0.0                      # distance shown to the applicant
    open_time: time = time(9, 30)
    close_time: time = time(16, 0)
    slot_minutes: int = 45               # fixed grid: 9:30, 10:15, 11:00, ...
    # The office shuts the counter over lunch, so no slot starts in this window.
    lunch_from: time = time(12, 30)
    lunch_to: time = time(14, 30)


class Slot(BaseModel):
    """One bookable appointment: a tester at a fixed time on a date."""
    id: str
    rto_id: str
    tester_id: str
    slot_date: date
    start: time
    booked_by_application: Optional[str] = None  # None = free

    @property
    def is_free(self) -> bool:
        return self.booked_by_application is None


class Booking(BaseModel):
    id: str
    application_id: str
    slot_id: str
    rto_id: str
    tester_id: str
    slot_date: date
    start: time
    created_at: datetime


# --------------------------------------------------------------------------
# QueueToken  (on-the-day live queue)
# --------------------------------------------------------------------------

class TokenStatus(str, Enum):
    WAITING = "waiting"
    IN_TEST = "in_test"
    DONE = "done"
    NO_SHOW = "no_show"


class QueueToken(BaseModel):
    id: str
    application_id: str
    rto_id: str
    tester_id: str
    number: int                          # human-facing token number
    status: TokenStatus = TokenStatus.WAITING
    checked_in_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

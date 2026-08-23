"""
Test engine: builds a 15-question test, records answers, enforces the legal
pass shell, and exposes proctoring hooks.

In-memory store for the demo. Swap `_ATTEMPTS` for Postgres in production —
the shapes are already Pydantic models, so persistence is a thin layer.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone

from .models import (
    PASS_THRESHOLD,
    QUESTIONS_PER_TEST,
    AnswerRecord,
    Attempt,
    AttemptStatus,
)
from .seed_scenarios import SCENARIOS, scenario_by_id

_ATTEMPTS: dict[str, Attempt] = {}
_ATTEMPTS_BY_CITIZEN: dict[str, list[str]] = {}   # citizen_id -> attempt ids, oldest first


def _now() -> datetime:
    return datetime.now(timezone.utc)


class BankTooSmall(Exception):
    """The scenario bank cannot fill a test without repeating a question."""


def build_test(citizen_id: str) -> Attempt:
    """
    Select QUESTIONS_PER_TEST scenarios with competency spread so no single
    skill dominates: round-robin across competencies, drawing at random
    within each. Every scenario served is distinct — repeating a question in
    a statutory test would be indefensible, so a bank that cannot fill a
    test raises instead of quietly sampling with replacement.
    """
    if len(SCENARIOS) < QUESTIONS_PER_TEST:
        raise BankTooSmall(
            f"bank has {len(SCENARIOS)} scenarios; need {QUESTIONS_PER_TEST}"
        )

    by_comp: dict[str, list] = {}
    for s in SCENARIOS:
        by_comp.setdefault(s.competency.value, []).append(s)

    chosen: list = []
    comps = list(by_comp.keys())
    random.shuffle(comps)

    # round-robin across competencies for a balanced test
    while len(chosen) < QUESTIONS_PER_TEST:
        drew = False
        for c in comps:
            if not by_comp[c]:
                continue
            chosen.append(by_comp[c].pop(random.randrange(len(by_comp[c]))))
            drew = True
            if len(chosen) == QUESTIONS_PER_TEST:
                break
        if not drew:                      # bank exhausted; guarded above
            break

    attempt = Attempt(
        id=str(uuid.uuid4()),
        citizen_id=citizen_id,
        scenario_ids=[s.id for s in chosen],
        started_at=_now(),
    )
    _ATTEMPTS[attempt.id] = attempt
    _ATTEMPTS_BY_CITIZEN.setdefault(citizen_id, []).append(attempt.id)
    return attempt


def get_attempt(attempt_id: str) -> Attempt | None:
    return _ATTEMPTS.get(attempt_id)


def latest_attempt_for(citizen_id: str) -> Attempt | None:
    """Most recent attempt for a citizen — powers the agent's journey status."""
    ids = _ATTEMPTS_BY_CITIZEN.get(citizen_id)
    return _ATTEMPTS[ids[-1]] if ids else None


def next_scenario_id(attempt: Attempt) -> str | None:
    if attempt.current_index >= QUESTIONS_PER_TEST:
        return None
    return attempt.scenario_ids[attempt.current_index]


def submit_answer(
    attempt: Attempt, scenario_id: str, chosen_option_id: str, time_taken_s: float
) -> AnswerRecord:
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise ValueError("Attempt is not in progress")

    expected = next_scenario_id(attempt)
    if scenario_id != expected:
        raise ValueError(f"Out-of-order answer: expected {expected}, got {scenario_id}")

    scenario = scenario_by_id(scenario_id)
    if scenario is None:
        raise ValueError("Unknown scenario")

    if chosen_option_id not in {o.id for o in scenario.options}:
        raise ValueError(f"Unknown option {chosen_option_id!r} for {scenario_id}")

    correct = chosen_option_id == scenario.correct_option_id
    rec = AnswerRecord(
        scenario_id=scenario_id,
        chosen_option_id=chosen_option_id,
        correct=correct,
        time_taken_s=time_taken_s,
        answered_at=_now(),
    )
    attempt.answers.append(rec)

    if attempt.current_index >= QUESTIONS_PER_TEST:
        _finalize(attempt)

    return rec


def _finalize(attempt: Attempt) -> None:
    attempt.finished_at = _now()
    if attempt.proctor_flags and _is_disqualifying(attempt.proctor_flags):
        attempt.status = AttemptStatus.VOIDED
    elif attempt.score >= PASS_THRESHOLD:
        attempt.status = AttemptStatus.PASSED
    else:
        attempt.status = AttemptStatus.FAILED


# ---------------------------------------------------------------------------
# Proctoring hooks — the LL test is already AI-face-recognition + proctored.
# Keep those guarantees. These are integration points, not full CV here.
# ---------------------------------------------------------------------------

DISQUALIFYING_FLAGS = {"no_face_30s", "multiple_faces", "identity_mismatch"}


def record_proctor_event(attempt: Attempt, flag: str) -> None:
    """Called by the proctoring subsystem (face-match / gaze / tab-switch)."""
    attempt.proctor_flags.append(flag)
    if flag in DISQUALIFYING_FLAGS and attempt.status == AttemptStatus.IN_PROGRESS:
        attempt.status = AttemptStatus.VOIDED
        attempt.finished_at = _now()


def _is_disqualifying(flags: list[str]) -> bool:
    return any(f in DISQUALIFYING_FLAGS for f in flags)

"""
Data models for the reimagined LL theory test.

The key idea: the legal shell of the Learner Licence test is unchanged
(15 questions, 9 correct to pass, Aadhaar-authenticated, proctored). What
changes is that every question is an animated *scenario* ending in a
decision point, instead of a static text MCQ. This file defines how such a
scenario is represented so the backend (scoring, sequencing, proctoring) and
the frontend renderer speak the same language.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Scenario schema  (the contract the frontend renderer builds to)
# ---------------------------------------------------------------------------

class Competency(str, Enum):
    """What real-world judgment the scenario tests. Maps to MV Act themes."""
    RIGHT_OF_WAY = "right_of_way"
    PEDESTRIAN_SAFETY = "pedestrian_safety"
    ROUNDABOUT = "roundabout"
    OVERTAKING = "overtaking"
    EMERGENCY_VEHICLE = "emergency_vehicle"
    LANE_DISCIPLINE = "lane_discipline"
    SIGN_RECOGNITION = "sign_recognition"
    HAZARD_ANTICIPATION = "hazard_anticipation"
    NIGHT_WEATHER = "night_weather"


class CameraKeyframe(BaseModel):
    """A camera pose the renderer plays through before the decision point."""
    t: float = Field(..., description="Seconds from scenario start")
    position: list[float] = Field(..., min_length=3, max_length=3)
    look_at: list[float] = Field(..., min_length=3, max_length=3)


class Actor(BaseModel):
    """A moving/static entity in the scene (car, pedestrian, sign, etc.)."""
    id: str
    kind: str = Field(..., description="e.g. 'car', 'pedestrian', 'sign', 'ambulance'")
    asset: str = Field(..., description="glTF/asset key the renderer resolves")
    # A simple keyframed path: list of [t, x, y, z]. Renderer interpolates.
    path: list[list[float]] = Field(default_factory=list)
    meta: dict = Field(default_factory=dict, description="e.g. {'sign':'STOP'}")


class Option(BaseModel):
    id: str
    label: str                       # shown to candidate ("Slow and give way")
    label_hi: Optional[str] = None   # Hindi label (audience is mobile/vernacular)


class Scenario(BaseModel):
    """One question = one animated scenario ending in a decision point."""
    id: str
    competency: Competency
    difficulty: int = Field(1, ge=1, le=3)
    duration_s: float = Field(..., description="Length of the animated clip")
    prompt: str                      # the question at the decision point
    prompt_hi: Optional[str] = None
    scene_env: str = Field(..., description="preset key: 'urban_intersection', etc.")
    actors: list[Actor] = Field(default_factory=list)
    camera: list[CameraKeyframe] = Field(default_factory=list)
    options: list[Option]
    correct_option_id: str
    explanation: str                 # shown after answer (learning, not just pass/fail)
    mv_act_ref: Optional[str] = None # e.g. "Rule 6, RRR 1989" — credibility for judges

    def public_view(self) -> "ScenarioPublic":
        """Strip the answer before sending to the client."""
        return ScenarioPublic(
            id=self.id,
            competency=self.competency,
            difficulty=self.difficulty,
            duration_s=self.duration_s,
            prompt=self.prompt,
            prompt_hi=self.prompt_hi,
            scene_env=self.scene_env,
            actors=self.actors,
            camera=self.camera,
            options=self.options,
        )


class ScenarioPublic(BaseModel):
    """Exactly what the frontend gets — no correct answer leaks."""
    id: str
    competency: Competency
    difficulty: int
    duration_s: float
    prompt: str
    prompt_hi: Optional[str]
    scene_env: str
    actors: list[Actor]
    camera: list[CameraKeyframe]
    options: list[Option]


# ---------------------------------------------------------------------------
# Test attempt / scoring
# ---------------------------------------------------------------------------

# Legal shell — do not change without a rule change.
# Ten questions, six correct to pass, as the LL theory test is actually set.
QUESTIONS_PER_TEST = 10
PASS_THRESHOLD = 6  # 60%


class AttemptStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    VOIDED = "voided"  # proctoring violation


class AnswerRecord(BaseModel):
    scenario_id: str
    chosen_option_id: str
    correct: bool
    time_taken_s: float
    answered_at: datetime


class Attempt(BaseModel):
    id: str
    citizen_id: str                  # Aadhaar-linked identity ref
    scenario_ids: list[str]          # the 15 served, in order
    answers: list[AnswerRecord] = Field(default_factory=list)
    status: AttemptStatus = AttemptStatus.IN_PROGRESS
    started_at: datetime
    finished_at: Optional[datetime] = None
    proctor_flags: list[str] = Field(default_factory=list)

    @property
    def score(self) -> int:
        return sum(1 for a in self.answers if a.correct)

    @property
    def current_index(self) -> int:
        return len(self.answers)

    def competency_breakdown(self) -> dict[str, dict[str, int]]:
        """
        Per-competency right/wrong tally. This is what turns a pass/fail into
        actionable feedback ("you are weak on roundabouts") — the learning
        goal, not just the certificate.
        """
        from .seed_scenarios import scenario_by_id

        out: dict[str, dict[str, int]] = {}
        for a in self.answers:
            sc = scenario_by_id(a.scenario_id)
            if sc is None:
                continue
            bucket = out.setdefault(sc.competency.value, {"correct": 0, "wrong": 0})
            bucket["correct" if a.correct else "wrong"] += 1
        return out

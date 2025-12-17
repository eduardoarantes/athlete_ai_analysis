"""Pydantic models for workout library schema."""

from typing import Literal

from pydantic import BaseModel


class IntervalPart(BaseModel):
    """Work or recovery part of an interval set."""

    duration_min: float
    power_low_pct: int
    power_high_pct: int
    description: str


class WorkoutSegment(BaseModel):
    """
    A segment within a workout.

    Can be either:
    - Simple segment (warmup, cooldown, steady, recovery) with direct duration/power
    - Interval set with work/recovery parts repeated for N sets
    """

    type: Literal["warmup", "interval", "recovery", "cooldown", "steady", "tempo"]

    # For simple segments (warmup, cooldown, steady, recovery)
    duration_min: float | None = None
    power_low_pct: int | None = None
    power_high_pct: int | None = None
    description: str | None = None

    # For interval sets
    sets: int | None = None
    work: IntervalPart | None = None
    recovery: IntervalPart | None = None


class VariableComponents(BaseModel):
    """Adjustable parameters for workout scaling."""

    adjustable_field: Literal["duration", "sets"]
    min_value: float
    max_value: float

    # Additional fields for 'sets' adjustable type
    tss_per_unit: float | None = None
    duration_per_unit_min: float | None = None


class Workout(BaseModel):
    """A single workout from the library."""

    id: str
    name: str
    detailed_description: str | None = None  # Optional for new workouts
    type: Literal["endurance", "tempo", "sweet_spot", "threshold", "vo2max", "recovery", "mixed"]
    intensity: Literal["easy", "moderate", "hard", "very_hard"]
    suitable_phases: list[Literal["Base", "Build", "Peak", "Taper", "Foundation", "Recovery"]] | None = None  # Optional
    suitable_weekdays: (
        list[Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]] | None
    ) = None  # Optional
    segments: list[WorkoutSegment]
    base_duration_min: float
    base_tss: float
    variable_components: VariableComponents | None = None
    source_file: str | None = None  # Optional for new workouts
    source_format: str | None = None  # Optional for new workouts


class WorkoutLibrary(BaseModel):
    """The complete workout library."""

    version: str
    description: str
    workouts: list[Workout]

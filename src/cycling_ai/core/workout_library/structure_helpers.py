"""
Workout Structure Helper Functions and Models

Utilities for working with the WorkoutStructure format (Issue #96).
Provides Python equivalents of the TypeScript WorkoutStructure types.
"""

from typing import Any, Literal

from pydantic import BaseModel


# =============================================================================
# WorkoutStructure Models (Issue #96)
# =============================================================================


class StepLength(BaseModel):
    """Length specification for a workout step (duration or distance)."""

    unit: Literal["second", "minute", "hour", "meter", "kilometer", "mile"]
    value: float


class StepTarget(BaseModel):
    """Target for a workout step (power, heart rate, cadence)."""

    type: Literal["power", "heartrate", "cadence"]
    minValue: float
    maxValue: float
    unit: Literal["percentOfFtp", "watts", "bpm", "rpm"] | None = None


class WorkoutStep(BaseModel):
    """A single step within a workout segment."""

    name: str
    intensityClass: Literal["warmUp", "active", "rest", "coolDown"]
    length: StepLength
    openDuration: bool | None = None
    targets: list[StepTarget]


class SegmentLength(BaseModel):
    """Segment/repetition block length (always in repetitions)."""

    unit: Literal["repetition"]
    value: int


class StructuredWorkoutSegment(BaseModel):
    """
    A segment within a workout - supports multi-step intervals.

    Examples:
    - Single step (warmup): type='step', length.value=1, steps=[{warmup step}]
    - 2-step interval: type='repetition', length.value=5, steps=[{work}, {recovery}]
    - 3-step interval: type='repetition', length.value=10, steps=[{Z3}, {Z5}, {Z2}]
    """

    type: Literal["step", "repetition"]
    length: SegmentLength
    steps: list[WorkoutStep]


class WorkoutStructure(BaseModel):
    """Complete workout structure with multi-step interval support."""

    primaryIntensityMetric: Literal["percentOfFtp", "watts", "heartrate"]
    primaryLengthMetric: Literal["duration", "distance"]
    structure: list[StructuredWorkoutSegment]


# =============================================================================
# Helper Functions
# =============================================================================


def has_valid_structure(structure: WorkoutStructure | dict[str, Any] | None) -> bool:
    """
    Check if a WorkoutStructure has valid content.

    Args:
        structure: WorkoutStructure object or dict representation

    Returns:
        True if structure has valid content, False otherwise
    """
    if structure is None:
        return False

    if isinstance(structure, dict):
        inner = structure.get("structure", [])
        return isinstance(inner, list) and len(inner) > 0

    return len(structure.structure) > 0


def convert_step_length_to_minutes(length: StepLength | dict[str, Any]) -> float:
    """
    Convert StepLength to minutes.

    Args:
        length: StepLength object or dict with unit and value

    Returns:
        Duration in minutes
    """
    if isinstance(length, dict):
        unit = str(length.get("unit", "second"))
        value = float(length.get("value", 0))
    else:
        unit = length.unit
        value = float(length.value)

    if unit == "second":
        return value / 60
    elif unit == "minute":
        return value
    elif unit == "hour":
        return value * 60
    else:
        # For distance-based lengths, assume value is in seconds
        return value / 60


def calculate_structure_duration(structure: WorkoutStructure | dict[str, Any]) -> float:
    """
    Calculate total duration of a WorkoutStructure in minutes.

    Args:
        structure: WorkoutStructure object or dict representation

    Returns:
        Total duration in minutes
    """
    if isinstance(structure, dict):
        segments = structure.get("structure", [])
    else:
        segments = structure.structure

    total = 0.0
    for segment in segments:
        if isinstance(segment, dict):
            repetitions = segment.get("length", {}).get("value", 1)
            steps = segment.get("steps", [])
        else:
            repetitions = segment.length.value
            steps = segment.steps

        steps_total = 0.0
        for step in steps:
            if isinstance(step, dict):
                length = step.get("length", {"unit": "minute", "value": 0})
            else:
                length = step.length
            steps_total += convert_step_length_to_minutes(length)

        total += steps_total * repetitions

    return total


def extract_power_target(
    targets: list[StepTarget] | list[dict[str, Any]],
    default_min: float = 50.0,
    default_max: float = 60.0,
) -> tuple[float, float]:
    """
    Extract power target values from a step's targets array.

    Args:
        targets: List of StepTarget objects or dicts
        default_min: Default minimum value if no power target found
        default_max: Default maximum value if no power target found

    Returns:
        Tuple of (minValue, maxValue) for power
    """
    for target in targets:
        if isinstance(target, dict):
            if target.get("type") == "power":
                return target.get("minValue", default_min), target.get("maxValue", default_max)
        else:
            if target.type == "power":
                return target.minValue, target.maxValue

    return default_min, default_max


def get_main_segment_from_structure(
    structure: WorkoutStructure | dict[str, Any],
) -> dict[str, Any] | None:
    """
    Find the main workout segment (highest intensity active segment).

    Used for duration adjustments and workout scaling.

    Args:
        structure: WorkoutStructure object or dict representation

    Returns:
        Dict with segment info or None if no suitable segment found
    """
    if isinstance(structure, dict):
        segments = structure.get("structure", [])
    else:
        segments = [s.model_dump() for s in structure.structure]

    main_segment = None
    max_intensity = 0.0
    max_duration = 0.0

    for i, segment in enumerate(segments):
        steps = segment.get("steps", [])
        for step in steps:
            intensity_class = step.get("intensityClass", "active")
            if intensity_class == "active":
                targets = step.get("targets", [])
                power_min, power_max = extract_power_target(targets)
                duration_min = convert_step_length_to_minutes(step.get("length", {}))

                # Use duration as tiebreaker when power is equal
                is_higher_intensity = power_max > max_intensity
                is_same_intensity_but_longer = (power_max == max_intensity and duration_min > max_duration)

                if is_higher_intensity or is_same_intensity_but_longer:
                    max_intensity = power_max
                    max_duration = duration_min
                    main_segment = {
                        "segment_index": i,
                        "step": step,
                        "power_low_pct": power_min,
                        "power_high_pct": power_max,
                        "duration_min": duration_min,
                    }

    return main_segment


def create_strength_structure(duration_min: float = 45) -> dict[str, Any]:
    """
    Create a structure for strength/gym workouts.

    Args:
        duration_min: Duration in minutes (default 45)

    Returns:
        WorkoutStructure dict for strength workout
    """
    return {
        "primaryIntensityMetric": "percentOfFtp",
        "primaryLengthMetric": "duration",
        "structure": [
            {
                "type": "step",
                "length": {"unit": "repetition", "value": 1},
                "steps": [
                    {
                        "name": "Strength Training",
                        "intensityClass": "active",
                        "length": {"unit": "minute", "value": duration_min},
                        "targets": [
                            {
                                "type": "power",
                                "minValue": 0,
                                "maxValue": 0,
                                "unit": "percentOfFtp",
                            }
                        ],
                    }
                ],
            }
        ],
    }


def legacy_segments_to_structure(segments: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Convert legacy segments format to WorkoutStructure.

    Used by FIT parser and other tools that generate segments format.

    Args:
        segments: List of segment dicts in legacy format

    Returns:
        WorkoutStructure dict
    """
    structure_segments: list[dict[str, Any]] = []

    for segment in segments:
        seg_type = segment.get("type", "steady")

        if seg_type == "interval" and "work" in segment:
            # Multi-step interval (work + recovery) - proper format with work/recovery fields
            sets = segment.get("sets", 1)
            work = segment.get("work", {})
            recovery = segment.get("recovery")

            steps: list[dict[str, Any]] = []

            # Add work step
            steps.append(
                {
                    "name": work.get("description", "Work"),
                    "intensityClass": "active",
                    "length": {"unit": "minute", "value": work.get("duration_min", 0)},
                    "targets": [
                        {
                            "type": "power",
                            "minValue": work.get("power_low_pct", 75),
                            "maxValue": work.get("power_high_pct", 75),
                            "unit": "percentOfFtp",
                        }
                    ],
                }
            )

            # Add recovery step if present
            if recovery:
                steps.append(
                    {
                        "name": recovery.get("description", "Recovery"),
                        "intensityClass": "rest",
                        "length": {"unit": "minute", "value": recovery.get("duration_min", 0)},
                        "targets": [
                            {
                                "type": "power",
                                "minValue": recovery.get("power_low_pct", 50),
                                "maxValue": recovery.get("power_high_pct", 50),
                                "unit": "percentOfFtp",
                            }
                        ],
                    }
                )

            structure_segments.append(
                {
                    "type": "repetition",
                    "length": {"unit": "repetition", "value": sets},
                    "steps": steps,
                }
            )

        else:
            # Single step segment (warmup, cooldown, steady, recovery, tempo)
            # Map segment type to intensityClass
            if seg_type == "warmup":
                intensity_class = "warmUp"
            elif seg_type == "cooldown":
                intensity_class = "coolDown"
            elif seg_type == "recovery":
                intensity_class = "rest"
            else:
                intensity_class = "active"

            structure_segments.append(
                {
                    "type": "step",
                    "length": {"unit": "repetition", "value": 1},
                    "steps": [
                        {
                            "name": segment.get("description", seg_type.capitalize()),
                            "intensityClass": intensity_class,
                            "length": {"unit": "minute", "value": segment.get("duration_min", 0)},
                            "targets": [
                                {
                                    "type": "power",
                                    "minValue": segment.get("power_low_pct", 50),
                                    "maxValue": segment.get("power_high_pct", 50),
                                    "unit": "percentOfFtp",
                                }
                            ],
                        }
                    ],
                }
            )

    return {
        "primaryIntensityMetric": "percentOfFtp",
        "primaryLengthMetric": "duration",
        "structure": structure_segments,
    }

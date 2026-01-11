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
    polyline: list[tuple[float, float]] | None = None


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


def get_structure_work_time(structure: WorkoutStructure | dict[str, Any]) -> float:
    """
    Get total work time (excluding warmup/cooldown) from structure.

    Args:
        structure: WorkoutStructure object or dict representation

    Returns:
        Work time in minutes
    """
    if isinstance(structure, dict):
        segments = structure.get("structure", [])
    else:
        segments = structure.structure

    work_time = 0.0
    for segment in segments:
        if isinstance(segment, dict):
            repetitions = segment.get("length", {}).get("value", 1)
            steps = segment.get("steps", [])
        else:
            repetitions = segment.length.value
            steps = segment.steps

        for step in steps:
            if isinstance(step, dict):
                intensity_class = step.get("intensityClass", "active")
                length = step.get("length", {"unit": "minute", "value": 0})
            else:
                intensity_class = step.intensityClass
                length = step.length

            if intensity_class == "active":
                work_time += convert_step_length_to_minutes(length) * repetitions

    return work_time


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

    for i, segment in enumerate(segments):
        steps = segment.get("steps", [])
        for step in steps:
            intensity_class = step.get("intensityClass", "active")
            if intensity_class == "active":
                targets = step.get("targets", [])
                power_min, power_max = extract_power_target(targets)
                if power_max > max_intensity:
                    max_intensity = power_max
                    main_segment = {
                        "segment_index": i,
                        "step": step,
                        "power_low_pct": power_min,
                        "power_high_pct": power_max,
                        "duration_min": convert_step_length_to_minutes(step.get("length", {})),
                    }

    return main_segment


def create_placeholder_structure(duration_min: float) -> dict[str, Any]:
    """
    Create a placeholder structure for workouts without detailed structure.

    Args:
        duration_min: Duration in minutes

    Returns:
        WorkoutStructure dict
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
                        "name": "Workout",
                        "intensityClass": "active",
                        "length": {"unit": "minute", "value": duration_min},
                        "targets": [
                            {
                                "type": "power",
                                "minValue": 50,
                                "maxValue": 75,
                                "unit": "percentOfFtp",
                            }
                        ],
                    }
                ],
            }
        ],
    }


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


def structure_to_legacy_segments(structure: WorkoutStructure | dict[str, Any]) -> list[dict[str, Any]]:
    """
    Convert WorkoutStructure to legacy segments format.

    This is useful for backwards compatibility during migration.
    Note: Multi-step intervals (3+ steps) are simplified to 2-step format.

    Args:
        structure: WorkoutStructure object or dict representation

    Returns:
        List of segment dicts in legacy format
    """
    if isinstance(structure, dict):
        segments = structure.get("structure", [])
    else:
        segments = [s.model_dump() for s in structure.structure]

    legacy_segments: list[dict[str, Any]] = []

    for segment in segments:
        steps = segment.get("steps", [])
        repetitions = segment.get("length", {}).get("value", 1)

        if len(steps) == 1:
            # Single step - warmup, cooldown, steady
            step = steps[0]
            intensity_class = step.get("intensityClass", "active")
            power_min, power_max = extract_power_target(step.get("targets", []))
            duration = convert_step_length_to_minutes(step.get("length", {}))

            # Map intensityClass to segment type
            if intensity_class == "warmUp":
                seg_type = "warmup"
            elif intensity_class == "coolDown":
                seg_type = "cooldown"
            elif intensity_class == "rest":
                seg_type = "recovery"
            else:
                seg_type = "steady"

            legacy_segments.append(
                {
                    "type": seg_type,
                    "duration_min": duration,
                    "power_low_pct": power_min,
                    "power_high_pct": power_max,
                    "description": step.get("name", ""),
                }
            )

        elif len(steps) >= 2:
            # Multi-step interval - convert to work/recovery format
            work_step = steps[0]
            recovery_step = steps[1] if len(steps) > 1 else steps[0]

            work_power_min, work_power_max = extract_power_target(work_step.get("targets", []))
            rec_power_min, rec_power_max = extract_power_target(recovery_step.get("targets", []))

            legacy_segments.append(
                {
                    "type": "interval",
                    "sets": repetitions,
                    "work": {
                        "duration_min": convert_step_length_to_minutes(work_step.get("length", {})),
                        "power_low_pct": work_power_min,
                        "power_high_pct": work_power_max,
                        "description": work_step.get("name", "Work"),
                    },
                    "recovery": {
                        "duration_min": convert_step_length_to_minutes(recovery_step.get("length", {})),
                        "power_low_pct": rec_power_min,
                        "power_high_pct": rec_power_max,
                        "description": recovery_step.get("name", "Recovery"),
                    },
                }
            )

    return legacy_segments


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

        if seg_type == "interval":
            # Multi-step interval (work + recovery)
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

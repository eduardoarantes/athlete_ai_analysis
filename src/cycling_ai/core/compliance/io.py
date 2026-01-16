import json
from typing import Any, Dict, List, Optional, Tuple

from cycling_ai.core.workout_library.structure_helpers import (
    WorkoutStructure,
    extract_power_target,
    convert_step_length_to_minutes,
)

from .models import StreamPoint, WorkoutStep


def _steps_from_structure(structure: WorkoutStructure | dict[str, Any], ftp: float) -> List[WorkoutStep]:
    """
    Convert WorkoutStructure to flat list of WorkoutSteps for compliance analysis.

    Args:
        structure: WorkoutStructure object or dict representation
        ftp: Functional Threshold Power in watts

    Returns:
        List of WorkoutStep objects (flattened, with durations in seconds and power in watts)
    """
    steps: List[WorkoutStep] = []

    # Handle both Pydantic model and dict input
    if isinstance(structure, dict):
        segments = structure.get("structure", [])
    else:
        segments = structure.structure

    for segment in segments:
        if isinstance(segment, dict):
            repetitions = segment.get("length", {}).get("value", 1)
            segment_steps = segment.get("steps", [])
        else:
            repetitions = segment.length.value
            segment_steps = segment.steps

        # Expand repetition blocks
        for _ in range(repetitions):
            for step in segment_steps:
                if isinstance(step, dict):
                    name = step.get("name", "Segment")
                    intensity_class = step.get("intensityClass", "")
                    length = step.get("length", {})
                    targets = step.get("targets", [])
                else:
                    name = step.name
                    intensity_class = step.intensityClass
                    length = step.length
                    targets = step.targets

                # Convert duration to seconds
                duration_min = convert_step_length_to_minutes(length)
                duration_seconds = int(duration_min * 60)

                # Extract power target (average of min/max)
                power_min, power_max = extract_power_target(targets)
                target_power_avg = (power_min + power_max) / 2.0

                # Check if power is in percentOfFtp
                is_percent_ftp = False
                for target in targets:
                    if isinstance(target, dict):
                        if target.get("unit") == "percentOfFtp":
                            is_percent_ftp = True
                            break
                    else:
                        if hasattr(target, "unit") and target.unit == "percentOfFtp":
                            is_percent_ftp = True
                            break

                # Convert to watts if needed
                if is_percent_ftp:
                    target_power = target_power_avg * ftp / 100.0
                else:
                    target_power = target_power_avg

                steps.append(
                    WorkoutStep(
                        name=name,
                        duration=duration_seconds,
                        target_power=target_power,
                        intensity_class=intensity_class.lower() if intensity_class else "",
                    )
                )

    return steps


def load_workout_steps(workout_path: str, ftp: float) -> Tuple[List[WorkoutStep], float]:
    with open(workout_path, "r") as f:
        workout = json.load(f)

    steps = _steps_from_structure(workout["structure"], ftp)
    return steps, ftp


def load_workout_library(workout_library_path: str) -> Dict[str, dict]:
    with open(workout_library_path, "r") as f:
        library = json.load(f)
    return {workout["id"]: workout for workout in library.get("workouts", [])}


def load_workout_steps_from_library_object(
    workout: dict,
    ftp: float,
) -> Tuple[List[WorkoutStep], float]:
    steps = _steps_from_structure(workout["structure"], ftp)
    return steps, ftp


def load_workout_steps_from_library(
    workout_library_path: str,
    workout_id: str,
    ftp: float,
) -> Tuple[List[WorkoutStep], float, str]:
    library = load_workout_library(workout_library_path)
    workout = library.get(workout_id)
    if workout is None:
        raise KeyError(f"Workout id {workout_id} not found in library.")

    steps = _steps_from_structure(workout["structure"], ftp)
    name = workout.get("name", workout_id)
    return steps, ftp, name


def load_streams(streams_path: str) -> List[StreamPoint]:
    with open(streams_path, "r") as f:
        streams = json.load(f)

    watts = streams["watts"]["data"]
    times = streams.get("time", {}).get("data")
    if times is None:
        times = list(range(len(watts)))

    length = min(len(times), len(watts))
    return [StreamPoint(time_offset=t, power=w) for t, w in zip(times[:length], watts[:length])]

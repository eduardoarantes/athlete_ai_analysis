"""
Training Stress Score (TSS) calculation module.

TSS quantifies training load based on intensity and duration.
Formula: TSS = (duration_seconds × NP × IF) / (FTP × 3600) × 100
Where:
- NP = Normalized Power (estimated from segment power zones)
- IF = Intensity Factor (NP / FTP)

For constant power segments, this simplifies to:
TSS = duration_hours × IF² × 100
"""

from typing import Any

from cycling_ai.core.workout_library.structure_helpers import (
    convert_step_length_to_minutes,
    extract_power_target,
)


def calculate_segment_tss(
    duration_min: int,
    power_low_pct: float,
    power_high_pct: float | None,
    ftp: float,
) -> float:
    """
    Calculate TSS for a single workout segment.

    Args:
        duration_min: Segment duration in minutes
        power_low_pct: Lower power bound as % of FTP
        power_high_pct: Upper power bound as % of FTP (optional, defaults to power_low_pct)
        ftp: Athlete's FTP in watts

    Returns:
        TSS value for the segment
    """
    if power_high_pct is None:
        power_high_pct = power_low_pct

    # Calculate average intensity factor for the segment
    avg_power_pct = (power_low_pct + power_high_pct) / 2.0
    intensity_factor = avg_power_pct / 100.0

    # TSS formula for constant power
    # TSS = (duration_hours × NP × IF) / FTP × 100
    # Simplified when NP is constant: TSS = duration_hours × IF² × 100
    duration_hours = duration_min / 60.0
    segment_tss = duration_hours * (intensity_factor**2) * 100.0

    return segment_tss


def calculate_workout_tss(
    segments_or_structure: list[dict[str, Any]] | dict[str, Any],
    ftp: float,
) -> float:
    """
    Calculate total TSS for a workout from segments or WorkoutStructure.

    Args:
        segments_or_structure: Either a list of segment dicts (legacy) OR
                              a WorkoutStructure dict with structure field
        ftp: Athlete's FTP in watts

    Returns:
        Total TSS for the workout
    """
    total_tss = 0.0

    # Check if it's a WorkoutStructure (dict with "structure" field)
    if isinstance(segments_or_structure, dict) and "structure" in segments_or_structure:
        # WorkoutStructure format
        structure = segments_or_structure
        segments = structure.get("structure", [])

        for segment in segments:
            seg_dict = segment if isinstance(segment, dict) else segment.__dict__
            repetitions = seg_dict.get("length", {}).get("value", 1)
            steps = seg_dict.get("steps", [])

            for step in steps:
                step_dict = step if isinstance(step, dict) else step.__dict__

                # Get step duration
                length = step_dict.get("length", {})
                duration_min = convert_step_length_to_minutes(length)

                # Get power targets (as % of FTP)
                targets = step_dict.get("targets", [])
                power_min, power_max = extract_power_target(targets)

                # Calculate TSS for this step
                step_tss = calculate_segment_tss(
                    duration_min=duration_min,
                    power_low_pct=power_min,
                    power_high_pct=power_max,
                    ftp=ftp,
                )

                # Multiply by repetitions
                total_tss += step_tss * repetitions
    else:
        # Legacy segments format (list of dicts)
        segments = segments_or_structure if isinstance(segments_or_structure, list) else []

        for segment in segments:
            duration = segment.get("duration_min", 0)
            power_low = segment.get("power_low_pct", 0)
            power_high = segment.get("power_high_pct", power_low)

            segment_tss = calculate_segment_tss(
                duration_min=duration,
                power_low_pct=power_low,
                power_high_pct=power_high,
                ftp=ftp,
            )

            total_tss += segment_tss

    return round(total_tss, 1)


def calculate_weekly_tss(
    workouts: list[dict[str, Any]],
    ftp: float,
) -> float:
    """
    Calculate total TSS for a week from its workouts.

    Args:
        workouts: List of workout dictionaries with either segments (legacy) or structure
        ftp: Athlete's FTP in watts

    Returns:
        Total TSS for the week
    """
    total_tss = 0.0

    for workout in workouts:
        # Check if workout has structure field (new format)
        if "structure" in workout:
            workout_tss = calculate_workout_tss(workout["structure"], ftp)
        else:
            # Legacy: use segments
            segments = workout.get("segments", [])
            workout_tss = calculate_workout_tss(segments, ftp)
        total_tss += workout_tss

    return round(total_tss, 1)

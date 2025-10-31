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
    segments: list[dict[str, Any]],
    ftp: float,
) -> float:
    """
    Calculate total TSS for a workout from its segments.

    Args:
        segments: List of segment dictionaries with duration_min, power_low_pct, power_high_pct
        ftp: Athlete's FTP in watts

    Returns:
        Total TSS for the workout
    """
    total_tss = 0.0

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
        workouts: List of workout dictionaries with segments
        ftp: Athlete's FTP in watts

    Returns:
        Total TSS for the week
    """
    total_tss = 0.0

    for workout in workouts:
        segments = workout.get("segments", [])
        workout_tss = calculate_workout_tss(segments, ftp)
        total_tss += workout_tss

    return round(total_tss, 1)

"""
Training plan finalization module.

This module saves LLM-designed training plans with validation and serialization.
The actual plan design is done by the LLM agent using workout building tools.
"""

import json
from typing import Any

from .tss import calculate_weekly_tss, calculate_workout_tss
from .utils import convert_to_json_serializable


def validate_training_plan(
    plan_data: dict[str, Any],
    available_days: list[str],
    weekly_hours: float,
    daily_caps: dict[str, int] | None = None,
) -> tuple[bool, list[str]]:
    """
    Validate training plan structure and constraints.

    Args:
        plan_data: Dictionary containing weekly_plan and total_weeks
        available_days: List of available training days (e.g., ["Monday", "Wednesday", "Saturday"])
        weekly_hours: Maximum weekly training hours
        daily_caps: Optional dict mapping day names to max minutes per day

    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []

    try:
        # Check top-level structure
        if "total_weeks" not in plan_data:
            errors.append("Missing 'total_weeks' field in plan")
            return False, errors

        if "weekly_plan" not in plan_data:
            errors.append("Missing 'weekly_plan' field in plan")
            return False, errors

        total_weeks = plan_data["total_weeks"]
        weekly_plan = plan_data["weekly_plan"]

        # Validate total_weeks matches weekly_plan length
        if total_weeks != len(weekly_plan):
            errors.append(f"total_weeks ({total_weeks}) does not match weekly_plan length ({len(weekly_plan)})")

        # Validate each week
        for i, week in enumerate(weekly_plan, 1):
            week_num = week.get("week_number", i)

            # Check week_number is in valid range
            if not (1 <= week_num <= total_weeks):
                errors.append(f"Week {week_num} number out of range (1-{total_weeks})")

            # Check workouts field exists
            if "workouts" not in week:
                errors.append(f"Week {week_num} missing 'workouts' field")
                continue  # Skip further validation for this week

            workouts = week["workouts"]

            # Check workouts is a list
            if not isinstance(workouts, list):
                errors.append(f"Week {week_num} 'workouts' must be a list, got {type(workouts).__name__}")
                continue

            # Check at least one workout
            if len(workouts) < 1:
                errors.append(f"Week {week_num} must have at least one workout")
                continue

            # Validate each workout
            week_minutes: float = 0
            for workout_idx, workout in enumerate(workouts, 1):
                # Validate weekday field exists
                if "weekday" not in workout:
                    errors.append(f"Week {week_num}, workout {workout_idx}: Missing 'weekday' field")
                    continue

                day = workout["weekday"]

                # Validate day name
                valid_days = [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ]
                if day not in valid_days:
                    errors.append(
                        f"Week {week_num}, workout {workout_idx}: Invalid weekday '{day}' (must be one of {valid_days})"
                    )
                    continue

                # Check day is in available days
                if day not in available_days:
                    errors.append(
                        f"Week {week_num}, workout {workout_idx}: Workout scheduled on '{day}' but athlete only available on {available_days}"
                    )

                # Validate workout has segments
                if "segments" not in workout:
                    errors.append(f"Week {week_num}, {day}: Workout missing 'segments' field")
                    continue

                segments = workout["segments"]
                if not isinstance(segments, list):
                    errors.append(f"Week {week_num}, {day}: 'segments' must be a list, got {type(segments).__name__}")
                    continue

                if len(segments) < 1:
                    errors.append(f"Week {week_num}, {day}: Workout must have at least one segment")
                    continue

                # Validate each segment
                day_minutes: float = 0
                for seg_idx, segment in enumerate(segments, 1):
                    # Check segment type
                    valid_types = {
                        "warmup",
                        "interval",
                        "work",
                        "recovery",
                        "cooldown",
                        "steady",
                        "tempo",
                        "strength",
                    }
                    seg_type = segment.get("type")
                    if seg_type not in valid_types:
                        errors.append(
                            f"Week {week_num}, {day}, segment {seg_idx}: Invalid type '{seg_type}' (must be one of {valid_types})"
                        )

                    # Check duration
                    if "duration_min" not in segment:
                        errors.append(f"Week {week_num}, {day}, segment {seg_idx}: Missing 'duration_min' field")
                    elif not isinstance(segment["duration_min"], (int, float)):
                        errors.append(f"Week {week_num}, {day}, segment {seg_idx}: 'duration_min' must be a number")
                    else:
                        day_minutes += segment["duration_min"]

                    # Skip power zone validation for strength segments
                    is_strength_segment = seg_type == "strength"
                    if is_strength_segment:
                        # Strength segments don't need power zones
                        continue

                    # Auto-default power_high_pct to power_low_pct if not provided
                    if "power_low_pct" in segment and "power_high_pct" not in segment:
                        segment["power_high_pct"] = segment["power_low_pct"]

                    # Check power percentage fields (only for cycling segments)
                    if "power_low_pct" not in segment:
                        errors.append(f"Week {week_num}, {day}, segment {seg_idx}: Missing 'power_low_pct' field")
                    elif not isinstance(segment["power_low_pct"], (int, float)):
                        errors.append(f"Week {week_num}, {day}, segment {seg_idx}: 'power_low_pct' must be a number")
                    elif segment["power_low_pct"] < 0:
                        errors.append(
                            f"Week {week_num}, {day}, segment {seg_idx}: 'power_low_pct' must be >= 0 (got {segment['power_low_pct']})"
                        )

                    # Validate power_high_pct >= power_low_pct if present
                    if "power_high_pct" in segment:
                        if not isinstance(segment["power_high_pct"], (int, float)):
                            errors.append(
                                f"Week {week_num}, {day}, segment {seg_idx}: 'power_high_pct' must be a number"
                            )
                        elif segment["power_high_pct"] < 0:
                            errors.append(
                                f"Week {week_num}, {day}, segment {seg_idx}: 'power_high_pct' must be >= 0 (got {segment['power_high_pct']})"
                            )
                        elif segment["power_high_pct"] < segment.get("power_low_pct", 0):
                            errors.append(
                                f"Week {week_num}, {day}, segment {seg_idx}: power_high_pct ({segment['power_high_pct']}) must be >= power_low_pct ({segment['power_low_pct']})"
                            )

                # Check daily cap if specified
                if daily_caps and day in daily_caps and day_minutes > daily_caps[day]:
                    errors.append(
                        f"Week {week_num}, {day}: Total duration {day_minutes} min exceeds "
                        f"daily cap of {daily_caps[day]} min"
                    )

                week_minutes += day_minutes

            # Check weekly hours constraint (with 20% tolerance to match add_week_details validation)
            max_weekly_minutes = weekly_hours * 60
            tolerance = 0.20  # 20% tolerance (aligned with add_week_details per-week validation)
            max_with_tolerance = max_weekly_minutes * (1 + tolerance)
            if week_minutes > max_with_tolerance:
                errors.append(
                    f"Week {week_num}: Total duration {week_minutes} min exceeds weekly limit of {max_weekly_minutes} min ({weekly_hours} hours) + 20% tolerance ({max_with_tolerance} min)"
                )

    except Exception as e:
        errors.append(f"Unexpected validation error: {str(e)}")
        return False, errors

    return len(errors) == 0, errors


def finalize_training_plan(
    athlete_profile: Any,
    total_weeks: int,
    target_ftp: float,
    weekly_plan: list[dict[str, Any]],
    coaching_notes: str = "",
    monitoring_guidance: str = "",
) -> str:
    """
    Finalize and save LLM-designed training plan.

    This function validates and serializes a training plan designed by the LLM agent.
    It does NOT generate the plan - that is the LLM's responsibility.

    Args:
        athlete_profile: Athlete profile object with FTP, goals, etc.
        total_weeks: Total duration of the plan in weeks
        target_ftp: Target FTP goal for the plan
        weekly_plan: List of week dictionaries designed by LLM
        coaching_notes: Overall coaching guidance from LLM
        monitoring_guidance: What athlete should monitor

    Returns:
        JSON string with complete training plan

    Example weekly_plan structure:
        [
            {
                "week_number": 1,
                "phase": "Foundation",
                "phase_rationale": "Building aerobic base...",
                "workouts": [
                    {workout object from create_workout with weekday field},
                    {workout object with weekday field},
                    ...
                ],
                "weekly_focus": "Focus on consistency...",
                "weekly_watch_points": "Watch for fatigue..."
            },
            ...
        ]
    """
    # Validate inputs
    if total_weeks < 4 or total_weeks > 24:
        raise ValueError("Plan duration must be between 4 and 24 weeks")

    if len(weekly_plan) != total_weeks:
        raise ValueError(f"weekly_plan length ({len(weekly_plan)}) does not match total_weeks ({total_weeks})")

    current_ftp = athlete_profile.ftp

    # Calculate TSS for each workout and week
    for week_data in weekly_plan:
        workouts = week_data.get("workouts", [])

        # Calculate TSS for each workout
        for workout in workouts:
            segments = workout.get("segments", [])
            workout_tss = calculate_workout_tss(segments, current_ftp)
            workout["tss"] = workout_tss  # Add TSS to workout data

        # Calculate weekly TSS total
        week_tss = calculate_weekly_tss(workouts, current_ftp)
        week_data["week_tss"] = week_tss  # Add weekly TSS

    # Validate each week
    for week_data in weekly_plan:
        if "week_number" not in week_data:
            raise ValueError(f"Week missing 'week_number' field: {week_data}")

        if "phase" not in week_data:
            raise ValueError(f"Week {week_data.get('week_number')} missing 'phase' field")

        if "workouts" not in week_data:
            raise ValueError(f"Week {week_data.get('week_number')} missing 'workouts' field")

        if not isinstance(week_data["workouts"], list):
            raise ValueError(f"Week {week_data.get('week_number')} 'workouts' must be a list")

    # Build athlete profile data for metadata
    athlete_profile_data = {
        "age": athlete_profile.age,
        "ftp": float(current_ftp),
        "name": athlete_profile.name,
        "gender": athlete_profile.gender,
        "weight_kg": athlete_profile.weight_kg,
        "power_to_weight": (float(current_ftp / athlete_profile.weight_kg) if athlete_profile.weight_kg else None),
        "max_hr": athlete_profile.max_hr,
        "training_availability": athlete_profile.training_availability,
        "goals": athlete_profile.goals,
        "current_training_status": athlete_profile.current_training_status,
        "available_training_days": athlete_profile.get_training_days(),
        "weekly_training_hours": athlete_profile.get_weekly_training_hours(),
    }

    # Calculate FTP progression
    ftp_gain = target_ftp - current_ftp
    ftp_gain_percent = (target_ftp / current_ftp - 1) * 100

    # Build complete plan structure
    plan_data = {
        "athlete_profile": athlete_profile_data,
        "plan_metadata": {
            "total_weeks": total_weeks,
            "current_ftp": float(current_ftp),
            "target_ftp": float(target_ftp),
            "ftp_gain_watts": float(ftp_gain),
            "ftp_gain_percent": float(ftp_gain_percent),
            "plan_type": "LLM-designed personalized plan",
        },
        "coaching_notes": coaching_notes,
        "monitoring_guidance": monitoring_guidance,
        "weekly_plan": weekly_plan,
    }

    # Convert to JSON-serializable types
    plan_data = convert_to_json_serializable(plan_data)

    return json.dumps(plan_data, indent=2)

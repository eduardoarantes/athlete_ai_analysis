"""
Training plan finalization module.

This module saves LLM-designed training plans with validation and serialization.
The actual plan design is done by the LLM agent using workout building tools.
"""

import json
from typing import Any

from .utils import convert_to_json_serializable


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
                "workouts": {
                    "Tuesday": {workout object from create_workout},
                    "Thursday": {workout object},
                    ...
                },
                "weekly_focus": "Focus on consistency...",
                "monitoring_notes": "Watch for fatigue..."
            },
            ...
        ]
    """
    # Validate inputs
    if total_weeks < 4 or total_weeks > 24:
        raise ValueError("Plan duration must be between 4 and 24 weeks")

    if len(weekly_plan) != total_weeks:
        raise ValueError(
            f"weekly_plan length ({len(weekly_plan)}) does not match total_weeks ({total_weeks})"
        )

    current_ftp = athlete_profile.ftp

    # Validate each week
    for week_data in weekly_plan:
        if "week_number" not in week_data:
            raise ValueError(f"Week missing 'week_number' field: {week_data}")

        if "phase" not in week_data:
            raise ValueError(f"Week {week_data.get('week_number')} missing 'phase' field")

        if "workouts" not in week_data:
            raise ValueError(f"Week {week_data.get('week_number')} missing 'workouts' field")

        if not isinstance(week_data["workouts"], dict):
            raise ValueError(
                f"Week {week_data.get('week_number')} 'workouts' must be a dictionary"
            )

    # Build athlete profile data for metadata
    athlete_profile_data = {
        'age': athlete_profile.age,
        'ftp': float(current_ftp),
        'name': athlete_profile.name,
        'gender': athlete_profile.gender,
        'weight_kg': athlete_profile.weight_kg,
        'power_to_weight': (
            float(current_ftp / athlete_profile.weight_kg)
            if athlete_profile.weight_kg
            else None
        ),
        'max_hr': athlete_profile.max_hr,
        'training_availability': athlete_profile.training_availability,
        'goals': athlete_profile.goals,
        'current_training_status': athlete_profile.current_training_status,
        'available_training_days': athlete_profile.get_training_days(),
        'weekly_training_hours': athlete_profile.get_weekly_training_hours(),
    }

    # Calculate FTP progression
    ftp_gain = target_ftp - current_ftp
    ftp_gain_percent = (target_ftp / current_ftp - 1) * 100

    # Build complete plan structure
    plan_data = {
        'athlete_profile': athlete_profile_data,
        'plan_metadata': {
            'total_weeks': total_weeks,
            'current_ftp': float(current_ftp),
            'target_ftp': float(target_ftp),
            'ftp_gain_watts': float(ftp_gain),
            'ftp_gain_percent': float(ftp_gain_percent),
            'plan_type': 'LLM-designed personalized plan',
        },
        'coaching_notes': coaching_notes,
        'monitoring_guidance': monitoring_guidance,
        'weekly_plan': weekly_plan,
    }

    # Convert to JSON-serializable types
    plan_data = convert_to_json_serializable(plan_data)

    return json.dumps(plan_data, indent=2)

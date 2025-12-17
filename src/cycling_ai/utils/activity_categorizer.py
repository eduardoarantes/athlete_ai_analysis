"""
Activity categorization for cross-training analysis.

Maps activity types from FIT files to training categories with metadata
for interference detection and load balancing.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass
class ActivityCategory:
    """Activity category with training load characteristics."""

    category: Literal["Cycling", "Strength", "Cardio", "Other"]
    muscle_focus: Literal["Legs", "Upper", "Core", "Full Body", "None"]
    fatigue_impact: Literal["Low", "Medium", "High"]
    recovery_hours: int  # Recommended recovery before hard cycling


# Sport-to-category mapping based on FIT sport types
SPORT_CATEGORY_MAP: dict[str, ActivityCategory] = {
    # Cycling variants
    "cycling": ActivityCategory(category="Cycling", muscle_focus="Legs", fatigue_impact="Medium", recovery_hours=24),
    "virtual_ride": ActivityCategory(
        category="Cycling", muscle_focus="Legs", fatigue_impact="Medium", recovery_hours=24
    ),
    "indoor_cycling": ActivityCategory(
        category="Cycling", muscle_focus="Legs", fatigue_impact="Medium", recovery_hours=24
    ),
    # Running variants (leg-focused cardio)
    "running": ActivityCategory(category="Cardio", muscle_focus="Legs", fatigue_impact="High", recovery_hours=48),
    "trail_running": ActivityCategory(category="Cardio", muscle_focus="Legs", fatigue_impact="High", recovery_hours=48),
    "treadmill_running": ActivityCategory(
        category="Cardio", muscle_focus="Legs", fatigue_impact="Medium", recovery_hours=36
    ),
    # Swimming (upper body cardio)
    "swimming": ActivityCategory(category="Cardio", muscle_focus="Upper", fatigue_impact="Low", recovery_hours=12),
    "lap_swimming": ActivityCategory(category="Cardio", muscle_focus="Upper", fatigue_impact="Low", recovery_hours=12),
    "open_water_swimming": ActivityCategory(
        category="Cardio", muscle_focus="Upper", fatigue_impact="Medium", recovery_hours=24
    ),
    # Strength training
    "strength_training": ActivityCategory(
        category="Strength", muscle_focus="Full Body", fatigue_impact="High", recovery_hours=48
    ),
    "training": ActivityCategory(  # Generic training
        category="Strength", muscle_focus="Full Body", fatigue_impact="Medium", recovery_hours=36
    ),
    "generic": ActivityCategory(  # Fallback
        category="Other", muscle_focus="Full Body", fatigue_impact="Medium", recovery_hours=24
    ),
    # Walking/hiking (low-impact cardio)
    "walking": ActivityCategory(category="Cardio", muscle_focus="Legs", fatigue_impact="Low", recovery_hours=12),
    "hiking": ActivityCategory(category="Cardio", muscle_focus="Legs", fatigue_impact="Medium", recovery_hours=24),
    # Yoga/flexibility
    "yoga": ActivityCategory(category="Other", muscle_focus="Full Body", fatigue_impact="Low", recovery_hours=0),
    "flexibility_training": ActivityCategory(
        category="Other", muscle_focus="Full Body", fatigue_impact="Low", recovery_hours=0
    ),
    # Rowing
    "rowing": ActivityCategory(category="Cardio", muscle_focus="Full Body", fatigue_impact="Medium", recovery_hours=24),
    # Elliptical
    "elliptical": ActivityCategory(category="Cardio", muscle_focus="Legs", fatigue_impact="Low", recovery_hours=12),
}

# Sub-sport specific overrides for strength training focus
SUB_SPORT_MUSCLE_FOCUS: dict[str, Literal["Legs", "Upper", "Core", "Full Body", "None"]] = {
    "leg_strength": "Legs",
    "upper_body_strength": "Upper",
    "core_strength": "Core",
    "total_body_strength": "Full Body",
}


def categorize_activity(sport: str, sub_sport: str | None = None) -> ActivityCategory:
    """
    Categorize an activity based on sport type and sub-sport.

    Args:
        sport: Primary sport type (from FIT file, lowercase)
        sub_sport: Sub-sport detail (from FIT file, lowercase), optional

    Returns:
        ActivityCategory with training load characteristics

    Examples:
        >>> cat = categorize_activity("running")
        >>> cat.category
        'Cardio'
        >>> cat.muscle_focus
        'Legs'
        >>> cat.recovery_hours
        48

        >>> cat = categorize_activity("strength_training", "leg_strength")
        >>> cat.muscle_focus
        'Legs'
    """
    # Get base category from sport
    base_category = SPORT_CATEGORY_MAP.get(sport)

    if not base_category:
        # Unknown sport - use generic default
        base_category = SPORT_CATEGORY_MAP["generic"]

    # Check for sub-sport muscle focus override
    if sub_sport and sub_sport in SUB_SPORT_MUSCLE_FOCUS:
        # Create copy with updated muscle focus
        return ActivityCategory(
            category=base_category.category,
            muscle_focus=SUB_SPORT_MUSCLE_FOCUS[sub_sport],
            fatigue_impact=base_category.fatigue_impact,
            recovery_hours=base_category.recovery_hours,
        )

    return base_category


def estimate_tss_from_activity(
    category: ActivityCategory,
    duration_seconds: int,
    avg_hr: int | None = None,
    max_hr: int | None = None,
    athlete_max_hr: int = 185,
) -> float:
    """
    Estimate Training Stress Score (TSS) for non-cycling activities.

    For cycling, use power-based TSS from zone enrichment.
    For other activities, estimate from HR or duration.

    Args:
        category: Activity category with characteristics
        duration_seconds: Activity duration in seconds
        avg_hr: Average heart rate (if available)
        max_hr: Max heart rate during activity (if available)
        athlete_max_hr: Athlete's maximum heart rate

    Returns:
        Estimated TSS value

    TSS Estimation Methods:
        1. HR-based (if HR data available): Use Coggan TRIMP formula
        2. Duration-based (fallback): category * duration * intensity factor
    """
    duration_hours = duration_seconds / 3600

    # Method 1: HR-based TSS (most accurate for non-power activities)
    if avg_hr and avg_hr > 60:  # Valid HR data
        # Calculate HR intensity as % of max HR
        hr_intensity = avg_hr / athlete_max_hr

        # TRIMP-based TSS estimation
        # TSS = duration (hours) * intensity_factor^1.92 * 100
        # This matches how Strava calculates "Suffer Score" for non-cycling
        tss = duration_hours * (hr_intensity**1.92) * 100

        # Apply category modifier
        if category.category == "Strength":
            tss *= 0.8  # Strength training TSS is typically lower per hour
        elif category.fatigue_impact == "High":
            tss *= 1.1  # High-fatigue activities get bonus
        elif category.fatigue_impact == "Low":
            tss *= 0.7  # Low-fatigue activities reduced

        return round(tss, 1)

    # Method 2: Duration-based TSS (fallback when no HR data)
    # Assume moderate intensity (similar to Z2 cycling = ~50 TSS/hour)
    base_tss_per_hour = {
        "Cycling": 50,  # Should not be used (power-based preferred)
        "Cardio": 45,  # Cardio slightly lower than cycling
        "Strength": 35,  # Strength lower TSS per hour but high fatigue
        "Other": 30,  # Recovery/flexibility lowest
    }

    tss_rate = base_tss_per_hour.get(category.category, 40)

    # Adjust for fatigue impact
    if category.fatigue_impact == "High":
        tss_rate *= 1.2
    elif category.fatigue_impact == "Low":
        tss_rate *= 0.7

    return round(duration_hours * tss_rate, 1)

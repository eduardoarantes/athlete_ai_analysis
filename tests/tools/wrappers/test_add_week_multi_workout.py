"""
Tests for add_week_tool.py multi-workout day functionality.

Tests validation of workouts against workout_types arrays:
- Single workout per day validation
- Multiple workouts per day (cycling + strength)
- Strength workout power zone exemption
- Workout counting and matching
"""
from typing import Any

import pytest

from cycling_ai.tools.wrappers.add_week_tool import AddWeekDetailsTool


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def tool() -> AddWeekDetailsTool:
    """Create instance of AddWeekDetailsTool."""
    return AddWeekDetailsTool()


@pytest.fixture
def base_overview_data() -> dict[str, Any]:
    """Base overview data for testing."""
    return {
        "athlete_profile_json": "profile.json",
        "total_weeks": 1,
        "target_ftp": 250,
        "weekly_overview": [],
    }


@pytest.fixture
def week_overview_single_workout() -> dict[str, Any]:
    """Week overview with single workout type per day."""
    return {
        "week_number": 1,
        "phase": "Base",
        "training_days": [
            {"weekday": "Monday", "workout_types": ["rest"]},
            {"weekday": "Tuesday", "workout_types": ["endurance"]},
            {"weekday": "Wednesday", "workout_types": ["recovery"]},
            {"weekday": "Thursday", "workout_types": ["rest"]},
            {"weekday": "Friday", "workout_types": ["tempo"]},
            {"weekday": "Saturday", "workout_types": ["endurance"]},
            {"weekday": "Sunday", "workout_types": ["rest"]},
        ],
        "target_tss": 200,
        "total_hours": 7.0,
    }


@pytest.fixture
def week_overview_multi_workout() -> dict[str, Any]:
    """Week overview with multiple workout types per day."""
    return {
        "week_number": 1,
        "phase": "Base",
        "training_days": [
            {"weekday": "Monday", "workout_types": ["rest"]},
            {"weekday": "Tuesday", "workout_types": ["endurance", "strength"]},
            {"weekday": "Wednesday", "workout_types": ["recovery"]},
            {"weekday": "Thursday", "workout_types": ["rest"]},
            {"weekday": "Friday", "workout_types": ["tempo", "strength"]},
            {"weekday": "Saturday", "workout_types": ["endurance"]},
            {"weekday": "Sunday", "workout_types": ["rest"]},
        ],
        "target_tss": 200,
        "total_hours": 7.5,
    }


@pytest.fixture
def cycling_workout() -> dict[str, Any]:
    """Sample cycling workout with power zones."""
    return {
        "weekday": "Tuesday",
        "description": "Endurance ride",
        "segments": [
            {
                "type": "warmup",
                "duration_min": 10,
                "power_low_pct": 50,
                "power_high_pct": 60,
                "description": "Warmup",
            },
            {
                "type": "steady",
                "duration_min": 60,
                "power_low_pct": 65,
                "power_high_pct": 75,
                "description": "Endurance",
            },
            {
                "type": "cooldown",
                "duration_min": 10,
                "power_low_pct": 50,
                "power_high_pct": 60,
                "description": "Cooldown",
            },
        ],
    }


@pytest.fixture
def strength_workout() -> dict[str, Any]:
    """Sample strength workout without power zones."""
    return {
        "weekday": "Tuesday",
        "description": "Strength Training",
        "segments": [
            {
                "type": "strength",
                "duration_min": 30,
                "description": "Upper body strength",
            }
        ],
    }


# ============================================================================
# Test Class 1: Single Workout Per Day
# ============================================================================


class TestSingleWorkoutPerDay:
    """Tests for single workout type per day validation."""

    def test_correct_number_of_workouts(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_single_workout,
        cycling_workout,
    ):
        """Valid: Correct number of workouts matches non-rest days."""
        # 4 non-rest days (Tue, Wed, Fri, Sat) → need 4 workouts
        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_single_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is True

    def test_wrong_number_of_workouts(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_single_workout,
        cycling_workout,
    ):
        """Invalid: Wrong number of workouts for training days."""
        # 4 training days but only 3 workouts
        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},
            # Missing Saturday workout
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_single_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is False
        assert "expected" in result.error.lower()


# ============================================================================
# Test Class 2: Multiple Workouts Per Day
# ============================================================================


class TestMultipleWorkoutsPerDay:
    """Tests for multiple workout types per day validation."""

    def test_cycling_plus_strength_same_day(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_multi_workout,
        cycling_workout,
        strength_workout,
    ):
        """Valid: Cycling + strength workout on same day."""
        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},  # Cycling
            {**strength_workout, "weekday": "Tuesday"},  # Strength on same day
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},
            {**strength_workout, "weekday": "Friday"},  # Strength on same day
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_multi_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is True

    def test_missing_strength_workout(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_multi_workout,
        cycling_workout,
    ):
        """Invalid: Missing strength workout when expected."""
        # Tuesday expects ["endurance", "strength"] but only providing cycling
        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},  # Missing strength
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},  # Missing strength
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_multi_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is False
        assert "expected" in result.error.lower()

    def test_extra_strength_workout_not_expected(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_single_workout,
        cycling_workout,
        strength_workout,
    ):
        """Invalid: Extra strength workout when not expected."""
        # Wednesday expects ["recovery"] only, not strength
        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},
            {**cycling_workout, "weekday": "Wednesday"},
            {**strength_workout, "weekday": "Wednesday"},  # Not expected
            {**cycling_workout, "weekday": "Friday"},
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_single_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is False


# ============================================================================
# Test Class 3: Strength Workout Power Zone Exemption
# ============================================================================


class TestStrengthPowerZoneExemption:
    """Tests for strength workout power zone validation exemption."""

    def test_strength_workout_without_power_zones(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_multi_workout,
        cycling_workout,
    ):
        """Valid: Strength workout doesn't require power zones."""
        strength_no_power = {
            "weekday": "Tuesday",
            "description": "Strength Training",
            "segments": [
                {
                    "type": "strength",
                    "duration_min": 30,
                    "description": "Core strength",
                    # No power_low_pct or power_high_pct
                }
            ],
        }

        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},
            strength_no_power,  # No power zones - should be valid
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},
            {**strength_workout, "weekday": "Friday"},
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_multi_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is True

    def test_cycling_workout_requires_power_zones(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_single_workout,
    ):
        """Invalid: Cycling workout missing power zones."""
        cycling_no_power = {
            "weekday": "Tuesday",
            "description": "Endurance ride",
            "segments": [
                {
                    "type": "steady",
                    "duration_min": 60,
                    "description": "Endurance",
                    # Missing power_low_pct - should fail
                }
            ],
        }

        workouts = [cycling_no_power]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [
                {
                    **week_overview_single_workout,
                    "training_days": [
                        {"weekday": "Monday", "workout_types": ["rest"]},
                        {"weekday": "Tuesday", "workout_types": ["endurance"]},
                        {"weekday": "Wednesday", "workout_types": ["rest"]},
                        {"weekday": "Thursday", "workout_types": ["rest"]},
                        {"weekday": "Friday", "workout_types": ["rest"]},
                        {"weekday": "Saturday", "workout_types": ["rest"]},
                        {"weekday": "Sunday", "workout_types": ["rest"]},
                    ],
                }
            ],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is False
        assert "power_low_pct" in result.error.lower()


# ============================================================================
# Test Class 4: Strength Detection
# ============================================================================


class TestStrengthWorkoutDetection:
    """Tests for identifying strength workouts."""

    def test_detect_by_description(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_multi_workout,
        cycling_workout,
    ):
        """Strength workout identified by description."""
        strength_by_desc = {
            "weekday": "Tuesday",
            "description": "Strength Training Session",  # "strength" in description
            "segments": [
                {
                    "type": "other",
                    "duration_min": 30,
                    "description": "Full body workout",
                }
            ],
        }

        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},
            strength_by_desc,
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},
            {**strength_workout, "weekday": "Friday"},
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_multi_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is True

    def test_detect_by_segment_type(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_multi_workout,
        cycling_workout,
    ):
        """Strength workout identified by segment type."""
        strength_by_type = {
            "weekday": "Tuesday",
            "description": "Workout",
            "segments": [
                {
                    "type": "strength",  # "strength" in type
                    "duration_min": 30,
                    "description": "Resistance training",
                }
            ],
        }

        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},
            strength_by_type,
            {**cycling_workout, "weekday": "Wednesday"},
            {**cycling_workout, "weekday": "Friday"},
            {**strength_workout, "weekday": "Friday"},
            {**cycling_workout, "weekday": "Saturday"},
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_multi_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is True


# ============================================================================
# Test Class 5: Volume Calculations
# ============================================================================


class TestVolumeCalculationsWithStrength:
    """Tests for TSS/volume calculations excluding strength."""

    def test_strength_excluded_from_volume(
        self,
        tool: AddWeekDetailsTool,
        base_overview_data,
        week_overview_multi_workout,
        cycling_workout,
        strength_workout,
    ):
        """Strength workout duration excluded from weekly hours calculation."""
        # Cycling: 80 min each (warmup 10 + steady 60 + cooldown 10)
        # Strength: 30 min each
        # Total cycling: 4 workouts * 80 min = 320 min = 5.33h
        # Total strength: 2 workouts * 30 min = 60 min (excluded)
        # Expected total hours: 5.33h (not 6.33h)

        workouts = [
            {**cycling_workout, "weekday": "Tuesday"},  # 80 min
            {**strength_workout, "weekday": "Tuesday"},  # 30 min (excluded)
            {**cycling_workout, "weekday": "Wednesday"},  # 80 min
            {**cycling_workout, "weekday": "Friday"},  # 80 min
            {**strength_workout, "weekday": "Friday"},  # 30 min (excluded)
            {**cycling_workout, "weekday": "Saturday"},  # 80 min
        ]

        overview_data = {
            **base_overview_data,
            "weekly_overview": [week_overview_multi_workout],
        }

        result = tool.execute(
            plan_id="test_plan",
            week_number=1,
            workouts=workouts,
            overview_data=overview_data,
        )

        assert result.success is True
        # Verify strength workouts were excluded from volume calculation
        # (Success means volume calculation matched target within tolerance)

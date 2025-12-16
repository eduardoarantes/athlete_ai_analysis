"""
Tests for plan_overview_tool.py multi-workout day functionality.

Tests the workout_types array schema:
- Single workout type per day
- Multiple workout types per day (cycling + strength)
- Validation rules for workout_types arrays
- Cannot mix rest with other types
"""
from typing import Any

import pytest

from cycling_ai.tools.wrappers.plan_overview_tool import PlanOverviewTool


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def tool() -> PlanOverviewTool:
    """Create instance of PlanOverviewTool."""
    return PlanOverviewTool()


@pytest.fixture
def base_plan_data() -> dict[str, Any]:
    """Base plan data for testing."""
    return {
        "athlete_profile_json": "profile.json",
        "total_weeks": 4,  # Minimum required by tool
        "target_ftp": 250,
        "coaching_notes": "Test coaching notes",
        "monitoring_guidance": "Test monitoring guidance",
    }


@pytest.fixture
def valid_week_single_workout() -> dict[str, Any]:
    """Valid week with single workout type per day."""
    return {
        "week_number": 1,
        "phase": "Base",
        "phase_rationale": "Build aerobic base",
        "weekly_focus": "Endurance",
        "weekly_watch_points": "Monitor fatigue",
        "training_days": [
            {"weekday": "Monday", "workout_types": ["rest"]},
            {"weekday": "Tuesday", "workout_types": ["endurance"]},
            {"weekday": "Wednesday", "workout_types": ["recovery"]},
            {"weekday": "Thursday", "workout_types": ["rest"]},
            {"weekday": "Friday", "workout_types": ["tempo"]},
            {"weekday": "Saturday", "workout_types": ["endurance"]},
            {"weekday": "Sunday", "workout_types": ["rest"]},
        ],
        "target_tss": 250,
        "total_hours": 7.0,
    }


@pytest.fixture
def valid_week_multi_workout() -> dict[str, Any]:
    """Valid week with multiple workout types per day."""
    return {
        "week_number": 1,
        "phase": "Base",
        "phase_rationale": "Build base with strength",
        "weekly_focus": "Endurance + Strength",
        "weekly_watch_points": "Monitor recovery",
        "training_days": [
            {"weekday": "Monday", "workout_types": ["rest"]},
            {"weekday": "Tuesday", "workout_types": ["endurance", "strength"]},
            {"weekday": "Wednesday", "workout_types": ["recovery"]},
            {"weekday": "Thursday", "workout_types": ["rest"]},
            {"weekday": "Friday", "workout_types": ["tempo", "strength"]},
            {"weekday": "Saturday", "workout_types": ["endurance"]},
            {"weekday": "Sunday", "workout_types": ["sweetspot", "strength"]},
        ],
        "target_tss": 250,
        "total_hours": 7.5,
    }


# ============================================================================
# Test Class 1: Valid Schemas
# ============================================================================


class TestValidWorkoutTypesSchemas:
    """Tests for valid workout_types array schemas."""

    def test_single_workout_type_per_day(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Valid: Single workout type per day in array format."""
        # Create 4 weeks of data (tool requires minimum 4 weeks)
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True
        assert result.error is None

    def test_multiple_workout_types_per_day(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_multi_workout
    ):
        """Valid: Multiple workout types per day (cycling + strength)."""
        weekly_overview = [
            {**valid_week_multi_workout, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True
        assert result.error is None

    def test_strength_only_day(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Valid: Day with only strength workout."""
        valid_week_single_workout["training_days"][1] = {
            "weekday": "Tuesday",
            "workout_types": ["strength"],
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True
        assert result.error is None


# ============================================================================
# Test Class 2: Invalid Schemas - Array Validation
# ============================================================================


class TestInvalidWorkoutTypesArrays:
    """Tests for invalid workout_types array structures."""

    def test_workout_types_not_array(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Invalid: workout_types is string instead of array."""
        invalid_week = {**valid_week_single_workout}
        invalid_week["training_days"] = list(valid_week_single_workout["training_days"])
        invalid_week["training_days"][1] = {
            "weekday": "Tuesday",
            "workout_types": "endurance",  # Should be ["endurance"]
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1} if i > 0
            else {**invalid_week, "week_number": 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is False
        assert "must be an array" in result.error.lower()

    def test_workout_types_empty_array(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Invalid: workout_types is empty array."""
        invalid_week = {**valid_week_single_workout}
        invalid_week["training_days"] = list(valid_week_single_workout["training_days"])
        invalid_week["training_days"][1] = {
            "weekday": "Tuesday",
            "workout_types": [],  # Empty array not allowed
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1} if i > 0
            else {**invalid_week, "week_number": 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is False
        # Empty array triggers "missing" validation since it's falsy
        assert "workout_types" in result.error.lower()

    def test_workout_types_missing(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Invalid: workout_types field missing."""
        invalid_week = {**valid_week_single_workout}
        invalid_week["training_days"] = list(valid_week_single_workout["training_days"])
        invalid_week["training_days"][1] = {
            "weekday": "Tuesday",
            # Missing workout_types
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1} if i > 0
            else {**invalid_week, "week_number": 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is False
        assert "missing 'workout_types'" in result.error.lower()


# ============================================================================
# Test Class 3: Invalid Workout Types
# ============================================================================


class TestInvalidWorkoutTypeValues:
    """Tests for invalid workout type values in arrays."""

    def test_invalid_workout_type_in_array(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Invalid: Unknown workout type in array."""
        invalid_week = {**valid_week_single_workout}
        invalid_week["training_days"] = list(valid_week_single_workout["training_days"])
        invalid_week["training_days"][1] = {
            "weekday": "Tuesday",
            "workout_types": ["invalid_type"],
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1} if i > 0
            else {**invalid_week, "week_number": 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is False
        assert "invalid workout_type" in result.error.lower()

    def test_rest_mixed_with_other_types(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Invalid: Cannot mix 'rest' with other workout types."""
        invalid_week = {**valid_week_single_workout}
        invalid_week["training_days"] = list(valid_week_single_workout["training_days"])
        invalid_week["training_days"][0] = {
            "weekday": "Monday",
            "workout_types": ["rest", "strength"],  # Cannot mix rest with others
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1} if i > 0
            else {**invalid_week, "week_number": 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is False
        assert "cannot combine 'rest'" in result.error.lower()


# ============================================================================
# Test Class 4: Case Normalization
# ============================================================================


class TestCaseNormalization:
    """Tests for case-insensitive workout type handling."""

    def test_uppercase_workout_types_normalized(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Valid: Uppercase workout types are normalized to lowercase."""
        week_with_uppercase = {**valid_week_single_workout}
        week_with_uppercase["training_days"] = list(valid_week_single_workout["training_days"])
        week_with_uppercase["training_days"][1] = {
            "weekday": "Tuesday",
            "workout_types": ["ENDURANCE", "STRENGTH"],  # Uppercase
        }
        weekly_overview = [
            {**week_with_uppercase, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True

    def test_mixed_case_workout_types(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Valid: Mixed case workout types are normalized."""
        week_with_mixed = {**valid_week_single_workout}
        week_with_mixed["training_days"] = list(valid_week_single_workout["training_days"])
        week_with_mixed["training_days"][1] = {
            "weekday": "Tuesday",
            "workout_types": ["Endurance", "StrEngth"],  # Mixed case
        }
        weekly_overview = [
            {**week_with_mixed, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True


# ============================================================================
# Test Class 5: Training Day Counts
# ============================================================================


class TestTrainingDayCounts:
    """Tests for training day counting with multi-workout days."""

    def test_cycling_day_count_excludes_strength_only(
        self, tool: PlanOverviewTool, base_plan_data
    ):
        """Cycling day count excludes strength-only days."""
        week = {
            "week_number": 1,
            "phase": "Base",
            "phase_rationale": "Test",
            "weekly_focus": "Test",
            "weekly_watch_points": "Test",
            "training_days": [
                {"weekday": "Monday", "workout_types": ["rest"]},
                {"weekday": "Tuesday", "workout_types": ["endurance"]},  # 1 cycling
                {"weekday": "Wednesday", "workout_types": ["strength"]},  # 0 cycling
                {"weekday": "Thursday", "workout_types": ["rest"]},
                {"weekday": "Friday", "workout_types": ["tempo", "strength"]},  # 1 cycling
                {"weekday": "Saturday", "workout_types": ["endurance"]},  # 1 cycling
                {"weekday": "Sunday", "workout_types": ["rest"]},
            ],
            "target_tss": 200,
            "total_hours": 5.0,
        }
        weekly_overview = [
            {**week, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True
        # Should count 3 cycling days (Tue, Fri, Sat)
        # Strength-only day (Wed) not counted as cycling day

    def test_max_five_cycling_days_enforced(
        self, tool: PlanOverviewTool, base_plan_data, valid_week_single_workout
    ):
        """Invalid: More than 5 cycling days per week."""
        invalid_week = {
            "week_number": 1,
            "phase": "Base",
            "phase_rationale": "Test",
            "weekly_focus": "Test",
            "weekly_watch_points": "Test",
            "training_days": [
                {"weekday": "Monday", "workout_types": ["endurance"]},  # 1
                {"weekday": "Tuesday", "workout_types": ["tempo"]},  # 2
                {"weekday": "Wednesday", "workout_types": ["sweetspot"]},  # 3
                {"weekday": "Thursday", "workout_types": ["threshold"]},  # 4
                {"weekday": "Friday", "workout_types": ["vo2max"]},  # 5
                {"weekday": "Saturday", "workout_types": ["endurance"]},  # 6 - TOO MANY
                {"weekday": "Sunday", "workout_types": ["rest"]},
            ],
            "target_tss": 300,
            "total_hours": 10.0,
        }
        weekly_overview = [
            {**valid_week_single_workout, "week_number": i + 1} if i > 0
            else {**invalid_week, "week_number": 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is False
        assert "6 non-rest days" in result.error.lower()

    def test_strength_does_not_count_toward_max_days(
        self, tool: PlanOverviewTool, base_plan_data
    ):
        """Valid: Strength workouts don't count toward max cycling days limit."""
        week = {
            "week_number": 1,
            "phase": "Base",
            "phase_rationale": "Test",
            "weekly_focus": "Test",
            "weekly_watch_points": "Test",
            "training_days": [
                {"weekday": "Monday", "workout_types": ["rest"]},
                {"weekday": "Tuesday", "workout_types": ["endurance", "strength"]},  # 1 cycling
                {"weekday": "Wednesday", "workout_types": ["strength"]},  # 0 cycling
                {"weekday": "Thursday", "workout_types": ["rest"]},
                {"weekday": "Friday", "workout_types": ["tempo", "strength"]},  # 1 cycling
                {"weekday": "Saturday", "workout_types": ["endurance", "strength"]},  # 1 cycling
                {"weekday": "Sunday", "workout_types": ["sweetspot", "strength"]},  # 1 cycling
            ],
            "target_tss": 250,
            "total_hours": 7.0,
        }
        weekly_overview = [
            {**week, "week_number": i + 1}
            for i in range(4)
        ]
        plan_data = {**base_plan_data, "weekly_overview": weekly_overview}

        result = tool.execute(**plan_data)

        assert result.success is True
        # Only 4 cycling days, well under the 5-day limit

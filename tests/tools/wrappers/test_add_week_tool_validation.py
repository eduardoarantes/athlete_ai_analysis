"""
Essential tests for add_week_tool.py validation enhancements.

Tests the core functionality:
- 6-day week recovery detection
- Multi-scenario validation
- Auto-fix functionality
- Endurance workout identification
"""
from typing import Any

import pytest

from cycling_ai.tools.wrappers.add_week_tool import (
    _attempt_auto_fix,
    _calculate_week_metrics,
    _detect_optional_recovery_workout,
    _find_weekend_endurance_rides,
    _is_endurance_workout,
    _validate_time_budget,
)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def sample_endurance_workout() -> dict[str, Any]:
    """Sample endurance workout for testing."""
    return {
        "weekday": "Saturday",
        "description": "Long endurance ride - Zone 2",
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
                "duration_min": 120,
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
def sample_interval_workout() -> dict[str, Any]:
    """Sample high-power interval workout."""
    return {
        "weekday": "Tuesday",
        "description": "VO2max intervals",
        "segments": [
            {
                "type": "warmup",
                "duration_min": 15,
                "power_low_pct": 50,
                "power_high_pct": 60,
                "description": "Warmup",
            },
            {
                "type": "interval",
                "duration_min": 30,
                "power_low_pct": 105,
                "power_high_pct": 120,
                "description": "5x4min @ 120%",
            },
            {
                "type": "cooldown",
                "duration_min": 15,
                "power_low_pct": 50,
                "power_high_pct": 60,
                "description": "Cooldown",
            },
        ],
    }


@pytest.fixture
def sample_recovery_workout() -> dict[str, Any]:
    """Sample recovery workout."""
    return {
        "weekday": "Wednesday",
        "description": "Easy recovery spin",
        "segments": [
            {
                "type": "recovery",
                "duration_min": 45,
                "power_low_pct": 45,
                "power_high_pct": 55,
                "description": "Easy spin",
            }
        ],
    }


# ============================================================================
# Test Class 1: Recovery Detection
# ============================================================================


class TestDetectOptionalRecoveryWorkout:
    """Tests for _detect_optional_recovery_workout()"""

    def test_six_day_with_one_recovery(self):
        """6 days, 1 recovery → Returns (index, weekday)"""
        training_days_objects = [
            {"weekday": "Monday", "workout_type": "endurance"},
            {"weekday": "Tuesday", "workout_type": "intervals"},
            {"weekday": "Wednesday", "workout_type": "recovery"},
            {"weekday": "Thursday", "workout_type": "endurance"},
            {"weekday": "Friday", "workout_type": "intervals"},
            {"weekday": "Saturday", "workout_type": "endurance"},
            {"weekday": "Sunday", "workout_type": "rest"},
        ]

        workouts = [
            {"weekday": "Monday", "description": "Endurance"},
            {"weekday": "Tuesday", "description": "Intervals"},
            {"weekday": "Wednesday", "description": "Recovery"},
            {"weekday": "Thursday", "description": "Endurance"},
            {"weekday": "Friday", "description": "Intervals"},
            {"weekday": "Saturday", "description": "Endurance"},
        ]

        idx, weekday = _detect_optional_recovery_workout(
            workouts, training_days_objects, 1
        )
        assert idx == 2
        assert weekday == "Wednesday"

    def test_five_day_week_returns_none(self):
        """5 days → Returns (None, None)"""
        training_days_objects = [
            {"weekday": "Monday", "workout_type": "endurance"},
            {"weekday": "Tuesday", "workout_type": "intervals"},
            {"weekday": "Wednesday", "workout_type": "recovery"},
            {"weekday": "Thursday", "workout_type": "endurance"},
            {"weekday": "Friday", "workout_type": "intervals"},
            {"weekday": "Saturday", "workout_type": "rest"},
            {"weekday": "Sunday", "workout_type": "rest"},
        ]

        workouts = [
            {"weekday": "Monday", "description": "Endurance"},
            {"weekday": "Tuesday", "description": "Intervals"},
            {"weekday": "Wednesday", "description": "Recovery"},
            {"weekday": "Thursday", "description": "Endurance"},
            {"weekday": "Friday", "description": "Intervals"},
        ]

        idx, weekday = _detect_optional_recovery_workout(
            workouts, training_days_objects, 1
        )
        assert idx is None
        assert weekday is None


# ============================================================================
# Test Class 2: Metrics Calculation
# ============================================================================


class TestCalculateWeekMetrics:
    """Tests for _calculate_week_metrics()"""

    def test_calculate_all_workouts(
        self, sample_endurance_workout, sample_interval_workout
    ):
        """Calculate metrics with all workouts included"""
        workouts = [sample_interval_workout, sample_endurance_workout]
        total_hours, actual_tss = _calculate_week_metrics(workouts, 250.0)

        # Total: (15+30+15) + (10+120+10) = 60 + 140 = 200 min = 3.333h
        assert total_hours == pytest.approx(3.333, abs=0.01)
        assert actual_tss > 0  # TSS should be calculated

    def test_calculate_excluding_workout(
        self, sample_endurance_workout, sample_interval_workout, sample_recovery_workout
    ):
        """Calculate metrics excluding specific workout"""
        workouts = [
            sample_interval_workout,
            sample_recovery_workout,
            sample_endurance_workout,
        ]

        # Exclude recovery (index 1)
        total_hours, actual_tss = _calculate_week_metrics(
            workouts, 250.0, exclude_workout_index=1
        )

        # Total: (15+30+15) + (10+120+10) = 200 min = 3.333h (recovery excluded)
        assert total_hours == pytest.approx(3.333, abs=0.01)


# ============================================================================
# Test Class 3: Validation Logic
# ============================================================================


class TestValidateTimeBudget:
    """Tests for _validate_time_budget()"""

    def test_within_tolerance_no_errors(self):
        """Within tolerance → No errors"""
        warnings, errors = _validate_time_budget(
            total_hours=7.5,
            target_hours=7.0,
            week_number=1,
            is_recovery_week=False,
        )

        assert len(errors) == 0
        # May have warnings for time (7.5 vs 7.0 = 7% diff)

    def test_exceeds_tolerance_has_errors(self):
        """Exceeds tolerance → Has errors"""
        warnings, errors = _validate_time_budget(
            total_hours=10.0,  # 43% over target
            target_hours=7.0,
            week_number=1,
            is_recovery_week=False,
        )

        assert len(errors) > 0
        assert "time budget violation" in errors[0].lower()


# ============================================================================
# Test Class 4: Endurance Detection
# ============================================================================


class TestIsEnduranceWorkout:
    """Tests for _is_endurance_workout()"""

    def test_endurance_by_description(self):
        """Workout identified by description keywords"""
        workout = {
            "weekday": "Saturday",
            "description": "Long Zone 2 endurance ride",
            "segments": [
                {
                    "type": "steady",
                    "duration_min": 120,
                    "power_low_pct": 70,
                    "power_high_pct": 75,
                    "description": "Z2",
                }
            ],
        }

        assert _is_endurance_workout(workout) is True

    def test_interval_not_endurance(self, sample_interval_workout):
        """High-power intervals not identified as endurance"""
        assert _is_endurance_workout(sample_interval_workout) is False

    def test_endurance_by_segments(self):
        """Workout identified by segment power levels"""
        workout = {
            "weekday": "Saturday",
            "description": "Weekend ride",
            "segments": [
                {
                    "type": "steady",
                    "duration_min": 120,
                    "power_low_pct": 65,
                    "power_high_pct": 75,
                    "description": "Main set",
                }
            ],
        }

        assert _is_endurance_workout(workout) is True


# ============================================================================
# Test Class 5: Weekend Endurance Finder
# ============================================================================


class TestFindWeekendEnduranceRides:
    """Tests for _find_weekend_endurance_rides()"""

    def test_find_saturday_endurance(self, sample_endurance_workout):
        """Finds endurance ride on Saturday"""
        workouts = [sample_endurance_workout]
        results = _find_weekend_endurance_rides(workouts)

        assert len(results) == 1
        assert results[0]["weekday"] == "Saturday"
        assert results[0]["workout_index"] == 0

    def test_no_weekend_endurance(self, sample_interval_workout):
        """No weekend endurance rides → Empty list"""
        workouts = [sample_interval_workout]
        results = _find_weekend_endurance_rides(workouts)

        assert len(results) == 0

    def test_sorts_by_duration_longest_first(self):
        """Multiple weekend rides sorted by duration"""
        workout_short = {
            "weekday": "Saturday",
            "description": "Short endurance",
            "segments": [
                {
                    "type": "steady",
                    "duration_min": 60,
                    "power_low_pct": 70,
                    "power_high_pct": 75,
                    "description": "Z2",
                }
            ],
        }

        workout_long = {
            "weekday": "Sunday",
            "description": "Long endurance",
            "segments": [
                {
                    "type": "steady",
                    "duration_min": 180,
                    "power_low_pct": 70,
                    "power_high_pct": 75,
                    "description": "Z2",
                }
            ],
        }

        workouts = [workout_short, workout_long]
        results = _find_weekend_endurance_rides(workouts)

        assert len(results) == 2
        assert results[0]["duration_min"] == 180  # Longest first
        assert results[1]["duration_min"] == 60


# ============================================================================
# Test Class 6: Auto-Fix
# ============================================================================


class TestAttemptAutoFix:
    """Tests for _attempt_auto_fix()"""

    def test_removes_warmup_cooldown(self):
        """Auto-fix removes warmup/cooldown first"""
        workout = {
            "weekday": "Saturday",
            "description": "Endurance with warmup/cooldown",
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
                    "duration_min": 120,
                    "power_low_pct": 65,
                    "power_high_pct": 75,
                    "description": "Main",
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

        workouts = [workout]

        # Target 2 hours, current 140 min (2.33h) - need to remove 20 min
        modified, log = _attempt_auto_fix(workouts, 2.0, 250.0, 1)

        assert modified is not None
        assert "warmup/cooldown" in log.lower()

        # Verify warmup/cooldown removed
        modified_workout = modified[0]
        segment_types = [seg["type"] for seg in modified_workout["segments"]]
        assert "warmup" not in segment_types
        assert "cooldown" not in segment_types

    def test_no_weekend_endurance_returns_none(self, sample_interval_workout):
        """No weekend endurance → Returns None"""
        workouts = [sample_interval_workout]

        # Need target < current to trigger auto-fix
        # Interval workout: 15+30+15 = 60 min = 1.0h
        # Set target to 0.5h to exceed budget
        modified, log = _attempt_auto_fix(workouts, 0.5, 250.0, 1)

        assert modified is None
        assert "no weekend endurance" in log.lower()

    def test_already_within_budget_returns_none(self):
        """Already within budget → Returns None"""
        workout = {
            "weekday": "Saturday",
            "description": "Short endurance",
            "segments": [
                {
                    "type": "steady",
                    "duration_min": 60,
                    "power_low_pct": 65,
                    "power_high_pct": 75,
                    "description": "Main",
                }
            ],
        }

        workouts = [workout]

        # Target 2 hours, current 1 hour - already within budget
        modified, log = _attempt_auto_fix(workouts, 2.0, 250.0, 1)

        assert modified is None
        assert "within budget" in log.lower()


# ============================================================================
# Integration Test
# ============================================================================


class TestIntegration:
    """Integration tests combining multiple functions"""

    def test_six_day_recovery_scenario_validation(self):
        """Full scenario: 6-day week with recovery, validate both scenarios"""
        # 6 training days with 1 recovery
        training_days_objects = [
            {"weekday": "Monday", "workout_type": "endurance"},
            {"weekday": "Tuesday", "workout_type": "intervals"},
            {"weekday": "Wednesday", "workout_type": "recovery"},
            {"weekday": "Thursday", "workout_type": "endurance"},
            {"weekday": "Friday", "workout_type": "intervals"},
            {"weekday": "Saturday", "workout_type": "endurance"},
            {"weekday": "Sunday", "workout_type": "rest"},
        ]

        workouts = [
            {
                "weekday": "Monday",
                "description": "Endurance",
                "segments": [
                    {
                        "type": "steady",
                        "duration_min": 60,
                        "power_low_pct": 65,
                        "power_high_pct": 75,
                        "description": "Z2",
                    }
                ],
            },
            {
                "weekday": "Tuesday",
                "description": "Intervals",
                "segments": [
                    {
                        "type": "interval",
                        "duration_min": 60,
                        "power_low_pct": 100,
                        "power_high_pct": 110,
                        "description": "Hard",
                    }
                ],
            },
            {
                "weekday": "Wednesday",
                "description": "Recovery",
                "segments": [
                    {
                        "type": "recovery",
                        "duration_min": 45,
                        "power_low_pct": 45,
                        "power_high_pct": 55,
                        "description": "Easy",
                    }
                ],
            },
            {
                "weekday": "Thursday",
                "description": "Endurance",
                "segments": [
                    {
                        "type": "steady",
                        "duration_min": 60,
                        "power_low_pct": 65,
                        "power_high_pct": 75,
                        "description": "Z2",
                    }
                ],
            },
            {
                "weekday": "Friday",
                "description": "Intervals",
                "segments": [
                    {
                        "type": "interval",
                        "duration_min": 60,
                        "power_low_pct": 100,
                        "power_high_pct": 110,
                        "description": "Hard",
                    }
                ],
            },
            {
                "weekday": "Saturday",
                "description": "Long endurance",
                "segments": [
                    {
                        "type": "steady",
                        "duration_min": 120,
                        "power_low_pct": 65,
                        "power_high_pct": 75,
                        "description": "Z2",
                    }
                ],
            },
        ]

        # Step 1: Detect recovery
        recovery_idx, recovery_weekday = _detect_optional_recovery_workout(
            workouts, training_days_objects, 1
        )
        assert recovery_idx == 2
        assert recovery_weekday == "Wednesday"

        # Step 2: Calculate metrics with all workouts
        total_hours_full, tss_full = _calculate_week_metrics(workouts, 250.0)
        # Total: 60+60+45+60+60+120 = 405 min = 6.75h
        assert total_hours_full == pytest.approx(6.75, abs=0.01)

        # Step 3: Calculate metrics without recovery
        total_hours_no_rec, tss_no_rec = _calculate_week_metrics(
            workouts, 250.0, exclude_workout_index=recovery_idx
        )
        # Total: 60+60+60+60+120 = 360 min = 6.0h
        assert total_hours_no_rec == pytest.approx(6.0, abs=0.01)

        # Step 4: Validate both scenarios
        warnings_full, errors_full = _validate_time_budget(
            total_hours_full, 6.5, 1, False
        )

        warnings_no_rec, errors_no_rec = _validate_time_budget(
            total_hours_no_rec, 6.5, 1, False
        )

        # Both scenarios should pass (within tolerance)
        assert len(errors_full) == 0  # 6.75h vs 6.5h = 3.8% diff
        assert len(errors_no_rec) == 0  # 6.0h vs 6.5h = 7.7% diff

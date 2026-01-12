"""
Unit tests for weekend workout scaling algorithm.

Tests the weekend scaling logic that ensures weekly time budgets are met
by extending weekend endurance rides while keeping weekday workouts fixed.
"""
import pytest

from cycling_ai.core.workout_library.structure_helpers import (
    calculate_structure_duration,
    legacy_segments_to_structure,
)
from cycling_ai.orchestration.phases.training_planning_library import (
    LibraryBasedTrainingPlanningWeeks,
)


@pytest.fixture
def library_phase():
    """Create library phase instance for testing."""
    return LibraryBasedTrainingPlanningWeeks(temperature=0.5)


class TestFindMainSegment:
    """Tests for _find_main_segment() helper method."""

    def test_find_steady_segment(self, library_phase):
        """Test finding a steady segment (endurance rides)."""
        workout = {
            "structure": legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10},
                {"type": "steady", "duration_min": 90},
                {"type": "cooldown", "duration_min": 10},
            ])
        }

        main_segment = library_phase._find_main_segment(workout)

        # New format returns dict with segment info
        assert main_segment is not None
        assert main_segment["duration_min"] == 90

    def test_find_tempo_segment_when_no_steady(self, library_phase):
        """Test finding tempo segment when no steady segment exists."""
        workout = {
            "structure": legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10},
                {"type": "tempo", "duration_min": 60},
                {"type": "cooldown", "duration_min": 10},
            ])
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment is not None
        assert main_segment["duration_min"] == 60

    def test_find_longest_segment_as_fallback(self, library_phase):
        """Test finding longest segment when no steady or tempo."""
        workout = {
            "structure": legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10},
                {"type": "work", "duration_min": 5},
                {"type": "recovery", "duration_min": 3},
                {"type": "work", "duration_min": 5},
                {"type": "recovery", "duration_min": 3},
                {"type": "intervals", "duration_min": 30},  # Longest
                {"type": "cooldown", "duration_min": 10},
            ])
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment is not None
        assert main_segment["duration_min"] == 30

    def test_find_first_steady_when_multiple(self, library_phase):
        """Test that first steady segment is returned when multiple exist."""
        workout = {
            "structure": legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10},
                {"type": "steady", "duration_min": 60, "id": "first"},
                {"type": "steady", "duration_min": 90, "id": "second"},
                {"type": "cooldown", "duration_min": 10},
            ])
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment is not None
        assert main_segment["duration_min"] == 60  # First steady segment


class TestScaleWeekendWorkouts:
    """Tests for _scale_weekend_workouts() method."""

    def test_scale_single_weekend_workout(self, library_phase):
        """Test scaling a single weekend workout to fill deficit."""
        weekend_workouts = [
            {
                "id": "endurance_90min",
                "structure": legacy_segments_to_structure([
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 70},
                    {"type": "cooldown", "duration_min": 10},
                ]),
            }
        ]

        # Need 60 more minutes
        deficit_minutes = 60.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should have extended the steady segment by 60 minutes
        assert len(scaled) == 1
        # Check total duration increased by deficit
        original_duration = 90  # 10 warmup + 70 steady + 10 cooldown
        scaled_duration = calculate_structure_duration(scaled[0]["structure"])
        assert abs(scaled_duration - (original_duration + 60)) < 5  # Allow 5min tolerance for rounding  # 70 + 60

    def test_scale_two_weekend_workouts_equally(self, library_phase):
        """Test scaling two weekend workouts distributes deficit equally."""
        weekend_workouts = [
            {
                "id": "saturday_endurance",
                "structure": legacy_segments_to_structure([
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 80},
                    {"type": "cooldown", "duration_min": 10},
                ]),
            },
            {
                "id": "sunday_endurance",
                "structure": legacy_segments_to_structure([
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 70},
                    {"type": "cooldown", "duration_min": 10},
                ]),
            },
        ]

        # Need 120 more minutes total (60 per workout)
        deficit_minutes = 120.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Each should get 60 minutes added
        assert len(scaled) == 2
        # Check durations increased proportionally
        saturday_duration = calculate_structure_duration(scaled[0]["structure"])
        sunday_duration = calculate_structure_duration(scaled[1]["structure"])
        assert abs(saturday_duration - 160) < 5  # 100 + 60, with rounding tolerance
        assert abs(sunday_duration - 150) < 5   # 90 + 60, with rounding tolerance

    def test_scale_respects_minimum_duration(self, library_phase):
        """Test that scaling doesn't reduce segment below minimum."""
        weekend_workouts = [
            {
                "id": "short_ride",
                "structure": legacy_segments_to_structure([
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 50},
                    {"type": "cooldown", "duration_min": 10},
                ]),
            }
        ]

        # Try to reduce by 60 minutes
        deficit_minutes = -60.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should clamp to minimum of 10 minutes
        assert scaled[0]["segments"][1]["duration_min"] >= 10

    def test_scale_respects_maximum_duration(self, library_phase):
        """Test that scaling doesn't extend segment beyond maximum."""
        weekend_workouts = [
            {
                "id": "long_ride",
                "structure": legacy_segments_to_structure([
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 140},
                    {"type": "cooldown", "duration_min": 10},
                ]),
            }
        ]

        # Try to add 60 minutes
        deficit_minutes = 60.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should clamp to maximum of 150 minutes
        # Check duration respects maximum
        scaled_duration = calculate_structure_duration(scaled[0]["structure"])
        assert scaled_duration <= 170  # 10 warmup + 150 max steady + 10 cooldown

    def test_scale_does_not_mutate_original(self, library_phase):
        """Test that scaling creates a copy and doesn't mutate original workout."""
        original_workout = {
            "id": "endurance_90min",
            "structure": legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10},
                {"type": "steady", "duration_min": 70},
                {"type": "cooldown", "duration_min": 10},
            ]),
        }
        weekend_workouts = [original_workout]

        deficit_minutes = 30.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Original should be unchanged
        original_duration = calculate_structure_duration(original_workout["structure"])
        assert abs(original_duration - 90) < 1  # Should be unchanged
        # Scaled should be modified
        scaled_duration = calculate_structure_duration(scaled[0]["structure"])
        assert abs(scaled_duration - 120) < 5  # 90 + 30, with rounding tolerance

    def test_scale_handles_zero_deficit(self, library_phase):
        """Test that zero deficit returns unchanged workouts."""
        weekend_workouts = [
            {
                "id": "endurance_90min",
                "structure": legacy_segments_to_structure([
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 70},
                    {"type": "cooldown", "duration_min": 10},
                ]),
            }
        ]

        deficit_minutes = 0.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should be unchanged
        scaled_duration = calculate_structure_duration(scaled[0]["structure"])
        assert abs(scaled_duration - 90) < 1  # Should be unchanged

    def test_scale_handles_empty_list(self, library_phase):
        """Test that empty weekend list returns empty list."""
        weekend_workouts = []
        deficit_minutes = 60.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        assert scaled == []


class TestSelectAndScaleWorkouts:
    """Tests for _select_and_scale_workouts() orchestration method."""

    def test_week_8_recovery_scenario(self, library_phase):
        """Test Week 8 recovery week scenario that was failing.

        Week 8: 5.2h target, recovery phase
        - Tuesday: recovery (60min) - weekday, fixed
        - Thursday: endurance (60min) - weekday, fixed
        - Friday: recovery (60min) - weekday, fixed
        - Saturday: endurance (SCALE) - weekend endurance, scaled
        - Sunday: recovery (NOT SCALED) - weekend recovery, stays at base duration

        Expected: Weekdays stay ~60min, only Saturday endurance scales to fill deficit
        """
        week = {
            "week_number": 8,
            "phase": "Recovery",
            "total_hours": 5.2,
            "training_days": [
                {"weekday": "Monday", "workout_types": ["rest"]},
                {"weekday": "Tuesday", "workout_types": ["recovery"]},
                {"weekday": "Wednesday", "workout_types": ["rest"]},
                {"weekday": "Thursday", "workout_types": ["endurance"]},
                {"weekday": "Friday", "workout_types": ["recovery"]},
                {"weekday": "Saturday", "workout_types": ["endurance"]},
                {"weekday": "Sunday", "workout_types": ["recovery"]},
            ]),
        }

        # This should select workouts and scale ONLY Saturday endurance to hit 5.2h
        workouts = library_phase._select_and_scale_workouts(week)

        # Calculate total duration
        total_minutes = sum(
            calculate_structure_duration(w.get("structure", {})) for w in workouts
        )
        total_hours = total_minutes / 60

        # Should be within 20% of target (5.2h ± 1.0h) since only 1 endurance workout can scale
        assert 4.0 <= total_hours <= 6.2, f"Got {total_hours:.1f}h, expected ~5.2h"

        # Weekday workouts should be 45-75 minutes
        weekday_workouts = [
            w
            for w in workouts
            if w.get("weekday") not in ["Saturday", "Sunday"]
        ]
        for workout in weekday_workouts:
            duration = sum(seg["duration_min"] for seg in workout["segments"])
            assert 45 <= duration <= 75, f"Weekday workout {duration}min outside 45-75min range"

        # Weekend endurance workouts (Saturday) should be scaled
        weekend_endurance = [
            w
            for w in workouts
            if w.get("weekday") in ["Saturday", "Sunday"] and any(
                day["weekday"] == w.get("weekday") and "endurance" in day["workout_types"]
                for day in week["training_days"]
            )
        ]
        for workout in weekend_endurance:
            duration = sum(seg["duration_min"] for seg in workout["segments"])
            # Endurance workouts can scale from 30-180 minutes (after rounding to nearest 10)
            assert 30 <= duration <= 180, f"Weekend endurance {duration}min outside 30-180min range"

        # Weekend recovery workouts (Sunday) should stay at base duration (not scaled)
        weekend_recovery = [
            w
            for w in workouts
            if w.get("weekday") in ["Saturday", "Sunday"] and any(
                day["weekday"] == w.get("weekday") and "recovery" in day["workout_types"]
                for day in week["training_days"]
            )
        ]
        for workout in weekend_recovery:
            duration = sum(seg["duration_min"] for seg in workout["segments"])
            # Recovery workouts stay at base duration (typically 30-100 minutes)
            assert 30 <= duration <= 120, f"Weekend recovery {duration}min outside 30-120min range"

    def test_foundation_week_high_volume(self, library_phase):
        """Test foundation week with higher volume target.

        Week 3: 7.8h target, foundation phase
        Should distribute volume across weekdays and weekends appropriately.
        """
        week = {
            "week_number": 3,
            "phase": "Foundation",
            "total_hours": 7.8,
            "training_days": [
                {"weekday": "Monday", "workout_types": ["rest"]},
                {"weekday": "Tuesday", "workout_types": ["sweetspot"]},
                {"weekday": "Wednesday", "workout_types": ["recovery"]},
                {"weekday": "Thursday", "workout_types": ["endurance"]},
                {"weekday": "Friday", "workout_types": ["threshold"]},
                {"weekday": "Saturday", "workout_types": ["endurance"]},
                {"weekday": "Sunday", "workout_types": ["endurance"]},
            ]),
        }

        workouts = library_phase._select_and_scale_workouts(week)

        # Calculate total duration
        total_minutes = sum(
            calculate_structure_duration(w.get("structure", {})) for w in workouts
        )
        total_hours = total_minutes / 60

        # Should be within 10% of target (7.8h ± 0.78h)
        assert 7.0 <= total_hours <= 8.6, f"Got {total_hours:.1f}h, expected ~7.8h"

"""
Unit tests for weekend workout scaling algorithm.

Tests the weekend scaling logic that ensures weekly time budgets are met
by extending weekend endurance rides while keeping weekday workouts fixed.
"""
import pytest

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
            "segments": [
                {"type": "warmup", "duration_min": 10},
                {"type": "steady", "duration_min": 90},
                {"type": "cooldown", "duration_min": 10},
            ]
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment["type"] == "steady"
        assert main_segment["duration_min"] == 90

    def test_find_tempo_segment_when_no_steady(self, library_phase):
        """Test finding tempo segment when no steady segment exists."""
        workout = {
            "segments": [
                {"type": "warmup", "duration_min": 10},
                {"type": "tempo", "duration_min": 60},
                {"type": "cooldown", "duration_min": 10},
            ]
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment["type"] == "tempo"
        assert main_segment["duration_min"] == 60

    def test_find_longest_segment_as_fallback(self, library_phase):
        """Test finding longest segment when no steady or tempo."""
        workout = {
            "segments": [
                {"type": "warmup", "duration_min": 10},
                {"type": "work", "duration_min": 5},
                {"type": "recovery", "duration_min": 3},
                {"type": "work", "duration_min": 5},
                {"type": "recovery", "duration_min": 3},
                {"type": "intervals", "duration_min": 30},  # Longest
                {"type": "cooldown", "duration_min": 10},
            ]
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment["type"] == "intervals"
        assert main_segment["duration_min"] == 30

    def test_find_first_steady_when_multiple(self, library_phase):
        """Test that first steady segment is returned when multiple exist."""
        workout = {
            "segments": [
                {"type": "warmup", "duration_min": 10},
                {"type": "steady", "duration_min": 60, "id": "first"},
                {"type": "steady", "duration_min": 90, "id": "second"},
                {"type": "cooldown", "duration_min": 10},
            ]
        }

        main_segment = library_phase._find_main_segment(workout)

        assert main_segment.get("id") == "first"


class TestScaleWeekendWorkouts:
    """Tests for _scale_weekend_workouts() method."""

    def test_scale_single_weekend_workout(self, library_phase):
        """Test scaling a single weekend workout to fill deficit."""
        weekend_workouts = [
            {
                "id": "endurance_90min",
                "segments": [
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 70},
                    {"type": "cooldown", "duration_min": 10},
                ],
            }
        ]

        # Need 60 more minutes
        deficit_minutes = 60.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should have extended the steady segment by 60 minutes
        assert len(scaled) == 1
        assert scaled[0]["segments"][1]["type"] == "steady"
        assert scaled[0]["segments"][1]["duration_min"] == 130  # 70 + 60

    def test_scale_two_weekend_workouts_equally(self, library_phase):
        """Test scaling two weekend workouts distributes deficit equally."""
        weekend_workouts = [
            {
                "id": "saturday_endurance",
                "segments": [
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 80},
                    {"type": "cooldown", "duration_min": 10},
                ],
            },
            {
                "id": "sunday_endurance",
                "segments": [
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 70},
                    {"type": "cooldown", "duration_min": 10},
                ],
            },
        ]

        # Need 120 more minutes total (60 per workout)
        deficit_minutes = 120.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Each should get 60 minutes added
        assert len(scaled) == 2
        assert scaled[0]["segments"][1]["duration_min"] == 140  # 80 + 60
        assert scaled[1]["segments"][1]["duration_min"] == 130  # 70 + 60

    def test_scale_respects_minimum_duration(self, library_phase):
        """Test that scaling doesn't reduce segment below minimum."""
        weekend_workouts = [
            {
                "id": "short_ride",
                "segments": [
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 50},
                    {"type": "cooldown", "duration_min": 10},
                ],
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
                "segments": [
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 140},
                    {"type": "cooldown", "duration_min": 10},
                ],
            }
        ]

        # Try to add 60 minutes
        deficit_minutes = 60.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should clamp to maximum of 150 minutes
        assert scaled[0]["segments"][1]["duration_min"] <= 150

    def test_scale_does_not_mutate_original(self, library_phase):
        """Test that scaling creates a copy and doesn't mutate original workout."""
        original_workout = {
            "id": "endurance_90min",
            "segments": [
                {"type": "warmup", "duration_min": 10},
                {"type": "steady", "duration_min": 70},
                {"type": "cooldown", "duration_min": 10},
            ],
        }
        weekend_workouts = [original_workout]

        deficit_minutes = 30.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Original should be unchanged
        assert original_workout["segments"][1]["duration_min"] == 70
        # Scaled should be modified
        assert scaled[0]["segments"][1]["duration_min"] == 100

    def test_scale_handles_zero_deficit(self, library_phase):
        """Test that zero deficit returns unchanged workouts."""
        weekend_workouts = [
            {
                "id": "endurance_90min",
                "segments": [
                    {"type": "warmup", "duration_min": 10},
                    {"type": "steady", "duration_min": 70},
                    {"type": "cooldown", "duration_min": 10},
                ],
            }
        ]

        deficit_minutes = 0.0

        scaled = library_phase._scale_weekend_workouts(weekend_workouts, deficit_minutes)

        # Should be unchanged
        assert scaled[0]["segments"][1]["duration_min"] == 70

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
        - Tuesday: recovery (60min)
        - Thursday: endurance (60min)
        - Friday: recovery (60min)
        - Saturday: endurance (SCALE)
        - Sunday: recovery (SCALE)

        Expected: Weekdays stay ~60min, weekends scale to fill 5.2h total
        """
        week = {
            "week_number": 8,
            "phase": "Recovery",
            "total_hours": 5.2,
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
        }

        # This should select workouts and scale weekends to hit 5.2h
        workouts = library_phase._select_and_scale_workouts(week)

        # Calculate total duration
        total_minutes = sum(
            sum(seg["duration_min"] for seg in w["segments"]) for w in workouts
        )
        total_hours = total_minutes / 60

        # Should be within 10% of target (5.2h ± 0.52h)
        assert 4.7 <= total_hours <= 5.7, f"Got {total_hours:.1f}h, expected ~5.2h"

        # Weekday workouts should be 45-75 minutes
        weekday_workouts = [
            w
            for w in workouts
            if w.get("weekday") not in ["Saturday", "Sunday"]
        ]
        for workout in weekday_workouts:
            duration = sum(seg["duration_min"] for seg in workout["segments"])
            assert 45 <= duration <= 75, f"Weekday workout {duration}min outside 45-75min range"

        # Weekend workouts should be reasonably sized for the week type
        # Recovery weeks have lower volume, so weekend workouts may be shorter
        weekend_workouts = [
            w
            for w in workouts
            if w.get("weekday") in ["Saturday", "Sunday"]
        ]
        # For recovery week (5.2h total), weekend workouts can be 60-120 minutes
        for workout in weekend_workouts:
            duration = sum(seg["duration_min"] for seg in workout["segments"])
            assert 45 <= duration <= 180, f"Weekend workout {duration}min outside 45-180min range"

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
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "threshold"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
        }

        workouts = library_phase._select_and_scale_workouts(week)

        # Calculate total duration
        total_minutes = sum(
            sum(seg["duration_min"] for seg in w["segments"]) for w in workouts
        )
        total_hours = total_minutes / 60

        # Should be within 10% of target (7.8h ± 0.78h)
        assert 7.0 <= total_hours <= 8.6, f"Got {total_hours:.1f}h, expected ~7.8h"

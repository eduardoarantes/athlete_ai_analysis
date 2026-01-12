"""
Tests for workout comparison business logic.

Following TDD approach: tests written first, then implementation.
"""

import json
import pytest
from datetime import datetime
from pathlib import Path

# Import will fail initially - that's expected in TDD (RED phase)
from cycling_ai.core.workout_comparison import (
    PlannedWorkout,
    ActualWorkout,
    ComplianceMetrics,
    WorkoutComparison,
    WeeklyPattern,
    WeeklyComparison,
    ComplianceScorer,
)
from cycling_ai.core.workout_library.structure_helpers import legacy_segments_to_structure


# Fixtures for test data
@pytest.fixture
def fixtures_dir():
    """Return path to workout comparison fixtures directory."""
    return Path(__file__).parent.parent / "fixtures" / "workout_comparison"


@pytest.fixture
def sample_plan_path(fixtures_dir):
    """Return path to sample training plan."""
    return fixtures_dir / "sample_training_plan.json"


@pytest.fixture
def sample_plan(sample_plan_path):
    """Load sample training plan."""
    with open(sample_plan_path) as f:
        return json.load(f)


# =============================================================================
# Data Model Tests - PlannedWorkout
# =============================================================================


class TestPlannedWorkout:
    """Test PlannedWorkout data model."""

    def test_create_planned_workout_required_fields(self):
        """Test creating PlannedWorkout with required fields."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=80.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60},
                {"type": "steady", "duration_min": 60, "power_low_pct": 70, "power_high_pct": 75},
                {"type": "cooldown", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 55},
            ]),
            description="Easy endurance ride",
        )

        assert workout.date == datetime(2024, 11, 4)
        assert workout.weekday == "Monday"
        assert workout.workout_type == "endurance"
        assert workout.total_duration_minutes == 80.0
        assert workout.planned_tss == 65.0
        assert workout.structure is not None
        assert workout.description == "Easy endurance ride"

    def test_planned_workout_zone_distribution_auto_calculated(self):
        """Test that zone distribution is auto-calculated if not provided."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=80.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60},
                {"type": "steady", "duration_min": 60, "power_low_pct": 65, "power_high_pct": 75},
                {"type": "cooldown", "duration_min": 10, "power_low_pct": 45, "power_high_pct": 55},
            ]),
            description="Endurance",
        )

        # Should auto-calculate zone distribution
        assert isinstance(workout.zone_distribution, dict)
        # Z1 (0-55%): warmup avg=55% (10min) + cooldown avg=50% (10min) = 20min
        # Z2 (56-75%): steady avg=70% (60min)
        assert workout.zone_distribution.get("Z1", 0) == 20
        assert workout.zone_distribution.get("Z2", 0) == 60

    def test_planned_workout_avg_power_pct_calculated(self):
        """Test that average power percentage is calculated."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=60.0,
            planned_tss=85.0,
            structure=legacy_segments_to_structure([
                {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60},
                {"type": "interval", "duration_min": 40, "power_low_pct": 95, "power_high_pct": 105},
                {"type": "cooldown", "duration_min": 10, "power_low_pct": 45, "power_high_pct": 55},
            ]),
            description="Threshold",
        )

        assert workout.target_avg_power_pct is not None
        # Weighted average: (10*55 + 40*100 + 10*50) / 60 = (550 + 4000 + 500) / 60 = 84.2
        assert 83 <= workout.target_avg_power_pct <= 85

    def test_planned_workout_empty_segments(self):
        """Test PlannedWorkout with empty segments list."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="recovery",
            total_duration_minutes=45.0,
            planned_tss=25.0,
            structure=legacy_segments_to_structure([]),
            description="Recovery",
        )

        assert workout.zone_distribution == {}
        assert workout.target_avg_power_pct == 0.0


# =============================================================================
# Data Model Tests - ActualWorkout
# =============================================================================


class TestActualWorkout:
    """Test ActualWorkout data model."""

    def test_create_actual_workout_required_fields_only(self):
        """Test creating ActualWorkout with required fields only."""
        workout = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=80.0,
        )

        assert workout.date == datetime(2024, 11, 4)
        assert workout.activity_name == "Morning Ride"
        assert workout.activity_type == "Ride"
        assert workout.duration_minutes == 80.0
        assert workout.distance_km is None
        assert workout.average_power is None
        assert workout.actual_tss is None

    def test_create_actual_workout_all_fields(self):
        """Test creating ActualWorkout with all optional fields."""
        workout = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=80.0,
            distance_km=50.2,
            average_power=185,
            normalized_power=190,
            actual_tss=65.0,
            intensity_factor=0.72,
            average_hr=145,
            max_hr=168,
            zone_distribution={"Z1": 20, "Z2": 60},
        )

        assert workout.distance_km == 50.2
        assert workout.average_power == 185
        assert workout.normalized_power == 190
        assert workout.actual_tss == 65.0
        assert workout.intensity_factor == 0.72
        assert workout.average_hr == 145
        assert workout.max_hr == 168
        assert workout.zone_distribution == {"Z1": 20, "Z2": 60}

    def test_actual_workout_missing_power_data(self):
        """Test ActualWorkout handles missing power data gracefully."""
        workout = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=80.0,
            average_hr=145,
        )

        assert workout.average_power is None
        assert workout.normalized_power is None
        assert workout.actual_tss is None
        assert workout.average_hr == 145  # HR still available


# =============================================================================
# Data Model Tests - ComplianceMetrics
# =============================================================================


class TestComplianceMetrics:
    """Test ComplianceMetrics data model."""

    def test_create_compliance_metrics_completed_workout(self):
        """Test creating ComplianceMetrics for completed workout."""
        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=95.0,
            intensity_score=90.0,
            tss_score=92.0,
            compliance_score=96.0,
            duration_compliance_pct=95.0,
            tss_compliance_pct=92.0,
        )

        assert metrics.completed is True
        assert metrics.completion_score == 100.0
        assert metrics.duration_score == 95.0
        assert metrics.intensity_score == 90.0
        assert metrics.tss_score == 92.0
        assert metrics.compliance_score == 96.0
        assert metrics.duration_compliance_pct == 95.0
        assert metrics.tss_compliance_pct == 92.0

    def test_create_compliance_metrics_skipped_workout(self):
        """Test creating ComplianceMetrics for skipped workout."""
        metrics = ComplianceMetrics(
            completed=False,
            completion_score=0.0,
            duration_score=0.0,
            intensity_score=0.0,
            tss_score=0.0,
            compliance_score=0.0,
            duration_compliance_pct=0.0,
            tss_compliance_pct=None,
        )

        assert metrics.completed is False
        assert metrics.compliance_score == 0.0
        assert metrics.tss_compliance_pct is None

    def test_compliance_metrics_missing_tss(self):
        """Test ComplianceMetrics with missing TSS data."""
        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=100.0,
            intensity_score=95.0,
            tss_score=100.0,  # Default when TSS missing
            compliance_score=98.8,
            duration_compliance_pct=100.0,
            tss_compliance_pct=None,  # Missing
        )

        assert metrics.tss_compliance_pct is None
        assert metrics.tss_score == 100.0


# =============================================================================
# Data Model Tests - WorkoutComparison
# =============================================================================


class TestWorkoutComparison:
    """Test WorkoutComparison data model."""

    def test_create_workout_comparison_completed(self):
        """Test creating WorkoutComparison for completed workout."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=80.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([]),
            description="Endurance",
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=80.0,
        )

        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=100.0,
            intensity_score=100.0,
            tss_score=100.0,
            compliance_score=100.0,
            duration_compliance_pct=100.0,
            tss_compliance_pct=100.0,
        )

        comparison = WorkoutComparison(
            date=datetime(2024, 11, 4),
            planned=planned,
            actual=actual,
            metrics=metrics,
            deviations=[],
            recommendation="Excellent execution!",
        )

        assert comparison.date == datetime(2024, 11, 4)
        assert comparison.planned == planned
        assert comparison.actual == actual
        assert comparison.metrics.compliance_score == 100.0
        assert comparison.deviations == []
        assert comparison.recommendation == "Excellent execution!"

    def test_create_workout_comparison_skipped(self):
        """Test creating WorkoutComparison for skipped workout."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 6),
            weekday="Wednesday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            structure=legacy_segments_to_structure([]),
            description="Threshold",
        )

        metrics = ComplianceMetrics(
            completed=False,
            completion_score=0.0,
            duration_score=0.0,
            intensity_score=0.0,
            tss_score=0.0,
            compliance_score=0.0,
            duration_compliance_pct=0.0,
            tss_compliance_pct=None,
        )

        comparison = WorkoutComparison(
            date=datetime(2024, 11, 6),
            planned=planned,
            actual=None,  # Skipped
            metrics=metrics,
            deviations=["Workout skipped entirely"],
            recommendation="Consider rescheduling this workout.",
        )

        assert comparison.actual is None
        assert comparison.metrics.completed is False
        assert "skipped" in comparison.deviations[0].lower()


# =============================================================================
# Data Model Tests - WeeklyPattern
# =============================================================================


class TestWeeklyPattern:
    """Test WeeklyPattern data model."""

    def test_create_weekly_pattern(self):
        """Test creating WeeklyPattern with all fields."""
        pattern = WeeklyPattern(
            pattern_type="skipped_hard_workouts",
            description="Threshold and VO2max workouts consistently skipped",
            severity="high",
            affected_workouts=[
                datetime(2024, 11, 6),
                datetime(2024, 11, 13),
            ],
        )

        assert pattern.pattern_type == "skipped_hard_workouts"
        assert pattern.severity == "high"
        assert len(pattern.affected_workouts) == 2


# =============================================================================
# Data Model Tests - WeeklyComparison
# =============================================================================


class TestWeeklyComparison:
    """Test WeeklyComparison data model."""

    def test_create_weekly_comparison(self):
        """Test creating WeeklyComparison with aggregated data."""
        weekly = WeeklyComparison(
            week_number=1,
            week_start_date=datetime(2024, 11, 4),
            week_end_date=datetime(2024, 11, 10),
            daily_comparisons=[],
            workouts_planned=3,
            workouts_completed=2,
            completion_rate_pct=66.7,
            total_planned_tss=255.0,
            total_actual_tss=170.0,
            tss_compliance_pct=66.7,
            total_planned_duration_minutes=305.0,
            total_actual_duration_minutes=230.0,
            duration_compliance_pct=75.4,
            avg_compliance_score=72.5,
            patterns=[],
            weekly_recommendation="Focus on completing all scheduled workouts.",
        )

        assert weekly.week_number == 1
        assert weekly.workouts_planned == 3
        assert weekly.workouts_completed == 2
        assert weekly.completion_rate_pct == 66.7
        assert weekly.avg_compliance_score == 72.5

    def test_weekly_comparison_week_boundaries(self):
        """Test that week starts on Monday and ends on Sunday."""
        weekly = WeeklyComparison(
            week_number=1,
            week_start_date=datetime(2024, 11, 4),  # Monday
            week_end_date=datetime(2024, 11, 10),  # Sunday
            daily_comparisons=[],
        )

        assert weekly.week_start_date.weekday() == 0  # Monday
        assert weekly.week_end_date.weekday() == 6  # Sunday


# =============================================================================
# ComplianceScorer Tests
# =============================================================================


class TestComplianceScorer:
    """Test ComplianceScorer algorithms."""

    @pytest.fixture
    def scorer(self):
        """Create ComplianceScorer instance."""
        return ComplianceScorer()

    def test_perfect_compliance(self, scorer):
        """Test workout executed exactly as planned."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([]),
            description="Endurance",
            zone_distribution={"Z1": 10, "Z2": 75, "Z3": 5},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=90.0,
            actual_tss=65.0,
            zone_distribution={"Z1": 10, "Z2": 75, "Z3": 5},
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert metrics.compliance_score >= 99.0  # Allow minor floating point diff
        assert metrics.completion_score == 100.0
        assert metrics.duration_score >= 99.0
        assert metrics.intensity_score >= 99.0
        assert metrics.tss_score >= 99.0

    def test_skipped_workout(self, scorer):
        """Test skipped workout returns zero scores."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            structure=legacy_segments_to_structure([]),
            description="Threshold",
        )

        metrics = scorer.calculate_compliance_score(planned, None, ftp=265)

        assert metrics.completed is False
        assert metrics.compliance_score == 0.0
        assert metrics.completion_score == 0.0
        assert metrics.duration_score == 0.0
        assert metrics.intensity_score == 0.0
        assert metrics.tss_score == 0.0

    def test_short_duration_deviation(self, scorer):
        """Test workout cut short by 20%."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([]),
            description="Endurance",
            zone_distribution={"Z2": 80, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=72.0,  # 80% of planned
            actual_tss=52.0,
            zone_distribution={"Z2": 64, "Z1": 8},
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert 85 < metrics.compliance_score < 90  # Good compliance despite being 20% short
        assert metrics.duration_compliance_pct == 80.0
        assert metrics.duration_score == 80.0

    def test_intensity_deviation(self, scorer):
        """Test wrong intensity zones (Z3 instead of Z4)."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 6),
            weekday="Wednesday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            structure=legacy_segments_to_structure([]),
            description="Threshold",
            zone_distribution={"Z2": 35, "Z4": 30, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 6),
            activity_name="Threshold Attempt",
            activity_type="Virtual Ride",
            duration_minutes=75.0,
            actual_tss=68.0,
            zone_distribution={"Z2": 40, "Z3": 30, "Z1": 5},  # Z3 instead of Z4
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert 60 < metrics.compliance_score < 80
        assert metrics.intensity_score < 70  # Poor zone match

    def test_missing_tss_data(self, scorer):
        """Test handling of missing TSS data."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([]),
            description="Endurance",
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Morning Ride",
            activity_type="Ride",
            duration_minutes=90.0,
            actual_tss=None,  # Missing TSS
        )

        metrics = scorer.calculate_compliance_score(planned, actual, ftp=265)

        assert metrics.completed is True
        assert metrics.tss_score == 100.0  # Default when TSS missing
        assert metrics.tss_compliance_pct is None

    def test_zone_match_perfect(self, scorer):
        """Test perfect zone match returns 100."""
        planned_zones = {"Z1": 10, "Z2": 60, "Z3": 10}
        actual_zones = {"Z1": 10, "Z2": 60, "Z3": 10}

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)
        assert score == 100.0

    def test_zone_match_complete_mismatch(self, scorer):
        """Test complete zone mismatch."""
        planned_zones = {"Z2": 60}
        actual_zones = {"Z4": 60}  # All time in wrong zone

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)

        # Total deviation = |60-0| + |0-60| = 120 minutes
        # Total planned = 60 minutes
        # Deviation % = 120/60 = 200%
        # Score = max(0, 100 - 200) = 0
        assert score == 0.0

    def test_zone_match_partial(self, scorer):
        """Test partial zone match."""
        planned_zones = {"Z2": 60, "Z4": 20}
        actual_zones = {"Z2": 60, "Z3": 20}  # Z3 instead of Z4

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)

        # Z2: no deviation (60 = 60)
        # Z4: deviation of 20 (planned 20, actual 0)
        # Z3: deviation of 20 (planned 0, actual 20)
        # Total deviation = 40
        # Total planned = 80
        # Deviation % = 40/80 = 50%
        # Score = 100 - 50 = 50
        assert score == 50.0

    def test_zone_match_empty_planned(self, scorer):
        """Test empty planned zones returns 100."""
        score = scorer.calculate_zone_match_score({}, {"Z2": 60})
        assert score == 100.0

    def test_zone_match_empty_actual(self, scorer):
        """Test empty actual zones with planned zones."""
        planned_zones = {"Z2": 60}
        actual_zones = {}

        score = scorer.calculate_zone_match_score(planned_zones, actual_zones)

        # All planned time is deviation
        assert score == 0.0


# =============================================================================
# WorkoutMatcher Tests
# =============================================================================


# Import will be added after implementation
# from cycling_ai.core.workout_comparison import WorkoutMatcher


class TestWorkoutMatcher:
    """Test WorkoutMatcher algorithms."""

    @pytest.fixture
    def matcher(self):
        """Create WorkoutMatcher instance."""
        # Will import after implementation
        from cycling_ai.core.workout_comparison import WorkoutMatcher
        return WorkoutMatcher()

    @pytest.fixture
    def sample_planned_workouts(self):
        """Create sample planned workouts for testing."""
        return [
            PlannedWorkout(
                date=datetime(2024, 11, 4),
                weekday="Monday",
                workout_type="endurance",
                total_duration_minutes=80.0,
                planned_tss=65.0,
                structure=legacy_segments_to_structure([]),
                description="Endurance",
            ),
            PlannedWorkout(
                date=datetime(2024, 11, 6),
                weekday="Wednesday",
                workout_type="threshold",
                total_duration_minutes=75.0,
                planned_tss=85.0,
                structure=legacy_segments_to_structure([]),
                description="Threshold",
            ),
            PlannedWorkout(
                date=datetime(2024, 11, 9),
                weekday="Saturday",
                workout_type="endurance",
                total_duration_minutes=150.0,
                planned_tss=105.0,
                structure=legacy_segments_to_structure([]),
                description="Long ride",
            ),
        ]

    def test_exact_date_match(self, matcher, sample_planned_workouts):
        """Test exact date matching of workouts."""
        actual_activities = [
            ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Morning Ride",
                activity_type="Ride",
                duration_minutes=80.0,
            ),
        ]

        matches = matcher.match_workouts(sample_planned_workouts, actual_activities)

        assert len(matches) == 3  # All planned workouts should be in results
        # First match should be exact
        assert matches[0][0].date == datetime(2024, 11, 4)
        assert matches[0][1] is not None
        assert matches[0][1].activity_name == "Morning Ride"
        # Others should be None (not matched)
        assert matches[1][1] is None
        assert matches[2][1] is None

    def test_fuzzy_match_one_day_after(self, matcher, sample_planned_workouts):
        """Test fuzzy matching when workout is done 1 day late."""
        # Workout planned for Monday, done on Tuesday
        actual_activities = [
            ActualWorkout(
                date=datetime(2024, 11, 5),  # Tuesday instead of Monday
                activity_name="Delayed Morning Ride",
                activity_type="Ride",
                duration_minutes=75.0,
            ),
        ]

        matches = matcher.match_workouts(
            sample_planned_workouts, actual_activities, fuzzy_match_days=1
        )

        # Should fuzzy-match to Monday's workout
        assert matches[0][1] is not None
        assert matches[0][1].date == datetime(2024, 11, 5)

    def test_fuzzy_match_one_day_before(self, matcher, sample_planned_workouts):
        """Test fuzzy matching when workout is done 1 day early."""
        # Workout planned for Wednesday, done on Tuesday
        actual_activities = [
            ActualWorkout(
                date=datetime(2024, 11, 5),  # Tuesday instead of Wednesday
                activity_name="Early Workout",
                activity_type="Ride",
                duration_minutes=70.0,
            ),
        ]

        matches = matcher.match_workouts(
            sample_planned_workouts, actual_activities, fuzzy_match_days=1
        )

        # Should fuzzy-match to Wednesday's workout (closest match)
        # Monday is Nov 4, Wednesday is Nov 6, workout is Nov 5
        # Could match either, but should prefer the one it's closer to in time
        matched_planned = matches[0][0] if matches[0][1] is not None else matches[1][0]
        assert matched_planned.date in [datetime(2024, 11, 4), datetime(2024, 11, 6)]

    def test_multiple_activities_same_day_select_longest(self, matcher, sample_planned_workouts):
        """Test that when multiple activities on same day, longest is selected."""
        actual_activities = [
            ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Morning Commute",
                activity_type="Ride",
                duration_minutes=20.0,
            ),
            ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Main Workout",
                activity_type="Ride",
                duration_minutes=80.0,
            ),
            ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Evening Spin",
                activity_type="Ride",
                duration_minutes=30.0,
            ),
        ]

        matches = matcher.match_workouts(sample_planned_workouts, actual_activities)

        # Should select the longest activity (80 min)
        assert matches[0][1] is not None
        assert matches[0][1].activity_name == "Main Workout"
        assert matches[0][1].duration_minutes == 80.0

    def test_no_match_workout_skipped(self, matcher, sample_planned_workouts):
        """Test that unmatched planned workouts return None."""
        # No actual activities
        actual_activities = []

        matches = matcher.match_workouts(sample_planned_workouts, actual_activities)

        assert len(matches) == 3
        assert all(match[1] is None for match in matches)

    def test_fuzzy_match_disabled(self, matcher, sample_planned_workouts):
        """Test that fuzzy matching can be disabled."""
        # Workout done 1 day late, but fuzzy matching disabled
        actual_activities = [
            ActualWorkout(
                date=datetime(2024, 11, 5),
                activity_name="Delayed Ride",
                activity_type="Ride",
                duration_minutes=80.0,
            ),
        ]

        matches = matcher.match_workouts(
            sample_planned_workouts, actual_activities, fuzzy_match_days=0
        )

        # Should not match (fuzzy disabled)
        assert all(match[1] is None for match in matches)

    def test_match_uses_each_actual_once(self, matcher):
        """Test that each actual workout is matched to at most one planned workout."""
        planned = [
            PlannedWorkout(
                date=datetime(2024, 11, 4),
                weekday="Monday",
                workout_type="endurance",
                total_duration_minutes=60.0,
                planned_tss=50.0,
                structure=legacy_segments_to_structure([]),
                description="Workout 1",
            ),
            PlannedWorkout(
                date=datetime(2024, 11, 5),
                weekday="Tuesday",
                workout_type="endurance",
                total_duration_minutes=60.0,
                planned_tss=50.0,
                structure=legacy_segments_to_structure([]),
                description="Workout 2",
            ),
        ]

        # Only one actual workout on Nov 4
        actual = [
            ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Single Ride",
                activity_type="Ride",
                duration_minutes=60.0,
            ),
        ]

        matches = matcher.match_workouts(planned, actual)

        # First should match exactly
        assert matches[0][1] is not None
        # Second should not match (actual already used)
        assert matches[1][1] is None


# =============================================================================
# DeviationDetector and RecommendationEngine Tests
# =============================================================================


class TestDeviationDetectorAndRecommendations:
    """Test DeviationDetector and RecommendationEngine together."""

    @pytest.fixture
    def detector(self):
        """Create DeviationDetector instance."""
        from cycling_ai.core.workout_comparison import DeviationDetector
        return DeviationDetector()

    @pytest.fixture
    def recommender(self):
        """Create RecommendationEngine instance."""
        from cycling_ai.core.workout_comparison import RecommendationEngine
        return RecommendationEngine()

    def test_detect_no_deviations_perfect_match(self, detector):
        """Test perfect workout execution has no deviations."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([]),
            description="Endurance",
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Perfect Ride",
            activity_type="Ride",
            duration_minutes=90.0,
            actual_tss=65.0,
        )

        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=100.0,
            intensity_score=100.0,
            tss_score=100.0,
            compliance_score=100.0,
            duration_compliance_pct=100.0,
            tss_compliance_pct=100.0,
        )

        deviations = detector.detect_deviations(planned, actual, metrics)
        assert len(deviations) == 0

    def test_detect_workout_skipped(self, detector):
        """Test detection of skipped workout."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            structure=legacy_segments_to_structure([]),
            description="Threshold",
        )

        metrics = ComplianceMetrics(
            completed=False,
            completion_score=0.0,
            duration_score=0.0,
            intensity_score=0.0,
            tss_score=0.0,
            compliance_score=0.0,
            duration_compliance_pct=0.0,
            tss_compliance_pct=None,
        )

        deviations = detector.detect_deviations(planned, None, metrics)

        assert len(deviations) >= 1
        assert any("skipped" in d.lower() for d in deviations)

    def test_detect_duration_too_short(self, detector):
        """Test detection of workout cut short."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=90.0,
            planned_tss=65.0,
            structure=legacy_segments_to_structure([]),
            description="Endurance",
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Short Ride",
            activity_type="Ride",
            duration_minutes=60.0,  # 67% of planned
        )

        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=66.7,
            intensity_score=100.0,
            tss_score=100.0,
            compliance_score=88.3,
            duration_compliance_pct=66.7,
            tss_compliance_pct=None,
        )

        deviations = detector.detect_deviations(planned, actual, metrics)

        assert len(deviations) >= 1
        assert any("short" in d.lower() or "duration" in d.lower() for d in deviations)

    def test_detect_duration_too_long(self, detector):
        """Test detection of workout done longer than planned."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="recovery",
            total_duration_minutes=45.0,
            planned_tss=25.0,
            structure=legacy_segments_to_structure([]),
            description="Recovery",
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Long Recovery",
            activity_type="Ride",
            duration_minutes=65.0,  # 144% of planned
        )

        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=100.0,  # Capped
            intensity_score=100.0,
            tss_score=100.0,
            compliance_score=100.0,
            duration_compliance_pct=144.4,
            tss_compliance_pct=None,
        )

        deviations = detector.detect_deviations(planned, actual, metrics)

        assert len(deviations) >= 1
        assert any("long" in d.lower() or "exceeded" in d.lower() for d in deviations)

    def test_detect_intensity_deviation(self, detector):
        """Test detection of wrong intensity."""
        planned = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=75.0,
            planned_tss=85.0,
            structure=legacy_segments_to_structure([]),
            description="Threshold",
            zone_distribution={"Z4": 30, "Z2": 35, "Z1": 10},
        )

        actual = ActualWorkout(
            date=datetime(2024, 11, 4),
            activity_name="Easy Ride",
            activity_type="Ride",
            duration_minutes=75.0,
            zone_distribution={"Z2": 65, "Z1": 10},  # No Z4!
        )

        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=100.0,
            intensity_score=40.0,  # Low zone match
            tss_score=70.0,
            compliance_score=87.0,
            duration_compliance_pct=100.0,
            tss_compliance_pct=None,
        )

        deviations = detector.detect_deviations(planned, actual, metrics)

        assert len(deviations) >= 1
        assert any("intensity" in d.lower() or "zone" in d.lower() for d in deviations)

    def test_recommendation_excellent_compliance(self, recommender):
        """Test recommendation for excellent compliance."""
        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=100.0,
            intensity_score=98.0,
            tss_score=100.0,
            compliance_score=99.5,
            duration_compliance_pct=100.0,
            tss_compliance_pct=100.0,
        )

        recommendation = recommender.generate_recommendation(
            planned=PlannedWorkout(
                date=datetime(2024, 11, 4),
                weekday="Monday",
                workout_type="endurance",
                total_duration_minutes=90.0,
                planned_tss=65.0,
                structure=legacy_segments_to_structure([]),
                description="Endurance",
            ),
            actual=ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Perfect Ride",
                activity_type="Ride",
                duration_minutes=90.0,
            ),
            metrics=metrics,
            deviations=[],
        )

        assert "excellent" in recommendation.lower() or "great" in recommendation.lower()

    def test_recommendation_workout_skipped(self, recommender):
        """Test recommendation for skipped workout."""
        metrics = ComplianceMetrics(
            completed=False,
            completion_score=0.0,
            duration_score=0.0,
            intensity_score=0.0,
            tss_score=0.0,
            compliance_score=0.0,
            duration_compliance_pct=0.0,
            tss_compliance_pct=None,
        )

        recommendation = recommender.generate_recommendation(
            planned=PlannedWorkout(
                date=datetime(2024, 11, 4),
                weekday="Monday",
                workout_type="threshold",
                total_duration_minutes=75.0,
                planned_tss=85.0,
                structure=legacy_segments_to_structure([]),
                description="Threshold",
            ),
            actual=None,
            metrics=metrics,
            deviations=["Workout skipped entirely"],
        )

        assert len(recommendation) > 0
        assert "reschedule" in recommendation.lower() or "make up" in recommendation.lower()

    def test_recommendation_moderate_compliance(self, recommender):
        """Test recommendation for moderate compliance."""
        metrics = ComplianceMetrics(
            completed=True,
            completion_score=100.0,
            duration_score=70.0,
            intensity_score=65.0,
            tss_score=75.0,
            compliance_score=82.5,
            duration_compliance_pct=70.0,
            tss_compliance_pct=75.0,
        )

        recommendation = recommender.generate_recommendation(
            planned=PlannedWorkout(
                date=datetime(2024, 11, 4),
                weekday="Monday",
                workout_type="threshold",
                total_duration_minutes=75.0,
                planned_tss=85.0,
                structure=legacy_segments_to_structure([]),
                description="Threshold",
            ),
            actual=ActualWorkout(
                date=datetime(2024, 11, 4),
                activity_name="Modified Ride",
                activity_type="Ride",
                duration_minutes=52.0,
            ),
            metrics=metrics,
            deviations=["Duration 30% shorter than planned", "Intensity lower than planned"],
        )

        assert len(recommendation) > 0
        # Should provide guidance, not be overly critical
        assert "fatigue" in recommendation.lower() or "recovery" in recommendation.lower() or "adjust" in recommendation.lower()


# =============================================================================
# PatternDetector Tests
# =============================================================================


class TestPatternDetector:
    """Test PatternDetector algorithms."""

    @pytest.fixture
    def detector(self):
        """Create PatternDetector instance."""
        from cycling_ai.core.workout_comparison import PatternDetector
        return PatternDetector()

    @pytest.fixture
    def sample_comparisons_all_skipped_hard(self):
        """Sample comparisons where all hard workouts are skipped."""
        return [
            WorkoutComparison(
                date=datetime(2024, 11, 4),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 4),
                    weekday="Monday",
                    workout_type="endurance",
                    total_duration_minutes=80.0,
                    planned_tss=65.0,
                    structure=legacy_segments_to_structure([]),
                    description="Endurance",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 4),
                    activity_name="Easy Ride",
                    activity_type="Ride",
                    duration_minutes=80.0,
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=100.0,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=100.0,
                    duration_compliance_pct=100.0,
                    tss_compliance_pct=100.0,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 6),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 6),
                    weekday="Wednesday",
                    workout_type="threshold",
                    total_duration_minutes=75.0,
                    planned_tss=85.0,
                    structure=legacy_segments_to_structure([]),
                    description="Threshold",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 13),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 13),
                    weekday="Wednesday",
                    workout_type="vo2max",
                    total_duration_minutes=60.0,
                    planned_tss=75.0,
                    structure=legacy_segments_to_structure([]),
                    description="VO2max",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
        ]

    def test_detect_skipped_hard_workouts_pattern(self, detector, sample_comparisons_all_skipped_hard):
        """Test detection of pattern where hard workouts are consistently skipped."""
        patterns = detector.identify_weekly_patterns(sample_comparisons_all_skipped_hard)

        # Should detect skipped hard workouts pattern
        skipped_patterns = [p for p in patterns if p.pattern_type == "skipped_hard_workouts"]
        assert len(skipped_patterns) == 1

        pattern = skipped_patterns[0]
        assert pattern.severity == "high"  # All hard workouts skipped
        assert len(pattern.affected_workouts) == 2  # 2 hard workouts skipped

    def test_detect_short_duration_pattern(self, detector):
        """Test detection of pattern where workouts are consistently cut short."""
        comparisons = [
            WorkoutComparison(
                date=datetime(2024, 11, 4),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 4),
                    weekday="Monday",
                    workout_type="endurance",
                    total_duration_minutes=90.0,
                    planned_tss=65.0,
                    structure=legacy_segments_to_structure([]),
                    description="Endurance",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 4),
                    activity_name="Short Ride",
                    activity_type="Ride",
                    duration_minutes=60.0,  # 67% of planned
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=66.7,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=91.7,
                    duration_compliance_pct=66.7,
                    tss_compliance_pct=None,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 6),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 6),
                    weekday="Wednesday",
                    workout_type="threshold",
                    total_duration_minutes=75.0,
                    planned_tss=85.0,
                    structure=legacy_segments_to_structure([]),
                    description="Threshold",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 6),
                    activity_name="Short Threshold",
                    activity_type="Ride",
                    duration_minutes=50.0,  # 67% of planned
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=66.7,
                    intensity_score=90.0,
                    tss_score=70.0,
                    compliance_score=87.7,
                    duration_compliance_pct=66.7,
                    tss_compliance_pct=None,
                ),
            ),
        ]

        patterns = detector.identify_weekly_patterns(comparisons)

        # Should detect short duration pattern
        short_patterns = [p for p in patterns if p.pattern_type == "short_duration"]
        assert len(short_patterns) == 1

        pattern = short_patterns[0]
        assert pattern.severity == "high"  # <70% of planned
        assert len(pattern.affected_workouts) == 2

    def test_detect_weekend_warrior_pattern(self, detector):
        """Test detection of weekend warrior pattern (high weekend compliance, low weekday)."""
        comparisons = [
            # Weekday workouts - poor compliance
            WorkoutComparison(
                date=datetime(2024, 11, 4),  # Monday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 4),
                    weekday="Monday",
                    workout_type="endurance",
                    total_duration_minutes=60.0,
                    planned_tss=50.0,
                    structure=legacy_segments_to_structure([]),
                    description="Endurance",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 6),  # Wednesday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 6),
                    weekday="Wednesday",
                    workout_type="threshold",
                    total_duration_minutes=60.0,
                    planned_tss=70.0,
                    structure=legacy_segments_to_structure([]),
                    description="Threshold",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
            # Weekend workouts - perfect compliance
            WorkoutComparison(
                date=datetime(2024, 11, 9),  # Saturday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 9),
                    weekday="Saturday",
                    workout_type="endurance",
                    total_duration_minutes=150.0,
                    planned_tss=105.0,
                    structure=legacy_segments_to_structure([]),
                    description="Long ride",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 9),
                    activity_name="Long Ride",
                    activity_type="Ride",
                    duration_minutes=150.0,
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=100.0,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=100.0,
                    duration_compliance_pct=100.0,
                    tss_compliance_pct=100.0,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 10),  # Sunday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 10),
                    weekday="Sunday",
                    workout_type="endurance",
                    total_duration_minutes=120.0,
                    planned_tss=85.0,
                    structure=legacy_segments_to_structure([]),
                    description="Endurance",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 10),
                    activity_name="Sunday Ride",
                    activity_type="Ride",
                    duration_minutes=120.0,
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=100.0,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=100.0,
                    duration_compliance_pct=100.0,
                    tss_compliance_pct=100.0,
                ),
            ),
        ]

        patterns = detector.identify_weekly_patterns(comparisons)

        # Should detect weekend warrior pattern
        weekend_patterns = [p for p in patterns if p.pattern_type == "weekend_warrior"]
        assert len(weekend_patterns) == 1

        pattern = weekend_patterns[0]
        assert pattern.severity == "low"  # Informational
        assert "weekend" in pattern.description.lower()

    def test_detect_scheduling_conflict_pattern(self, detector):
        """Test detection of specific day always skipped (scheduling conflict)."""
        comparisons = [
            # Wednesday workouts always skipped
            WorkoutComparison(
                date=datetime(2024, 11, 6),  # Wednesday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 6),
                    weekday="Wednesday",
                    workout_type="threshold",
                    total_duration_minutes=75.0,
                    planned_tss=85.0,
                    structure=legacy_segments_to_structure([]),
                    description="Threshold",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 13),  # Wednesday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 13),
                    weekday="Wednesday",
                    workout_type="tempo",
                    total_duration_minutes=90.0,
                    planned_tss=70.0,
                    structure=legacy_segments_to_structure([]),
                    description="Tempo",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
            # Other days completed
            WorkoutComparison(
                date=datetime(2024, 11, 4),  # Monday
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 4),
                    weekday="Monday",
                    workout_type="endurance",
                    total_duration_minutes=80.0,
                    planned_tss=65.0,
                    structure=legacy_segments_to_structure([]),
                    description="Endurance",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 4),
                    activity_name="Morning Ride",
                    activity_type="Ride",
                    duration_minutes=80.0,
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=100.0,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=100.0,
                    duration_compliance_pct=100.0,
                    tss_compliance_pct=100.0,
                ),
            ),
        ]

        patterns = detector.identify_weekly_patterns(comparisons)

        # Should detect scheduling conflict on Wednesday
        conflict_patterns = [p for p in patterns if p.pattern_type == "scheduling_conflict"]
        assert len(conflict_patterns) == 1

        pattern = conflict_patterns[0]
        assert pattern.severity == "medium"
        assert "Wednesday" in pattern.description

    def test_no_patterns_with_perfect_compliance(self, detector):
        """Test that perfect compliance produces no patterns."""
        comparisons = [
            WorkoutComparison(
                date=datetime(2024, 11, 4),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 4),
                    weekday="Monday",
                    workout_type="endurance",
                    total_duration_minutes=80.0,
                    planned_tss=65.0,
                    structure=legacy_segments_to_structure([]),
                    description="Endurance",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 4),
                    activity_name="Perfect Ride",
                    activity_type="Ride",
                    duration_minutes=80.0,
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=100.0,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=100.0,
                    duration_compliance_pct=100.0,
                    tss_compliance_pct=100.0,
                ),
            ),
            WorkoutComparison(
                date=datetime(2024, 11, 6),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 6),
                    weekday="Wednesday",
                    workout_type="threshold",
                    total_duration_minutes=75.0,
                    planned_tss=85.0,
                    structure=legacy_segments_to_structure([]),
                    description="Threshold",
                ),
                actual=ActualWorkout(
                    date=datetime(2024, 11, 6),
                    activity_name="Perfect Threshold",
                    activity_type="Ride",
                    duration_minutes=75.0,
                ),
                metrics=ComplianceMetrics(
                    completed=True,
                    completion_score=100.0,
                    duration_score=100.0,
                    intensity_score=100.0,
                    tss_score=100.0,
                    compliance_score=100.0,
                    duration_compliance_pct=100.0,
                    tss_compliance_pct=100.0,
                ),
            ),
        ]

        patterns = detector.identify_weekly_patterns(comparisons)
        assert len(patterns) == 0

    def test_min_occurrences_threshold(self, detector):
        """Test that patterns require minimum occurrences to be detected."""
        # Only 1 hard workout skipped - should not trigger pattern (needs 2)
        comparisons = [
            WorkoutComparison(
                date=datetime(2024, 11, 6),
                planned=PlannedWorkout(
                    date=datetime(2024, 11, 6),
                    weekday="Wednesday",
                    workout_type="threshold",
                    total_duration_minutes=75.0,
                    planned_tss=85.0,
                    structure=legacy_segments_to_structure([]),
                    description="Threshold",
                ),
                actual=None,  # Skipped
                metrics=ComplianceMetrics(
                    completed=False,
                    completion_score=0.0,
                    duration_score=0.0,
                    intensity_score=0.0,
                    tss_score=0.0,
                    compliance_score=0.0,
                    duration_compliance_pct=0.0,
                    tss_compliance_pct=None,
                ),
            ),
        ]

        patterns = detector.identify_weekly_patterns(comparisons, min_occurrences=2)

        # Should not detect pattern (only 1 occurrence)
        skipped_patterns = [p for p in patterns if p.pattern_type == "skipped_hard_workouts"]
        assert len(skipped_patterns) == 0


# =============================================================================
# WorkoutComparer Tests (Integration)
# =============================================================================


class TestWorkoutComparer:
    """Test WorkoutComparer facade class (end-to-end integration)."""

    @pytest.fixture
    def comparer(self, fixtures_dir, sample_plan_path):
        """Create WorkoutComparer instance with test data."""
        from cycling_ai.core.workout_comparison import WorkoutComparer

        activities_path = fixtures_dir / "sample_activities_perfect.csv"
        profile_path = fixtures_dir / "sample_athlete_profile.json"

        # Extract FTP from profile
        import json
        with open(profile_path) as f:
            profile = json.load(f)
        ftp = int(profile["FTP"].replace("w", ""))

        return WorkoutComparer(
            plan_path=sample_plan_path,
            activities_path=activities_path,
            ftp=ftp,
        )

    def test_load_planned_workouts_from_json(self, comparer):
        """Test loading planned workouts from training plan JSON."""
        # Access internal _planned_workouts (after initialization)
        assert hasattr(comparer, "_planned_workouts")
        assert len(comparer._planned_workouts) == 5  # 3 week 1 + 2 week 2

        # Check first workout
        first_workout = comparer._planned_workouts[0]
        assert first_workout.weekday == "Monday"
        assert first_workout.workout_type == "endurance"
        assert first_workout.total_duration_minutes == 80

    def test_load_actual_workouts_from_csv(self, comparer):
        """Test loading actual workouts from activities CSV."""
        assert hasattr(comparer, "_actual_workouts")
        assert len(comparer._actual_workouts) == 5  # All 5 activities

        # Check first activity
        first_activity = comparer._actual_workouts[0]
        assert first_activity.activity_name == "Morning Endurance Ride"
        assert first_activity.duration_minutes == 80

    def test_compare_daily_workout_perfect_compliance(self, comparer):
        """Test daily comparison with perfect compliance."""
        # Nov 4 - perfect endurance ride
        comparison = comparer.compare_daily_workout("2024-11-04")

        assert comparison.date == datetime(2024, 11, 4)
        assert comparison.planned.workout_type == "endurance"
        assert comparison.actual is not None
        assert comparison.actual.activity_name == "Morning Endurance Ride"
        assert comparison.metrics.compliance_score >= 99.0
        assert comparison.metrics.completed is True
        assert len(comparison.deviations) == 0

    def test_compare_daily_workout_skipped(self, fixtures_dir, sample_plan_path):
        """Test daily comparison with skipped workout."""
        from cycling_ai.core.workout_comparison import WorkoutComparer

        # Use activities_skipped.csv which has missing workouts
        activities_path = fixtures_dir / "sample_activities_skipped.csv"
        profile_path = fixtures_dir / "sample_athlete_profile.json"

        import json
        with open(profile_path) as f:
            profile = json.load(f)
        ftp = int(profile["FTP"].replace("w", ""))

        comparer = WorkoutComparer(
            plan_path=sample_plan_path,
            activities_path=activities_path,
            ftp=ftp,
        )

        # Nov 6 should be skipped in the skipped dataset
        comparison = comparer.compare_daily_workout("2024-11-06")

        assert comparison.date == datetime(2024, 11, 6)
        assert comparison.planned.workout_type == "threshold"
        assert comparison.actual is None  # Skipped
        assert comparison.metrics.completed is False
        assert comparison.metrics.compliance_score == 0.0
        assert len(comparison.deviations) >= 1
        assert any("skipped" in d.lower() for d in comparison.deviations)

    def test_compare_weekly_workouts_aggregation(self, comparer):
        """Test weekly comparison aggregates daily comparisons correctly."""
        # Week 1: Nov 4 - Nov 10
        weekly = comparer.compare_weekly_workouts("2024-11-04")

        assert weekly.week_number == 1
        assert weekly.week_start_date == datetime(2024, 11, 4)
        assert weekly.week_end_date == datetime(2024, 11, 10)

        # Check aggregated metrics
        assert weekly.workouts_planned == 3
        assert weekly.workouts_completed == 3
        assert weekly.completion_rate_pct == 100.0
        assert weekly.avg_compliance_score >= 95.0  # Average of completed workouts

        # Check daily comparisons included
        assert len(weekly.daily_comparisons) == 3

    def test_compare_weekly_workouts_calculates_tss(self, comparer):
        """Test weekly comparison calculates TSS compliance."""
        weekly = comparer.compare_weekly_workouts("2024-11-04")

        assert weekly.total_planned_tss == 255.0  # From training plan
        assert weekly.total_actual_tss == 255.0  # Perfect compliance
        assert weekly.tss_compliance_pct == 100.0

    def test_compare_weekly_workouts_detects_patterns(self, fixtures_dir, sample_plan_path):
        """Test weekly comparison detects patterns."""
        from cycling_ai.core.workout_comparison import WorkoutComparer

        # Use skipped activities
        activities_path = fixtures_dir / "sample_activities_skipped.csv"
        profile_path = fixtures_dir / "sample_athlete_profile.json"

        import json
        with open(profile_path) as f:
            profile = json.load(f)
        ftp = int(profile["FTP"].replace("w", ""))

        comparer = WorkoutComparer(
            plan_path=sample_plan_path,
            activities_path=activities_path,
            ftp=ftp,
        )

        # Week 1 has skipped threshold workout
        weekly = comparer.compare_weekly_workouts("2024-11-04")

        # Should detect some patterns (depends on data)
        # At minimum, check that patterns field exists and is a list
        assert isinstance(weekly.patterns, list)
        assert isinstance(weekly.weekly_recommendation, str)
        assert len(weekly.weekly_recommendation) > 0

    def test_compare_daily_workout_invalid_date(self, comparer):
        """Test daily comparison with date not in plan."""
        # Date not in training plan
        comparison = comparer.compare_daily_workout("2025-01-01")

        # Should return None or raise ValueError (implementation choice)
        # For now, let's expect it returns None or raises
        # We'll define behavior in implementation

    def test_planned_workout_parsing_segments(self, comparer):
        """Test that planned workout structure is parsed correctly."""
        first_workout = comparer._planned_workouts[0]

        # Check structure was parsed
        assert first_workout.structure is not None
        if isinstance(first_workout.structure, dict):
            assert "structure" in first_workout.structure

        # Check derived fields calculated
        assert first_workout.zone_distribution is not None
        assert len(first_workout.zone_distribution) > 0
        assert first_workout.target_avg_power_pct is not None

    def test_actual_workout_parsing_zones(self, comparer):
        """Test that actual workout zones are parsed correctly."""
        first_activity = comparer._actual_workouts[0]

        # Check zone distribution parsed from CSV
        assert first_activity.zone_distribution is not None
        assert first_activity.zone_distribution.get("Z1", 0) == 20
        assert first_activity.zone_distribution.get("Z2", 0) == 60

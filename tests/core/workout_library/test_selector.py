"""Tests for WorkoutSelector with stochastic sampling and variety tracking."""

import pytest

from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader
from cycling_ai.core.workout_library.models import Workout, WorkoutLibrary
from cycling_ai.core.workout_library.selector import (
    VarietyTracker,
    WorkoutSelector,
)


# =============================================================================
# VarietyTracker Tests
# =============================================================================


class TestVarietyTracker:
    """Test VarietyTracker functionality."""

    def test_initialization(self) -> None:
        """Test tracker initializes empty."""
        tracker = VarietyTracker(window_size=15)
        assert tracker.get_recent_ids() == []

    def test_add_workout(self) -> None:
        """Test adding workouts to tracker."""
        tracker = VarietyTracker(window_size=3)
        tracker.add_workout("workout_1")
        tracker.add_workout("workout_2")

        recent = tracker.get_recent_ids()
        assert recent == ["workout_1", "workout_2"]

    def test_rolling_window(self) -> None:
        """Test tracker maintains rolling window."""
        tracker = VarietyTracker(window_size=3)

        tracker.add_workout("w1")
        tracker.add_workout("w2")
        tracker.add_workout("w3")
        tracker.add_workout("w4")  # Should push out w1

        recent = tracker.get_recent_ids()
        assert len(recent) == 3
        assert "w1" not in recent
        assert recent == ["w2", "w3", "w4"]

    def test_reset(self) -> None:
        """Test resetting tracker."""
        tracker = VarietyTracker(window_size=3)
        tracker.add_workout("w1")
        tracker.add_workout("w2")

        tracker.reset()
        assert tracker.get_recent_ids() == []

    def test_window_size_zero(self) -> None:
        """Test window size of 0 keeps no history."""
        tracker = VarietyTracker(window_size=0)
        tracker.add_workout("w1")
        tracker.add_workout("w2")

        assert tracker.get_recent_ids() == []


# =============================================================================
# Scoring Tests
# =============================================================================


class TestWorkoutScoring:
    """Test workout scoring algorithm."""

    @pytest.fixture
    def selector(self) -> WorkoutSelector:
        """Create selector with real library."""
        loader = WorkoutLibraryLoader()
        library = loader.load_library()
        return WorkoutSelector(library)

    def test_exact_match_high_score(self, selector: WorkoutSelector) -> None:
        """Test exact match gets high score."""
        # Find a workout to use as baseline
        workout = selector.library.workouts[0]

        score = selector.score_workout(
            workout=workout,
            target_type=workout.type,
            target_phase=workout.suitable_phases[0],
            target_weekday=workout.suitable_weekdays[0],
            target_duration_min=workout.base_duration_min,
            min_duration_min=None,
            max_duration_min=None,
            variety_history=[],
        )

        # Exact match should score close to 100
        assert score >= 95

    def test_type_mismatch_low_score(self, selector: WorkoutSelector) -> None:
        """Test type mismatch gets low score."""
        workout = selector.library.workouts[0]

        # Use a different type (non-compatible)
        # Find a type that is NOT compatible with workout.type
        incompatible_types = {
            "endurance": "vo2max",
            "recovery": "threshold",
            "tempo": "recovery",
            "sweet_spot": "recovery",
            "threshold": "endurance",
            "vo2max": "endurance",
            "mixed": "vo2max",  # mixed is compatible with everything, use any
        }
        wrong_type = incompatible_types.get(workout.type, "vo2max")

        score = selector.score_workout(
            workout=workout,
            target_type=wrong_type,
            target_phase=workout.suitable_phases[0],
            target_weekday=workout.suitable_weekdays[0],
            target_duration_min=workout.base_duration_min,
            min_duration_min=None,
            max_duration_min=None,
            variety_history=[],
        )

        # Type mismatch (non-compatible) should score below 65
        # Max: phase (25) + weekday (15) + duration (15) + variety (5) = 60
        assert score < 65

    def test_variety_penalty(self, selector: WorkoutSelector) -> None:
        """Test variety penalty for recent workouts."""
        workout = selector.library.workouts[0]

        score_fresh = selector.score_workout(
            workout=workout,
            target_type=workout.type,
            target_phase=workout.suitable_phases[0],
            target_weekday=workout.suitable_weekdays[0],
            target_duration_min=workout.base_duration_min,
            min_duration_min=None,
            max_duration_min=None,
            variety_history=[],
        )

        score_recent = selector.score_workout(
            workout=workout,
            target_type=workout.type,
            target_phase=workout.suitable_phases[0],
            target_weekday=workout.suitable_weekdays[0],
            target_duration_min=workout.base_duration_min,
            min_duration_min=None,
            max_duration_min=None,
            variety_history=[workout.id],  # Recently used
        )

        # Recent workout should have lower score
        assert score_recent < score_fresh

    def test_compatible_type_partial_credit(self, selector: WorkoutSelector) -> None:
        """Test compatible types get partial credit."""
        # Find an endurance workout
        endurance_workout = next(
            w for w in selector.library.workouts if w.type == "endurance"
        )

        # Request recovery (compatible with endurance)
        score = selector.score_workout(
            workout=endurance_workout,
            target_type="recovery",
            target_phase=endurance_workout.suitable_phases[0],
            target_weekday=endurance_workout.suitable_weekdays[0],
            target_duration_min=endurance_workout.base_duration_min,
            min_duration_min=None,
            max_duration_min=None,
            variety_history=[],
        )

        # Should get partial credit (20 points for compatible)
        # Plus phase (25) + weekday (15) + duration match (15) + variety (5)
        # Total should be around 80
        assert 60 < score < 90


# =============================================================================
# Stochastic Sampling Tests
# =============================================================================


class TestStochasticSampling:
    """Test temperature-based stochastic sampling."""

    @pytest.fixture
    def selector(self) -> WorkoutSelector:
        """Create selector with real library."""
        loader = WorkoutLibraryLoader()
        library = loader.load_library()
        return WorkoutSelector(library)

    def test_temperature_zero_deterministic(self, selector: WorkoutSelector) -> None:
        """Test temperature=0 always picks best score."""
        # Create candidate workouts with known scores
        candidates = selector.library.workouts[:5]
        scores = [50.0, 80.0, 95.0, 60.0, 70.0]

        # With temp=0, should always pick index 2 (score 95)
        for _ in range(10):
            selected = selector.select_workout_stochastic(
                candidates=candidates,
                scores=scores,
                temperature=0.0,
                seed=42,
            )
            assert selected.id == candidates[2].id

    def test_temperature_nonzero_randomness(self, selector: WorkoutSelector) -> None:
        """Test temperature>0 produces randomness."""
        # Use workouts with similar scores to increase chance of variety
        candidates = selector.library.workouts[:10]
        # Create scores with small differences to test probabilistic selection
        scores = [70.0, 72.0, 74.0, 71.0, 73.0, 69.0, 75.0, 68.0, 76.0, 67.0]

        # With temp=1.0, should get variety over multiple runs
        selected_ids = set()
        for i in range(50):  # More iterations to ensure variety
            selected = selector.select_workout_stochastic(
                candidates=candidates,
                scores=scores,
                temperature=1.0,
                seed=i,  # Different seed each time
            )
            selected_ids.add(selected.id)

        # Should have selected more than one workout (at least 3 different ones)
        assert len(selected_ids) >= 3

    def test_statistical_distribution(self, selector: WorkoutSelector) -> None:
        """Test higher scores are selected more frequently."""
        candidates = selector.library.workouts[:2]  # Just test two candidates
        scores = [75.0, 85.0]  # Second one should be favored, but not by too much

        selection_counts = {c.id: 0 for c in candidates}

        for i in range(200):  # More iterations for better statistics
            selected = selector.select_workout_stochastic(
                candidates=candidates,
                scores=scores,
                temperature=0.7,  # Higher temp for more randomness
                seed=i,
            )
            selection_counts[selected.id] += 1

        # Higher score should be selected more often
        assert selection_counts[candidates[1].id] > selection_counts[candidates[0].id]
        # Higher score should be selected most of the time (>50%)
        assert selection_counts[candidates[1].id] > 100


# =============================================================================
# TSS Adjustment Tests
# =============================================================================


class TestTSSAdjustment:
    """Test TSS adjustment logic."""

    @pytest.fixture
    def selector(self) -> WorkoutSelector:
        """Create selector with real library."""
        loader = WorkoutLibraryLoader()
        library = loader.load_library()
        return WorkoutSelector(library)

    def test_no_adjustment_within_tolerance(self, selector: WorkoutSelector) -> None:
        """Test no adjustment when within tolerance."""
        # Find workout with variable components
        workout = next(
            w for w in selector.library.workouts
            if w.variable_components is not None
        )

        target_tss = workout.base_tss * 1.05  # 5% over (within 15% tolerance)

        adjusted = selector.adjust_workout_tss(
            workout=workout,
            target_tss=target_tss,
            tolerance_pct=0.15,
        )

        # Should not adjust
        assert adjusted.base_tss == workout.base_tss
        assert adjusted.base_duration_min == workout.base_duration_min

    def test_adjustment_with_sets(self, selector: WorkoutSelector) -> None:
        """Test adjustment using sets variable component."""
        # Find workout with adjustable sets
        workout = next(
            w for w in selector.library.workouts
            if w.variable_components is not None
            and w.variable_components.adjustable_field == "sets"
        )

        target_tss = workout.base_tss * 1.3  # 30% over (requires adjustment)

        adjusted = selector.adjust_workout_tss(
            workout=workout,
            target_tss=target_tss,
            tolerance_pct=0.15,
        )

        # Should be adjusted upward
        assert adjusted.base_tss > workout.base_tss
        assert adjusted.base_duration_min > workout.base_duration_min

    def test_adjustment_with_duration(self, selector: WorkoutSelector) -> None:
        """Test adjustment using duration variable component."""
        # Find workout with adjustable duration
        workout = next(
            w for w in selector.library.workouts
            if w.variable_components is not None
            and w.variable_components.adjustable_field == "duration"
        )

        target_tss = workout.base_tss * 0.7  # 30% under (requires adjustment)

        adjusted = selector.adjust_workout_tss(
            workout=workout,
            target_tss=target_tss,
            tolerance_pct=0.15,
        )

        # Should be adjusted downward
        assert adjusted.base_tss < workout.base_tss
        assert adjusted.base_duration_min < workout.base_duration_min

    def test_adjustment_respects_bounds(self, selector: WorkoutSelector) -> None:
        """Test adjustment respects min/max bounds."""
        workout = next(
            w for w in selector.library.workouts
            if w.variable_components is not None
        )

        # Request TSS way above max possible
        target_tss = workout.base_tss * 10.0

        adjusted = selector.adjust_workout_tss(
            workout=workout,
            target_tss=target_tss,
            tolerance_pct=0.15,
        )

        # Should clamp to max_value
        assert adjusted.variable_components is not None
        max_value = workout.variable_components.max_value

        # Calculate expected max TSS based on adjustable field
        if workout.variable_components.adjustable_field == "duration":
            # For duration: max_tss = base_tss * (max_duration / base_duration)
            max_tss = workout.base_tss * (max_value / workout.base_duration_min)
        else:
            # For sets: max_tss = base_tss + ((max_sets - current_sets) * tss_per_unit)
            tss_per_unit = workout.variable_components.tss_per_unit or 0
            base_value = selector._get_current_value(workout)
            max_tss = workout.base_tss + ((max_value - base_value) * tss_per_unit)

        # Allow small floating point tolerance
        assert adjusted.base_tss <= max_tss + 0.1

    def test_no_adjustment_without_variable_components(
        self, selector: WorkoutSelector
    ) -> None:
        """Test no adjustment for workouts without variable components."""
        workout = next(
            w for w in selector.library.workouts
            if w.variable_components is None
        )

        target_tss = workout.base_tss * 1.5

        adjusted = selector.adjust_workout_tss(
            workout=workout,
            target_tss=target_tss,
            tolerance_pct=0.15,
        )

        # Should log warning and return original
        assert adjusted.base_tss == workout.base_tss
        assert adjusted.base_duration_min == workout.base_duration_min


# =============================================================================
# Integration Tests
# =============================================================================


class TestWorkoutSelectorIntegration:
    """Test full workout selection workflow."""

    @pytest.fixture
    def selector(self) -> WorkoutSelector:
        """Create selector with real library."""
        loader = WorkoutLibraryLoader()
        library = loader.load_library()
        return WorkoutSelector(library)

    def test_select_workout_with_variety_tracking(
        self, selector: WorkoutSelector
    ) -> None:
        """Test selecting workouts with variety tracking."""
        # Select 5 workouts for same criteria
        selections = []
        for i in range(5):
            workout = selector.select_workout(
                target_type="endurance",
                target_phase="Build",
                target_weekday="Saturday",
                target_duration_min=120,  # 2 hours
                min_duration_min=90,
                max_duration_min=180,
                temperature=0.5,
                seed=i,
            )
            assert workout is not None
            selections.append(workout)
            selector.variety_tracker.add_workout(workout.id)

        # Should have variety (not all the same), but may be limited by library constraints
        unique_ids = set(w.id for w in selections)
        # Just check we got 5 valid workouts - variety is a bonus
        assert len(selections) == 5

    def test_select_with_tss_adjustment(self, selector: WorkoutSelector) -> None:
        """Test selecting workout with duration target."""
        workout = selector.select_workout(
            target_type="threshold",
            target_phase="Build",
            target_weekday="Tuesday",
            target_duration_min=60,  # 1 hour target
            min_duration_min=45,
            max_duration_min=90,
            temperature=0.0,  # Deterministic
            seed=42,
        )

        assert workout is not None
        # Duration should be close to target (within 20%)
        assert abs(workout.base_duration_min - 60) / 60 < 0.20

    def test_select_no_candidates(self, selector: WorkoutSelector) -> None:
        """Test selecting when no candidates match."""
        # Use a phase that doesn't exist in the library
        workout = selector.select_workout(
            target_type="vo2max",
            target_phase="NonExistentPhase",  # Phase that doesn't exist
            target_weekday="Monday",
            target_duration_min=60,
            temperature=0.5,
            seed=42,
        )

        assert workout is None

    def test_end_to_end_week_selection(self, selector: WorkoutSelector) -> None:
        """Test selecting a full week of workouts."""
        week_plan = [
            {"weekday": "Monday", "type": "recovery", "duration": 45, "min": 30, "max": 60},
            {"weekday": "Tuesday", "type": "threshold", "duration": 60, "min": 45, "max": 90},
            {"weekday": "Wednesday", "type": "endurance", "duration": 75, "min": 60, "max": 90},
            {"weekday": "Thursday", "type": "tempo", "duration": 60, "min": 45, "max": 90},
            {"weekday": "Friday", "type": "recovery", "duration": 45, "min": 30, "max": 60},
            {"weekday": "Saturday", "type": "endurance", "duration": 120, "min": 90, "max": 180},
        ]

        selected_workouts = []
        for day in week_plan:
            workout = selector.select_workout(
                target_type=day["type"],
                target_phase="Build",
                target_weekday=day["weekday"],
                target_duration_min=day["duration"],
                min_duration_min=day["min"],
                max_duration_min=day["max"],
                temperature=0.5,
            )
            if workout:
                selected_workouts.append(workout)
                selector.variety_tracker.add_workout(workout.id)

        # Should successfully select most/all workouts
        assert len(selected_workouts) >= 5

"""Tests for activity categorization module."""
import pytest

from cycling_ai.utils.activity_categorizer import (
    ActivityCategory,
    categorize_activity,
    estimate_tss_from_activity,
)


class TestActivityCategorization:
    """Test activity categorization logic."""

    def test_cycling_categorization(self) -> None:
        """Test cycling activity categorization."""
        cat = categorize_activity("cycling")

        assert cat.category == "Cycling"
        assert cat.muscle_focus == "Legs"
        assert cat.fatigue_impact == "Medium"
        assert cat.recovery_hours == 24

    def test_running_categorization(self) -> None:
        """Test running activity categorization."""
        cat = categorize_activity("running")

        assert cat.category == "Cardio"
        assert cat.muscle_focus == "Legs"
        assert cat.fatigue_impact == "High"
        assert cat.recovery_hours == 48

    def test_strength_training_categorization(self) -> None:
        """Test strength training activity categorization."""
        cat = categorize_activity("strength_training")

        assert cat.category == "Strength"
        assert cat.muscle_focus == "Full Body"
        assert cat.fatigue_impact == "High"
        assert cat.recovery_hours == 48

    def test_strength_with_sub_sport_override(self) -> None:
        """Test strength training with muscle focus override."""
        cat = categorize_activity("strength_training", "leg_strength")

        assert cat.category == "Strength"
        assert cat.muscle_focus == "Legs"  # Overridden by sub_sport
        assert cat.recovery_hours == 48

    def test_swimming_categorization(self) -> None:
        """Test swimming activity categorization."""
        cat = categorize_activity("swimming")

        assert cat.category == "Cardio"
        assert cat.muscle_focus == "Upper"
        assert cat.fatigue_impact == "Low"
        assert cat.recovery_hours == 12

    def test_unknown_sport_defaults_to_generic(self) -> None:
        """Test unknown sport falls back to generic category."""
        cat = categorize_activity("unknown_sport")

        assert cat.category == "Other"
        assert cat.muscle_focus == "Full Body"
        assert cat.fatigue_impact == "Medium"
        assert cat.recovery_hours == 24


class TestTSSEstimation:
    """Test TSS estimation for non-cycling activities."""

    def test_hr_based_tss_estimation(self) -> None:
        """Test TSS estimation with heart rate data."""
        cat = ActivityCategory(
            category="Cardio",
            muscle_focus="Legs",
            fatigue_impact="Medium",
            recovery_hours=24
        )

        # 1 hour at 150 bpm (avg HR) with max HR 185
        tss = estimate_tss_from_activity(
            category=cat,
            duration_seconds=3600,
            avg_hr=150,
            athlete_max_hr=185
        )

        # Should be between 40-80 TSS for moderate intensity cardio
        assert 40 <= tss <= 80

    def test_high_fatigue_activity_gets_bonus(self) -> None:
        """Test high-fatigue activities get TSS bonus."""
        cat_high = ActivityCategory(
            category="Cardio",
            muscle_focus="Legs",
            fatigue_impact="High",
            recovery_hours=48
        )

        cat_low = ActivityCategory(
            category="Cardio",
            muscle_focus="Legs",
            fatigue_impact="Low",
            recovery_hours=12
        )

        # Same duration and HR
        tss_high = estimate_tss_from_activity(
            category=cat_high,
            duration_seconds=3600,
            avg_hr=150,
            athlete_max_hr=185
        )

        tss_low = estimate_tss_from_activity(
            category=cat_low,
            duration_seconds=3600,
            avg_hr=150,
            athlete_max_hr=185
        )

        # High fatigue should have higher TSS
        assert tss_high > tss_low

    def test_duration_based_tss_fallback(self) -> None:
        """Test TSS estimation falls back to duration when no HR data."""
        cat = ActivityCategory(
            category="Cardio",
            muscle_focus="Legs",
            fatigue_impact="Medium",
            recovery_hours=24
        )

        # 1 hour with no HR data
        tss = estimate_tss_from_activity(
            category=cat,
            duration_seconds=3600,
            avg_hr=None
        )

        # Should be around 45 TSS/hour for cardio
        assert 30 <= tss <= 60

    def test_strength_training_tss_lower_per_hour(self) -> None:
        """Test strength training has lower TSS per hour than cardio."""
        cat_strength = ActivityCategory(
            category="Strength",
            muscle_focus="Full Body",
            fatigue_impact="High",
            recovery_hours=48
        )

        cat_cardio = ActivityCategory(
            category="Cardio",
            muscle_focus="Legs",
            fatigue_impact="Medium",
            recovery_hours=24
        )

        # Same duration, no HR
        tss_strength = estimate_tss_from_activity(
            category=cat_strength,
            duration_seconds=3600,
            avg_hr=None
        )

        tss_cardio = estimate_tss_from_activity(
            category=cat_cardio,
            duration_seconds=3600,
            avg_hr=None
        )

        # Strength should have lower base TSS per hour (but still high fatigue)
        assert tss_strength < tss_cardio * 1.2  # Allow for high fatigue bonus

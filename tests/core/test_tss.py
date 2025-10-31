"""Tests for TSS (Training Stress Score) calculation module."""

import pytest
from cycling_ai.core.tss import (
    calculate_segment_tss,
    calculate_workout_tss,
    calculate_weekly_tss,
)


class TestSegmentTSS:
    """Test segment-level TSS calculations."""

    def test_segment_tss_at_ftp(self):
        """Test that 1 hour at FTP = 100 TSS."""
        # 60 minutes at 100% FTP should equal 100 TSS
        tss = calculate_segment_tss(
            duration_min=60,
            power_low_pct=100.0,
            power_high_pct=100.0,
            ftp=250,  # FTP value doesn't affect calculation when using percentages
        )
        assert tss == pytest.approx(100.0, rel=0.01)

    def test_segment_tss_below_ftp(self):
        """Test TSS for endurance pace (70% FTP)."""
        # 60 minutes at 70% FTP
        # TSS = 1.0 hours × (0.7)² × 100 = 49
        tss = calculate_segment_tss(
            duration_min=60,
            power_low_pct=70.0,
            power_high_pct=70.0,
            ftp=250,
        )
        assert tss == pytest.approx(49.0, rel=0.01)

    def test_segment_tss_above_ftp(self):
        """Test TSS for threshold work (95% FTP)."""
        # 20 minutes at 95% FTP
        # TSS = (20/60) hours × (0.95)² × 100 ≈ 30.08
        tss = calculate_segment_tss(
            duration_min=20,
            power_low_pct=95.0,
            power_high_pct=95.0,
            ftp=250,
        )
        assert tss == pytest.approx(30.08, rel=0.01)

    def test_segment_tss_vo2max(self):
        """Test TSS for VO2max intervals (110% FTP)."""
        # 5 minutes at 110% FTP
        # TSS = (5/60) hours × (1.10)² × 100 ≈ 10.08
        tss = calculate_segment_tss(
            duration_min=5,
            power_low_pct=110.0,
            power_high_pct=110.0,
            ftp=250,
        )
        assert tss == pytest.approx(10.08, rel=0.01)

    def test_segment_tss_power_range(self):
        """Test TSS calculation with power range (uses average)."""
        # 30 minutes at 88-93% FTP (average = 90.5%)
        # TSS = (30/60) hours × (0.905)² × 100 ≈ 40.95
        tss = calculate_segment_tss(
            duration_min=30,
            power_low_pct=88.0,
            power_high_pct=93.0,
            ftp=250,
        )
        assert tss == pytest.approx(40.95, rel=0.01)

    def test_segment_tss_no_high_power(self):
        """Test that power_high_pct defaults to power_low_pct."""
        tss_with_range = calculate_segment_tss(
            duration_min=30,
            power_low_pct=85.0,
            power_high_pct=85.0,
            ftp=250,
        )
        tss_without_range = calculate_segment_tss(
            duration_min=30,
            power_low_pct=85.0,
            power_high_pct=None,
            ftp=250,
        )
        assert tss_with_range == tss_without_range


class TestWorkoutTSS:
    """Test workout-level TSS calculations."""

    def test_workout_tss_simple(self):
        """Test TSS for simple workout with one segment."""
        segments = [
            {
                "duration_min": 60,
                "power_low_pct": 70.0,
                "power_high_pct": 75.0,
            }
        ]
        tss = calculate_workout_tss(segments, ftp=250)
        # Average power = 72.5% FTP
        # TSS = 1.0 hours × (0.725)² × 100 ≈ 52.56
        assert tss == pytest.approx(52.6, abs=0.1)

    def test_workout_tss_with_warmup_cooldown(self):
        """Test TSS for typical structured workout."""
        segments = [
            # 15 min warmup at 55-65% FTP (avg 60%)
            {"duration_min": 15, "power_low_pct": 55.0, "power_high_pct": 65.0},
            # 2x20 at threshold (95% FTP)
            {"duration_min": 20, "power_low_pct": 95.0, "power_high_pct": 95.0},
            {"duration_min": 5, "power_low_pct": 50.0, "power_high_pct": 50.0},  # recovery
            {"duration_min": 20, "power_low_pct": 95.0, "power_high_pct": 95.0},
            # 10 min cooldown at 50% FTP
            {"duration_min": 10, "power_low_pct": 50.0, "power_high_pct": 50.0},
        ]
        tss = calculate_workout_tss(segments, ftp=250)
        # Should be around 70-76 TSS for a 2x20 threshold workout
        assert 70.0 <= tss <= 76.0

    def test_workout_tss_vo2max_intervals(self):
        """Test TSS for VO2max workout (5x5 at 110% FTP)."""
        segments = [
            # Warmup
            {"duration_min": 15, "power_low_pct": 55.0, "power_high_pct": 65.0},
            # 5x5 intervals
            {"duration_min": 5, "power_low_pct": 110.0, "power_high_pct": 110.0},
            {"duration_min": 5, "power_low_pct": 50.0, "power_high_pct": 50.0},
            {"duration_min": 5, "power_low_pct": 110.0, "power_high_pct": 110.0},
            {"duration_min": 5, "power_low_pct": 50.0, "power_high_pct": 50.0},
            {"duration_min": 5, "power_low_pct": 110.0, "power_high_pct": 110.0},
            {"duration_min": 5, "power_low_pct": 50.0, "power_high_pct": 50.0},
            {"duration_min": 5, "power_low_pct": 110.0, "power_high_pct": 110.0},
            {"duration_min": 5, "power_low_pct": 50.0, "power_high_pct": 50.0},
            {"duration_min": 5, "power_low_pct": 110.0, "power_high_pct": 110.0},
            # Cooldown
            {"duration_min": 10, "power_low_pct": 50.0, "power_high_pct": 50.0},
        ]
        tss = calculate_workout_tss(segments, ftp=250)
        # VO2max intervals accumulate TSS quickly despite shorter duration
        assert 60.0 <= tss <= 75.0

    def test_workout_tss_empty_segments(self):
        """Test that empty segment list returns 0 TSS."""
        tss = calculate_workout_tss([], ftp=250)
        assert tss == 0.0

    def test_workout_tss_missing_power_high(self):
        """Test workout TSS when power_high_pct is missing."""
        segments = [
            {"duration_min": 60, "power_low_pct": 70.0}  # No power_high_pct
        ]
        tss = calculate_workout_tss(segments, ftp=250)
        # Should use power_low_pct for both
        assert tss == pytest.approx(49.0, rel=0.01)


class TestWeeklyTSS:
    """Test weekly TSS calculations."""

    def test_weekly_tss_simple(self):
        """Test TSS for simple week with 3 workouts."""
        workouts = [
            {
                "weekday": "Tuesday",
                "segments": [
                    {"duration_min": 60, "power_low_pct": 70.0, "power_high_pct": 70.0}
                ],
            },
            {
                "weekday": "Thursday",
                "segments": [
                    {"duration_min": 60, "power_low_pct": 70.0, "power_high_pct": 70.0}
                ],
            },
            {
                "weekday": "Saturday",
                "segments": [
                    {"duration_min": 90, "power_low_pct": 65.0, "power_high_pct": 70.0}
                ],
            },
        ]
        weekly_tss = calculate_weekly_tss(workouts, ftp=250)
        # Each 60min@70%: ~49 TSS
        # 90min@67.5%: ~61 TSS
        # Total: ~166 TSS
        assert 155.0 <= weekly_tss <= 170.0

    def test_weekly_tss_mixed_intensities(self):
        """Test weekly TSS with varied workout intensities."""
        workouts = [
            # Easy endurance ride
            {
                "weekday": "Monday",
                "segments": [
                    {"duration_min": 90, "power_low_pct": 65.0, "power_high_pct": 70.0}
                ],
            },
            # Threshold workout
            {
                "weekday": "Wednesday",
                "segments": [
                    {"duration_min": 15, "power_low_pct": 55.0, "power_high_pct": 65.0},
                    {"duration_min": 20, "power_low_pct": 95.0, "power_high_pct": 95.0},
                    {"duration_min": 5, "power_low_pct": 50.0, "power_high_pct": 50.0},
                    {"duration_min": 20, "power_low_pct": 95.0, "power_high_pct": 95.0},
                    {"duration_min": 10, "power_low_pct": 50.0, "power_high_pct": 50.0},
                ],
            },
            # Long endurance ride
            {
                "weekday": "Saturday",
                "segments": [
                    {"duration_min": 180, "power_low_pct": 65.0, "power_high_pct": 70.0}
                ],
            },
        ]
        weekly_tss = calculate_weekly_tss(workouts, ftp=250)
        # Should be in the range for moderate training week
        assert 200.0 <= weekly_tss <= 350.0

    def test_weekly_tss_empty_workouts(self):
        """Test that empty workout list returns 0 TSS."""
        weekly_tss = calculate_weekly_tss([], ftp=250)
        assert weekly_tss == 0.0

    def test_weekly_tss_workouts_without_segments(self):
        """Test weekly TSS when workouts have no segments."""
        workouts = [
            {"weekday": "Monday", "segments": []},
            {"weekday": "Wednesday", "segments": []},
        ]
        weekly_tss = calculate_weekly_tss(workouts, ftp=250)
        assert weekly_tss == 0.0


class TestTSSRounding:
    """Test TSS rounding behavior."""

    def test_workout_tss_rounded_to_one_decimal(self):
        """Test that workout TSS is rounded to 1 decimal place."""
        segments = [
            {"duration_min": 60, "power_low_pct": 72.34, "power_high_pct": 72.34}
        ]
        tss = calculate_workout_tss(segments, ftp=250)
        # Check that result has at most 1 decimal place
        assert tss == round(tss, 1)

    def test_weekly_tss_rounded_to_one_decimal(self):
        """Test that weekly TSS is rounded to 1 decimal place."""
        workouts = [
            {
                "weekday": "Tuesday",
                "segments": [
                    {"duration_min": 60, "power_low_pct": 72.34, "power_high_pct": 72.34}
                ],
            }
        ]
        weekly_tss = calculate_weekly_tss(workouts, ftp=250)
        # Check that result has at most 1 decimal place
        assert weekly_tss == round(weekly_tss, 1)

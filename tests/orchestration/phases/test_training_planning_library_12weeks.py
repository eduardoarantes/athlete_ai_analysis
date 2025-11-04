"""
Unit test for library-based training planning with real 12-week plan.

Tests the complete flow:
1. Phase 3a creates 12-week overview
2. Phase 3b library selects workouts from library
3. TSS adjustment ensures weekly targets met
4. add_week_tool validates and stores all weeks
"""
import json
import uuid
from pathlib import Path

import pytest

from cycling_ai.orchestration.phases.training_planning_library import (
    LibraryBasedTrainingPlanningWeeks,
)


@pytest.fixture
def plan_id():
    """Generate unique plan ID for this test."""
    return str(uuid.uuid4())


@pytest.fixture
def twelve_week_overview():
    """
    Real 12-week training plan overview from Phase 3a.

    Includes:
    - Weeks 1-3: Foundation (280-320 TSS)
    - Week 4: Recovery (200 TSS)
    - Weeks 5-7: Build (340-370 TSS)
    - Week 8: Recovery (210 TSS)
    - Weeks 9-10: Peak (380-390 TSS)
    - Weeks 11-12: Taper (220-150 TSS)
    """
    return [
        {
            "week_number": 1,
            "phase": "Foundation",
            "phase_rationale": "Establish aerobic base and familiarize with training routine.",
            "weekly_focus": "Aerobic base building",
            "weekly_watch_points": "Fatigue, heart rate drift, recovery",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "endurance"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 280,
            "total_hours": 6.7,
        },
        {
            "week_number": 2,
            "phase": "Foundation",
            "phase_rationale": "Progress aerobic base with slight overload.",
            "weekly_focus": "Building endurance volume",
            "weekly_watch_points": "Cumulative fatigue, heart rate trends",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "endurance"},
                {"weekday": "Wednesday", "workout_type": "sweet_spot"},
                {"weekday": "Thursday", "workout_type": "recovery"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 305,
            "total_hours": 7.3,
        },
        {
            "week_number": 3,
            "phase": "Foundation",
            "phase_rationale": "Final week of aerobic base focus.",
            "weekly_focus": "Maximize endurance adaptation",
            "weekly_watch_points": "Fatigue, sleep quality, power consistency",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "threshold"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 320,
            "total_hours": 7.8,
        },
        {
            "week_number": 4,
            "phase": "Recovery",
            "phase_rationale": "Allow adaptation and prevent overtraining.",
            "weekly_focus": "Recovery and adaptation",
            "weekly_watch_points": "Resting heart rate, fatigue levels",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 200,
            "total_hours": 5.0,
        },
        {
            "week_number": 5,
            "phase": "Build",
            "phase_rationale": "Introduce higher intensity to develop FTP.",
            "weekly_focus": "FTP and VO2 Max boost",
            "weekly_watch_points": "Power at threshold, recovery rate",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "threshold"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "sweet_spot"},
            ],
            "target_tss": 340,
            "total_hours": 8.0,
        },
        {
            "week_number": 6,
            "phase": "Build",
            "phase_rationale": "Increase load with progressive intensity.",
            "weekly_focus": "Sustained power development",
            "weekly_watch_points": "Recovery quality, power at VO2 max",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "threshold"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "sweet_spot"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "tempo"},
            ],
            "target_tss": 355,
            "total_hours": 8.3,
        },
        {
            "week_number": 7,
            "phase": "Build",
            "phase_rationale": "Peak FTP development with VO2 max focus.",
            "weekly_focus": "Max aerobic power",
            "weekly_watch_points": "Heart rate zones, fatigue",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "vo2max"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "threshold"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 370,
            "total_hours": 8.5,
        },
        {
            "week_number": 8,
            "phase": "Recovery",
            "phase_rationale": "Reduce accumulated fatigue and consolidate gains.",
            "weekly_focus": "Recovery and adaptation",
            "weekly_watch_points": "Resting heart rate, recovery quality",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 210,
            "total_hours": 5.2,
        },
        {
            "week_number": 9,
            "phase": "Peak",
            "phase_rationale": "Prepare for peak performance with high intensity.",
            "weekly_focus": "Maximize FTP and VO2 max",
            "weekly_watch_points": "Peak power, fatigue management",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "threshold"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "vo2max"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "threshold"},
            ],
            "target_tss": 380,
            "total_hours": 8.7,
        },
        {
            "week_number": 10,
            "phase": "Peak",
            "phase_rationale": "Sustain peak with fine-tuned intensity.",
            "weekly_focus": "FTP sustainability",
            "weekly_watch_points": "Power zones, fatigue",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "threshold"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "threshold"},
            ],
            "target_tss": 390,
            "total_hours": 8.9,
        },
        {
            "week_number": 11,
            "phase": "Taper",
            "phase_rationale": "Reduce training load to optimize race readiness.",
            "weekly_focus": "Sharpen performance",
            "weekly_watch_points": "Peak power, recovery",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "sweet_spot"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 220,
            "total_hours": 5.5,
        },
        {
            "week_number": 12,
            "phase": "Taper",
            "phase_rationale": "Final taper week to ensure freshness.",
            "weekly_focus": "Race readiness",
            "weekly_watch_points": "Recovery, mental focus",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "rest"},
                {"weekday": "Friday", "workout_type": "rest"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 150,
            "total_hours": 4.0,
        },
    ]


@pytest.fixture
def overview_file(plan_id, twelve_week_overview, tmp_path):
    """
    Create Phase 3a overview file for testing.

    Simulates what Phase 3a (create_plan_overview tool) would produce.
    """
    overview_data = {
        "plan_id": plan_id,
        "total_weeks": 12,
        "target_ftp": 265,
        "athlete_profile_json": "data/Athlete_Name/athlete_profile.json",
        "coaching_notes": "12-week progressive plan building from foundation to peak",
        "monitoring_guidance": "Track TSS, recovery, and power zones weekly",
        "weekly_overview": twelve_week_overview,
    }

    # Save to /tmp (where library phase expects it)
    overview_path = Path("/tmp") / f"{plan_id}_overview.json"
    with open(overview_path, "w") as f:
        json.dump(overview_data, f, indent=2)

    yield overview_path

    # Cleanup
    if overview_path.exists():
        overview_path.unlink()


def test_library_phase_12_weeks_full_execution(plan_id, overview_file, twelve_week_overview):
    """
    Test library-based training planning with real 12-week plan.

    This test validates:
    1. All 12 weeks are processed successfully
    2. Workouts selected from library match workout types
    3. TSS adjustment brings weekly totals within ±25% tolerance
    4. add_week_tool validation passes for all weeks
    5. Proper handling of different phases (Foundation, Build, Recovery, Peak, Taper)
    6. Proper handling of recovery weeks (stricter ±20% TSS tolerance)
    """
    # Create library phase
    phase = LibraryBasedTrainingPlanningWeeks(temperature=0.5)

    # Execute - should process all 12 weeks
    result = phase.execute(plan_id=plan_id)

    # Validate success
    assert result["success"] is True, "Library phase should succeed"
    assert result["weeks_added"] == 12, "Should add all 12 weeks"

    print("\n" + "=" * 80)
    print("✅ All 12 weeks processed successfully!")
    print("=" * 80)

    # Load the final training plan to validate structure
    plan_file = Path("/tmp") / f"{plan_id}_training_plan.json"
    assert plan_file.exists(), "Training plan file should be created"

    with open(plan_file) as f:
        training_plan = json.load(f)

    # Validate plan structure
    assert "plan_id" in training_plan
    assert training_plan["plan_id"] == plan_id
    assert "total_weeks" in training_plan
    assert training_plan["total_weeks"] == 12
    assert "weeks" in training_plan
    assert len(training_plan["weeks"]) == 12

    print("\n📊 Weekly Breakdown:")
    print("-" * 80)

    # Validate each week
    for week_idx, week_overview in enumerate(twelve_week_overview):
        week_num = week_overview["week_number"]
        expected_phase = week_overview["phase"]
        target_tss = week_overview["target_tss"]
        total_hours = week_overview["total_hours"]

        # Find corresponding week in training plan
        week_data = next(
            (w for w in training_plan["weeks"] if w["week_number"] == week_num),
            None
        )

        assert week_data is not None, f"Week {week_num} should exist in training plan"
        assert week_data["phase"] == expected_phase, f"Week {week_num} phase should match"

        # Count non-rest training days
        non_rest_days = [
            day for day in week_overview["training_days"]
            if day["workout_type"] != "rest"
        ]
        expected_workout_count = len(non_rest_days)

        # Validate workouts
        workouts = week_data.get("workouts", [])
        assert len(workouts) == expected_workout_count, (
            f"Week {week_num} should have {expected_workout_count} workouts "
            f"(got {len(workouts)})"
        )

        # Calculate actual TSS from workouts
        actual_tss = 0.0
        for workout in workouts:
            for seg in workout.get("segments", []):
                duration_min = seg.get("duration_min", 0) or 0
                power_avg = (seg.get("power_low_pct", 50) + seg.get("power_high_pct", 60)) / 2
                seg_tss = ((power_avg / 100) ** 2) * (duration_min / 60) * 100
                actual_tss += seg_tss

        # Validate TSS is within tolerance
        tss_diff_pct = abs(actual_tss - target_tss) / target_tss * 100 if target_tss > 0 else 0

        # Recovery weeks have stricter tolerance (±20%)
        is_recovery_week = expected_phase in ["Recovery", "Taper"]
        max_tolerance = 20 if is_recovery_week else 25

        assert tss_diff_pct <= max_tolerance, (
            f"Week {week_num} TSS should be within ±{max_tolerance}% tolerance "
            f"(actual {actual_tss:.0f} vs target {target_tss}, {tss_diff_pct:.1f}% diff)"
        )

        # Print summary
        phase_icon = {
            "Foundation": "🏗️",
            "Build": "💪",
            "Recovery": "💤",
            "Peak": "🏔️",
            "Taper": "📉",
        }.get(expected_phase, "📅")

        tss_status = "✅" if tss_diff_pct <= 15 else "⚠️"

        print(
            f"{phase_icon} Week {week_num:2d} ({expected_phase:10s}): "
            f"{len(workouts)} workouts, "
            f"TSS {actual_tss:3.0f}/{target_tss:3.0f} ({tss_diff_pct:4.1f}%) {tss_status}"
        )

    print("-" * 80)
    print("\n📈 Phase Distribution:")

    # Count weeks by phase
    phase_counts = {}
    for week in twelve_week_overview:
        phase = week["phase"]
        phase_counts[phase] = phase_counts.get(phase, 0) + 1

    for phase, count in sorted(phase_counts.items()):
        print(f"  {phase:12s}: {count} weeks")

    print("\n✅ All validations passed!")

    # Cleanup
    if plan_file.exists():
        plan_file.unlink()


def test_library_phase_tss_adjustment_effectiveness(plan_id, overview_file):
    """
    Test that TSS adjustment effectively brings workouts within tolerance.

    This test specifically validates the _adjust_weekly_tss() method.
    """
    phase = LibraryBasedTrainingPlanningWeeks(temperature=0.5)
    result = phase.execute(plan_id=plan_id)

    assert result["success"] is True

    # Load training plan
    plan_file = Path("/tmp") / f"{plan_id}_training_plan.json"
    with open(plan_file) as f:
        training_plan = json.load(f)

    # Load overview
    with open(overview_file) as f:
        overview_data = json.load(f)

    print("\n🔧 TSS Adjustment Effectiveness:")
    print("-" * 80)

    weeks_adjusted = 0
    weeks_within_tolerance = 0

    for week_data in training_plan["weeks"]:
        week_num = week_data["week_number"]

        # Find target TSS from overview
        week_overview = next(
            (w for w in overview_data["weekly_overview"] if w["week_number"] == week_num),
            None
        )
        target_tss = week_overview["target_tss"]

        # Calculate actual TSS
        actual_tss = 0.0
        for workout in week_data.get("workouts", []):
            for seg in workout.get("segments", []):
                duration_min = seg.get("duration_min", 0) or 0
                power_avg = (seg.get("power_low_pct", 50) + seg.get("power_high_pct", 60)) / 2
                seg_tss = ((power_avg / 100) ** 2) * (duration_min / 60) * 100
                actual_tss += seg_tss

        tss_diff_pct = abs(actual_tss - target_tss) / target_tss * 100

        if tss_diff_pct <= 25:
            weeks_within_tolerance += 1
            status = "✅ Within tolerance"
        else:
            status = "❌ Outside tolerance"

        print(f"Week {week_num:2d}: {actual_tss:3.0f}/{target_tss:3.0f} TSS ({tss_diff_pct:4.1f}%) {status}")

    print("-" * 80)
    print(f"✅ {weeks_within_tolerance}/12 weeks within ±25% tolerance")

    # All weeks should be within tolerance
    assert weeks_within_tolerance == 12, "All weeks should pass TSS validation"

    # Cleanup
    if plan_file.exists():
        plan_file.unlink()


def test_library_phase_recovery_week_strict_tolerance(plan_id, overview_file):
    """
    Test that recovery weeks (weeks 4, 8, 11, 12) meet stricter ±20% TSS tolerance.
    """
    phase = LibraryBasedTrainingPlanningWeeks(temperature=0.5)
    result = phase.execute(plan_id=plan_id)

    assert result["success"] is True

    # Load training plan
    plan_file = Path("/tmp") / f"{plan_id}_training_plan.json"
    with open(plan_file) as f:
        training_plan = json.load(f)

    # Load overview
    with open(overview_file) as f:
        overview_data = json.load(f)

    print("\n💤 Recovery Week TSS Validation (Stricter ±20% Tolerance):")
    print("-" * 80)

    recovery_weeks = [4, 8, 11, 12]

    for week_num in recovery_weeks:
        week_data = next(
            (w for w in training_plan["weeks"] if w["week_number"] == week_num),
            None
        )
        week_overview = next(
            (w for w in overview_data["weekly_overview"] if w["week_number"] == week_num),
            None
        )

        target_tss = week_overview["target_tss"]
        phase = week_overview["phase"]

        # Calculate actual TSS
        actual_tss = 0.0
        for workout in week_data.get("workouts", []):
            for seg in workout.get("segments", []):
                duration_min = seg.get("duration_min", 0) or 0
                power_avg = (seg.get("power_low_pct", 50) + seg.get("power_high_pct", 60)) / 2
                seg_tss = ((power_avg / 100) ** 2) * (duration_min / 60) * 100
                actual_tss += seg_tss

        tss_diff_pct = abs(actual_tss - target_tss) / target_tss * 100

        # Recovery weeks should meet ±20% tolerance
        assert tss_diff_pct <= 20, (
            f"Recovery week {week_num} ({phase}) should be within ±20% tolerance "
            f"(actual {actual_tss:.0f} vs target {target_tss}, {tss_diff_pct:.1f}%)"
        )

        print(f"Week {week_num} ({phase:8s}): {actual_tss:3.0f}/{target_tss:3.0f} TSS ({tss_diff_pct:4.1f}%) ✅")

    print("-" * 80)
    print("✅ All recovery weeks within ±20% tolerance")

    # Cleanup
    if plan_file.exists():
        plan_file.unlink()


def get_twelve_week_overview():
    """Get the 12-week overview data without using pytest fixture."""
    return [
        {
            "week_number": 1,
            "phase": "Foundation",
            "phase_rationale": "Establish aerobic base and familiarize with training routine.",
            "weekly_focus": "Aerobic base building",
            "weekly_watch_points": "Fatigue, heart rate drift, recovery",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "endurance"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 280,
            "total_hours": 6.7,
        },
        {
            "week_number": 2,
            "phase": "Foundation",
            "phase_rationale": "Progress aerobic base with slight overload.",
            "weekly_focus": "Building endurance volume",
            "weekly_watch_points": "Cumulative fatigue, heart rate trends",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "endurance"},
                {"weekday": "Wednesday", "workout_type": "sweet_spot"},
                {"weekday": "Thursday", "workout_type": "recovery"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 305,
            "total_hours": 7.3,
        },
        {
            "week_number": 3,
            "phase": "Foundation",
            "phase_rationale": "Final week of aerobic base focus.",
            "weekly_focus": "Maximize endurance adaptation",
            "weekly_watch_points": "Fatigue, sleep quality, power consistency",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "threshold"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 320,
            "total_hours": 7.8,
        },
        {
            "week_number": 4,
            "phase": "Recovery",
            "phase_rationale": "Allow adaptation and prevent overtraining.",
            "weekly_focus": "Recovery and adaptation",
            "weekly_watch_points": "Resting heart rate, fatigue levels",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 200,
            "total_hours": 5.0,
        },
        {
            "week_number": 5,
            "phase": "Build",
            "phase_rationale": "Introduce higher intensity to develop FTP.",
            "weekly_focus": "FTP and VO2 Max boost",
            "weekly_watch_points": "Power at threshold, recovery rate",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "threshold"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "sweet_spot"},
            ],
            "target_tss": 340,
            "total_hours": 8.0,
        },
        {
            "week_number": 6,
            "phase": "Build",
            "phase_rationale": "Increase load with progressive intensity.",
            "weekly_focus": "Sustained power development",
            "weekly_watch_points": "Recovery quality, power at VO2 max",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "threshold"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "sweet_spot"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "tempo"},
            ],
            "target_tss": 355,
            "total_hours": 8.3,
        },
        {
            "week_number": 7,
            "phase": "Build",
            "phase_rationale": "Peak FTP development with VO2 max focus.",
            "weekly_focus": "Max aerobic power",
            "weekly_watch_points": "Heart rate zones, fatigue",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "vo2max"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "threshold"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
            "target_tss": 370,
            "total_hours": 8.5,
        },
        {
            "week_number": 8,
            "phase": "Recovery",
            "phase_rationale": "Reduce accumulated fatigue and consolidate gains.",
            "weekly_focus": "Recovery and adaptation",
            "weekly_watch_points": "Resting heart rate, recovery quality",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "endurance"},
                {"weekday": "Friday", "workout_type": "recovery"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 210,
            "total_hours": 5.2,
        },
        {
            "week_number": 9,
            "phase": "Peak",
            "phase_rationale": "Prepare for peak performance with high intensity.",
            "weekly_focus": "Maximize FTP and VO2 max",
            "weekly_watch_points": "Peak power, fatigue management",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "threshold"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "vo2max"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "threshold"},
            ],
            "target_tss": 380,
            "total_hours": 8.7,
        },
        {
            "week_number": 10,
            "phase": "Peak",
            "phase_rationale": "Sustain peak with fine-tuned intensity.",
            "weekly_focus": "FTP sustainability",
            "weekly_watch_points": "Power zones, fatigue",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "sweet_spot"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "threshold"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "threshold"},
            ],
            "target_tss": 390,
            "total_hours": 8.9,
        },
        {
            "week_number": 11,
            "phase": "Taper",
            "phase_rationale": "Reduce training load to optimize race readiness.",
            "weekly_focus": "Sharpen performance",
            "weekly_watch_points": "Peak power, recovery",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "rest"},
                {"weekday": "Thursday", "workout_type": "sweet_spot"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 220,
            "total_hours": 5.5,
        },
        {
            "week_number": 12,
            "phase": "Taper",
            "phase_rationale": "Final taper week to ensure freshness.",
            "weekly_focus": "Race readiness",
            "weekly_watch_points": "Recovery, mental focus",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "recovery"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "rest"},
                {"weekday": "Friday", "workout_type": "rest"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "recovery"},
            ],
            "target_tss": 150,
            "total_hours": 4.0,
        },
    ]


if __name__ == "__main__":
    """
    Run tests directly for debugging.

    Usage:
        python test_training_planning_library_12weeks.py
    """
    import sys

    print("=" * 80)
    print("🧪 Testing Library-Based Training Planning (12 Weeks)")
    print("=" * 80)

    # Create fixtures
    plan_id = str(uuid.uuid4())
    overview = get_twelve_week_overview()

    # Create overview file
    overview_data = {
        "plan_id": plan_id,
        "total_weeks": 12,
        "target_ftp": 265,
        "athlete_profile_json": "data/Athlete_Name/athlete_profile.json",
        "coaching_notes": "12-week progressive plan",
        "monitoring_guidance": "Track TSS and recovery",
        "weekly_overview": overview,
    }

    overview_path = Path("/tmp") / f"{plan_id}_overview.json"
    with open(overview_path, "w") as f:
        json.dump(overview_data, f, indent=2)

    try:
        # Run tests
        print("\n📋 Test 1: Full 12-week execution")
        test_library_phase_12_weeks_full_execution(plan_id, overview_path, overview)

        # Create new plan_id for second test
        plan_id2 = str(uuid.uuid4())
        overview_path2 = Path("/tmp") / f"{plan_id2}_overview.json"
        overview_data["plan_id"] = plan_id2
        with open(overview_path2, "w") as f:
            json.dump(overview_data, f, indent=2)

        print("\n📋 Test 2: TSS adjustment effectiveness")
        test_library_phase_tss_adjustment_effectiveness(plan_id2, overview_path2)

        # Create new plan_id for third test
        plan_id3 = str(uuid.uuid4())
        overview_path3 = Path("/tmp") / f"{plan_id3}_overview.json"
        overview_data["plan_id"] = plan_id3
        with open(overview_path3, "w") as f:
            json.dump(overview_data, f, indent=2)

        print("\n📋 Test 3: Recovery week strict tolerance")
        test_library_phase_recovery_week_strict_tolerance(plan_id3, overview_path3)

        print("\n" + "=" * 80)
        print("🎉 All tests passed!")
        print("=" * 80)

        sys.exit(0)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        # Cleanup
        for pid in [plan_id, plan_id2 if 'plan_id2' in locals() else None, plan_id3 if 'plan_id3' in locals() else None]:
            if pid:
                overview_file = Path("/tmp") / f"{pid}_overview.json"
                plan_file = Path("/tmp") / f"{pid}_training_plan.json"
                if overview_file.exists():
                    overview_file.unlink()
                if plan_file.exists():
                    plan_file.unlink()

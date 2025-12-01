"""Manual test runner for WorkoutSelector (no pytest required)."""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from cycling_ai.selectors import WorkoutSelector
from cycling_ai.selectors.workout_selector import WorkoutRequirements


def create_test_library(tmp_path: Path) -> Path:
    """Create a test workout library."""
    library = {
        "version": "1.0.0",
        "description": "Test workout library",
        "workouts": [
            {
                "id": "vo2_classic",
                "name": "VO2 Max Classic",
                "detailed_description": "Classic VO2 max intervals",
                "type": "vo2max",
                "intensity": "hard",
                "suitable_phases": ["Build", "Peak"],
                "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
                "segments": [
                    {
                        "type": "warmup",
                        "duration_min": 10,
                        "power_low_pct": 50,
                        "power_high_pct": 65,
                        "description": "Warmup",
                    },
                    {
                        "type": "interval",
                        "sets": 5,
                        "work": {
                            "duration_min": 3,
                            "power_low_pct": 110,
                            "power_high_pct": 120,
                            "description": "VO2 work",
                        },
                        "recovery": {
                            "duration_min": 3,
                            "power_low_pct": 50,
                            "power_high_pct": 60,
                            "description": "Recovery",
                        },
                    },
                    {
                        "type": "cooldown",
                        "duration_min": 10,
                        "power_low_pct": 50,
                        "power_high_pct": 55,
                        "description": "Cooldown",
                    },
                ],
                "base_duration_min": 50,
                "base_tss": 85,
                "variable_components": {
                    "adjustable_field": "sets",
                    "min_value": 3,
                    "max_value": 8,
                    "tss_per_unit": 15,
                    "duration_per_unit_min": 6,
                },
            },
            {
                "id": "endurance_2hr",
                "name": "2hr Endurance",
                "detailed_description": "Long endurance ride",
                "type": "endurance",
                "intensity": "easy",
                "suitable_phases": ["Foundation", "Build", "Recovery"],
                "suitable_weekdays": ["Saturday", "Sunday"],
                "segments": [
                    {
                        "type": "steady",
                        "duration_min": 120,
                        "power_low_pct": 56,
                        "power_high_pct": 75,
                        "description": "Endurance",
                    }
                ],
                "base_duration_min": 120,
                "base_tss": 95,
                "variable_components": {
                    "adjustable_field": "duration",
                    "min_value": 60,
                    "max_value": 240,
                    "tss_per_unit": 0.8,
                    "duration_per_unit_min": 1,
                },
            },
        ],
    }

    library_path = tmp_path / "test_library.json"
    with open(library_path, "w") as f:
        json.dump(library, f)

    return library_path


def run_tests():
    """Run manual tests."""
    passed = 0
    failed = 0

    print("=" * 60)
    print("WorkoutSelector Manual Test Runner")
    print("=" * 60)

    # Create temp library
    import tempfile

    tmp_dir = Path(tempfile.mkdtemp())
    test_library_path = create_test_library(tmp_dir)

    # Test 1: Load library
    print("\n[TEST 1] Load library")
    try:
        selector = WorkoutSelector(library_path=test_library_path)
        assert len(selector.workouts) == 2
        print("✓ PASSED: Loaded 2 workouts")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 2: Select workout by type
    print("\n[TEST 2] Select workout by type")
    try:
        requirements = WorkoutRequirements(
            weekday="Tuesday", phase="Build", workout_type="vo2max"
        )
        workout = selector.select_workout(requirements)
        assert workout is not None
        assert workout.workout_type == "vo2max"
        assert workout.name == "VO2 Max Classic"
        print(f"✓ PASSED: Selected '{workout.name}'")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 3: Adjust TSS upward
    print("\n[TEST 3] Adjust TSS upward")
    try:
        requirements = WorkoutRequirements(
            weekday="Tuesday",
            phase="Build",
            workout_type="vo2max",
            target_tss=115,  # Base is 85, need +30 (~2 sets)
        )
        workout = selector.select_workout(requirements)
        assert workout is not None
        assert workout.adjusted is True
        assert workout.tss > 85
        print(f"✓ PASSED: Adjusted from 85 TSS to {workout.tss} TSS")
        print(f"  Details: {workout.adjustment_details['field']} adjusted from "
              f"{workout.adjustment_details['original_value']} to "
              f"{workout.adjustment_details['adjusted_value']}")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 4: Adjust duration
    print("\n[TEST 4] Adjust duration")
    try:
        requirements = WorkoutRequirements(
            weekday="Saturday",
            phase="Foundation",
            workout_type="endurance",
            target_duration_min=180,  # Base is 120
        )
        workout = selector.select_workout(requirements)
        assert workout is not None
        assert workout.adjusted is True
        assert workout.duration_min > 120
        print(f"✓ PASSED: Adjusted from 120 min to {workout.duration_min} min")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 5: Within tolerance (no adjustment)
    print("\n[TEST 5] Within tolerance (no adjustment)")
    try:
        requirements = WorkoutRequirements(
            weekday="Tuesday",
            phase="Build",
            workout_type="vo2max",
            target_tss=87,  # Within 15% of 85
            tss_tolerance_pct=0.15,
        )
        workout = selector.select_workout(requirements)
        assert workout is not None
        assert workout.adjusted is False
        assert workout.tss == 85
        print(f"✓ PASSED: No adjustment needed (within tolerance)")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 6: Get workouts by type
    print("\n[TEST 6] Get workouts by type")
    try:
        vo2_workouts = selector.get_workouts_by_type("vo2max")
        assert len(vo2_workouts) == 1
        assert vo2_workouts[0]["id"] == "vo2_classic"
        print(f"✓ PASSED: Found {len(vo2_workouts)} VO2 Max workout(s)")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 7: Get workout stats
    print("\n[TEST 7] Get workout stats")
    try:
        stats = selector.get_workout_stats()
        assert stats["total_workouts"] == 2
        assert stats["by_type"]["vo2max"] == 1
        assert stats["by_type"]["endurance"] == 1
        print(f"✓ PASSED: Stats: {stats['total_workouts']} total, "
              f"avg TSS: {stats['avg_tss']:.1f}")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Test 8: Real library
    print("\n[TEST 8] Load real library")
    try:
        real_selector = WorkoutSelector()  # Uses default path
        assert len(real_selector.workouts) > 0
        stats = real_selector.get_workout_stats()
        print(f"✓ PASSED: Loaded {stats['total_workouts']} workouts from real library")
        print(f"  Types: {stats['by_type']}")
        print(f"  Avg TSS: {stats['avg_tss']:.1f}")
        print(f"  Avg Duration: {stats['avg_duration_min']:.1f} min")
        passed += 1
    except Exception as e:
        print(f"✗ FAILED: {e}")
        failed += 1

    # Cleanup
    import shutil
    shutil.rmtree(tmp_dir)

    # Summary
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

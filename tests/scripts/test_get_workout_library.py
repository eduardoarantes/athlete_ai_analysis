"""Tests for get_workout_library.py script.

Part of Issue #21: Plan Builder Phase 1 - Foundation
TDD approach: Write tests first (RED), then implement (GREEN).
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

# Path to the script
SCRIPT_PATH = Path(__file__).parent.parent.parent / "scripts" / "get_workout_library.py"


def run_script(args: list[str] | None = None) -> dict:
    """Run the get_workout_library.py script and parse JSON output."""
    cmd = [sys.executable, str(SCRIPT_PATH)]
    if args:
        cmd.extend(args)

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    if result.returncode != 0:
        raise RuntimeError(f"Script failed: {result.stderr}")

    return json.loads(result.stdout)


class TestWorkoutLibraryScript:
    """Tests for the workout library script."""

    def test_returns_all_workouts_without_filters(self) -> None:
        """Script returns all workouts when no filters are provided."""
        result = run_script()

        assert "workouts" in result
        assert len(result["workouts"]) > 0
        assert "total" in result

        # Each workout should have required fields
        for workout in result["workouts"]:
            assert "id" in workout
            assert "name" in workout
            assert "type" in workout
            assert "base_duration_min" in workout
            assert "base_tss" in workout

    def test_filters_by_single_type(self) -> None:
        """Script filters workouts by a single type."""
        result = run_script(["--type", "endurance"])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            assert workout["type"] == "endurance"

    def test_filters_by_multiple_types(self) -> None:
        """Script filters workouts by multiple types."""
        result = run_script(["--type", "endurance", "--type", "tempo"])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            assert workout["type"] in ["endurance", "tempo"]

    def test_filters_by_intensity(self) -> None:
        """Script filters workouts by intensity."""
        result = run_script(["--intensity", "easy"])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            assert workout["intensity"] == "easy"

    def test_filters_by_phase(self) -> None:
        """Script filters workouts by suitable phase."""
        result = run_script(["--phase", "Base"])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            # Phase should be in suitable_phases list
            phases = workout.get("suitable_phases", [])
            assert "Base" in phases, f"Workout {workout['id']} doesn't have Base in phases: {phases}"

    def test_filters_by_min_duration(self) -> None:
        """Script filters workouts by minimum duration."""
        min_duration = 60
        result = run_script(["--min-duration", str(min_duration)])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            assert (
                workout["base_duration_min"] >= min_duration
            ), f"Workout {workout['id']} has duration {workout['base_duration_min']} < {min_duration}"

    def test_filters_by_max_duration(self) -> None:
        """Script filters workouts by maximum duration."""
        max_duration = 60
        result = run_script(["--max-duration", str(max_duration)])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            assert (
                workout["base_duration_min"] <= max_duration
            ), f"Workout {workout['id']} has duration {workout['base_duration_min']} > {max_duration}"

    def test_filters_by_duration_range(self) -> None:
        """Script filters workouts by duration range."""
        min_duration = 45
        max_duration = 90
        result = run_script(["--min-duration", str(min_duration), "--max-duration", str(max_duration)])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            assert (
                min_duration <= workout["base_duration_min"] <= max_duration
            ), f"Workout {workout['id']} has duration {workout['base_duration_min']} outside range [{min_duration}, {max_duration}]"

    def test_search_by_name(self) -> None:
        """Script searches workouts by name (case insensitive)."""
        result = run_script(["--search", "zone 2"])

        assert len(result["workouts"]) > 0
        for workout in result["workouts"]:
            # Search term should be in name or description
            name_lower = workout["name"].lower()
            desc_lower = (workout.get("detailed_description") or "").lower()
            assert (
                "zone 2" in name_lower or "zone 2" in desc_lower
            ), f"Workout {workout['id']} doesn't contain 'zone 2'"

    def test_combined_filters(self) -> None:
        """Script applies multiple filters together."""
        result = run_script(
            [
                "--type",
                "endurance",
                "--min-duration",
                "60",
                "--max-duration",
                "120",
            ]
        )

        # May return 0 if no workouts match all criteria
        for workout in result["workouts"]:
            assert workout["type"] == "endurance"
            assert 60 <= workout["base_duration_min"] <= 120

    def test_returns_filters_applied(self) -> None:
        """Script returns the filters that were applied."""
        result = run_script(["--type", "endurance", "--min-duration", "60"])

        assert "filters_applied" in result
        filters = result["filters_applied"]
        assert "endurance" in filters.get("type", [])
        assert filters.get("min_duration") == 60

    def test_empty_result_for_impossible_filters(self) -> None:
        """Script returns empty list for filters that match nothing."""
        # Very short VO2max workout is unlikely
        result = run_script(["--type", "vo2max", "--max-duration", "5"])

        assert "workouts" in result
        # May or may not have results, but should not error

    def test_invalid_type_returns_error(self) -> None:
        """Script returns error for invalid workout type."""
        with pytest.raises(RuntimeError) as exc_info:
            run_script(["--type", "invalid_type"])

        assert "invalid" in str(exc_info.value).lower() or "error" in str(exc_info.value).lower()

    def test_invalid_phase_returns_error(self) -> None:
        """Script returns error for invalid phase."""
        with pytest.raises(RuntimeError) as exc_info:
            run_script(["--phase", "InvalidPhase"])

        assert "invalid" in str(exc_info.value).lower() or "error" in str(exc_info.value).lower()

    def test_help_flag(self) -> None:
        """Script shows help with --help flag."""
        result = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "--help"],
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert result.returncode == 0
        assert "usage" in result.stdout.lower() or "options" in result.stdout.lower()

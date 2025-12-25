#!/usr/bin/env python3
"""
Get Workout Library Script

Retrieves and filters workouts from the cycling-ai workout library.
Outputs JSON to stdout for consumption by Next.js API routes.

Part of Issue #21: Plan Builder Phase 1 - Foundation

Usage:
    python scripts/get_workout_library.py [OPTIONS]

Options:
    --type TYPE           Filter by workout type (can be repeated)
    --intensity INTENSITY Filter by intensity level (can be repeated)
    --phase PHASE         Filter by suitable phase (can be repeated)
    --min-duration MINS   Minimum duration in minutes
    --max-duration MINS   Maximum duration in minutes
    --search TERM         Search in name and description

Example:
    python scripts/get_workout_library.py --type endurance --min-duration 60 --max-duration 120
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader
from cycling_ai.core.workout_library.models import Workout

# Valid values for validation
VALID_TYPES = {"endurance", "tempo", "sweet_spot", "threshold", "vo2max", "recovery", "mixed"}
VALID_INTENSITIES = {"easy", "moderate", "hard", "very_hard"}
VALID_PHASES = {"Base", "Build", "Peak", "Recovery", "Taper", "Foundation"}


def validate_args(args: argparse.Namespace) -> list[str]:
    """Validate command line arguments."""
    errors: list[str] = []

    if args.type:
        for t in args.type:
            if t not in VALID_TYPES:
                errors.append(f"Invalid type: {t}. Valid types: {', '.join(sorted(VALID_TYPES))}")

    if args.intensity:
        for i in args.intensity:
            if i not in VALID_INTENSITIES:
                errors.append(
                    f"Invalid intensity: {i}. Valid intensities: {', '.join(sorted(VALID_INTENSITIES))}"
                )

    if args.phase:
        for p in args.phase:
            if p not in VALID_PHASES:
                errors.append(f"Invalid phase: {p}. Valid phases: {', '.join(sorted(VALID_PHASES))}")

    if args.min_duration is not None and args.min_duration < 0:
        errors.append("min-duration must be non-negative")

    if args.max_duration is not None and args.max_duration < 0:
        errors.append("max-duration must be non-negative")

    if args.min_duration is not None and args.max_duration is not None:
        if args.min_duration > args.max_duration:
            errors.append("min-duration cannot be greater than max-duration")

    return errors


def workout_to_dict(workout: Workout) -> dict[str, Any]:
    """Convert a Workout model to a dictionary for JSON output."""
    result: dict[str, Any] = {
        "id": workout.id,
        "name": workout.name,
        "type": workout.type,
        "intensity": workout.intensity,
        "base_duration_min": workout.base_duration_min,
        "base_tss": workout.base_tss,
    }

    # Optional fields
    if workout.detailed_description:
        result["detailed_description"] = workout.detailed_description

    if workout.suitable_phases:
        result["suitable_phases"] = list(workout.suitable_phases)

    if workout.suitable_weekdays:
        result["suitable_weekdays"] = list(workout.suitable_weekdays)

    if workout.segments:
        result["segments"] = [
            {
                "type": seg.type,
                "duration_min": seg.duration_min,
                "power_low_pct": seg.power_low_pct,
                "power_high_pct": seg.power_high_pct,
                "description": seg.description,
                "sets": seg.sets,
                "work": (
                    {
                        "duration_min": seg.work.duration_min,
                        "power_low_pct": seg.work.power_low_pct,
                        "power_high_pct": seg.work.power_high_pct,
                        "description": seg.work.description,
                    }
                    if seg.work
                    else None
                ),
                "recovery": (
                    {
                        "duration_min": seg.recovery.duration_min,
                        "power_low_pct": seg.recovery.power_low_pct,
                        "power_high_pct": seg.recovery.power_high_pct,
                        "description": seg.recovery.description,
                    }
                    if seg.recovery
                    else None
                ),
            }
            for seg in workout.segments
        ]

    if workout.variable_components:
        vc = workout.variable_components
        result["variable_components"] = {
            "adjustable_field": vc.adjustable_field,
            "min_value": vc.min_value,
            "max_value": vc.max_value,
            "tss_per_unit": vc.tss_per_unit,
            "duration_per_unit_min": vc.duration_per_unit_min,
        }

    return result


def filter_workouts(
    workouts: list[Workout],
    types: list[str] | None = None,
    intensities: list[str] | None = None,
    phases: list[str] | None = None,
    min_duration: float | None = None,
    max_duration: float | None = None,
    search: str | None = None,
) -> list[Workout]:
    """Filter workouts based on criteria."""
    filtered = workouts

    # Filter by type
    if types:
        filtered = [w for w in filtered if w.type in types]

    # Filter by intensity
    if intensities:
        filtered = [w for w in filtered if w.intensity in intensities]

    # Filter by phase
    if phases:
        filtered = [w for w in filtered if w.suitable_phases and any(p in w.suitable_phases for p in phases)]

    # Filter by duration
    if min_duration is not None:
        filtered = [w for w in filtered if w.base_duration_min >= min_duration]

    if max_duration is not None:
        filtered = [w for w in filtered if w.base_duration_min <= max_duration]

    # Search in name and description
    if search:
        search_lower = search.lower()
        filtered = [
            w
            for w in filtered
            if search_lower in w.name.lower()
            or (w.detailed_description and search_lower in w.detailed_description.lower())
        ]

    return filtered


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Get workout library with optional filters",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--type",
        action="append",
        dest="type",
        help=f"Filter by workout type. Valid: {', '.join(sorted(VALID_TYPES))}",
    )

    parser.add_argument(
        "--intensity",
        action="append",
        dest="intensity",
        help=f"Filter by intensity. Valid: {', '.join(sorted(VALID_INTENSITIES))}",
    )

    parser.add_argument(
        "--phase",
        action="append",
        dest="phase",
        help=f"Filter by suitable phase. Valid: {', '.join(sorted(VALID_PHASES))}",
    )

    parser.add_argument(
        "--min-duration",
        type=float,
        dest="min_duration",
        help="Minimum duration in minutes",
    )

    parser.add_argument(
        "--max-duration",
        type=float,
        dest="max_duration",
        help="Maximum duration in minutes",
    )

    parser.add_argument(
        "--search",
        type=str,
        help="Search term for name/description",
    )

    args = parser.parse_args()

    # Validate arguments
    validation_errors = validate_args(args)
    if validation_errors:
        error_response = {
            "error": True,
            "message": "Invalid arguments",
            "details": validation_errors,
        }
        print(json.dumps(error_response), file=sys.stderr)
        return 1

    try:
        # Load workout library
        loader = WorkoutLibraryLoader()
        library = loader.get_library()

        # Filter workouts
        filtered = filter_workouts(
            workouts=library.workouts,
            types=args.type,
            intensities=args.intensity,
            phases=args.phase,
            min_duration=args.min_duration,
            max_duration=args.max_duration,
            search=args.search,
        )

        # Build response
        response = {
            "workouts": [workout_to_dict(w) for w in filtered],
            "total": len(filtered),
            "filters_applied": {
                "type": args.type or [],
                "intensity": args.intensity or [],
                "phase": args.phase or [],
                "min_duration": args.min_duration,
                "max_duration": args.max_duration,
                "search": args.search,
            },
        }

        # Output JSON
        print(json.dumps(response, indent=2))
        return 0

    except FileNotFoundError as e:
        error_response = {
            "error": True,
            "message": "Workout library not found",
            "details": str(e),
        }
        print(json.dumps(error_response), file=sys.stderr)
        return 1

    except Exception as e:
        error_response = {
            "error": True,
            "message": "Failed to load workout library",
            "details": str(e),
        }
        print(json.dumps(error_response), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

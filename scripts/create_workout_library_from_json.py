#!/usr/bin/env python3
"""
Create workout library from JSON workout files.

Parses JSON workout files and generates data/workout_library.json with
pre-built workout definitions for use in training plan generation.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cycling_ai.parsers.json_workout_parser import JsonWorkoutParser


def create_workout_library(
    json_dir: Path,
    output_path: Path,
) -> None:
    """
    Create workout library from JSON files.

    Args:
        json_dir: Directory containing JSON workout files
        output_path: Path to save workout_library.json
    """
    parser = JsonWorkoutParser()

    # Find all JSON files
    json_files = list(json_dir.glob("workout_*.json"))

    if not json_files:
        print(f"❌ No JSON workout files found in {json_dir}")
        sys.exit(1)

    print(f"📁 Found {len(json_files)} JSON files in {json_dir}")
    print()

    # Parse all JSON files
    workouts = []
    failed = []

    for json_file in sorted(json_files):
        try:
            workout_dict = parser.parse_workout_file(json_file)
            workouts.append(workout_dict)

            # Print summary (but not all 222!)
            if len(workouts) <= 10 or len(workouts) % 20 == 0:
                print(f"✅ [{len(workouts):3d}] {workout_dict['name'][:50]}")

        except Exception as e:
            failed.append((json_file.name, str(e)))
            if len(failed) <= 5:  # Only print first few errors
                print(f"❌ {json_file.name}: {e}")

    print()
    print(f"✅ Successfully parsed: {len(workouts)} workouts")
    if failed:
        print(f"❌ Failed to parse: {len(failed)} workouts")
        if len(failed) > 5:
            print(f"   (showing first 5 errors, {len(failed) - 5} more suppressed)")

    if not workouts:
        print("❌ No workouts successfully parsed")
        sys.exit(1)

    # Create library structure
    library = {
        "version": "1.0.0",
        "description": "Workout library for cycling training plans",
        "workouts": workouts,
        "metadata": {
            "total_workouts": len(workouts),
            "source": "JSON files from fit-crawler/workout_library/",
            "created_by": "create_workout_library_from_json.py",
        },
    }

    # Save to file
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(library, f, indent=2)

    print()
    print(f"✅ Workout library created: {output_path}")
    print(f"📊 Total workouts: {len(workouts)}")
    print()
    print("Workout Summary:")
    print("-" * 60)

    # Summarize by type and intensity
    by_type = {}
    by_intensity = {}

    for workout in workouts:
        wtype = workout["type"]
        intensity = workout["intensity"]

        by_type[wtype] = by_type.get(wtype, 0) + 1
        by_intensity[intensity] = by_intensity.get(intensity, 0) + 1

    print("\nBy Type:")
    for wtype, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {wtype:15s}: {count:3d}")

    print("\nBy Intensity:")
    for intensity, count in sorted(by_intensity.items()):
        print(f"  {intensity:15s}: {count:3d}")

    # Show duration and TSS stats
    durations = [w["base_duration_min"] for w in workouts]
    tss_values = [w["base_tss"] for w in workouts]

    print("\nDuration (minutes):")
    print(f"  Min: {min(durations)}, Max: {max(durations)}, Avg: {sum(durations) / len(durations):.0f}")

    print("\nTSS:")
    print(f"  Min: {min(tss_values):.0f}, Max: {max(tss_values):.0f}, Avg: {sum(tss_values) / len(tss_values):.0f}")

    print()
    print("🎉 Workout library ready for use!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Create workout library from JSON files"
    )
    parser.add_argument(
        "--json-dir",
        type=Path,
        default=Path("/Users/eduardo/Documents/projects/fit-crawler/workout_library"),
        help="Directory containing JSON files",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/workout_library.json"),
        help="Output path for library (default: data/workout_library.json)",
    )

    args = parser.parse_args()

    create_workout_library(
        json_dir=args.json_dir,
        output_path=args.output,
    )

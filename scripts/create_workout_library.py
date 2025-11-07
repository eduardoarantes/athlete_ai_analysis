#!/usr/bin/env python3
"""
Create workout library from FIT workout files.

Parses FIT workout files and generates data/workout_library.json with
pre-built workout definitions for use in training plan generation.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cycling_ai.parsers.fit_workout_parser import FitWorkoutParser


def create_workout_library(
    fit_dir: Path,
    output_path: Path,
    ftp: float = 260,
) -> None:
    """
    Create workout library from FIT files.

    Args:
        fit_dir: Directory containing FIT workout files
        output_path: Path to save workout_library.json
        ftp: FTP to use for power percentage calculations (default: 260W)
    """
    parser = FitWorkoutParser()

    # Find all FIT files
    fit_files = list(fit_dir.glob("*.fit"))

    if not fit_files:
        print(f"❌ No FIT files found in {fit_dir}")
        sys.exit(1)

    print(f"📁 Found {len(fit_files)} FIT files in {fit_dir}")
    print(f"⚙️  Using FTP: {ftp}W for power calculations")
    print()

    # Parse all FIT files
    workouts = []
    for fit_file in sorted(fit_files):
        print(f"📄 Parsing {fit_file.name}...")
        try:
            parsed_workout = parser.parse_workout_file(fit_file, ftp=ftp)
            workout_dict = parsed_workout.to_library_format()

            # Add metadata
            workout_dict["source_file"] = fit_file.name
            workout_dict["source_format"] = "fit"

            workouts.append(workout_dict)

            print(f"   ✅ {workout_dict['name']}")
            print(f"      Type: {workout_dict['type']}")
            print(f"      Intensity: {workout_dict['intensity']}")
            print(f"      Duration: {workout_dict['base_duration_min']} min")
            print(f"      TSS: {workout_dict['base_tss']:.0f}")
            print(f"      Segments: {len(workout_dict['segments'])}")
            print()

        except Exception as e:
            print(f"   ❌ Failed to parse {fit_file.name}: {e}")
            print()
            continue

    if not workouts:
        print("❌ No workouts successfully parsed")
        sys.exit(1)

    # Create library structure
    library = {
        "version": "1.0.0",
        "description": "Workout library for cycling training plans",
        "ftp_reference": ftp,
        "workouts": workouts,
        "metadata": {
            "total_workouts": len(workouts),
            "source": "FIT files from .claude/fit_samples/",
            "created_by": "create_workout_library.py",
        }
    }

    # Save to file
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(library, f, indent=2)

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
    for wtype, count in sorted(by_type.items()):
        print(f"  {wtype}: {count}")

    print("\nBy Intensity:")
    for intensity, count in sorted(by_intensity.items()):
        print(f"  {intensity}: {count}")

    print()
    print("🎉 Workout library ready for use!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Create workout library from FIT files"
    )
    parser.add_argument(
        "--fit-dir",
        type=Path,
        default=Path(".claude/fit_samples"),
        help="Directory containing FIT files (default: .claude/fit_samples)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/workout_library.json"),
        help="Output path for library (default: data/workout_library.json)",
    )
    parser.add_argument(
        "--ftp",
        type=float,
        default=260,
        help="FTP for power calculations (default: 260W)",
    )

    args = parser.parse_args()

    create_workout_library(
        fit_dir=args.fit_dir,
        output_path=args.output,
        ftp=args.ftp,
    )

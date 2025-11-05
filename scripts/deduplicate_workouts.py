#!/usr/bin/env python3
"""
Workout Library Deduplication Tool

Identifies and removes duplicate workouts from workout_library.json.
Workouts are considered duplicates if they have exactly the same segments.
When duplicates are found, keeps the workout with the longest name.
"""

import json
import hashlib
from pathlib import Path
from typing import Any
from collections import defaultdict


def hash_segments(segments: list[dict[str, Any]]) -> str:
    """
    Create a hash of the segments structure.

    This creates a deterministic hash based on the segment content
    to identify workouts with identical segment structures.
    """
    # Convert to JSON with sorted keys for deterministic hashing
    segments_json = json.dumps(segments, sort_keys=True)
    return hashlib.sha256(segments_json.encode()).hexdigest()


def find_duplicates(workouts: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    Group workouts by their segment hash.

    Returns a dictionary where keys are segment hashes and values are lists
    of workouts that share that segment structure.
    """
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for workout in workouts:
        segments = workout.get("segments", [])
        seg_hash = hash_segments(segments)
        groups[seg_hash].append(workout)

    # Only return groups with more than one workout (duplicates)
    return {k: v for k, v in groups.items() if len(v) > 1}


def select_best_workout(duplicates: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Select the workout with the longest name from a group of duplicates.
    """
    return max(duplicates, key=lambda w: len(w.get("name", "")))


def generate_report(
    duplicate_groups: dict[str, list[dict[str, Any]]],
    kept_workouts: dict[str, dict[str, Any]],
    removed_workouts: list[dict[str, Any]]
) -> str:
    """Generate a detailed deduplication report."""

    report_lines = [
        "=" * 80,
        "WORKOUT LIBRARY DEDUPLICATION REPORT",
        "=" * 80,
        "",
        f"Total duplicate groups found: {len(duplicate_groups)}",
        f"Total workouts removed: {len(removed_workouts)}",
        "",
        "=" * 80,
        "DUPLICATE GROUPS",
        "=" * 80,
        ""
    ]

    for i, (seg_hash, duplicates) in enumerate(duplicate_groups.items(), 1):
        kept = kept_workouts[seg_hash]
        removed = [w for w in duplicates if w["id"] != kept["id"]]

        report_lines.extend([
            f"Group {i}: {len(duplicates)} duplicates",
            "-" * 80,
            f"  Segment Hash: {seg_hash[:16]}...",
            "",
            f"  ✓ KEPT: {kept['name']}",
            f"     ID: {kept['id']}",
            f"     Name Length: {len(kept['name'])} characters",
            f"     Duration: {kept.get('base_duration_min', 'N/A')} min",
            f"     TSS: {kept.get('base_tss', 'N/A')}",
            ""
        ])

        for workout in removed:
            report_lines.extend([
                f"  ✗ REMOVED: {workout['name']}",
                f"     ID: {workout['id']}",
                f"     Name Length: {len(workout['name'])} characters",
                f"     Duration: {workout.get('base_duration_min', 'N/A')} min",
                f"     TSS: {workout.get('base_tss', 'N/A')}",
                ""
            ])

        report_lines.append("")

    report_lines.extend([
        "=" * 80,
        "REMOVED WORKOUTS SUMMARY",
        "=" * 80,
        ""
    ])

    for workout in removed_workouts:
        report_lines.append(f"  • {workout['id']}: {workout['name']}")

    report_lines.extend([
        "",
        "=" * 80,
        "END OF REPORT",
        "=" * 80
    ])

    return "\n".join(report_lines)


def deduplicate_workouts(input_path: Path, output_path: Path, report_path: Path) -> None:
    """
    Main deduplication function.

    Args:
        input_path: Path to the original workout_library.json
        output_path: Path to save the deduplicated library
        report_path: Path to save the deduplication report
    """
    print(f"Loading workout library from: {input_path}")

    # Load the workout library
    with open(input_path, 'r', encoding='utf-8') as f:
        library = json.load(f)

    workouts = library.get("workouts", [])
    original_count = len(workouts)

    print(f"Found {original_count} workouts in library")
    print("Analyzing for duplicates...")

    # Find duplicate groups
    duplicate_groups = find_duplicates(workouts)

    if not duplicate_groups:
        print("\n✓ No duplicates found! Library is already clean.")
        return

    print(f"\nFound {len(duplicate_groups)} duplicate groups")

    # Select the best workout from each duplicate group
    kept_workouts: dict[str, dict[str, Any]] = {}
    removed_workouts: list[dict[str, Any]] = []
    kept_ids: set[str] = set()

    for seg_hash, duplicates in duplicate_groups.items():
        best_workout = select_best_workout(duplicates)
        kept_workouts[seg_hash] = best_workout
        kept_ids.add(best_workout["id"])

        # Track removed workouts
        for workout in duplicates:
            if workout["id"] != best_workout["id"]:
                removed_workouts.append(workout)

    # Create deduplicated workout list
    deduplicated_workouts = [
        w for w in workouts
        if w["id"] not in {r["id"] for r in removed_workouts}
    ]

    # Update library
    library["workouts"] = deduplicated_workouts

    # Save deduplicated library
    print(f"\nSaving deduplicated library to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    final_count = len(deduplicated_workouts)
    print(f"✓ Saved {final_count} workouts (removed {original_count - final_count})")

    # Generate and save report
    report = generate_report(duplicate_groups, kept_workouts, removed_workouts)

    print(f"\nSaving report to: {report_path}")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Original workouts: {original_count}")
    print(f"Duplicate groups: {len(duplicate_groups)}")
    print(f"Workouts removed: {len(removed_workouts)}")
    print(f"Final workouts: {final_count}")
    print("=" * 80)


def main() -> None:
    """Main entry point."""
    # Set up paths
    project_root = Path(__file__).parent.parent
    input_path = project_root / "data" / "workout_library.json"
    output_path = project_root / "data" / "workout_library_deduplicated.json"
    report_path = project_root / "data" / "deduplication_report.txt"

    # Validate input file exists
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}")
        return

    print("Workout Library Deduplication Tool")
    print("=" * 80)

    # Run deduplication
    deduplicate_workouts(input_path, output_path, report_path)

    print(f"\n✓ Deduplication complete!")
    print(f"\nFiles created:")
    print(f"  • Deduplicated library: {output_path}")
    print(f"  • Report: {report_path}")


if __name__ == "__main__":
    main()

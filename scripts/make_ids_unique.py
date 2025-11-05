#!/usr/bin/env python3
"""
Make Workout IDs Unique

Adds a counter suffix to duplicate workout IDs to ensure uniqueness.
For example, if "active_recovery" appears 7 times, they become:
  active_recovery, active_recovery_2, active_recovery_3, ..., active_recovery_7
"""

import json
from pathlib import Path
from collections import defaultdict
from typing import Any


def make_ids_unique(workouts: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """
    Make all workout IDs unique by adding counter suffixes.

    Returns:
        Tuple of (modified workouts, id_counts dict showing how many times each ID appeared)
    """
    # Count occurrences of each ID
    id_counts: dict[str, int] = defaultdict(int)
    for workout in workouts:
        workout_id = workout.get("id", "")
        id_counts[workout_id] += 1

    # Track which IDs need counters and current counter value
    ids_needing_counters = {k: v for k, v in id_counts.items() if v > 1}
    id_counter: dict[str, int] = defaultdict(int)

    # Modify duplicate IDs
    modified_workouts = []
    for workout in workouts:
        original_id = workout["id"]

        if original_id in ids_needing_counters:
            id_counter[original_id] += 1
            counter = id_counter[original_id]

            # First occurrence keeps original ID, subsequent get _2, _3, etc.
            if counter > 1:
                workout["id"] = f"{original_id}_{counter}"

        modified_workouts.append(workout)

    return modified_workouts, dict(id_counts)


def generate_uniqueness_report(
    id_counts: dict[str, int],
    original_count: int,
    final_count: int
) -> str:
    """Generate report showing which IDs were made unique."""

    report_lines = [
        "=" * 80,
        "WORKOUT ID UNIQUENESS REPORT",
        "=" * 80,
        "",
        f"Total workouts processed: {original_count}",
        f"Total workouts after making IDs unique: {final_count}",
        "",
    ]

    # Find duplicate IDs (those that appeared more than once)
    duplicate_ids = {k: v for k, v in id_counts.items() if v > 1}

    if not duplicate_ids:
        report_lines.extend([
            "✓ All workout IDs were already unique!",
            "No changes needed.",
            ""
        ])
    else:
        total_duplicates = sum(v for v in duplicate_ids.values())
        report_lines.extend([
            f"Duplicate IDs found: {len(duplicate_ids)}",
            f"Total workouts affected: {total_duplicates}",
            "",
            "=" * 80,
            "IDs THAT WERE MODIFIED",
            "=" * 80,
            "",
            "Format: original_id (count) → new IDs generated",
            ""
        ])

        # Sort by count (most duplicates first)
        sorted_duplicates = sorted(duplicate_ids.items(), key=lambda x: x[1], reverse=True)

        for original_id, count in sorted_duplicates:
            new_ids = [original_id] + [f"{original_id}_{i}" for i in range(2, count + 1)]
            report_lines.extend([
                f"{original_id} ({count} occurrences):",
                f"  → {', '.join(new_ids)}",
                ""
            ])

    report_lines.extend([
        "=" * 80,
        "VERIFICATION",
        "=" * 80,
        "",
        f"Original unique IDs: {len(id_counts)}",
        f"After modification: {final_count} (should equal total workouts)",
        f"All IDs unique: {'✓ YES' if final_count == original_count else '✗ NO'}",
        "",
        "=" * 80,
        "END OF REPORT",
        "=" * 80
    ])

    return "\n".join(report_lines)


def make_workout_ids_unique(input_path: Path, output_path: Path, report_path: Path) -> None:
    """
    Main function to make all workout IDs unique.

    Args:
        input_path: Path to input workout library
        output_path: Path to save library with unique IDs
        report_path: Path to save uniqueness report
    """
    print(f"Loading workout library from: {input_path}")

    # Load the workout library
    with open(input_path, 'r', encoding='utf-8') as f:
        library = json.load(f)

    workouts = library.get("workouts", [])
    original_count = len(workouts)

    print(f"Found {original_count} workouts")
    print("Analyzing for duplicate IDs...")

    # Make IDs unique
    modified_workouts, id_counts = make_ids_unique(workouts)

    # Verify uniqueness
    final_ids = [w["id"] for w in modified_workouts]
    final_unique_ids = len(set(final_ids))

    print(f"\nOriginal unique IDs: {len(id_counts)}")
    print(f"Final unique IDs: {final_unique_ids}")

    # Count how many IDs were modified
    duplicate_count = sum(1 for count in id_counts.values() if count > 1)
    print(f"IDs that needed modification: {duplicate_count}")

    # Update library
    library["workouts"] = modified_workouts

    # Save modified library
    print(f"\nSaving library with unique IDs to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"✓ Saved {len(modified_workouts)} workouts with unique IDs")

    # Generate and save report
    report = generate_uniqueness_report(id_counts, original_count, final_unique_ids)

    print(f"\nSaving report to: {report_path}")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total workouts: {original_count}")
    print(f"Unique IDs after modification: {final_unique_ids}")
    print(f"All IDs unique: {'✓ YES' if final_unique_ids == original_count else '✗ NO'}")
    print("=" * 80)


def main() -> None:
    """Main entry point."""
    # Set up paths
    project_root = Path(__file__).parent.parent
    input_path = project_root / "data" / "workout_library_deduplicated.json"
    output_path = project_root / "data" / "workout_library_unique_ids.json"
    report_path = project_root / "data" / "id_uniqueness_report.txt"

    # Validate input file exists
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}")
        return

    print("Workout ID Uniqueness Tool")
    print("=" * 80)

    # Make IDs unique
    make_workout_ids_unique(input_path, output_path, report_path)

    print(f"\n✓ ID uniqueness process complete!")
    print(f"\nFiles created:")
    print(f"  • Library with unique IDs: {output_path}")
    print(f"  • Report: {report_path}")


if __name__ == "__main__":
    main()

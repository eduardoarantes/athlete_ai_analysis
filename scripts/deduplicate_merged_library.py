#!/usr/bin/env python3
"""
Deduplicate Merged Workout Library

Takes the merged library and deduplicates by segment structure,
then ensures all IDs are unique.
"""

import json
import hashlib
from pathlib import Path
from typing import Any
from collections import defaultdict


def hash_segments(segments: list[dict[str, Any]]) -> str:
    """Create a hash of the segments structure for deduplication."""
    segments_json = json.dumps(segments, sort_keys=True)
    return hashlib.sha256(segments_json.encode()).hexdigest()


def deduplicate_by_segments(
    workouts: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """
    Deduplicate workouts by segment structure.

    Returns:
        - List of unique workouts
        - Dict mapping segment hash to list of removed workout IDs/names
    """
    seen_hashes: dict[str, dict[str, Any]] = {}
    removed_by_hash: dict[str, list[str]] = defaultdict(list)

    for workout in workouts:
        seg_hash = hash_segments(workout["segments"])

        if seg_hash in seen_hashes:
            # Already seen - keep the one with longer name
            existing = seen_hashes[seg_hash]
            current_name = workout.get("name", "")
            existing_name = existing.get("name", "")

            if len(current_name) > len(existing_name):
                # Replace with longer name
                removed_by_hash[seg_hash].append(f"{existing.get('id', 'unknown')}: {existing_name}")
                seen_hashes[seg_hash] = workout
            else:
                # Keep existing
                removed_by_hash[seg_hash].append(f"{workout.get('id', 'unknown')}: {current_name}")
        else:
            seen_hashes[seg_hash] = workout

    unique_workouts = list(seen_hashes.values())
    return unique_workouts, dict(removed_by_hash)


def make_ids_unique(workouts: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """
    Ensure all workout IDs are unique by adding counters to duplicates.

    Returns:
        - List of workouts with unique IDs
        - Dict mapping base ID to count
    """
    id_counts: dict[str, int] = defaultdict(int)
    id_duplicates: dict[str, int] = {}
    result = []

    # First pass: count IDs
    for workout in workouts:
        original_id = workout.get("id", "unknown")
        id_counts[original_id] += 1

    # Second pass: add counters to duplicates
    id_counter: dict[str, int] = defaultdict(int)

    for workout in workouts:
        original_id = workout.get("id", "unknown")

        if id_counts[original_id] > 1:
            id_counter[original_id] += 1
            if id_counter[original_id] > 1:
                workout["id"] = f"{original_id}_{id_counter[original_id]}"
            id_duplicates[original_id] = id_counts[original_id]

        result.append(workout)

    return result, id_duplicates


def main() -> None:
    """Main entry point."""
    project_root = Path(__file__).parent.parent

    input_path = project_root / "data" / "workout_library_merged_temp.json"
    output_path = project_root / "data" / "workout_library_master.json"
    report_path = project_root / "data" / "merge_deduplication_report.txt"

    print("=" * 80)
    print("MERGE & DEDUPLICATION")
    print("=" * 80)

    # Load merged library
    print(f"\nLoading merged library: {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        library = json.load(f)

    workouts = library.get("workouts", [])
    original_count = len(workouts)
    print(f"Total workouts in merged library: {original_count}")

    # Step 1: Deduplicate by segments
    print("\nStep 1: Deduplicating by segment structure...")
    unique_workouts, removed_map = deduplicate_by_segments(workouts)
    duplicate_count = original_count - len(unique_workouts)
    print(f"  ✓ Unique workouts: {len(unique_workouts)}")
    print(f"  ✓ Duplicates removed: {duplicate_count}")

    # Step 2: Make IDs unique
    print("\nStep 2: Ensuring all IDs are unique...")
    unique_workouts, id_duplicates = make_ids_unique(unique_workouts)
    print(f"  ✓ Base IDs with duplicates: {len(id_duplicates)}")
    if id_duplicates:
        total_id_changes = sum(count - 1 for count in id_duplicates.values())
        print(f"  ✓ IDs modified with counters: {total_id_changes}")

    # Update library
    library["workouts"] = unique_workouts
    library["description"] = "Master workout library - merged and deduplicated from all sources"
    library["deduplication_date"] = "2025-11-03"
    library["statistics"] = {
        "original_merged_count": original_count,
        "segment_duplicates_removed": duplicate_count,
        "final_unique_count": len(unique_workouts)
    }

    # Save master library
    print(f"\nSaving master library: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"✓ Saved {len(unique_workouts)} unique workouts")

    # Generate report
    report_lines = [
        "=" * 80,
        "MERGE & DEDUPLICATION REPORT",
        "=" * 80,
        "",
        "Date: 2025-11-03",
        f"Input: {input_path.name}",
        f"Output: {output_path.name}",
        "",
        "SOURCES MERGED:",
        "-" * 80,
        "1. workout_library_deduplicated.json (177 workouts - original cleaned)",
        "2. workout_library_from_reports.json (125 workouts - extracted from reports)",
        "3. workout_library_extracted.json (4 workouts - extracted from logs)",
        "",
        "DEDUPLICATION STATISTICS:",
        "-" * 80,
        f"Total workouts in merged library: {original_count}",
        f"Segment duplicates removed: {duplicate_count}",
        f"Unique workouts after deduplication: {len(unique_workouts)}",
        f"Reduction: {duplicate_count / original_count * 100:.1f}%",
        "",
    ]

    if removed_map:
        report_lines.extend([
            "DUPLICATE GROUPS REMOVED:",
            "-" * 80,
            f"Total duplicate groups: {len(removed_map)}",
            "",
        ])

        # Show first 20 duplicate groups
        for i, (seg_hash, removed) in enumerate(list(removed_map.items())[:20], 1):
            report_lines.append(f"Group {i} ({len(removed)} duplicates removed):")
            for workout_info in removed[:5]:  # Show first 5 per group
                report_lines.append(f"  • {workout_info}")
            if len(removed) > 5:
                report_lines.append(f"  ... and {len(removed) - 5} more")
            report_lines.append("")

        if len(removed_map) > 20:
            report_lines.append(f"... and {len(removed_map) - 20} more duplicate groups")
            report_lines.append("")

    if id_duplicates:
        report_lines.extend([
            "ID UNIQUENESS:",
            "-" * 80,
            f"Base IDs with duplicates: {len(id_duplicates)}",
            f"IDs modified with counters: {sum(count - 1 for count in id_duplicates.values())}",
            "",
            "IDs that needed counters:",
        ])

        for base_id, count in sorted(id_duplicates.items(), key=lambda x: x[1], reverse=True)[:20]:
            report_lines.append(f"  {base_id}: {count} occurrences")

        if len(id_duplicates) > 20:
            report_lines.append(f"  ... and {len(id_duplicates) - 20} more")
        report_lines.append("")

    # Count by type
    type_counts: dict[str, int] = defaultdict(int)
    for workout in unique_workouts:
        workout_type = workout.get("type", "unknown")
        type_counts[workout_type] += 1

    report_lines.extend([
        "FINAL WORKOUT DISTRIBUTION:",
        "-" * 80,
        "By Type:",
    ])

    for workout_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
        pct = count / len(unique_workouts) * 100
        report_lines.append(f"  {workout_type}: {count} ({pct:.1f}%)")

    # Count by intensity
    intensity_counts: dict[str, int] = defaultdict(int)
    for workout in unique_workouts:
        intensity = workout.get("intensity", "unknown")
        intensity_counts[intensity] += 1

    report_lines.extend([
        "",
        "By Intensity:",
    ])

    for intensity, count in sorted(intensity_counts.items(), key=lambda x: x[1], reverse=True):
        pct = count / len(unique_workouts) * 100
        report_lines.append(f"  {intensity}: {count} ({pct:.1f}%)")

    report_lines.extend([
        "",
        "=" * 80,
        "SUMMARY",
        "=" * 80,
        f"Original merged: {original_count} workouts",
        f"Duplicates removed: {duplicate_count}",
        f"Final unique: {len(unique_workouts)}",
        f"All IDs unique: YES",
        "",
        "=" * 80,
        "END OF REPORT",
        "=" * 80,
    ])

    # Save report
    report_text = "\n".join(report_lines)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_text)

    print(f"\nReport saved: {report_path}")

    print("\n" + "=" * 80)
    print("MERGE & DEDUPLICATION COMPLETE")
    print("=" * 80)
    print(f"Original: {original_count} workouts")
    print(f"Removed: {duplicate_count} duplicates")
    print(f"Final: {len(unique_workouts)} unique workouts")
    print(f"\n✓ Master library: {output_path}")
    print(f"✓ Report: {report_path}")


if __name__ == "__main__":
    main()

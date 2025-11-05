#!/usr/bin/env python3
"""
Extract Workouts from Report Data Files

Scans all report_data.json files in /tmp/cycling_* directories and extracts
workout definitions from training plans. Creates a comprehensive workout library
with all discovered workouts.
"""

import json
import hashlib
from pathlib import Path
from typing import Any
from collections import defaultdict
import re


def hash_segments(segments: list[dict[str, Any]]) -> str:
    """Create a hash of the segments structure for deduplication."""
    segments_json = json.dumps(segments, sort_keys=True)
    return hashlib.sha256(segments_json.encode()).hexdigest()


def generate_workout_name(workout: dict[str, Any]) -> str:
    """Generate a descriptive name from workout segments."""
    segments = workout.get("segments", [])

    # Count interval types
    interval_count = sum(1 for s in segments if s.get("type") == "interval")
    steady_count = sum(1 for s in segments if s.get("type") == "steady")

    # Categorize by power zones
    vo2_max_segments = [s for s in segments if s.get("power_high_pct", 0) >= 105]
    threshold_segments = [s for s in segments if 95 <= s.get("power_high_pct", 0) < 105]
    sweet_spot_segments = [s for s in segments if 88 <= s.get("power_high_pct", 0) < 95]
    tempo_segments = [s for s in segments if 76 <= s.get("power_high_pct", 0) < 88]
    endurance_segments = [s for s in segments if 56 <= s.get("power_high_pct", 0) < 76]

    # Calculate total duration
    total_duration = sum(s.get("duration_min", 0) for s in segments)

    # Generate name based on workout type
    if vo2_max_segments and interval_count >= 2:
        interval_duration = vo2_max_segments[0].get("duration_min", 0)
        name = f"{interval_count}x{int(interval_duration)}min VO2 Max Intervals"
    elif threshold_segments and interval_count >= 2:
        interval_duration = threshold_segments[0].get("duration_min", 0)
        name = f"{interval_count}x{int(interval_duration)}min Threshold Intervals"
    elif sweet_spot_segments and interval_count >= 2:
        interval_duration = sweet_spot_segments[0].get("duration_min", 0)
        name = f"{interval_count}x{int(interval_duration)}min Sweet Spot"
    elif sweet_spot_segments:
        total_ss = sum(s.get("duration_min", 0) for s in sweet_spot_segments)
        name = f"{int(total_ss)}min Sweet Spot"
    elif tempo_segments:
        tempo_duration = sum(s.get("duration_min", 0) for s in tempo_segments)
        name = f"{int(tempo_duration)}min Tempo"
    elif endurance_segments and total_duration >= 90:
        hours = total_duration / 60
        name = f"{hours:.1f}hr Endurance Ride"
    elif endurance_segments:
        name = f"{int(total_duration)}min Base Ride"
    else:
        name = f"{int(total_duration)}min Mixed Workout"

    return name


def infer_workout_type(segments: list[dict[str, Any]]) -> str:
    """Infer workout type from segments."""
    max_power = max((s.get("power_high_pct", 0) for s in segments), default=0)
    interval_count = sum(1 for s in segments if s.get("type") == "interval")

    if max_power >= 105:
        return "vo2max"
    elif max_power >= 95:
        return "threshold"
    elif max_power >= 88:
        return "sweet_spot"
    elif max_power >= 76:
        return "tempo"
    else:
        return "endurance"


def infer_intensity(segments: list[dict[str, Any]]) -> str:
    """Infer workout intensity from segments."""
    max_power = max((s.get("power_high_pct", 0) for s in segments), default=0)

    if max_power >= 100:
        return "hard"
    elif max_power >= 85:
        return "moderate"
    else:
        return "easy"


def normalize_workout(workout: dict[str, Any], source_file: str, week_num: int, day: str) -> dict[str, Any]:
    """
    Normalize a workout to match the library schema.
    """
    normalized = workout.copy()

    # Generate descriptive name
    if "name" not in normalized or not normalized["name"]:
        normalized["name"] = generate_workout_name(normalized)

    # Generate ID from name
    workout_id = normalized["name"].lower().replace(" ", "_").replace("-", "_")
    workout_id = re.sub(r'[^a-z0-9_]', '', workout_id)
    if len(workout_id) > 50:
        seg_hash = hash_segments(normalized["segments"])[:8]
        workout_id = f"{workout_id[:40]}_{seg_hash}"

    normalized["id"] = workout_id

    # Add metadata
    normalized["source_file"] = source_file
    normalized["extracted_from_report"] = True
    normalized["source_week"] = week_num
    normalized["source_day"] = day

    # Calculate base_duration_min
    if "base_duration_min" not in normalized:
        total_duration = sum(s.get("duration_min", 0) for s in normalized["segments"])
        normalized["base_duration_min"] = total_duration

    # Use TSS from report if available, otherwise estimate
    if "base_tss" not in normalized:
        if "tss" in normalized:
            normalized["base_tss"] = normalized["tss"]
        else:
            # Simple estimation
            avg_intensity = 0.7
            normalized["base_tss"] = round(normalized["base_duration_min"] * avg_intensity * 0.8, 1)

    # Infer type and intensity
    if "type" not in normalized:
        normalized["type"] = infer_workout_type(normalized["segments"])

    if "intensity" not in normalized:
        normalized["intensity"] = infer_intensity(normalized["segments"])

    return normalized


def extract_workouts_from_report(report_path: Path) -> list[dict[str, Any]]:
    """
    Extract all workouts from a single report_data.json file.
    """
    workouts = []

    try:
        with open(report_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Navigate to training plan
        if "athletes" not in data or not data["athletes"]:
            return workouts

        for athlete in data["athletes"]:
            if "training_plan" not in athlete:
                continue

            training_plan = athlete["training_plan"]
            if "weekly_plan" not in training_plan:
                continue

            # Extract workouts from each week
            for week in training_plan["weekly_plan"]:
                week_num = week.get("week_number", 0)
                week_workouts = week.get("workouts", [])

                for workout in week_workouts:
                    if "segments" in workout and workout["segments"]:
                        day = workout.get("weekday", "Unknown")
                        normalized = normalize_workout(
                            workout,
                            report_path.name,
                            week_num,
                            day
                        )
                        workouts.append(normalized)

    except Exception as e:
        print(f"Error reading {report_path}: {e}")

    return workouts


def deduplicate_workouts(
    all_workouts: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    """
    Deduplicate workouts by segment structure.
    Returns (unique_workouts, duplicate_count).
    """
    seen_hashes: dict[str, dict[str, Any]] = {}
    duplicates = 0

    for workout in all_workouts:
        seg_hash = hash_segments(workout["segments"])

        if seg_hash in seen_hashes:
            # Already seen - keep the one with longer name
            existing = seen_hashes[seg_hash]
            if len(workout.get("name", "")) > len(existing.get("name", "")):
                seen_hashes[seg_hash] = workout
            duplicates += 1
        else:
            seen_hashes[seg_hash] = workout

    unique_workouts = list(seen_hashes.values())
    return unique_workouts, duplicates


def make_ids_unique(workouts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Ensure all workout IDs are unique by adding counters to duplicates.
    """
    id_counts: dict[str, int] = defaultdict(int)
    result = []

    for workout in workouts:
        original_id = workout["id"]
        id_counts[original_id] += 1

        if id_counts[original_id] > 1:
            workout["id"] = f"{original_id}_{id_counts[original_id]}"

        result.append(workout)

    return result


def main() -> None:
    """Main entry point."""
    project_root = Path(__file__).parent.parent

    # Find all report_data.json files in /tmp/cycling_*
    report_files = list(Path("/tmp").glob("cycling_*/report_data.json"))

    if not report_files:
        print("No report_data.json files found in /tmp/cycling_* directories")
        return

    print("=" * 80)
    print("WORKOUT EXTRACTION FROM REPORT DATA FILES")
    print("=" * 80)
    print(f"\nFound {len(report_files)} report files to process")

    # Extract workouts from all reports
    all_workouts = []
    source_counts: dict[str, int] = {}

    for report_path in report_files:
        print(f"\nProcessing: {report_path}")
        workouts = extract_workouts_from_report(report_path)

        if workouts:
            all_workouts.extend(workouts)
            source_counts[report_path.parent.name] = len(workouts)
            print(f"  ✓ Extracted {len(workouts)} workouts")
        else:
            print(f"  - No workouts found")

    print(f"\n{'=' * 80}")
    print(f"Total workouts extracted: {len(all_workouts)}")

    if len(all_workouts) == 0:
        print("\nNo workouts found in reports. Nothing to save.")
        return

    # Deduplicate by segments
    print("\nDeduplicating by segment structure...")
    unique_workouts, duplicate_count = deduplicate_workouts(all_workouts)
    print(f"  ✓ Unique workouts: {len(unique_workouts)}")
    print(f"  ✓ Duplicates removed: {duplicate_count}")

    # Make IDs unique
    print("\nEnsuring all IDs are unique...")
    unique_workouts = make_ids_unique(unique_workouts)

    # Create library structure
    library = {
        "version": "1.0.0",
        "description": "Workouts extracted from report_data.json files",
        "extraction_date": "2025-11-03",
        "source": "/tmp/cycling_*/report_data.json",
        "workouts": unique_workouts
    }

    # Save library
    output_path = project_root / "data" / "workout_library_from_reports.json"
    print(f"\nSaving extracted library to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"✓ Saved {len(unique_workouts)} workouts")

    # Generate report
    report_path = project_root / "data" / "report_extraction_summary.txt"

    report_lines = [
        "=" * 80,
        "WORKOUT EXTRACTION FROM REPORTS - SUMMARY",
        "=" * 80,
        "",
        f"Extraction Date: 2025-11-03",
        f"Source: /tmp/cycling_*/report_data.json",
        f"Output File: {output_path}",
        "",
        "STATISTICS:",
        "-" * 80,
        f"Report files processed: {len(report_files)}",
        f"Total workouts found: {len(all_workouts)}",
        f"Duplicates removed: {duplicate_count}",
        f"Final unique workouts: {len(unique_workouts)}",
        "",
        "WORKOUTS BY SOURCE:",
        "-" * 80,
    ]

    for source, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True):
        report_lines.append(f"  {source}: {count} workouts")

    # Count by type
    type_counts: dict[str, int] = defaultdict(int)
    for workout in unique_workouts:
        workout_type = workout.get("type", "unknown")
        type_counts[workout_type] += 1

    report_lines.extend([
        "",
        "WORKOUT TYPES:",
        "-" * 80,
    ])

    for workout_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
        report_lines.append(f"  {workout_type}: {count}")

    # Count by intensity
    intensity_counts: dict[str, int] = defaultdict(int)
    for workout in unique_workouts:
        intensity = workout.get("intensity", "unknown")
        intensity_counts[intensity] += 1

    report_lines.extend([
        "",
        "INTENSITY DISTRIBUTION:",
        "-" * 80,
    ])

    for intensity, count in sorted(intensity_counts.items(), key=lambda x: x[1], reverse=True):
        report_lines.append(f"  {intensity}: {count}")

    report_lines.extend([
        "",
        "=" * 80,
        "END OF REPORT",
        "=" * 80,
    ])

    # Save report
    report_text = "\n".join(report_lines)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_text)

    print(f"\nReport saved to: {report_path}")

    print("\n" + "=" * 80)
    print("EXTRACTION COMPLETE")
    print("=" * 80)
    print(f"✓ Extracted library: {output_path}")
    print(f"✓ Summary report: {report_path}")
    print(f"✓ Total workouts: {len(unique_workouts)}")


if __name__ == "__main__":
    main()

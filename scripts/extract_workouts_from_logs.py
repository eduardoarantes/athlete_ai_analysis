#!/usr/bin/env python3
"""
Extract Workouts from LLM Interaction Logs

Scans all session log files in logs/llm_interactions/ and extracts workout definitions
from training plan generation responses. Creates a new workout library file with all
discovered workouts.
"""

import json
import re
from pathlib import Path
from typing import Any
from collections import defaultdict
import hashlib


def hash_segments(segments: list[dict[str, Any]]) -> str:
    """Create a hash of the segments structure for deduplication."""
    segments_json = json.dumps(segments, sort_keys=True)
    return hashlib.sha256(segments_json.encode()).hexdigest()


def extract_workout_from_json(content: str) -> list[dict[str, Any]]:
    """
    Extract workout definitions from JSON content in log messages.

    Looks for training plan JSON structures that contain workout arrays.
    """
    workouts = []

    try:
        # Try to parse the entire content as JSON
        data = json.loads(content)

        # Look for workouts array in various locations
        if isinstance(data, dict):
            # Direct workouts field
            if "workouts" in data and isinstance(data["workouts"], list):
                workouts.extend(data["workouts"])

            # Training plan with weeks
            if "weeks" in data and isinstance(data["weeks"], list):
                for week in data["weeks"]:
                    if "training_days" in week:
                        for day in week["training_days"]:
                            if "workout" in day and day["workout"]:
                                workouts.append(day["workout"])

            # Training plan structure
            if "training_plan" in data and isinstance(data["training_plan"], dict):
                plan = data["training_plan"]
                if "weeks" in plan:
                    for week in plan["weeks"]:
                        if "training_days" in week:
                            for day in week["training_days"]:
                                if "workout" in day and day["workout"]:
                                    workouts.append(day["workout"])

    except json.JSONDecodeError:
        # Try to find JSON objects within the content
        # Look for patterns like {"id": "...", "name": "...", "segments": [...]}
        json_pattern = r'\{[^{}]*"segments"\s*:\s*\[[^\]]*\][^{}]*\}'
        matches = re.finditer(json_pattern, content, re.DOTALL)

        for match in matches:
            try:
                workout_data = json.loads(match.group(0))
                if "segments" in workout_data:
                    workouts.append(workout_data)
            except json.JSONDecodeError:
                continue

    return workouts


def validate_workout(workout: dict[str, Any]) -> bool:
    """
    Validate that a workout has the minimum required fields.
    """
    required_fields = ["segments"]

    # Must have segments
    if not all(field in workout for field in required_fields):
        return False

    # Segments must be a non-empty list
    if not isinstance(workout["segments"], list) or len(workout["segments"]) == 0:
        return False

    # Each segment should have basic structure
    for segment in workout["segments"]:
        if not isinstance(segment, dict):
            return False
        # Must have at least type and duration
        if "type" not in segment and "duration_min" not in segment:
            return False

    return True


def generate_workout_name(workout: dict[str, Any]) -> str:
    """Generate a descriptive name from workout segments."""
    segments = workout.get("segments", [])

    # Try to infer workout type from segments
    interval_count = sum(1 for s in segments if s.get("type") == "interval")
    steady_count = sum(1 for s in segments if s.get("type") == "steady")

    # Check for high-intensity intervals
    high_intensity_segments = [
        s for s in segments
        if s.get("power_high_pct", 0) >= 90
    ]

    # Check for sweet spot
    sweet_spot_segments = [
        s for s in segments
        if 85 <= s.get("power_high_pct", 0) < 95
    ]

    # Check for tempo
    tempo_segments = [
        s for s in segments
        if 75 <= s.get("power_high_pct", 0) < 87
    ]

    # Check for endurance/Z2
    endurance_segments = [
        s for s in segments
        if 56 <= s.get("power_high_pct", 0) < 76
    ]

    # Calculate total duration
    total_duration = sum(s.get("duration_min", 0) for s in segments)

    # Generate name based on workout type
    if high_intensity_segments and interval_count >= 2:
        interval_duration = high_intensity_segments[0].get("duration_min", 0)
        name = f"{interval_count}x{int(interval_duration)}min VO2 Max Intervals"
    elif sweet_spot_segments and interval_count >= 2:
        interval_duration = sweet_spot_segments[0].get("duration_min", 0)
        name = f"{interval_count}x{int(interval_duration)}min Sweet Spot"
    elif tempo_segments:
        tempo_duration = sum(s.get("duration_min", 0) for s in tempo_segments)
        name = f"{int(tempo_duration)}min Tempo"
    elif endurance_segments and total_duration >= 90:
        hours = total_duration / 60
        name = f"{hours:.1f}hr Endurance Ride"
    elif endurance_segments:
        name = f"{int(total_duration)}min Base Ride"
    else:
        # Fallback to duration and intensity
        name = f"{int(total_duration)}min Mixed Workout"

    return name


def normalize_workout(workout: dict[str, Any], source_file: str) -> dict[str, Any]:
    """
    Normalize a workout to match the library schema.
    Adds missing fields and ensures consistent structure.
    """
    normalized = workout.copy()

    # Generate a descriptive name first
    if "name" not in normalized or not normalized["name"] or "workout_" in normalized.get("name", "").lower():
        normalized["name"] = generate_workout_name(normalized)

    # Ensure it has an ID
    if "id" not in normalized or not normalized["id"]:
        # Generate ID from name
        normalized["id"] = normalized["name"].lower().replace(" ", "_").replace("-", "_")
        # Remove special characters
        normalized["id"] = re.sub(r'[^a-z0-9_]', '', normalized["id"])
        # If ID is too long, truncate
        if len(normalized["id"]) > 50:
            seg_hash = hash_segments(normalized["segments"])[:8]
            normalized["id"] = f"{normalized['id'][:40]}_{seg_hash}"

    # If still no valid name, use ID
    if not normalized["name"]:
        normalized["name"] = normalized["id"].replace("_", " ").title()

    # Add source file reference
    normalized["source_file"] = source_file
    normalized["extracted_from_logs"] = True

    # Calculate base duration if not present
    if "base_duration_min" not in normalized:
        total_duration = sum(
            seg.get("duration_min", 0)
            for seg in normalized["segments"]
        )
        normalized["base_duration_min"] = total_duration

    # Calculate approximate TSS if not present
    if "base_tss" not in normalized and "base_duration_min" in normalized:
        # Simple TSS estimation based on duration and intensity
        # This is a rough estimate and should be recalculated properly
        avg_intensity = 0.7  # Default moderate intensity
        if "intensity" in normalized:
            intensity_map = {"easy": 0.5, "moderate": 0.7, "hard": 0.85, "threshold": 0.95}
            avg_intensity = intensity_map.get(normalized["intensity"], 0.7)

        normalized["base_tss"] = round(normalized["base_duration_min"] * avg_intensity * 0.8, 1)

    # Ensure type field
    if "type" not in normalized:
        normalized["type"] = "endurance"  # Default

    # Ensure intensity field
    if "intensity" not in normalized:
        # Infer from segments
        intensities = []
        for seg in normalized["segments"]:
            if seg.get("power_high_pct", 0) >= 90:
                intensities.append("hard")
            elif seg.get("power_high_pct", 0) >= 70:
                intensities.append("moderate")
            else:
                intensities.append("easy")

        if intensities:
            # Use most common intensity
            normalized["intensity"] = max(set(intensities), key=intensities.count)
        else:
            normalized["intensity"] = "moderate"

    return normalized


def extract_workouts_from_log_file(log_file: Path) -> list[dict[str, Any]]:
    """
    Extract all workouts from a single JSONL log file.
    """
    workouts = []

    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)

                    # Check output content
                    if "output" in entry and "content" in entry["output"]:
                        content = entry["output"]["content"]
                        if content and isinstance(content, str):
                            extracted = extract_workout_from_json(content)
                            workouts.extend(extracted)

                    # Check input messages
                    if "input" in entry and "messages" in entry["input"]:
                        for message in entry["input"]["messages"]:
                            if "content" in message and message["content"]:
                                extracted = extract_workout_from_json(message["content"])
                                workouts.extend(extracted)

                except json.JSONDecodeError as e:
                    print(f"Warning: Could not parse line {line_num} in {log_file.name}: {e}")
                    continue

    except Exception as e:
        print(f"Error reading {log_file}: {e}")

    return workouts


def process_all_logs(logs_dir: Path) -> dict[str, list[dict[str, Any]]]:
    """
    Process all log files and extract workouts.

    Returns a dict mapping source file names to lists of workouts found.
    """
    results = defaultdict(list)

    log_files = list(logs_dir.glob("*.jsonl"))
    print(f"Found {len(log_files)} log files to process")

    for log_file in log_files:
        print(f"\nProcessing: {log_file.name}")
        workouts = extract_workouts_from_log_file(log_file)

        # Validate and normalize workouts
        valid_workouts = []
        for workout in workouts:
            if validate_workout(workout):
                normalized = normalize_workout(workout, log_file.name)
                valid_workouts.append(normalized)

        if valid_workouts:
            results[log_file.name] = valid_workouts
            print(f"  ✓ Extracted {len(valid_workouts)} valid workouts")
        else:
            print(f"  - No valid workouts found")

    return results


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
    logs_dir = project_root / "logs" / "llm_interactions"
    output_path = project_root / "data" / "workout_library_extracted.json"
    report_path = project_root / "data" / "extraction_report.txt"

    if not logs_dir.exists():
        print(f"ERROR: Logs directory not found: {logs_dir}")
        return

    print("=" * 80)
    print("WORKOUT EXTRACTION FROM LLM INTERACTION LOGS")
    print("=" * 80)
    print(f"\nScanning directory: {logs_dir}")

    # Extract workouts from all logs
    results = process_all_logs(logs_dir)

    # Combine all workouts
    all_workouts = []
    for source_file, workouts in results.items():
        all_workouts.extend(workouts)

    print(f"\n{'=' * 80}")
    print(f"Total workouts extracted: {len(all_workouts)}")

    if len(all_workouts) == 0:
        print("\nNo workouts found in logs. Nothing to save.")
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
        "description": "Workouts extracted from LLM interaction logs",
        "extraction_date": "2025-11-03",
        "source": "logs/llm_interactions/*.jsonl",
        "workouts": unique_workouts
    }

    # Save library
    print(f"\nSaving extracted library to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"✓ Saved {len(unique_workouts)} workouts")

    # Generate report
    report_lines = [
        "=" * 80,
        "WORKOUT EXTRACTION REPORT",
        "=" * 80,
        "",
        f"Extraction Date: 2025-11-03",
        f"Source Directory: logs/llm_interactions/",
        f"Output File: {output_path}",
        "",
        "STATISTICS:",
        "-" * 80,
        f"Log files processed: {len(results)}",
        f"Total workouts found: {len(all_workouts)}",
        f"Duplicates removed: {duplicate_count}",
        f"Final unique workouts: {len(unique_workouts)}",
        "",
        "WORKOUTS BY SOURCE FILE:",
        "-" * 80,
    ]

    for source_file, workouts in sorted(results.items(), key=lambda x: len(x[1]), reverse=True):
        report_lines.append(f"  {source_file}: {len(workouts)} workouts")

    report_lines.extend([
        "",
        "WORKOUT TYPES:",
        "-" * 80,
    ])

    # Count by type
    type_counts: dict[str, int] = defaultdict(int)
    for workout in unique_workouts:
        workout_type = workout.get("type", "unknown")
        type_counts[workout_type] += 1

    for workout_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
        report_lines.append(f"  {workout_type}: {count}")

    report_lines.extend([
        "",
        "INTENSITY DISTRIBUTION:",
        "-" * 80,
    ])

    # Count by intensity
    intensity_counts: dict[str, int] = defaultdict(int)
    for workout in unique_workouts:
        intensity = workout.get("intensity", "unknown")
        intensity_counts[intensity] += 1

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
    print(f"✓ Extraction report: {report_path}")
    print(f"✓ Total workouts: {len(unique_workouts)}")


if __name__ == "__main__":
    main()

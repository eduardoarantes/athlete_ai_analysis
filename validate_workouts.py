#!/usr/bin/env python3
"""
Workout Library Validation Script
Validates workouts against professional cycling coach criteria
"""

import json
from pathlib import Path
from typing import Any
from collections import defaultdict

# Define professional criteria
CRITERIA = {
    "intensity_zones": {
        "recovery": {"ftp_range": (0, 55), "zones": ["recovery", "active recovery"]},
        "endurance": {"ftp_range": (56, 75), "zones": ["endurance", "zone 2", "z2"]},
        "tempo": {"ftp_range": (76, 87), "zones": ["tempo", "zone 3", "z3"]},
        "sweet_spot": {"ftp_range": (88, 94), "zones": ["sweet spot", "sweetspot", "ss"]},
        "threshold": {"ftp_range": (95, 105), "zones": ["threshold", "ftp", "zone 4", "z4"]},
        "vo2max": {"ftp_range": (106, 120), "zones": ["vo2max", "vo2", "zone 5", "z5"]},
        "anaerobic": {"ftp_range": (121, 150), "zones": ["anaerobic", "zone 6", "z6"]},
        "sprint": {"ftp_range": (151, 300), "zones": ["sprint", "zone 7", "z7", "neuromuscular"]},
        "mixed": {"ftp_range": (0, 300), "zones": ["mixed", "varied"]},
    },

    "type_intensity_mapping": {
        "endurance": ["recovery", "endurance"],
        "tempo": ["tempo", "endurance"],
        "sweet_spot": ["sweet_spot", "tempo"],
        "threshold": ["threshold", "sweet_spot"],
        "vo2max": ["vo2max", "threshold"],
        "anaerobic": ["anaerobic", "vo2max"],
        "sprint": ["sprint", "anaerobic"],
        "recovery": ["recovery"],
        "mixed": ["mixed", "endurance", "tempo", "sweet_spot", "threshold", "vo2max"],
    },

    "weekday_workout_types": {
        "Monday": ["recovery", "endurance"],
        "Tuesday": ["vo2max", "threshold", "sweet_spot", "anaerobic", "sprint", "tempo"],
        "Wednesday": ["tempo", "sweet_spot", "threshold", "vo2max"],
        "Thursday": ["recovery", "endurance", "tempo"],
        "Friday": ["recovery", "endurance", "mixed"],
        "Saturday": ["endurance", "tempo", "sweet_spot", "threshold", "vo2max", "anaerobic", "sprint", "mixed"],
        "Sunday": ["endurance", "recovery", "tempo", "mixed"],
    },

    "phase_workout_types": {
        "Base": ["endurance", "tempo", "recovery"],
        "Build": ["sweet_spot", "threshold", "tempo", "vo2max"],
        "Peak": ["vo2max", "threshold", "anaerobic", "sprint", "mixed"],
        "Race": ["mixed", "recovery", "vo2max", "threshold"],
        "Recovery": ["recovery", "endurance"],
        "Transition": ["endurance", "recovery", "mixed"],
    },

    "phase_intensities": {
        "Base": ["recovery", "endurance", "tempo"],
        "Build": ["tempo", "sweet_spot", "threshold"],
        "Peak": ["threshold", "vo2max", "anaerobic", "sprint"],
        "Race": ["mixed", "recovery", "vo2max", "threshold"],
        "Recovery": ["recovery", "endurance"],
        "Transition": ["recovery", "endurance"],
    }
}

def normalize_string(s: str) -> str:
    """Normalize strings for comparison."""
    return s.lower().strip().replace("_", " ").replace("-", " ")

def calculate_workout_intensity(segments: list[dict]) -> str:
    """Calculate actual intensity from workout segments."""
    if not segments:
        return "unknown"

    # Get power zones from main work segments (exclude warmup/cooldown)
    work_segments = [s for s in segments if s.get("type") not in ["warmup", "cooldown", "rest"]]

    if not work_segments:
        return "recovery"

    # Find max power percentage
    max_power = 0
    total_time = 0
    weighted_power = 0

    for seg in work_segments:
        power_high = seg.get("power_high_pct", seg.get("power_low_pct", 0))
        duration = seg.get("duration_min", 0)

        max_power = max(max_power, power_high)
        weighted_power += power_high * duration
        total_time += duration

    avg_power = weighted_power / total_time if total_time > 0 else 0

    # Check if mixed (wide range of intensities)
    power_range = max([s.get("power_high_pct", 0) for s in work_segments]) - \
                  min([s.get("power_low_pct", 100) for s in work_segments])

    if power_range > 40:  # More than 40% FTP range = mixed
        return "mixed"

    # Classify by average power
    for intensity, info in CRITERIA["intensity_zones"].items():
        low, high = info["ftp_range"]
        if low <= avg_power <= high:
            return intensity

    return "unknown"

def validate_workout(workout: dict) -> dict[str, list[str]]:
    """Validate a single workout against criteria."""
    issues = defaultdict(list)

    workout_id = workout.get("id", "unknown")
    workout_type = normalize_string(workout.get("type", ""))
    workout_intensity = normalize_string(workout.get("intensity", ""))
    suitable_phases = [normalize_string(p) for p in workout.get("suitable_phases", [])]
    suitable_weekdays = [normalize_string(d) for d in workout.get("suitable_weekdays", [])]
    segments = workout.get("segments", [])

    # Calculate actual intensity from segments
    calculated_intensity = calculate_workout_intensity(segments)

    # 1. Validate type vs intensity alignment
    expected_intensities = CRITERIA["type_intensity_mapping"].get(workout_type, [])
    if expected_intensities and workout_intensity not in expected_intensities:
        issues["type_intensity_mismatch"].append(
            f"Type '{workout_type}' typically has intensity {expected_intensities}, "
            f"but workout has '{workout_intensity}'"
        )

    # 2. Validate calculated intensity vs stated intensity
    if calculated_intensity != "unknown" and calculated_intensity != workout_intensity:
        issues["calculated_intensity_mismatch"].append(
            f"Stated intensity '{workout_intensity}' but calculated intensity is '{calculated_intensity}' "
            f"based on segments"
        )

    # 3. Validate weekdays appropriateness
    for weekday in suitable_weekdays:
        weekday_cap = weekday.capitalize()
        appropriate_types = CRITERIA["weekday_workout_types"].get(weekday_cap, [])
        if workout_type not in appropriate_types:
            issues["inappropriate_weekday"].append(
                f"Type '{workout_type}' is not typically appropriate for {weekday_cap}. "
                f"Expected types: {appropriate_types}"
            )

    # 4. Validate phases appropriateness
    for phase in suitable_phases:
        phase_cap = phase.capitalize()
        appropriate_types = CRITERIA["phase_workout_types"].get(phase_cap, [])
        appropriate_intensities = CRITERIA["phase_intensities"].get(phase_cap, [])

        if workout_type not in appropriate_types:
            issues["inappropriate_phase_type"].append(
                f"Type '{workout_type}' is not typically appropriate for {phase_cap} phase. "
                f"Expected types: {appropriate_types}"
            )

        if workout_intensity not in appropriate_intensities:
            issues["inappropriate_phase_intensity"].append(
                f"Intensity '{workout_intensity}' is not typically appropriate for {phase_cap} phase. "
                f"Expected intensities: {appropriate_intensities}"
            )

    # 5. Check for missing required fields
    if not workout.get("suitable_weekdays"):
        issues["missing_field"].append("Missing 'suitable_weekdays'")
    if not workout.get("suitable_phases"):
        issues["missing_field"].append("Missing 'suitable_phases'")
    if not workout.get("type"):
        issues["missing_field"].append("Missing 'type'")
    if not workout.get("intensity"):
        issues["missing_field"].append("Missing 'intensity'")

    # 6. Validate phase/weekday case consistency
    for phase in workout.get("suitable_phases", []):
        if phase != phase.capitalize():
            issues["case_inconsistency"].append(
                f"Phase '{phase}' should be capitalized as '{phase.capitalize()}'"
            )

    for weekday in workout.get("suitable_weekdays", []):
        if weekday != weekday.capitalize():
            issues["case_inconsistency"].append(
                f"Weekday '{weekday}' should be capitalized as '{weekday.capitalize()}'"
            )

    return dict(issues)

def main():
    """Main validation function."""
    library_path = Path("data/workout_library.json")

    if not library_path.exists():
        print(f"Error: {library_path} not found")
        return

    with open(library_path) as f:
        data = json.load(f)

    workouts = data.get("workouts", [])
    print(f"Analyzing {len(workouts)} workouts...\n")

    # Collect all issues
    all_issues = {}
    issue_counts = defaultdict(int)

    for workout in workouts:
        workout_id = workout.get("id", "unknown")
        issues = validate_workout(workout)

        if issues:
            all_issues[workout_id] = {
                "name": workout.get("name", "Unknown"),
                "type": workout.get("type", "unknown"),
                "intensity": workout.get("intensity", "unknown"),
                "issues": issues
            }

            for issue_type in issues.keys():
                issue_counts[issue_type] += 1

    # Generate report
    print("=" * 80)
    print("WORKOUT LIBRARY VALIDATION REPORT")
    print("=" * 80)
    print()

    print(f"Total workouts analyzed: {len(workouts)}")
    print(f"Workouts with issues: {len(all_issues)}")
    print(f"Workouts passing validation: {len(workouts) - len(all_issues)}")
    print()

    print("=" * 80)
    print("ISSUE SUMMARY")
    print("=" * 80)
    for issue_type, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {issue_type}: {count} occurrences")
    print()

    print("=" * 80)
    print("DETAILED ISSUES BY WORKOUT")
    print("=" * 80)
    print()

    for workout_id, workout_info in sorted(all_issues.items()):
        print(f"Workout: {workout_info['name']} (ID: {workout_id})")
        print(f"  Type: {workout_info['type']}")
        print(f"  Intensity: {workout_info['intensity']}")
        print(f"  Issues found:")

        for issue_type, issue_list in workout_info['issues'].items():
            print(f"\n  [{issue_type.upper().replace('_', ' ')}]")
            for issue in issue_list:
                print(f"    - {issue}")
        print()
        print("-" * 80)
        print()

    # Save report to file
    report_path = Path("data/workout_validation_report.txt")
    with open(report_path, "w") as f:
        f.write("=" * 80 + "\n")
        f.write("WORKOUT LIBRARY VALIDATION REPORT\n")
        f.write("=" * 80 + "\n\n")

        f.write(f"Total workouts analyzed: {len(workouts)}\n")
        f.write(f"Workouts with issues: {len(all_issues)}\n")
        f.write(f"Workouts passing validation: {len(workouts) - len(all_issues)}\n\n")

        f.write("=" * 80 + "\n")
        f.write("ISSUE SUMMARY\n")
        f.write("=" * 80 + "\n")
        for issue_type, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
            f.write(f"  {issue_type}: {count} occurrences\n")
        f.write("\n")

        f.write("=" * 80 + "\n")
        f.write("DETAILED ISSUES BY WORKOUT\n")
        f.write("=" * 80 + "\n\n")

        for workout_id, workout_info in sorted(all_issues.items()):
            f.write(f"Workout: {workout_info['name']} (ID: {workout_id})\n")
            f.write(f"  Type: {workout_info['type']}\n")
            f.write(f"  Intensity: {workout_info['intensity']}\n")
            f.write(f"  Issues found:\n")

            for issue_type, issue_list in workout_info['issues'].items():
                f.write(f"\n  [{issue_type.upper().replace('_', ' ')}]\n")
                for issue in issue_list:
                    f.write(f"    - {issue}\n")
            f.write("\n")
            f.write("-" * 80 + "\n\n")

    print(f"\nReport saved to: {report_path}")

if __name__ == "__main__":
    main()

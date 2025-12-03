#!/usr/bin/env python3
"""
Compare Planned vs Executed FIT Workouts

This script compares a planned workout FIT file against an executed workout FIT file
and provides compliance metrics and recommendations.

Usage:
    python compare_fit_workouts.py \\
        --planned planned_2025-11-19_MinuteMons.fit \\
        --executed executed_2025-11-19_MinuteMons.fit \\
        --ftp 250
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from cycling_ai.core.workout_comparison import (
    ActualWorkout,
    ComplianceScorer,
    DeviationDetector,
    PlannedWorkout,
    RecommendationEngine,
)
from cycling_ai.parsers.fit_workout_parser import FitWorkoutParser
from cycling_ai.utils.fit_parser import parse_fit_zones


import json

def parse_planned_json(json_path: Path) -> PlannedWorkout:
    """
    Parse planned workout JSON file (library format).
    
    Args:
        json_path: Path to planned workout JSON file
        
    Returns:
        PlannedWorkout object
    """
    with open(json_path, "r") as f:
        library_format = json.load(f)
        
    # Extract date from filename if possible, otherwise use today
    # Format: planned_YYYY-MM-DD_Name.json or just Name.json
    try:
        filename = json_path.stem
        if "planned_" in filename and "_" in filename:
            date_str = filename.split("_")[1]
            workout_date = datetime.strptime(date_str, "%Y-%m-%d")
        else:
            workout_date = datetime.now()
    except Exception:
        workout_date = datetime.now()
        
    # Calculate zone distribution from segments
    zone_distribution: dict[str, float] = {}
    
    def add_to_zones(segment: dict, multiplier: int = 1):
        """Helper to add segment duration to zones."""
        duration = segment.get("duration_min", 0) * multiplier
        
        # Map power percentage to zone
        power_low = segment.get("power_low_pct", 0)
        power_high = segment.get("power_high_pct", 0)
        power_pct = (power_low + power_high) / 2 if power_low and power_high else power_high
        
        if power_pct <= 55:
            zone = "Z1"
        elif power_pct <= 75:
            zone = "Z2"
        elif power_pct <= 90:
            zone = "Z3"
        elif power_pct <= 105:
            zone = "Z4"
        elif power_pct <= 120:
            zone = "Z5"
        else:
            zone = "Z6"
        
        zone_distribution[zone] = zone_distribution.get(zone, 0) + duration

    for segment in library_format.get("segments", []):
        if segment.get("type") == "interval":
            # Handle interval structure
            sets = segment.get("sets", 1)
            if "work" in segment:
                add_to_zones(segment["work"], sets)
            if "recovery" in segment:
                add_to_zones(segment["recovery"], sets)
        else:
            # Simple segment
            add_to_zones(segment)
            
    return PlannedWorkout(
        date=workout_date,
        weekday=workout_date.strftime("%A"),
        workout_type=library_format.get("type", "endurance"),
        total_duration_minutes=float(library_format.get("base_duration_min", 0)),
        planned_tss=float(library_format.get("base_tss", 0)),
        zone_distribution=zone_distribution,
        segments=library_format.get("segments", []),
        description=library_format.get("name", ""),
    )


def parse_planned_fit(fit_path: Path, ftp: float) -> PlannedWorkout:
    """
    Parse planned workout FIT file.
    
    Args:
        fit_path: Path to planned workout FIT file
        ftp: Functional Threshold Power
        
    Returns:
        PlannedWorkout object
    """
    parser = FitWorkoutParser()
    parsed = parser.parse_workout_file(fit_path=str(fit_path), ftp=ftp)
    library_format = parsed.to_library_format()
    
    # Extract date from filename (format: planned_YYYY-MM-DD_Name.fit)
    filename = fit_path.stem
    try:
        date_str = filename.split("_")[1]  # Get YYYY-MM-DD part
        workout_date = datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        workout_date = datetime.now()
    
    # Calculate zone distribution from segments
    zone_distribution: dict[str, float] = {}
    
    def add_to_zones(segment: dict, multiplier: int = 1):
        """Helper to add segment duration to zones."""
        duration = segment.get("duration_min", 0) * multiplier
        
        # Map power percentage to zone
        # Use average of high/low if available, otherwise just high
        power_low = segment.get("power_low_pct", 0)
        power_high = segment.get("power_high_pct", 0)
        power_pct = (power_low + power_high) / 2 if power_low and power_high else power_high
        
        if power_pct <= 55:
            zone = "Z1"
        elif power_pct <= 75:
            zone = "Z2"
        elif power_pct <= 90:
            zone = "Z3"
        elif power_pct <= 105:
            zone = "Z4"
        elif power_pct <= 120:
            zone = "Z5"
        else:
            zone = "Z6"
        
        zone_distribution[zone] = zone_distribution.get(zone, 0) + duration

    for segment in library_format.get("segments", []):
        if segment.get("type") == "interval":
            # Handle interval structure
            sets = segment.get("sets", 1)
            if "work" in segment:
                add_to_zones(segment["work"], sets)
            if "recovery" in segment:
                add_to_zones(segment["recovery"], sets)
        else:
            # Simple segment
            add_to_zones(segment)
    
    return PlannedWorkout(
        date=workout_date,
        weekday=workout_date.strftime("%A"),
        workout_type=library_format.get("type", "endurance"),
        total_duration_minutes=float(library_format.get("base_duration_min", 0)),
        planned_tss=float(library_format.get("base_tss", 0)),
        zone_distribution=zone_distribution,
        segments=library_format.get("segments", []),
        description=library_format.get("name", ""),
    )


def parse_executed_fit(fit_path: Path, ftp: float) -> ActualWorkout:
    """
    Parse executed workout FIT file.
    
    Args:
        fit_path: Path to executed workout FIT file
        ftp: Functional Threshold Power
        
    Returns:
        ActualWorkout object
    """
    # Parse zones from executed FIT file
    zone_data = parse_fit_zones(fit_path, ftp)
    
    if not zone_data.get("success"):
        raise ValueError(f"Failed to parse FIT file: {zone_data.get('error')}")
    
    # Extract date from filename
    filename = fit_path.stem
    try:
        # Try to find a date pattern YYYY-MM-DD
        import re
        match = re.search(r"(\d{4}-\d{2}-\d{2})", filename)
        if match:
            date_str = match.group(1)
            workout_date = datetime.strptime(date_str, "%Y-%m-%d")
        else:
            # Fallback to today if no date found
            workout_date = datetime.now()
    except Exception:
        workout_date = datetime.now()
    
    # Convert seconds to minutes for zone distribution
    zone_distribution = {
        "Z1": zone_data["z1_active_recovery"] / 60.0,
        "Z2": zone_data["z2_endurance"] / 60.0,
        "Z3": zone_data["z3_tempo"] / 60.0,
        "Z4": zone_data["z4_threshold"] / 60.0,
        "Z5": zone_data["z5_vo2max"] / 60.0,
        "Z6": zone_data["z6_anaerobic"] / 60.0,
    }
    
    # Calculate duration from total power seconds
    duration_minutes = zone_data["total_power_seconds"] / 60.0
    
    # Estimate TSS from NP if available, otherwise from average power
    if zone_data["normalized_power"] > 0:
        intensity_factor = zone_data["normalized_power"] / ftp
        tss = (duration_minutes * zone_data["normalized_power"] * intensity_factor) / (ftp * 36)
    else:
        tss = (duration_minutes * zone_data["avg_power"]) / (ftp * 36)
    
    return ActualWorkout(
        date=workout_date,
        activity_name=fit_path.stem,  # Use filename as activity name
        activity_type="Ride",
        duration_minutes=duration_minutes,
        zone_distribution=zone_distribution,
        average_power=int(zone_data["avg_power"]) if zone_data["avg_power"] > 0 else None,
        normalized_power=int(zone_data["normalized_power"]) if zone_data["normalized_power"] > 0 else None,
        actual_tss=tss,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Compare planned vs executed FIT workout files"
    )
    parser.add_argument(
        "--planned",
        type=Path,
        required=True,
        help="Path to planned workout file (FIT or JSON)",
    )
    parser.add_argument(
        "--executed",
        type=Path,
        required=True,
        help="Path to executed workout FIT file",
    )
    parser.add_argument(
        "--ftp",
        type=float,
        required=True,
        help="Functional Threshold Power in watts",
    )
    
    args = parser.parse_args()
    
    # Validate files exist
    if not args.planned.exists():
        print(f"❌ Error: Planned workout file not found: {args.planned}")
        return 1
    
    if not args.executed.exists():
        print(f"❌ Error: Executed workout file not found: {args.executed}")
        return 1
    
    print(f"\n🔍 Comparing Workouts")
    print(f"{'='*60}")
    print(f"Planned:  {args.planned.name}")
    print(f"Executed: {args.executed.name}")
    print(f"FTP:      {args.ftp}W")
    print(f"{'='*60}\n")
    
    try:
        # Parse planned workout
        print("📖 Parsing planned workout...")
        if args.planned.suffix.lower() == ".json":
            planned = parse_planned_json(args.planned)
        else:
            planned = parse_planned_fit(args.planned, args.ftp)
        
        print("📖 Parsing executed workout...")
        executed = parse_executed_fit(args.executed, args.ftp)
        
        # Calculate compliance
        print("📊 Calculating compliance...\n")
        scorer = ComplianceScorer()
        metrics = scorer.calculate_compliance_score(planned, executed, args.ftp)
        
        # Detect deviations
        detector = DeviationDetector()
        deviations = detector.detect_deviations(planned, executed, metrics)
        
        # Generate recommendation
        recommender = RecommendationEngine()
        recommendation = recommender.generate_recommendation(
            planned, executed, metrics, deviations
        )
        
        # Display results
        print(f"{'='*60}")
        print(f"📈 COMPLIANCE REPORT")
        print(f"{'='*60}\n")
        
        print(f"✅ Completed: {metrics.completed}")
        print(f"🎯 Overall Compliance: {metrics.compliance_score:.1f}%\n")
        
        print(f"📊 Breakdown:")
        print(f"  • Duration:  {metrics.duration_score:.1f}% "
              f"({executed.duration_minutes:.0f} min / {planned.total_duration_minutes:.0f} min planned)")
        print(f"  • Intensity: {metrics.intensity_score:.1f}%")
        print(f"  • TSS:       {metrics.tss_score:.1f}% "
              f"({executed.actual_tss:.0f} / {planned.planned_tss:.0f} planned)\n")
        
        if deviations:
            print(f"⚠️  Deviations Detected:")
            for dev in deviations:
                print(f"  • {dev}")
            print()
        
        print(f"💡 Recommendation:")
        print(f"  {recommendation}\n")
        
        # Zone comparison
        print(f"{'='*60}")
        print(f"🎨 ZONE DISTRIBUTION COMPARISON")
        print(f"{'='*60}\n")
        print(f"{'Zone':<6} {'Planned':<12} {'Actual':<12} {'Diff':<10}")
        print(f"{'-'*40}")
        
        for zone in ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6"]:
            planned_min = planned.zone_distribution.get(zone, 0)
            actual_min = executed.zone_distribution.get(zone, 0)
            diff = actual_min - planned_min
            diff_str = f"{diff:+.1f} min" if diff != 0 else "—"
            
            print(f"{zone:<6} {planned_min:>6.1f} min   {actual_min:>6.1f} min   {diff_str:<10}")
        
        print(f"\n{'='*60}\n")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())

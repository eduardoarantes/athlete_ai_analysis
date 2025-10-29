#!/usr/bin/env python3
"""
Test integrated report data preparation.

Simulates what Phase 5 of the workflow does.
"""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from cycling_ai.tools.report_data_extractor import (
    extract_from_session_file,
    create_report_data,
)

def main():
    """Test integrated report preparation."""
    # Use existing session file
    session_path = Path("logs/llm_interactions/session_20251029_100250.jsonl")
    profile_path = Path("/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json")
    output_dir = Path("/tmp/cycling_DEBUG_WITH_LOGGING_1")
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("INTEGRATED REPORT DATA PREPARATION TEST")
    print("=" * 60)
    print()
    print(f"Session file: {session_path}")
    print(f"Profile: {profile_path}")
    print(f"Output dir: {output_dir}")
    print()

    # Step 1: Extract athlete data
    print("Phase 5: Report Data Preparation")
    print("-" * 60)
    print("Extracting training plan from session...")

    athlete_data = extract_from_session_file(
        session_path=session_path,
        athlete_profile_path=profile_path,
    )

    if not athlete_data:
        print("✗ Failed to extract training plan")
        sys.exit(1)

    print(f"✓ Extracted data for {athlete_data['name']}")
    print(f"  ID: {athlete_data['id']}")
    print(f"  FTP: {athlete_data['profile']['ftp']}W → {athlete_data['training_plan']['target_ftp']}W")
    print(f"  Weeks: {athlete_data['training_plan']['total_weeks']}")
    print()

    # Step 2: Create report data structure
    print("Creating report data structure...")
    generator_info = {
        "tool": "cycling-ai",
        "version": "0.1.0",
        "command": "generate (integrated workflow)",
    }

    report_data = create_report_data([athlete_data], generator_info)
    print(f"✓ Report data created with {len(report_data['athletes'])} athlete(s)")
    print()

    # Step 3: Save to output directory
    output_path = output_dir / "report_data.json"
    print(f"Saving report data to: {output_path}")

    with open(output_path, "w") as f:
        json.dump(report_data, f, indent=2)

    print(f"✓ Report data saved ({output_path.stat().st_size:,} bytes)")
    print()

    # Step 4: Copy HTML viewer template
    import shutil
    template_path = Path(__file__).parent.parent / "templates" / "training_plan_viewer.html"
    viewer_output_path = output_dir / "training_plan_viewer.html"

    print(f"Copying HTML viewer to: {viewer_output_path}")
    if template_path.exists():
        shutil.copy2(template_path, viewer_output_path)
        print(f"✓ HTML viewer copied ({viewer_output_path.stat().st_size:,} bytes)")
    else:
        print(f"✗ Template not found at {template_path}")
    print()

    # Summary
    print("=" * 60)
    print("PHASE 5 COMPLETE")
    print("=" * 60)
    print()
    print("Output files:")
    print(f"  - {output_path}")
    print(f"  - {viewer_output_path}")
    print()
    print("Summary:")
    print(f"  Athlete: {athlete_data['name']} (ID: {athlete_data['id']})")
    print(f"  FTP: {athlete_data['profile']['ftp']}W → {athlete_data['training_plan']['target_ftp']}W")
    print(f"  Training plan: {athlete_data['training_plan']['total_weeks']} weeks")
    print(f"  Workouts: {sum(len(w['workouts']) for w in athlete_data['training_plan']['weekly_workouts'])} total")
    print()
    print("✓ Integrated workflow Phase 5 completed successfully!")
    print()
    print("Next steps:")
    print("  1. Open HTML viewer")
    print("  2. Load report_data.json")
    print("  3. View interactive training calendar")

if __name__ == '__main__':
    main()

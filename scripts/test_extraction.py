#!/usr/bin/env python3
"""
Test script to verify data extraction from interaction logs.
"""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from cycling_ai.tools.report_data_extractor import extract_from_session_file

def main():
    """Test extraction."""
    session_path = Path("logs/llm_interactions/session_20251029_100250.jsonl")
    profile_path = Path("/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json")

    print(f"Testing extraction from:")
    print(f"  Session: {session_path}")
    print(f"  Profile: {profile_path}")
    print()

    # Test extraction
    athlete_data = extract_from_session_file(session_path, profile_path)

    if athlete_data:
        print("✓ Extraction successful!")
        print()
        print("Athlete Data:")
        print(f"  ID: {athlete_data['id']}")
        print(f"  Name: {athlete_data['name']}")
        print(f"  FTP: {athlete_data['profile']['ftp']}W")
        print(f"  Target FTP: {athlete_data['training_plan']['target_ftp']}W")
        print(f"  Weeks: {athlete_data['training_plan']['total_weeks']}")
        print(f"  Workouts: {len(athlete_data['training_plan']['weekly_workouts'])} weeks")

        # Show first workout
        if athlete_data['training_plan']['weekly_workouts']:
            week1 = athlete_data['training_plan']['weekly_workouts'][0]
            print(f"\n  Week 1 ({week1['phase']}):")
            for day, workout in week1['workouts'].items():
                print(f"    {day}: {workout['name']} ({workout['total_duration_min']}min)")

        # Save to file for inspection
        output_path = Path("logs/test_extraction.json")
        with open(output_path, 'w') as f:
            json.dump(athlete_data, f, indent=2)
        print(f"\n✓ Full data saved to: {output_path}")

    else:
        print("✗ Extraction failed")
        sys.exit(1)

if __name__ == '__main__':
    main()

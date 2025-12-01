#!/usr/bin/env python3
"""
Complete training plan by running Phase 3b (workout selection from library).

This script takes an overview JSON file and selects specific workouts
for each day from the workout library.

Usage:
    python complete_training_plan.py <plan_id>

Example:
    python complete_training_plan.py 6ca04a86-20e8-4dc3-9a0c-7d7925993370
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from cycling_ai.orchestration.phases.training_planning_library import (
    LibraryBasedTrainingPlanningWeeks,
)


def main():
    if len(sys.argv) < 2:
        print("Usage: python complete_training_plan.py <plan_id>")
        print("\nExample:")
        print("  python complete_training_plan.py 6ca04a86-20e8-4dc3-9a0c-7d7925993370")
        sys.exit(1)

    plan_id = sys.argv[1]

    print(f"🚴 Completing training plan: {plan_id}")
    print()

    # Check if overview exists
    overview_path = Path("/tmp") / f"{plan_id}_overview.json"
    if not overview_path.exists():
        print(f"❌ Error: Overview file not found: {overview_path}")
        print()
        print("Make sure you have the overview file from Phase 3a")
        sys.exit(1)

    print(f"✅ Found overview: {overview_path}")
    print()

    # Initialize Phase 3b
    print("Initializing workout library...")
    phase = LibraryBasedTrainingPlanningWeeks(temperature=0.5)
    print()

    # Execute workout selection
    print("Selecting workouts from library...")
    print("This will create detailed workout files for each week.")
    print()

    try:
        result = phase.execute(plan_id=plan_id)

        if result["success"]:
            weeks_added = result["weeks_added"]
            print(f"✅ Success! Added {weeks_added} weeks with detailed workouts")
            print()
            print("Output files created:")
            print(f"  - /tmp/{plan_id}_overview.json (overview)")

            # List week files
            for week_num in range(1, weeks_added + 1):
                week_file = Path("/tmp") / f"{plan_id}_week_{week_num}.json"
                if week_file.exists():
                    print(f"  - /tmp/{plan_id}_week_{week_num}.json (detailed workouts)")

            print()
            print("You can now:")
            print(f"  1. View detailed workouts: cat /tmp/{plan_id}_week_1.json")
            print(f"  2. Generate HTML report: cycling-ai report --plan-id {plan_id}")

        else:
            print("❌ Failed to complete training plan")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

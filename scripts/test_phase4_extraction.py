#!/usr/bin/env python3
"""
Standalone test to debug Phase 4 data extraction issue.

Tests the flow from Phase 3 tool execution to Phase 4 data extraction.
"""
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cycling_ai.orchestration.multi_agent import PhaseResult, PhaseStatus


def test_phase3_extraction():
    """Test what data Phase 3 actually extracts."""
    print("=" * 60)
    print("Phase 3 → Phase 4 Data Extraction Test")
    print("=" * 60)

    # Simulate what happens when finalize_training_plan tool is called
    print("\n1. Checking finalize_training_plan tool...")

    from cycling_ai.tools.registry import get_global_registry
    registry = get_global_registry()

    # Load tools
    from cycling_ai.tools.loader import load_all_tools
    load_all_tools(registry)

    tool = registry.get_tool("finalize_training_plan")
    print(f"   ✓ Tool found: {tool.definition.name}")
    print(f"   Parameters: {[p.name for p in tool.definition.parameters]}")
    print(f"   Returns: {tool.definition.returns}")

    # Simulate tool execution with minimal data
    print("\n2. Simulating tool execution...")

    athlete_profile_path = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json"

    test_plan = {
        "total_weeks": 4,
        "target_ftp": 270,
        "weekly_plan": [
            {
                "week_number": 1,
                "phase": "Foundation",
                "phase_rationale": "Building base fitness",
                "workouts": {
                    "Monday": {
                        "name": "Recovery Ride",
                        "description": "Easy recovery spin",
                        "segments": [
                            {
                                "type": "steady",
                                "duration_min": 60,
                                "power_low": 130,
                                "power_high": 156,
                                "description": "Z1-Z2 steady state"
                            }
                        ]
                    }
                },
                "weekly_focus": "Aerobic base development",
                "weekly_watch_points": "Monitor fatigue levels"
            },
            {
                "week_number": 2,
                "phase": "Foundation",
                "phase_rationale": "Continuing base",
                "workouts": {},
                "weekly_focus": "Aerobic base",
                "weekly_watch_points": "Monitor"
            },
            {
                "week_number": 3,
                "phase": "Build",
                "phase_rationale": "Building intensity",
                "workouts": {},
                "weekly_focus": "Tempo work",
                "weekly_watch_points": "Monitor"
            },
            {
                "week_number": 4,
                "phase": "Recovery",
                "phase_rationale": "Recovery week",
                "workouts": {},
                "weekly_focus": "Recovery",
                "weekly_watch_points": "Monitor"
            }
        ],
        "coaching_notes": "Focus on consistent aerobic development",
        "monitoring_guidance": "Track weekly TSS and recovery"
    }

    try:
        result = tool.execute(
            athlete_profile_json=athlete_profile_path,
            total_weeks=4,
            target_ftp=270,
            weekly_plan=test_plan["weekly_plan"],
            coaching_notes=test_plan["coaching_notes"],
            monitoring_guidance=test_plan["monitoring_guidance"]
        )

        print(f"   Success: {result.success}")
        print(f"   Format: {result.format}")
        print(f"   Data type: {type(result.data)}")

        if result.success:
            print(f"   Data keys: {list(result.data.keys()) if isinstance(result.data, dict) else 'N/A'}")

            # Check if training_plan is in data
            if isinstance(result.data, dict):
                if 'training_plan' in result.data:
                    print(f"   ✓ 'training_plan' found in result.data")
                    plan = result.data['training_plan']
                    print(f"   Training plan type: {type(plan)}")
                    if isinstance(plan, dict):
                        print(f"   Training plan keys: {list(plan.keys())}")
                else:
                    print(f"   ✗ 'training_plan' NOT found in result.data")
                    print(f"   Available keys: {list(result.data.keys())}")

    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return

    # Simulate how agent.py extracts data
    print("\n3. Simulating agent extraction...")

    # Check if the result.data becomes extracted_data
    print(f"   result.data would become extracted_data")
    print(f"   Type: {type(result.data)}")

    if not result.success:
        print(f"   ✗ Tool execution failed!")
        print(f"   Errors: {result.errors}")
        return

    if isinstance(result.data, dict):
        # Check for training_plan key
        if 'training_plan' in result.data:
            print(f"   ✓ Phase 4 would find training_plan")
        else:
            print(f"   ✗ Phase 4 would NOT find training_plan")
            print(f"   This is the problem!")

            # Show what's actually there
            print(f"\n   Actual keys in extracted_data:")
            for key in result.data.keys():
                value = result.data[key]
                value_preview = str(value)[:100] if value else "None"
                print(f"     - {key}: {type(value).__name__} = {value_preview}...")

    # Simulate Phase 4 check
    print("\n4. Simulating Phase 4 check...")

    # Create a mock PhaseResult
    phase3_result = PhaseResult(
        phase_name="training_planning",
        status=PhaseStatus.COMPLETED,
        agent_response="Training plan created",
        extracted_data=result.data if isinstance(result.data, dict) else {}
    )

    print(f"   Phase 3 success: {phase3_result.success}")
    print(f"   Extracted data keys: {list(phase3_result.extracted_data.keys())}")

    # This is what Phase 4 does
    training_plan = phase3_result.extracted_data.get("training_plan")

    if training_plan:
        print(f"   ✓ Phase 4 SUCCESS - training_plan found")
        print(f"   Training plan type: {type(training_plan)}")
    else:
        print(f"   ✗ Phase 4 FAILURE - training_plan not found")
        print(f"   This is why Phase 4 fails!")

    print("\n" + "=" * 60)
    print("DIAGNOSIS:")
    print("=" * 60)

    if not training_plan:
        print("❌ The finalize_training_plan tool is not returning")
        print("   the training plan in the expected format.")
        print()
        print("Expected: result.data = {'training_plan': {...}}")
        print(f"Actual:   result.data = {{{', '.join(result.data.keys())}}}")
        print()
        print("FIX NEEDED: Update finalize_training_plan tool to return")
        print("            {'training_plan': plan_dict} instead of plan_dict directly")
    else:
        print("✓ Data extraction working correctly!")


if __name__ == "__main__":
    test_phase3_extraction()

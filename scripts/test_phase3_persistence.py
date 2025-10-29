#!/usr/bin/env python3
"""
Quick test to verify Phase 3 session persistence fix.
"""
import json
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
from cycling_ai.config import WorkflowConfig, ProviderConfig
from cycling_ai.orchestration.prompts import PromptsManager
from cycling_ai.providers.gemini_provider import GeminiProvider


def main():
    # Configuration
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set")
        return 1

    athlete_profile = Path(
        "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json"
    )
    fit_dir = Path(
        "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities"
    )
    output_dir = Path("/tmp/cycling_eduardo_20251029_1126")

    # Provider config
    provider_config = ProviderConfig(
        provider_name="gemini",
        api_key=api_key,
        model="gemini-2.5-flash",
        max_tokens=8192,
        temperature=0.7,
    )

    # Workflow config
    config = WorkflowConfig(
        csv_file_path=None,
        athlete_profile_path=athlete_profile,
        fit_dir_path=fit_dir,
        output_dir=output_dir,
        period_months=3,
        training_plan_weeks=4,
        fit_only_mode=True,
        skip_data_prep=True,
        generate_training_plan=True,
        max_iterations_per_phase=15,
    )

    # Initialize provider
    provider = GeminiProvider(provider_config)

    # Load Phase 2 result to get context
    phase2_result_path = output_dir / "phase_performance_analysis_result.json"
    if not phase2_result_path.exists():
        print(f"ERROR: Phase 2 result not found: {phase2_result_path}")
        return 1

    with open(phase2_result_path) as f:
        phase2_data = json.load(f)

    print("=" * 60)
    print("Testing Phase 3 Session Persistence Fix")
    print("=" * 60)
    print(f"Provider: {provider_config.provider_name} ({provider_config.model})")
    print(f"Output dir: {output_dir}")
    print()

    # Create orchestrator
    orchestrator = MultiAgentOrchestrator(
        provider=provider,
        prompts_manager=PromptsManager(),
    )

    # Mock Phase 2 result
    from cycling_ai.orchestration.phases import PhaseResult, PhaseStatus

    phase2_result = PhaseResult(
        phase_name="performance_analysis",
        status=PhaseStatus.COMPLETED,
        agent_response="",
        extracted_data=phase2_data.get("extracted_data", {}),
    )

    # Run Phase 3
    print("Running Phase 3 (Training Planning)...")
    phase3_result = orchestrator._execute_phase_3(config, phase2_result)

    print()
    print("Phase 3 Result:")
    print(f"  Status: {phase3_result.status}")
    print(f"  Execution time: {phase3_result.execution_time_seconds:.2f}s")
    print(f"  Tokens used: {phase3_result.tokens_used}")
    print(f"  Agent response length: {len(phase3_result.agent_response)} chars")
    print(f"  Extracted data keys: {list(phase3_result.extracted_data.keys())}")
    print()

    # Check session file
    session_id = phase3_result.extracted_data.get("session_id")
    if session_id:
        session_file = Path.home() / ".cycling-ai" / "workflow_sessions" / f"{session_id}.json"
        if session_file.exists():
            with open(session_file) as f:
                session_data = json.load(f)

            print(f"Session file: {session_file}")
            print(f"  Total messages: {len(session_data.get('messages', []))}")

            # Show message roles
            if "messages" in session_data:
                roles = [msg.get("role") for msg in session_data["messages"]]
                print(f"  Message roles: {roles}")

                # Count each role
                from collections import Counter

                role_counts = Counter(roles)
                print(f"  Role counts: {dict(role_counts)}")
        else:
            print(f"ERROR: Session file not found: {session_file}")
    else:
        print("ERROR: No session_id in extracted_data")

    # Save result
    result_file = output_dir / "phase_training_planning_result.json"
    with open(result_file, "w") as f:
        json.dump(
            {
                "phase_name": phase3_result.phase_name,
                "status": phase3_result.status.value,
                "agent_response": phase3_result.agent_response,
                "extracted_data": phase3_result.extracted_data,
                "errors": phase3_result.errors,
                "execution_time_seconds": phase3_result.execution_time_seconds,
                "tokens_used": phase3_result.tokens_used,
            },
            f,
            indent=2,
        )
    print(f"\nResult saved to: {result_file}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

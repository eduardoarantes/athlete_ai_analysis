#!/usr/bin/env python3
"""
Manual phase runner for debugging multi-agent workflow.

Runs each workflow phase individually and captures all LLM interactions
for inspection. Useful for debugging provider-specific issues.
"""
import json
import logging
import os
import sys
from pathlib import Path

# Configure logging BEFORE any other imports
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s',
    stream=sys.stderr  # Send to stderr so it appears with tee
)

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cycling_ai.orchestration.base import PhaseStatus, WorkflowConfig
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.providers.base import ProviderConfig
from cycling_ai.providers.factory import ProviderFactory


def save_interaction_log(phase_name: str, session_id: str, output_dir: Path):
    """Save session interaction log to file."""
    # Session logs are in ~/.cycling-ai/workflow_sessions/
    session_dir = Path.home() / ".cycling-ai" / "workflow_sessions" / session_id

    if not session_dir.exists():
        print(f"⚠️  Session directory not found: {session_dir}")
        return

    # Copy session data to output directory
    output_session_dir = output_dir / "debug_sessions" / phase_name
    output_session_dir.mkdir(parents=True, exist_ok=True)

    # Copy all session files
    import shutil
    for file in session_dir.glob("*"):
        shutil.copy2(file, output_session_dir / file.name)

    print(f"✓ Session data saved to: {output_session_dir}")


def progress_callback(phase_name: str, status: PhaseStatus):
    """Print progress updates."""
    status_emoji = {
        PhaseStatus.PENDING: "⏳",
        PhaseStatus.IN_PROGRESS: "▶️ ",
        PhaseStatus.COMPLETED: "✓",
        PhaseStatus.FAILED: "✗",
        PhaseStatus.SKIPPED: "⊘",
    }
    emoji = status_emoji.get(status, "?")
    print(f"\n{emoji} Phase: {phase_name} - Status: {status.value}")


def inspect_phase_result(result, output_dir: Path):
    """Print and save detailed phase result."""
    print(f"\n{'='*60}")
    print(f"PHASE RESULT: {result.phase_name}")
    print(f"{'='*60}")
    print(f"Status: {result.status.value}")
    print(f"Execution time: {result.execution_time_seconds:.2f}s")
    print(f"Tokens used: {result.tokens_used}")

    if result.errors:
        print(f"\n⚠️  ERRORS:")
        for error in result.errors:
            print(f"  - {error}")

    print(f"\nAgent Response:")
    print("-" * 60)
    print(result.agent_response[:500])
    if len(result.agent_response) > 500:
        print(f"... (truncated, {len(result.agent_response)} total chars)")
    print("-" * 60)

    print(f"\nExtracted Data Keys: {list(result.extracted_data.keys())}")

    # Save full result to file
    result_file = output_dir / f"phase_{result.phase_name}_result.json"
    with open(result_file, "w") as f:
        json.dump(result.to_dict(), f, indent=2)
    print(f"\n✓ Full result saved to: {result_file}")

    # Save session log if available
    session_id = result.extracted_data.get("session_id")
    if session_id:
        save_interaction_log(result.phase_name, session_id, output_dir)

    print(f"\n{'='*60}\n")

    return result


def main():
    """Run workflow phases individually."""
    # Check if running interactively
    import sys
    interactive = sys.stdin.isatty()

    print("\n" + "="*60)
    print("Manual Phase Runner - OpenAI GPT-4o Test")
    if not interactive:
        print("(Running in non-interactive mode)")
    print("="*60 + "\n")

    # Configuration
    athlete_profile = Path("/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json")
    fit_dir = Path("/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities")
    output_dir = Path("/tmp/cycling_eduardo_20251029_1126")
    output_dir.mkdir(exist_ok=True)

    print(f"Output directory: {output_dir}")
    print(f"Athlete profile: {athlete_profile}")
    print(f"FIT directory: {fit_dir}")

    # Initialize provider
    print("\nInitializing OpenAI provider...")

    # Get API key from environment
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("✗ Error: OPENAI_API_KEY environment variable not set")
        return 1

    provider_config = ProviderConfig(
        provider_name="openai",
        api_key=api_key,
        model="gpt-4o",
        max_tokens=8192,
        temperature=0.7,
    )
    provider = ProviderFactory.create_provider(provider_config)
    print(f"✓ Provider initialized: {provider.config.provider_name} ({provider.config.model})")

    # Create orchestrator
    prompts_manager = AgentPromptsManager()
    orchestrator = MultiAgentOrchestrator(
        provider=provider,
        prompts_manager=prompts_manager,
        progress_callback=progress_callback,
    )

    # Create workflow config
    config = WorkflowConfig(
        csv_file_path=None,
        athlete_profile_path=athlete_profile,
        fit_dir_path=fit_dir,
        output_dir=output_dir,
        period_months=3,
        training_plan_weeks=4,
        fit_only_mode=True,
        skip_data_prep=True,  # Skip Phase 1 - use existing cache
        generate_training_plan=True,
        max_iterations_per_phase=5,  # Enough for finalize to be called
    )

    try:
        config.validate()
        print("✓ Configuration validated\n")
    except ValueError as e:
        print(f"✗ Configuration error: {e}")
        return 1

    # Store phase results
    phase_results = []

    # ========== PHASE 1: Data Preparation ==========
    if config.skip_data_prep:
        print("\n" + "█"*60)
        print("PHASE 1: Data Preparation (SKIPPED)")
        print("█"*60)
        print("\n⊘ Using existing cache - Phase 1 skipped")

        # Create skipped phase result with cache info
        from cycling_ai.orchestration.base import PhaseResult
        cache_file_path = str(config.output_dir / "cache" / "activities_processed.parquet")
        phase1_result = PhaseResult(
            phase_name="data_preparation",
            status=PhaseStatus.SKIPPED,
            agent_response="Data preparation skipped - using existing cache",
            extracted_data={
                "cache_file_path": cache_file_path,
                "athlete_profile_path": str(config.athlete_profile_path),
                "zones_already_calculated": True,
            },
        )
        phase_results.append(phase1_result)
    else:
        print("\n" + "█"*60)
        print("PHASE 1: Data Preparation")
        print("█"*60)

        if interactive:
            input("\nPress ENTER to run Phase 1...")
        else:
            print("\nStarting Phase 1...")

        phase1_result = orchestrator._execute_phase_1(config)
        inspect_phase_result(phase1_result, output_dir)
        phase_results.append(phase1_result)

        if not phase1_result.success:
            print("⚠️  Phase 1 failed. Cannot continue.")
            return 1

    # ========== PHASE 2: Performance Analysis ==========
    print("\n" + "█"*60)
    print("PHASE 2: Performance Analysis")
    print("█"*60)

    if interactive:
        input("\nPress ENTER to run Phase 2...")
    else:
        print("\nStarting Phase 2...")

    phase2_result = orchestrator._execute_phase_2(config, phase1_result)
    inspect_phase_result(phase2_result, output_dir)
    phase_results.append(phase2_result)

    if not phase2_result.success:
        print("⚠️  Phase 2 failed. Cannot continue.")
        return 1

    # ========== PHASE 3: Training Planning ==========
    print("\n" + "█"*60)
    print("PHASE 3: Training Planning")
    print("█"*60)

    if interactive:
        input("\nPress ENTER to run Phase 3...")
    else:
        print("\nStarting Phase 3...")

    phase3_result = orchestrator._execute_phase_3(config, phase2_result)
    inspect_phase_result(phase3_result, output_dir)
    phase_results.append(phase3_result)

    if not phase3_result.success:
        print("⚠️  Phase 3 failed. Continuing to Phase 4 to diagnose...")

    # ========== PHASE 4: Report Data Preparation ==========
    print("\n" + "█"*60)
    print("PHASE 4: Report Data Preparation")
    print("█"*60)

    if interactive:
        input("\nPress ENTER to run Phase 4...")
    else:
        print("\nStarting Phase 4...")

    phase4_result = orchestrator._execute_phase_4(config, phase_results)
    inspect_phase_result(phase4_result, output_dir)
    phase_results.append(phase4_result)

    if not phase4_result.success:
        print("⚠️  Phase 4 failed.")
        print("\nDEBUGGING INFO:")
        print(f"  Phase 3 training_plan in extracted_data: {'training_plan' in phase3_result.extracted_data}")
        if 'training_plan' in phase3_result.extracted_data:
            plan = phase3_result.extracted_data['training_plan']
            print(f"  Training plan type: {type(plan)}")
            print(f"  Training plan preview: {str(plan)[:200]}")

        # Save Phase 3 agent response for inspection
        response_file = output_dir / "phase3_agent_response.txt"
        with open(response_file, "w") as f:
            f.write(phase3_result.agent_response)
        print(f"\n✓ Phase 3 response saved to: {response_file}")

        return 1

    # ========== PHASE 5: Report Generation ==========
    print("\n" + "█"*60)
    print("PHASE 5: Report Generation")
    print("█"*60)

    if interactive:
        input("\nPress ENTER to run Phase 5...")
    else:
        print("\nStarting Phase 5...")

    phase5_result = orchestrator._execute_phase_5(config, phase_results)
    inspect_phase_result(phase5_result, output_dir)
    phase_results.append(phase5_result)

    # ========== SUMMARY ==========
    print("\n" + "="*60)
    print("WORKFLOW SUMMARY")
    print("="*60)

    for result in phase_results:
        status_emoji = {
            PhaseStatus.COMPLETED: "✓",
            PhaseStatus.FAILED: "✗",
            PhaseStatus.SKIPPED: "⊘",
        }
        emoji = status_emoji.get(result.status, "?")
        print(f"{emoji} {result.phase_name}: {result.status.value} ({result.execution_time_seconds:.2f}s)")

    print(f"\nAll debug data saved to: {output_dir}")
    print(f"Session logs in: {output_dir}/debug_sessions/")

    return 0


if __name__ == "__main__":
    sys.exit(main())

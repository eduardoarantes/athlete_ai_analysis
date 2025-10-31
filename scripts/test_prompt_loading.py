#!/usr/bin/env python3
"""
Test script for external prompt loading system.

This script verifies that prompts can be loaded from external files
using the PromptLoader and AgentPromptsManager classes.
"""
from pathlib import Path

from cycling_ai.orchestration.prompt_loader import PromptLoader, get_prompt_loader
from cycling_ai.orchestration.prompts import AgentPromptsManager


def test_prompt_loader_direct():
    """Test PromptLoader directly."""
    print("=" * 80)
    print("Testing PromptLoader directly")
    print("=" * 80)

    # Test with default model/version
    loader = get_prompt_loader()
    print(f"\nPrompts directory: {loader.get_prompts_dir()}")
    print(f"Directory exists: {loader.exists()}")

    if not loader.exists():
        print("❌ Prompts directory does not exist!")
        return False

    # Load metadata
    try:
        metadata = loader.load_metadata()
        print(f"\nMetadata:")
        print(f"  Model: {metadata['model']}")
        print(f"  Version: {metadata['version']}")
        print(f"  Description: {metadata['description']}")
        print(f"  Agents: {list(metadata['agents'].keys())}")
    except Exception as e:
        print(f"❌ Failed to load metadata: {e}")
        return False

    # Test loading individual prompts
    print("\n" + "-" * 80)
    print("Testing individual prompt loading:")
    print("-" * 80)

    # Note: Phase 1 (data_preparation) no longer uses LLM prompts
    agents = ["performance_analysis", "training_planning", "report_generation"]

    for agent in agents:
        try:
            prompt = loader.load_prompt(agent)
            lines = prompt.split("\n")
            first_line = lines[0] if lines else "(empty)"
            print(f"\n✅ {agent}:")
            print(f"   First line: {first_line}")
            print(f"   Total chars: {len(prompt)}")
            print(f"   Total lines: {len(lines)}")
        except Exception as e:
            print(f"\n❌ {agent}: {e}")
            return False

    return True


def test_agent_prompts_manager():
    """Test AgentPromptsManager with external prompts."""
    print("\n" + "=" * 80)
    print("Testing AgentPromptsManager")
    print("=" * 80)

    # Test with default settings (should use PromptLoader)
    manager = AgentPromptsManager()

    print("\nTesting system prompt retrieval methods:")
    print("-" * 80)

    # Note: Phase 1 (data_preparation) no longer uses LLM prompts
    methods = [
        ("performance_analysis", manager.get_performance_analysis_prompt),
        ("training_planning", manager.get_training_planning_prompt),
        ("report_generation", manager.get_report_generation_prompt),
    ]

    for name, method in methods:
        try:
            prompt = method()
            lines = prompt.split("\n")
            first_line = lines[0] if lines else "(empty)"
            print(f"\n✅ {name}:")
            print(f"   First line: {first_line}")
            print(f"   Total chars: {len(prompt)}")
            print(f"   Total lines: {len(lines)}")
        except Exception as e:
            print(f"\n❌ {name}: {e}")
            return False

    print("\n" + "-" * 80)
    print("Testing user prompt retrieval methods:")
    print("-" * 80)

    # Note: Phase 1 (data_preparation) no longer uses LLM prompts
    user_methods = [
        ("performance_analysis_user",
         lambda: manager.get_performance_analysis_user_prompt(
             period_months=6,
             cache_file_path="/path/to/cache.parquet",
             athlete_profile_path="/path/to/profile.json"
         )),
        ("training_planning_user",
         lambda: manager.get_training_planning_user_prompt(
             training_plan_weeks=12,
             athlete_profile_path="/path/to/profile.json",
             power_zones="Z1-Z6 zones",
             available_days="Mon, Wed, Sat",
             weekly_time_budget_hours="8",
             daily_time_caps_json="{}"
         )),
        ("report_generation_user",
         lambda: manager.get_report_generation_user_prompt(output_dir="/tmp/reports")),
    ]

    for name, method in user_methods:
        try:
            prompt = method()
            lines = prompt.split("\n")
            first_line = lines[0] if lines else "(empty)"
            print(f"\n✅ {name}:")
            print(f"   First line: {first_line}")
            print(f"   Total chars: {len(prompt)}")
            print(f"   Contains variables: {'{' not in prompt}")  # Should be formatted
        except Exception as e:
            print(f"\n❌ {name}: {e}")
            return False

    return True


def test_fallback_behavior():
    """Test error handling for non-existent model."""
    print("\n" + "=" * 80)
    print("Testing error handling (non-existent model)")
    print("=" * 80)

    print("\nThis should raise an appropriate error:")

    try:
        # This should fail during initialization since prompts don't exist
        manager = AgentPromptsManager(model="nonexistent", version="99.0")
        print(f"\n❌ Should have raised FileNotFoundError during initialization")
        return False
    except FileNotFoundError as e:
        print(f"\n✅ Correctly raised FileNotFoundError: {e}")
        return True
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False


def test_model_version_listing():
    """Test listing available models and versions."""
    print("\n" + "=" * 80)
    print("Testing model/version listing")
    print("=" * 80)

    # List available models
    models = PromptLoader.list_available_models()
    print(f"\nAvailable models: {models}")

    # List versions for each model
    for model in models:
        versions = PromptLoader.list_available_versions(model)
        print(f"  {model} versions: {versions}")

    return True


def main():
    """Run all tests."""
    print("\n" + "🧪 " * 40)
    print("PROMPT LOADING SYSTEM TEST SUITE")
    print("🧪 " * 40)

    tests = [
        ("PromptLoader Direct", test_prompt_loader_direct),
        ("AgentPromptsManager", test_agent_prompts_manager),
        ("Error Handling", test_fallback_behavior),
        ("Model/Version Listing", test_model_version_listing),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")

    all_passed = all(result for _, result in results)

    if all_passed:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n⚠️  Some tests failed")
        return 1


if __name__ == "__main__":
    exit(main())

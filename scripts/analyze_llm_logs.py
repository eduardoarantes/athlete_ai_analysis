#!/usr/bin/env python3
"""
Analyze LLM interaction logs.

This script provides utilities to read, parse, and analyze the JSONL log files
created by the InteractionLogger.

Usage:
    python scripts/analyze_llm_logs.py <log_file.jsonl>
    python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --summary
    python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --interaction 3
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Any


def load_interactions(log_file: Path) -> list[dict[str, Any]]:
    """Load all interactions from a JSONL log file."""
    interactions = []
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                interactions.append(json.loads(line))
    return interactions


def print_summary(interactions: list[dict[str, Any]]) -> None:
    """Print a summary of all interactions."""
    print(f"\n{'='*80}")
    print(f"Log Summary: {len(interactions)} interactions")
    print(f"{'='*80}\n")

    for interaction in interactions:
        print(f"Interaction #{interaction['interaction_id']}")
        print(f"  Timestamp: {interaction['timestamp']}")
        print(f"  Provider: {interaction['provider']} / {interaction['model']}")
        print(f"  Duration: {interaction.get('duration_ms', 0):.0f}ms")
        print(f"  Messages: {len(interaction['input']['messages'])}")
        print(f"  Tools available: {len(interaction['input']['tools'])}")

        # Count message types
        msg_types = {}
        for msg in interaction['input']['messages']:
            role = msg['role']
            msg_types[role] = msg_types.get(role, 0) + 1
        print(f"  Message breakdown: {dict(msg_types)}")

        # Response info
        output = interaction['output']
        print(f"  Response length: {len(output.get('content', '')) if output.get('content') else 0} chars")
        print(f"  Tool calls: {len(output.get('tool_calls', [])) if output.get('tool_calls') else 0}")
        if output.get('tool_calls'):
            tool_names = [tc.get('name', 'unknown') for tc in output['tool_calls']]
            print(f"  Tools called: {tool_names}")

        # Token usage
        if 'usage' in output.get('metadata', {}):
            usage = output['metadata']['usage']
            print(f"  Tokens: {usage.get('total_tokens', 'N/A')}")

        print()


def print_interaction(interaction: dict[str, Any], detail_level: str = "full") -> None:
    """Print a single interaction with details."""
    print(f"\n{'='*80}")
    print(f"Interaction #{interaction['interaction_id']} - {interaction['timestamp']}")
    print(f"{'='*80}\n")

    print(f"Provider: {interaction['provider']}")
    print(f"Model: {interaction['model']}")
    print(f"Duration: {interaction.get('duration_ms', 0):.2f}ms\n")

    # Input messages
    print("INPUT MESSAGES:")
    print("-" * 80)
    for i, msg in enumerate(interaction['input']['messages'], 1):
        print(f"\nMessage {i} ({msg['role'].upper()}):")
        print(f"Length: {msg['content_length']} characters")
        if detail_level == "full":
            print(f"\nContent:")
            print(msg['content'])
            if msg.get('tool_calls'):
                print(f"\nTool calls: {msg['tool_calls']}")

    # Available tools
    print(f"\n{'='*80}")
    print(f"AVAILABLE TOOLS: {len(interaction['input']['tools'])}")
    print("-" * 80)
    for tool in interaction['input']['tools']:
        print(f"\n{tool['name']}")
        if detail_level == "full":
            print(f"  Description: {tool['description']}")
            print(f"  Parameters: {len(tool['parameters'])}")
            for param in tool['parameters']:
                req = "REQUIRED" if param['required'] else "optional"
                print(f"    - {param['name']} ({param['type']}, {req}): {param['description']}")

    # Output
    print(f"\n{'='*80}")
    print("LLM RESPONSE:")
    print("-" * 80)
    output = interaction['output']
    print(f"\nContent ({len(output.get('content', '')) if output.get('content') else 0} chars):")
    if output.get('content'):
        print(output['content'])
    else:
        print("(No text content)")

    if output.get('tool_calls'):
        print(f"\nTool Calls ({len(output['tool_calls'])}):")
        for i, tc in enumerate(output['tool_calls'], 1):
            print(f"\n  {i}. {tc.get('name', 'unknown')}")
            print(f"     ID: {tc.get('id', 'N/A')}")
            print(f"     Arguments: {json.dumps(tc.get('arguments', {}), indent=8)}")

    # Metadata
    print(f"\n{'='*80}")
    print("METADATA:")
    print("-" * 80)
    print(json.dumps(output.get('metadata', {}), indent=2))
    print()


def main():
    parser = argparse.ArgumentParser(description="Analyze LLM interaction logs")
    parser.add_argument("log_file", type=Path, help="Path to JSONL log file")
    parser.add_argument("--summary", action="store_true", help="Show summary of all interactions")
    parser.add_argument("--interaction", type=int, help="Show details for specific interaction ID")
    parser.add_argument("--detail", choices=["full", "summary"], default="full",
                       help="Detail level for interaction output")

    args = parser.parse_args()

    if not args.log_file.exists():
        print(f"Error: Log file not found: {args.log_file}", file=sys.stderr)
        sys.exit(1)

    # Load interactions
    interactions = load_interactions(args.log_file)

    if not interactions:
        print("No interactions found in log file")
        sys.exit(0)

    # Show summary
    if args.summary:
        print_summary(interactions)
    # Show specific interaction
    elif args.interaction is not None:
        interaction = next((i for i in interactions if i['interaction_id'] == args.interaction), None)
        if interaction:
            print_interaction(interaction, args.detail)
        else:
            print(f"Interaction #{args.interaction} not found")
            sys.exit(1)
    # Default: show all interactions
    else:
        for interaction in interactions:
            print_interaction(interaction, args.detail)


if __name__ == "__main__":
    main()

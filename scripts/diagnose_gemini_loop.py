#!/usr/bin/env python3
"""
Diagnose why Gemini is stuck in a loop calling calculate_power_zones.

Reads the LLM interaction log and shows exactly what messages are being
sent between the LLM and the tools.
"""
import json
import sys
from pathlib import Path

def analyze_log(log_path: Path):
    """Analyze interaction log to understand the loop."""
    print(f"\nAnalyzing: {log_path}")
    print("=" * 80)

    with open(log_path) as f:
        interactions = [json.loads(line) for line in f]

    for interaction in interactions:
        interaction_id = interaction["interaction_id"]
        print(f"\n{'='*80}")
        print(f"INTERACTION #{interaction_id}")
        print(f"{'='*80}")

        # Show input messages
        print(f"\n📥 INPUT MESSAGES ({len(interaction['input']['messages'])})")
        for i, msg in enumerate(interaction['input']['messages']):
            role = msg['role']
            content_len = msg['content_length']
            print(f"  [{i+1}] {role}: {content_len} chars")

            # Show first 200 chars of user/assistant messages
            if role in ('user', 'assistant') and msg.get('content'):
                preview = msg['content'][:200]
                print(f"      Preview: {preview}...")

            # Show tool calls if present
            if msg.get('tool_calls'):
                print(f"      Tool calls: {msg['tool_calls']}")

        # Show output
        print(f"\n📤 OUTPUT")
        output = interaction['output']

        if output.get('content'):
            content_preview = output['content'][:300]
            print(f"  Content: {content_preview}...")

        if output.get('tool_calls'):
            print(f"  Tool calls: {json.dumps(output['tool_calls'], indent=4)}")

        print(f"\n  Metadata: {output.get('metadata', {})}")

def main():
    # Find the most recent session log
    log_dir = Path("/Users/eduardo/Documents/projects/cycling-ai-analysis/logs/llm_interactions")

    if len(sys.argv) > 1:
        log_file = Path(sys.argv[1])
    else:
        # Use most recent
        log_files = sorted(log_dir.glob("session_*.jsonl"), key=lambda p: p.stat().st_mtime)
        if not log_files:
            print("No log files found")
            return 1
        log_file = log_files[-1]

    analyze_log(log_file)

    print(f"\n\n{'='*80}")
    print("KEY OBSERVATIONS")
    print(f"{'='*80}")
    print("""
The loop happens when:
1. LLM calls calculate_power_zones
2. Tool returns result as message #4
3. LLM receives the result but calls calculate_power_zones AGAIN
4. This repeats until max_iterations is hit

This suggests the tool result format might not be clear to Gemini,
or Gemini is expecting a different response format.
    """)

    return 0

if __name__ == "__main__":
    sys.exit(main())

# LLM Interaction Logging

This document describes the LLM interaction logging system that captures all interactions with language models including system prompts, user messages, tool definitions, and LLM responses.

## Overview

The interaction logger automatically captures:
- **System prompts** - Instructions given to the LLM
- **User messages** - User queries and context
- **Tool definitions** - Available tools and their parameters
- **LLM responses** - Generated text and tool calls
- **Metadata** - Tokens used, duration, model info

## Log Location

Logs are stored in JSONL format (JSON Lines - one JSON object per line):

```
logs/llm_interactions/session_YYYYMMDD_HHMMSS.jsonl
```

Each session creates a new log file with a timestamp.

## Log Format

Each interaction is logged as a single JSON object with the following structure:

```json
{
  "interaction_id": 1,
  "timestamp": "2025-10-28T08:53:21.199419",
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "duration_ms": 4595.05,
  "input": {
    "messages": [
      {
        "role": "system",
        "content": "You are a data preparation specialist...",
        "tool_calls": null,
        "content_length": 657
      },
      {
        "role": "user",
        "content": "Prepare cycling data for analysis...",
        "tool_calls": null,
        "content_length": 446
      }
    ],
    "tools": [
      {
        "name": "analyze_performance",
        "description": "Analyze cycling performance...",
        "parameters": [
          {
            "name": "csv_file_path",
            "type": "string",
            "required": true,
            "description": "Path to CSV file"
          }
        ]
      }
    ]
  },
  "output": {
    "content": "LLM response text...",
    "tool_calls": [
      {
        "name": "analyze_performance",
        "arguments": {"csv_file_path": "/path/to/file.csv"},
        "id": "call_0"
      }
    ],
    "metadata": {
      "model": "gemini-2.5-flash",
      "usage": {
        "prompt_tokens": 1433,
        "total_tokens": 1857
      },
      "finish_reason": "stop"
    }
  }
}
```

## Analyzing Logs

Use the provided script to analyze log files:

### View Summary

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --summary
```

Output:
```
================================================================================
Log Summary: 4 interactions
================================================================================

Interaction #1
  Timestamp: 2025-10-28T08:53:21.199419
  Provider: gemini / gemini-2.5-flash
  Duration: 4595ms
  Messages: 2
  Tools available: 5
  Message breakdown: {'system': 1, 'user': 1}
  Response length: 988 chars
  Tool calls: 0
  Tokens: 1857
```

### View Specific Interaction

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --interaction 2
```

This shows the complete details including:
- All input messages (system, user, assistant)
- All available tools and their parameters
- Full LLM response
- Tool calls with arguments
- Token usage and metadata

### View All Interactions (Full Detail)

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl
```

## Configuration

The logger is automatically enabled for all providers. It's configured in:

```
src/cycling_ai/providers/interaction_logger.py
```

### Disable Logging

To disable logging, set `enabled=False` when creating the logger:

```python
from cycling_ai.providers.interaction_logger import InteractionLogger

logger = InteractionLogger(enabled=False)
```

### Change Log Directory

```python
logger = InteractionLogger(log_dir="/path/to/custom/logs")
```

## Use Cases

### 1. Debugging Prompts

Review system prompts and user messages to understand what instructions the LLM received:

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --interaction 1 | less
```

### 2. Analyzing Tool Usage

See which tools were called and with what arguments:

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --summary | grep "Tools called"
```

### 3. Token Optimization

Analyze token usage across interactions to optimize prompts:

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --summary | grep "Tokens:"
```

### 4. Performance Analysis

Review response times to identify slow interactions:

```bash
python scripts/analyze_llm_logs.py logs/llm_interactions/session_*.jsonl --summary | grep "Duration:"
```

## Processing Logs Programmatically

You can load and process logs in Python:

```python
import json
from pathlib import Path

# Load log file
log_file = Path("logs/llm_interactions/session_20251028_085321.jsonl")
interactions = []

with open(log_file, "r") as f:
    for line in f:
        interactions.append(json.loads(line))

# Analyze
total_tokens = sum(
    i["output"]["metadata"].get("usage", {}).get("total_tokens", 0)
    for i in interactions
)

print(f"Total tokens used: {total_tokens}")

# Find interactions with tool calls
tool_interactions = [
    i for i in interactions
    if i["output"].get("tool_calls")
]

print(f"Interactions with tool calls: {len(tool_interactions)}")
```

## File Format: JSONL

JSONL (JSON Lines) format stores one JSON object per line. Benefits:
- **Streamable** - Can process large files line by line
- **Appendable** - Can append new interactions without loading entire file
- **Git-friendly** - Diffs show individual interactions
- **Easy to parse** - Standard JSON format

## Integration

The logging is integrated into the Gemini provider at:

```
src/cycling_ai/providers/gemini_provider.py
```

To add logging to other providers, follow the same pattern:

```python
from cycling_ai.providers.interaction_logger import get_interaction_logger
import time

def create_completion(self, messages, tools=None):
    start_time = time.time()

    # ... make API call ...

    duration_ms = (time.time() - start_time) * 1000

    # Log interaction
    logger = get_interaction_logger()
    logger.log_interaction(
        provider_name=self.config.provider_name,
        model=self.config.model,
        messages=messages,
        tools=tools,
        response=completion_response,
        duration_ms=duration_ms,
    )

    return completion_response
```

## Files

- **Logger Implementation**: `src/cycling_ai/providers/interaction_logger.py`
- **Analysis Script**: `scripts/analyze_llm_logs.py`
- **Log Files**: `logs/llm_interactions/session_*.jsonl`
- **Documentation**: `docs/LLM_INTERACTION_LOGGING.md`

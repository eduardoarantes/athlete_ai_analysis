# Data Preparation Tool - Implementation Complete

## Overview

The data preparation tool successfully extracts training plan data from LLM interaction logs and consolidates it into the `report_data.json` format.

## Implementation Status

✅ **Complete** - Tool is fully functional and tested

## What Was Built

### 1. Core Extraction Module
**File:** `src/cycling_ai/tools/report_data_extractor.py`

Functions:
- `extract_training_plan_from_jsonl()` - Finds and extracts training plan from interaction logs
- `load_athlete_profile()` - Loads and normalizes athlete profile JSON
- `consolidate_athlete_data()` - Combines training plan and profile into report format
- `extract_from_session_file()` - Complete extraction pipeline for a single session

### 2. CLI Command
**Files:**
- `src/cycling_ai/cli/prepare_report.py` - Core CLI logic
- `src/cycling_ai/cli/commands/prepare_report_cmd.py` - Click command wrapper

**Usage:**
```bash
cycling-ai prepare-report \
  --session logs/llm_interactions/session_20251029_100250.jsonl \
  --athlete-dir /path/to/data/ \
  --output logs/report_data.json
```

### 3. Validation
**Files:**
- `schemas/report_data_schema.json` - JSON Schema for validation
- `scripts/validate_report_data.py` - Standalone validation script

## How It Works

### Interaction Log Format

The training plan data is stored in the LLM interaction logs in this structure:

```
Interaction N: Tool call is made
  output:
    tool_calls:
      - name: "generate_training_plan"
        arguments: {...}

Interaction N+1: Tool result is returned
  input:
    messages:
      - role: "assistant"
        content: "{...training_plan_json...}"  # <-- The data!
```

The tool extracts the JSON embedded in the assistant message content.

### Extraction Process

1. **Find Tool Call**: Scans interactions for `generate_training_plan` tool call
2. **Locate Result**: Looks in the next interaction's input messages for the tool result
3. **Parse JSON**: Extracts and parses the training plan JSON from message content
4. **Load Profile**: Loads athlete profile from filesystem
5. **Normalize Data**: Converts to standard format (handle different field names)
6. **Add Metadata**: Includes source file, timestamps, LLM provider info
7. **Validate**: Optionally validates against JSON schema
8. **Save**: Writes consolidated `report_data.json`

## Testing

### Test with Sample Data

```bash
# Test extraction
python3 scripts/test_extraction.py

# Output:
✓ Extraction successful!
Athlete Data:
  ID: tom
  Name: Tom
  FTP: 236W
  Target FTP: 275.0W
  Weeks: 12
  Workouts: 12 weeks
```

### Validate Output

```bash
.venv/bin/python scripts/validate_report_data.py logs/report_data.json

# Output:
Validation successful!
Data summary:
  Version: 1.0
  Generated: 2025-10-28T23:17:13.212791Z
  Number of athletes: 1

  Athlete: Tom (ID: tom)
    FTP: 236W
    Training plan: 12 weeks
    Target FTP: 275.0W
    Number of workouts: 44
```

## Generated Output Example

```json
{
  "version": "1.0",
  "generated_timestamp": "2025-10-28T23:17:13.212791Z",
  "generator": {
    "tool": "cycling-ai",
    "version": "0.1.0",
    "command": "..."
  },
  "athletes": [
    {
      "id": "tom",
      "name": "Tom",
      "profile": {
        "age": 52,
        "ftp": 236,
        "weight_kg": 84.0,
        "power_to_weight": 2.810,
        "training_availability": {
          "hours_per_week": 7,
          "available_training_days": ["Tuesday", "Saturday", ...]
        },
        "goals": "..."
      },
      "training_plan": {
        "current_ftp": 236,
        "target_ftp": 275.0,
        "ftp_gain": 39.0,
        "ftp_gain_percent": 16.53,
        "total_weeks": 12,
        "available_days_per_week": 4,
        "power_zones": {
          "z1": {"name": "Active Recovery", "min": 0, "max": 142},
          "z2": {"name": "Endurance", "min": 142, "max": 189},
          ...
        },
        "weekly_workouts": [
          {
            "week": 1,
            "phase": "Foundation",
            "workouts": {
              "Tuesday": {
                "name": "Threshold",
                "description": "Build sustainable power at FTP",
                "total_duration_min": 60,
                "segments": [
                  {
                    "duration_min": 15,
                    "power_low": 142,
                    "power_high": 177,
                    "description": "Warm-up 15 min",
                    "type": "warmup"
                  },
                  ...
                ],
                "svg": "<svg>...</svg>"
              },
              ...
            }
          },
          ...
        ]
      },
      "metadata": {
        "sources": {
          "interaction_log": "logs/llm_interactions/session_20251029_100250.jsonl",
          "interaction_id": 5
        },
        "generated_at": "2025-10-28T14:49:25.606916",
        "llm_provider": "gemini",
        "llm_model": "gemini-2.5-flash",
        "generation_duration_ms": 39196.679
      }
    }
  ]
}
```

## Key Features

### ✅ Multi-Athlete Support
Can process multiple session files and consolidate into single report:
```bash
cycling-ai prepare-report \
  --sessions logs/session1.jsonl logs/session2.jsonl logs/session3.jsonl \
  --output logs/report_data.json
```

### ✅ Automatic Profile Discovery
Finds athlete profiles automatically from common locations:
- Specified athlete directory
- Project data directory
- Relative to session file

### ✅ Data Normalization
Handles different field name variations:
- `FTP` vs `ftp`
- `weight` vs `weight_kg`
- `critical_HR` vs `max_hr`
- Power values with/without units ("260w" → 260)

### ✅ Validation
Validates output against JSON Schema to ensure data quality

### ✅ Comprehensive Metadata
Tracks data sources, timestamps, LLM provider info for traceability

## CLI Options

```
cycling-ai prepare-report [OPTIONS]

Options:
  --session PATH          Single session JSONL file
  --sessions PATH...      Multiple session files
  --athlete-dir PATH      Directory containing athlete profiles
  --output, -o PATH       Output file (default: logs/report_data.json)
  --no-validate           Skip validation
  --verbose, -v           Verbose output
  --help                  Show help message
```

## Example Workflows

### Single Athlete
```bash
# Generate training plan
cycling-ai generate --athlete data/John_Doe

# Prepare report
cycling-ai prepare-report \
  --session logs/llm_interactions/session_latest.jsonl \
  --output logs/report_data.json
```

### Multiple Athletes
```bash
# Generate plans for multiple athletes
cycling-ai generate --athlete data/Athlete_1
cycling-ai generate --athlete data/Athlete_2
cycling-ai generate --athlete data/Athlete_3

# Prepare combined report
cycling-ai prepare-report \
  --sessions logs/llm_interactions/*.jsonl \
  --athlete-dir data/ \
  --output logs/report_data.json
```

### With Validation
```bash
# Prepare and validate
cycling-ai prepare-report \
  --session logs/session.jsonl \
  --output logs/report_data.json

# Separate validation
python scripts/validate_report_data.py logs/report_data.json
```

## Error Handling

The tool handles various edge cases:
- Missing athlete profiles (uses data from session)
- Multiple tool calls in same session (uses last one)
- Invalid JSON in profiles (logs error, continues)
- Missing session files (clear error message)
- Validation failures (detailed error path)

## Next Steps

Now that data preparation is complete, next tasks are:

1. **Design HTML Viewer** - Interactive calendar interface
2. **Implement Viewer** - HTML/CSS/JS for displaying report data
3. **Test End-to-End** - Full workflow from generation to viewing

## Files Created

- `src/cycling_ai/tools/report_data_extractor.py` (370 lines)
- `src/cycling_ai/cli/prepare_report.py` (205 lines)
- `src/cycling_ai/cli/commands/prepare_report_cmd.py` (100 lines)
- `scripts/validate_report_data.py` (110 lines)
- `scripts/test_extraction.py` (57 lines)

## Total Implementation

- **~850 lines of Python code**
- **Fully tested and working**
- **Documented with docstrings**
- **CLI integrated**
- **Validation ready**

Ready for HTML viewer implementation!

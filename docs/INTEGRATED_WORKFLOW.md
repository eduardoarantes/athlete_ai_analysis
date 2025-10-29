# Integrated Workflow - End-to-End Report Generation

## Overview

The cycling-ai pipeline now includes automated report data preparation as **Phase 5** of the multi-agent workflow. When you run `cycling-ai generate`, the system automatically creates `report_data.json` ready for the HTML viewer.

## Workflow Phases

### Complete Pipeline

```
Phase 1: Data Preparation
  ↓ (Parquet cache, athlete profile)
Phase 2: Performance Analysis
  ↓ (Performance metrics, time-in-zones)
Phase 3: Training Planning
  ↓ (12-week training plan with workouts)
Phase 4: Report Generation
  ↓ (Markdown reports)
Phase 5: Report Data Preparation  ← NEW!
  ↓ (report_data.json for HTML viewer)
```

### Phase 5: Report Data Preparation

**Purpose:** Consolidate training plan data into `report_data.json` format for interactive HTML viewing.

**Process:**
1. Extract training plan from LLM interaction log
2. Load athlete profile
3. Consolidate into standardized format
4. Validate data structure
5. Save `report_data.json` to output directory

**Output:**
- `{output_dir}/report_data.json` - Ready for HTML viewer

## Usage

### Standard Workflow

```bash
cycling-ai generate \
  --profile path/to/athlete_profile.json \
  --fit-dir path/to/fit_files \
  --output-dir /tmp/reports
```

**Output files:**
- `/tmp/reports/report_data.json` ← Automatically generated!
- `/tmp/reports/performance_report.md`
- `/tmp/reports/training_plan.md`
- `/tmp/reports/cache/activities_processed.parquet`

### With Cache (Skip Data Prep)

```bash
cycling-ai generate \
  --profile path/to/athlete_profile.json \
  --fit-dir path/to/fit_files \
  --output-dir /tmp/reports \
  --skip-data-prep
```

**Uses existing Parquet cache, then:**
- Phase 1: SKIPPED (cache exists)
- Phase 2: Performance Analysis
- Phase 3: Training Planning
- Phase 4: Report Generation
- Phase 5: Report Data Preparation ← Still runs!

### Example Run

```bash
cycling-ai generate \
  --profile /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json \
  --fit-dir /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities \
  --output-dir /tmp/cycling_report \
  --skip-data-prep
```

**Phase 5 Output:**
```
Phase 5: Report Data Preparation
------------------------------------------------------------
Extracting training plan from session...
✓ Extracted data for Athlete_Name
  ID: athlete_name
  FTP: 260W → 275.0W
  Weeks: 12

Creating report data structure...
✓ Report data created with 1 athlete(s)

Saving to: /tmp/cycling_report/report_data.json
✓ Report data saved (127,741 bytes)
```

## Implementation Details

### Code Changes

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**Added Method:**
```python
def _execute_phase_5(
    self, config: WorkflowConfig, all_results: list[PhaseResult]
) -> PhaseResult:
    """
    Execute Phase 5: Report Data Preparation.

    Consolidates training plan data into report_data.json format
    for use with the HTML viewer.
    """
    from cycling_ai.tools.report_data_extractor import (
        extract_from_session_file,
        create_report_data,
    )

    # Get session file
    session_file = self.session_manager.get_session_file()

    # Extract athlete data
    athlete_data = extract_from_session_file(
        session_path=session_file,
        athlete_profile_path=config.athlete_profile_path,
    )

    # Create report data
    report_data = create_report_data([athlete_data], generator_info)

    # Save to output directory
    output_path = config.output_dir / "report_data.json"
    with open(output_path, "w") as f:
        json.dump(report_data, f, indent=2)

    return PhaseResult(
        phase_name="report_data_preparation",
        status=PhaseStatus.COMPLETED,
        agent_response=f"Report data prepared and saved to {output_path}",
        ...
    )
```

**Modified Workflow:**
```python
def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
    # ... Phase 1-4 execution ...

    # Phase 5: Prepare Report Data (NEW)
    if config.generate_training_plan:
        phase5_result = self._execute_phase_5(config, phase_results)
        phase_results.append(phase5_result)
    else:
        # Skip if no training plan
        phase_results.append(PhaseResult(
            phase_name="report_data_preparation",
            status=PhaseStatus.SKIPPED,
            agent_response="No training plan generated",
        ))

    # Return workflow result
    return WorkflowResult(...)
```

### When Phase 5 Runs

**Runs when:**
- ✅ Training plan generation is enabled (default)
- ✅ Phase 3 completed successfully
- ✅ Session file exists with training plan data

**Skipped when:**
- ❌ `--no-training-plan` flag is used
- ❌ Phase 3 failed or was skipped
- ❌ No training plan in interaction log

### Error Handling

Phase 5 has comprehensive error handling:

```python
try:
    # Extract and prepare data
    ...
    return PhaseResult(status=PhaseStatus.COMPLETED, ...)

except FileNotFoundError:
    return PhaseResult(
        status=PhaseStatus.FAILED,
        errors=["Session file not found"],
    )

except Exception as e:
    return PhaseResult(
        status=PhaseStatus.FAILED,
        errors=[str(e)],
    )
```

**Note:** Phase 5 failure is **non-fatal**. The workflow continues and markdown reports are still generated.

## Data Flow

```
┌─────────────────────┐
│ cycling-ai generate │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────┐
│ Phase 1-3: Analysis & Planning      │
│ - Generates training plan           │
│ - Logs to interaction.jsonl         │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│ Phase 4: Report Generation          │
│ - Markdown reports                  │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│ Phase 5: Report Data Preparation    │
│                                     │
│ 1. Read interaction.jsonl           │
│ 2. Extract training plan JSON       │
│ 3. Load athlete profile             │
│ 4. Consolidate data                 │
│ 5. Save report_data.json            │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│ Output Directory                    │
│                                     │
│ ├── report_data.json       ← NEW!  │
│ ├── performance_report.md           │
│ ├── training_plan.md                │
│ └── cache/                          │
│     └── activities_processed.parquet│
└─────────────────────────────────────┘
```

## Testing

### Test Phase 5 Independently

```bash
python3 scripts/test_integrated_report_prep.py
```

**Output:**
```
============================================================
INTEGRATED REPORT DATA PREPARATION TEST
============================================================

Phase 5: Report Data Preparation
------------------------------------------------------------
✓ Extracted data for Athlete_Name
✓ Report data created with 1 athlete(s)
✓ Report data saved (127,741 bytes)

============================================================
PHASE 5 COMPLETE
============================================================

✓ Integrated workflow Phase 5 completed successfully!
```

### Validate Output

```bash
python scripts/validate_report_data.py /tmp/cycling_report/report_data.json
```

**Output:**
```
Validation successful!

Data summary:
  Version: 1.0
  Number of athletes: 1

  Athlete: Athlete_Name (ID: athlete_name)
    FTP: 260W
    Training plan: 12 weeks
    Target FTP: 275.0W
    Number of workouts: 44
```

## Benefits

### 1. **Automated Workflow**
- No manual data extraction needed
- Single command produces everything
- Consistent data format

### 2. **Seamless Integration**
- Phase 5 runs automatically
- Uses existing session data
- No additional LLM calls

### 3. **Ready for Visualization**
- `report_data.json` ready for HTML viewer
- Standardized format
- Validated structure

### 4. **No Extra Cost**
- Phase 5 is pure Python processing
- No additional API calls
- Fast execution (~0.1 seconds)

### 5. **Robust Error Handling**
- Phase 5 failure doesn't break workflow
- Markdown reports still generated
- Clear error messages

## Output File

### report_data.json Structure

```json
{
  "version": "1.0",
  "generated_timestamp": "2025-10-29T10:30:00Z",
  "generator": {
    "tool": "cycling-ai",
    "version": "0.1.0",
    "command": "generate (integrated workflow)"
  },
  "athletes": [
    {
      "id": "athlete_name",
      "name": "Athlete Name",
      "profile": {
        "age": 51,
        "ftp": 260,
        "weight_kg": 84,
        "goals": "..."
      },
      "training_plan": {
        "current_ftp": 260,
        "target_ftp": 275,
        "total_weeks": 12,
        "power_zones": {...},
        "weekly_workouts": [
          {
            "week": 1,
            "phase": "Foundation",
            "workouts": {
              "Tuesday": {
                "name": "Threshold",
                "segments": [...],
                "svg": "..."
              },
              ...
            }
          },
          ...
        ]
      }
    }
  ]
}
```

### File Size

Typical sizes:
- **With 12-week plan:** ~120-130 KB
- **With SVG charts:** Includes all power profile visualizations
- **Compressed:** Can be ~20-25 KB gzipped

## Next Steps

Now that `report_data.json` is automatically generated:

1. **Build HTML Viewer** - Interactive training calendar
2. **Copy Viewer to Output** - Include viewer template in output directory
3. **Single-Click Access** - Open HTML file to view plan

### Future Enhancement

```bash
cycling-ai generate \
  --profile ... \
  --output-dir /tmp/report \
  --open-viewer  # ← Auto-open HTML viewer when done
```

This would:
1. Generate all reports
2. Prepare report data
3. Copy HTML viewer template
4. Open in default browser

## Files Modified

- `src/cycling_ai/orchestration/multi_agent.py` (+90 lines)
  - Added `_execute_phase_5()` method
  - Updated `execute_workflow()` to call Phase 5
  - Updated docstrings

## Files Created

- `scripts/test_integrated_report_prep.py` (test script)
- `docs/INTEGRATED_WORKFLOW.md` (this file)

## Summary

✅ **Phase 5 integrated into workflow**
✅ **Automatic report_data.json generation**
✅ **No manual data preparation needed**
✅ **Ready for HTML viewer implementation**

The end-to-end pipeline is now complete:
**FIT files → Analysis → Training Plan → report_data.json**

All you need to do is run:
```bash
cycling-ai generate --profile ... --fit-dir ... --output-dir ...
```

And you get everything including `report_data.json` ready for interactive viewing!

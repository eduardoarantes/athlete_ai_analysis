# Multi-Agent Workflow Phases

**Version:** 1.2
**Last Updated:** 2025-11-03
**Status:** Production

This document describes the 4-phase multi-agent workflow for generating comprehensive cycling performance reports with training plans.

---

## Overview

The workflow orchestrates 4 specialized AI agents that execute sequentially:
1. **Data Preparation** - Validates and prepares data (deterministic, no LLM)
2. **Performance Analysis** - Analyzes performance with optional cross-training impact
3. **Training Planning** - Generates periodized training plans (optional)
4. **Report Data Preparation** - Consolidates data for HTML report generation (deterministic, no LLM)

**Total LLM Interactions:** 2-3 (Phases 2 and 3 only)
**Total Execution Time:** 2-5 minutes
**Deterministic Phases:** 1 and 4 (direct tool execution, 100% predictable)

---

## Phase 1: Data Preparation

**Phase Name:** `data_preparation`
**LLM Required:** No (direct tool execution)
**Duration:** ~5-10 seconds
**Implementation:** `src/cycling_ai/orchestration/phases/data_preparation.py`

### Goals

1. **Validate Input Files**
   - Check CSV file exists and has required columns
   - Validate athlete profile JSON exists and is parsable
   - Check FIT directory exists (if provided)

2. **Create Enriched Parquet Cache**
   - Load activities from CSV
   - Parse and extract data from FIT files (if available)
   - Enrich activities with power zone classification
   - Categorize activities by type (Cycling, Running, Strength, etc.)
   - Save to Parquet format for fast access in subsequent phases

3. **Prepare Athlete Profile**
   - Load athlete profile
   - Validate required fields (FTP, max_hr, weight, age)
   - Calculate power zones based on FTP

### Tools Used

- `validate_data_sources` - Validates all input files
- `prepare_activity_cache` - Creates enriched Parquet cache

### Output Data

```python
{
    "csv_validated": True,
    "fit_files_count": 42,
    "cache_file_path": "/tmp/cycling_eduardo_20251103/cache/activities_processed.parquet",
    "athlete_profile_path": "/path/to/athlete_profile.json",
    "validation_results": {
        "csv_valid": True,
        "profile_valid": True,
        "fit_dir_valid": True
    }
}
```

### Prompts

**This phase does NOT use prompts** (deterministic tool execution)

**Implementation Reference:**
- Phase: `src/cycling_ai/orchestration/phases/data_preparation.py`
- Tools: `src/cycling_ai/tools/wrappers/data_validation_tool.py`
- Tools: `src/cycling_ai/tools/wrappers/cache_preparation_tool.py`

---

## Phase 2: Performance Analysis

**Phase Name:** `performance_analysis`
**LLM Required:** Yes (with prefetch optimization)
**Duration:** ~20-30 seconds
**LLM Interactions:** 1 (reduced from 2-3 via prefetch)
**Implementation:** `src/cycling_ai/orchestration/phases/performance_analysis.py`

### Goals

1. **Compare Time Periods**
   - Analyze recent period (e.g., last 6 months)
   - Compare with equivalent prior period (e.g., months 7-12)
   - Calculate trends in power, speed, distance, time

2. **Calculate Zone Distribution**
   - Analyze time spent in each power zone
   - Evaluate training intensity distribution
   - Check adherence to polarized training (80/20 rule)

3. **Cross-Training Impact (Conditional)**
   - Auto-detect if athlete does multiple sports
   - Analyze activity distribution by category
   - Identify interference events (e.g., hard strength < 24h before cycling)
   - Assess load balance across activities

4. **Generate Insights**
   - Identify key performance trends
   - Provide actionable insights
   - Recommend training adjustments

### Execution Mode: Prefetch Optimization

**Phase 2 uses prefetch optimization** to reduce LLM interactions from 2-3 to 1:

1. **Prefetch Step** (before LLM): Tools executed deterministically
   - `analyze_performance` - Compare time periods
   - `analyze_cross_training_impact` - Cross-training analysis (if warranted)

2. **Synthesis Step** (LLM): Single interaction
   - LLM receives pre-computed data
   - LLM synthesizes into structured JSON report
   - No tool calling needed (already done)

**Benefit:** ~30% token savings, 100% reliable (no incorrect tool parameters)

### Tools Used

- `analyze_performance` - Compare performance across periods (prefetched)
- `analyze_cross_training_impact` - Analyze multi-sport impact (prefetched, conditional)

### Cross-Training Auto-Detection

Phase 2 automatically enables cross-training analysis if:
- At least 20 total activities in cache
- At least 2 different activity categories
- At least 10% of activities are non-cycling

**Override:** Set `analyze_cross_training=True/False` in config to force enable/disable

### Output Data

```python
{
    "performance_analysis_json": {...},  # Full performance report
    "performance_data": {...},           # Alias for Phase 4 compatibility
    "zones_data": [...],                 # Extracted from time_in_zones
    "cross_training_analysis": {...}     # Optional, if cross-training detected
}
```

### Prompts

**System Prompt:**
- File: `prompts/default/1.2/performance_analysis.txt`
- Purpose: Defines LLM role as performance analyst
- Tools: Lists available tools and their purposes
- Output: Specifies JSON schema for performance report

**User Prompt:**
- File: `prompts/default/1.2/performance_analysis_user.txt`
- Purpose: Provides task instructions and data locations
- Context: Includes period_months, cache path, athlete profile path
- Conditional: Adds cross-training instructions if warranted

**Cross-Training Add-on:**
- File: `prompts/default/1.2/performance_analysis_cross_training_addon.txt`
- Purpose: Additional instructions for cross-training analysis
- Usage: Conditionally injected into user prompt

**Prefetch Mode (Current):**
- File: Uses `_get_user_message_with_data()` method
- Purpose: Embeds pre-computed tool results in prompt
- Mode: Synthesis-only (no tool access)

**Prompt Links:**
- System: [prompts/default/1.2/performance_analysis.txt](../prompts/default/1.2/performance_analysis.txt)
- User: [prompts/default/1.2/performance_analysis_user.txt](../prompts/default/1.2/performance_analysis_user.txt)
- Cross-Training: [prompts/default/1.2/performance_analysis_cross_training_addon.txt](../prompts/default/1.2/performance_analysis_cross_training_addon.txt)

---

## Phase 3: Training Planning (Optional)

**Phase Name:** `training_planning`
**LLM Required:** Yes
**Duration:** ~60-120 seconds
**LLM Interactions:** 5-30 (depends on plan length)
**Implementation:** `src/cycling_ai/orchestration/phases/training_planning.py`

### Sub-Phases

Phase 3 consists of **3 sequential sub-phases**:

#### Phase 3a: Overview Generation
- **Duration:** ~5-10 seconds (1 LLM interaction)
- **Tool:** `create_plan_overview`
- **Output:** `plan_id` + weekly structure

#### Phase 3b: Weekly Details
- **Duration:** ~40-100 seconds (N LLM interactions, N = number of weeks)
- **Tool:** `add_week_details` (called once per week)
- **Output:** Detailed workouts for each week

#### Phase 3c: Finalization
- **Duration:** ~2-5 seconds (no LLM, Python only)
- **Tool:** `finalize_training_plan`
- **Output:** Complete validated training plan JSON

### Goals

1. **Generate Periodized Plan**
   - Define training phases (Foundation, Build, Recovery, Peak, Taper)
   - Assign weekly phase progression
   - Calculate TSS targets per week
   - Prescribe training days with specific workout types

2. **Create Weekly Workout Details**
   - Generate detailed workouts for each training day
   - Structure workouts with segments (warmup, intervals, cooldown)
   - Set power targets based on FTP zones
   - Include coaching notes and execution guidance

3. **Validate and Finalize**
   - Assemble complete plan from overview + weeks
   - Validate weekly TSS targets vs actual
   - Validate time budget compliance
   - Save to output directory

### New Training Days Structure

**Phase 3 uses explicit 7-day workout prescription** (introduced in commit 54b747b):

**Old Format (deprecated):**
```json
{
  "target_tss": 280,
  "hard_days": 1,
  "easy_days": 2,
  "rest_days": 4
}
```

**New Format (current):**
```json
{
  "training_days": [
    {"weekday": "Monday", "workout_type": "rest"},
    {"weekday": "Tuesday", "workout_type": "endurance"},
    {"weekday": "Wednesday", "workout_type": "recovery"},
    {"weekday": "Thursday", "workout_type": "rest"},
    {"weekday": "Friday", "workout_type": "tempo"},
    {"weekday": "Saturday", "workout_type": "endurance"},
    {"weekday": "Sunday", "workout_type": "endurance"}
  ],
  "target_tss": 280
}
```

**Workout Types** (from 222-workout library):
- `rest` - Complete rest day
- `recovery` - Active recovery (11 workouts)
- `endurance` - Long aerobic rides (104 workouts)
- `tempo` - Sub-threshold work (8 workouts)
- `sweet_spot` - Sweet spot training (2 workouts - use sparingly)
- `threshold` - FTP/lactate threshold (81 workouts)
- `vo2max` - VO2max intervals (5 workouts - Peak phase only)
- `mixed` - Combined intensities (11 workouts)

### Weekend Priority Rule

**New in commit 49d3ddd:**

If Saturday AND Sunday are BOTH available for training, the LLM **MUST** use them:
- Weekends allow longer endurance rides (2-3 hours) without time constraints
- Saturday: Long endurance ride OR key quality session
- Sunday: Long endurance ride OR active recovery (if Saturday was hard)
- **DO NOT** leave weekends as rest days if they are available

### Tools Used

- `create_plan_overview` - Phase 3a: Create high-level structure
- `add_week_details` - Phase 3b: Add workouts for each week (iterative)
- `finalize_training_plan` - Phase 3c: Assemble and validate complete plan

### Output Data

```python
{
    "plan_id": "uuid-string",
    "training_plan": {
        "plan_id": "uuid-string",
        "athlete_profile_json": "/path/to/profile.json",
        "total_weeks": 12,
        "target_ftp": 280,
        "weekly_overview": [...],  # 12 week objects
        "coaching_notes": "...",
        "monitoring_guidance": "...",
        "weeks": [...]  # 12 week detail objects with workouts
    },
    "output_path": "/path/to/training_plan.json"
}
```

### Prompts

**Main Comprehensive Prompt (All 3 sub-phases):**
- File: `prompts/default/1.2/training_planning.txt`
- Purpose: Complete specification for all 3 phases
- Sections: Workout types, guidelines, compliance rules, examples
- Usage: Reference documentation (not directly used by LLM)

**Phase 3a Prompts (Overview Generation):**
- System: `prompts/default/1.2/training_planning_overview.txt`
  - Role: Expert cycling coach
  - Task: Create high-level periodization structure
  - Tools: `create_plan_overview`
  - Output: Plan overview with weekly structure

- User: `prompts/default/1.2/training_planning_overview_user.txt`
  - Context: Athlete profile, performance data, constraints
  - Instructions: Call `create_plan_overview` with weekly_overview array
  - Example: Shows proper JSON structure with training_days

**Phase 3b Prompts (Weekly Details):**
- System: `prompts/default/1.2/training_planning_weeks.txt`
  - Role: Expert cycling coach
  - Task: Generate detailed workouts for each week
  - Tools: `add_week_details`
  - Iteration: Call once per week sequentially

- User: `prompts/default/1.2/training_planning_weeks_user.txt`
  - Context: plan_id from Phase 3a, power zones, constraints
  - Instructions: Call `add_week_details` N times (once per week)
  - Example: Shows workout structure with segments

**Phase 3c Prompts (Finalization):**
- **No prompts** (deterministic Python execution)

**Combined Prompt (Legacy):**
- File: `prompts/default/1.2/training_planning_user.txt`
- Purpose: Shows all 3 phases in one document
- Usage: Testing or single-shot workflows (not used in multi-agent)

**Prompt Links:**
- Main Spec: [prompts/default/1.2/training_planning.txt](../prompts/default/1.2/training_planning.txt)
- Phase 3a System: [prompts/default/1.2/training_planning_overview.txt](../prompts/default/1.2/training_planning_overview.txt)
- Phase 3a User: [prompts/default/1.2/training_planning_overview_user.txt](../prompts/default/1.2/training_planning_overview_user.txt)
- Phase 3b System: [prompts/default/1.2/training_planning_weeks.txt](../prompts/default/1.2/training_planning_weeks.txt)
- Phase 3b User: [prompts/default/1.2/training_planning_weeks_user.txt](../prompts/default/1.2/training_planning_weeks_user.txt)
- Combined: [prompts/default/1.2/training_planning_user.txt](../prompts/default/1.2/training_planning_user.txt)

---

## Phase 4: Report Data Preparation

**Phase Name:** `report_data_preparation`
**LLM Required:** No (direct tool execution)
**Duration:** ~5-10 seconds
**Implementation:** `src/cycling_ai/orchestration/phases/report_preparation.py`

### Goals

1. **Consolidate All Data**
   - Combine performance data from Phase 2
   - Include zones data from Phase 2
   - Include training plan from Phase 3 (if generated)
   - Load athlete profile metadata

2. **Prepare Report Data JSON**
   - Structure data for HTML template consumption
   - Add metadata (generation timestamp, version)
   - Calculate summary statistics
   - Generate chart data structures

3. **Validate Data Completeness**
   - Ensure all required data present from previous phases
   - Validate data types and structure
   - Check for missing or malformed data

### Required Data from Previous Phases

From **Phase 2** (required):
- `performance_data` - Performance analysis JSON
- `zones_data` - Time-in-zones distribution

From **Phase 3** (required if training plan enabled):
- `training_plan` - Complete training plan JSON

### Tools Used

- **No tools** - Direct Python execution
- Uses: `consolidate_athlete_data()` function
- Uses: `create_report_data()` function

### Output Data

```python
{
    "report_data_json": "/path/to/output/report_data.json",
    "has_performance_analysis": True,
    "has_training_plan": True,
    "output_directory": "/path/to/output"
}
```

**Report Data JSON Structure:**
```json
{
    "metadata": {
        "generated_at": "2025-11-03T14:30:00",
        "version": "1.2.0",
        "athlete_name": "Eduardo"
    },
    "athlete": {...},
    "performance": {...},
    "zones": {...},
    "training_plan": {...}
}
```

### Prompts

**This phase does NOT use prompts** (deterministic tool execution)

**Implementation Reference:**
- Phase: `src/cycling_ai/orchestration/phases/report_preparation.py`
- Functions: `src/cycling_ai/tools/report_data_extractor.py`

---

## Data Flow Between Phases

```
Phase 1 (Data Preparation)
│
├─> Output: cache_file_path, athlete_profile_path
│
└─> Phase 2 (Performance Analysis)
    │
    ├─> Output: performance_data, zones_data, cross_training_analysis
    │
    └─> Phase 3 (Training Planning) [OPTIONAL]
        │
        ├─> Output: training_plan, plan_id
        │
        └─> Phase 4 (Report Data Preparation)
            │
            └─> Output: report_data.json
```

**Key Points:**
- Each phase has **session isolation** (fresh ConversationSession)
- Data flows via `previous_phase_data` in PhaseContext
- Phases 1 and 4 are **deterministic** (no LLM variability)
- Phases 2 and 3 use **LLM agents** with tool calling

---

## Prompt Version Control

**Current Version:** 1.2
**Location:** `prompts/default/1.2/`

### Version History

- **1.1** (deprecated): Initial multi-agent prompts
- **1.2** (current): Enhanced prompts with:
  - Explicit 7-day training_days structure
  - Workout type integration (222-workout library)
  - Weekend priority rules
  - Mandatory rest days guidance
  - Prefetch optimization support

### Prompt Maintenance Checklist

When updating prompts, verify:

- [ ] All prompt files use consistent terminology
- [ ] Tool names match actual tool registry
- [ ] JSON schemas match tool parameter definitions
- [ ] Examples show correct data structures
- [ ] Phase-specific constraints are documented
- [ ] Prompt links in this document are up-to-date

---

## Tool Registry

All tools used across phases:

| Tool Name | Phase | Purpose |
|-----------|-------|---------|
| `validate_data_sources` | 1 | Validate input files |
| `prepare_activity_cache` | 1 | Create Parquet cache |
| `analyze_performance` | 2 | Compare time periods |
| `analyze_cross_training_impact` | 2 | Analyze multi-sport impact |
| `create_plan_overview` | 3a | Create plan structure |
| `add_week_details` | 3b | Add weekly workouts |
| `finalize_training_plan` | 3c | Finalize plan |

**Tool Registry Location:** `src/cycling_ai/tools/registry.py`

---

## Troubleshooting

### Phase 1 Failures
- **CSV not found:** Check file path, ensure file exists
- **Profile invalid:** Verify JSON is parsable, has required fields
- **FIT directory missing:** Optional, workflow continues without FIT data

### Phase 2 Failures
- **Prefetch fails:** Falls back to normal tool-calling mode (2-3 interactions)
- **Cross-training disabled:** If < 10% non-cycling activities
- **JSON parse error:** Check LLM output format, may need model upgrade

### Phase 3 Failures
- **Weekly validation fails:** TSS/time targets too aggressive, LLM retries
- **Workout type invalid:** Case-insensitive validation, auto-corrects to lowercase
- **Weekend not used:** Check weekend priority guidance in prompts

### Phase 4 Failures
- **Missing performance_data:** Check Phase 2 data extraction (commit f15abe9)
- **Missing zones_data:** Should be extracted from time_in_zones in performance_data
- **Missing training_plan:** Only required if generate_training_plan=True

---

## References

- **Main Implementation:** `src/cycling_ai/orchestration/workflows/full_report.py`
- **Phase Base Class:** `src/cycling_ai/orchestration/phases/base_phase.py`
- **Agent Factory:** `src/cycling_ai/orchestration/agent.py`
- **Session Manager:** `src/cycling_ai/orchestration/session.py`
- **Prompts Manager:** `src/cycling_ai/orchestration/prompts.py`

---

**Document Version:** 1.0
**Last Updated:** 2025-11-03
**Maintainer:** Eduardo

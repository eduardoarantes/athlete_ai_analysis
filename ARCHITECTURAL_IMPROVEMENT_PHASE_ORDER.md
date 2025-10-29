# Architectural Improvement: Phase 4 and Phase 5 Order

## Current Problem

The current phase execution order is **logically inconsistent**:

```
Phase 1: Data Preparation
Phase 2: Performance Analysis
Phase 3: Training Planning
Phase 4: Report Generation (LLM)      ← Uses raw extracted_data
Phase 5: Report Data Preparation      ← Creates structured report_data.json
```

### Issues with Current Flow

1. **Data Duplication**:
   - Phase 4 uses `extracted_data` from phase results (raw tool outputs)
   - Phase 5 re-extracts data from session log to create structured format
   - Same data is processed twice in different ways

2. **Missed Opportunity**:
   - Phase 5 creates clean, structured `report_data.json`
   - Phase 4 LLM could benefit from this structured format
   - Instead, Phase 4 gets raw JSON from tool outputs

3. **Logical Inconsistency**:
   - You must **prepare data** before you can **generate reports** from it
   - Current order: Generate report → Then prepare the data (backwards!)

## Current Implementation Details

### Phase 4: Report Generation (lines 601-630)

```python
def _execute_phase_4(self, config: WorkflowConfig, all_results: list[PhaseResult]):
    # Combine data from all previous phases
    combined_data = {}
    for result in all_results:
        combined_data.update(result.extracted_data)  # ← Raw tool outputs

    return self._execute_phase(
        phase_name="report_generation",
        tools=["generate_report"],
        phase_context=combined_data,  # ← Unstructured data
    )
```

**What Phase 4 receives**:
```python
{
    "training_plan": {
        "athlete_profile": {...},
        "plan_metadata": {...},
        "weekly_plan": [...]  # Raw structure from finalize_training_plan
    },
    "performance_data": {...},  # Raw from analyze_performance
    "zones_data": {...}         # Raw from analyze_time_in_zones
}
```

### Phase 5: Report Data Preparation (lines 632-728)

```python
def _execute_phase_5(self, config: WorkflowConfig, all_results: list[PhaseResult]):
    # Extract from session log
    session_file = self.session_manager.get_session_file()

    athlete_data = extract_from_session_file(
        session_path=session_file,
        athlete_profile_path=config.athlete_profile_path,
    )  # ← Re-extracts same data!

    # Create structured format
    report_data = create_report_data([athlete_data], generator_info)

    # Save to file
    with open(output_path, "w") as f:
        json.dump(report_data, f, indent=2)
```

**What Phase 5 creates**:
```python
{
    "version": "1.0",
    "generated_timestamp": "...",
    "generator": {...},
    "athletes": [
        {
            "id": "...",
            "name": "...",
            "profile": {...},
            "training_plan": {
                "power_zones": {...},
                "weekly_workouts": [...]  # Clean, structured format
            }
        }
    ]
}
```

## Proposed Solution

### Swap Phase 4 and Phase 5

**Improved Flow**:
```
Phase 1: Data Preparation
Phase 2: Performance Analysis
Phase 3: Training Planning
Phase 4: Report Data Preparation    ← Create structured report_data.json FIRST
Phase 5: Report Generation (LLM)    ← Use structured data for HTML generation
```

### Benefits

1. **Single Data Pipeline**:
   - Phase 4 extracts and structures data once
   - Phase 5 uses the structured `report_data.json`
   - No duplication, consistent format

2. **Better LLM Input**:
   - LLM receives clean, structured data
   - Easier for LLM to generate consistent reports
   - Clear schema for report generation

3. **Logical Consistency**:
   - Prepare data → Generate reports (correct order!)
   - Matches intuitive workflow

4. **Separation of Concerns**:
   - Phase 4: Deterministic data extraction/structuring
   - Phase 5: Creative LLM report writing
   - Clear boundaries between phases

## Implementation Changes Required

### 1. Rename/Reorder Phase Methods

**File**: `src/cycling_ai/orchestration/multi_agent.py`

```python
# Current
def _execute_phase_4(self, ...):  # Report Generation (LLM)
def _execute_phase_5(self, ...):  # Report Data Preparation (deterministic)

# Proposed
def _execute_phase_4(self, ...):  # Report Data Preparation (deterministic)
def _execute_phase_5(self, ...):  # Report Generation (LLM)
```

### 2. Update Phase 5 to Use report_data.json

**Current Phase 5** (becomes Phase 4):
- Keep extraction logic
- Keep report_data.json creation
- Keep HTML viewer copying

**Current Phase 4** (becomes Phase 5):
```python
def _execute_phase_5(self, config: WorkflowConfig, all_results: list[PhaseResult]):
    """
    Execute Phase 5: Report Generation.

    Uses structured report_data.json from Phase 4 to generate HTML reports.
    """
    # Load structured data from Phase 4
    report_data_path = config.output_dir / "report_data.json"

    if not report_data_path.exists():
        return PhaseResult(
            phase_name="report_generation",
            status=PhaseStatus.FAILED,
            errors=["report_data.json not found from Phase 4"]
        )

    with open(report_data_path) as f:
        report_data = json.load(f)

    # Pass structured data to LLM
    return self._execute_phase(
        phase_name="report_generation",
        tools=["generate_report"],
        phase_context={"report_data": report_data},  # ← Clean, structured input
        user_message=...
    )
```

### 3. Update execute_workflow Order

**File**: `src/cycling_ai/orchestration/multi_agent.py:742-852`

```python
# Current
# Phase 4: Report Generation
phase4_result = self._execute_phase_4(config, phase_results)  # LLM
phase_results.append(phase4_result)

# Phase 5: Prepare Report Data
if config.generate_training_plan:
    phase5_result = self._execute_phase_5(config, phase_results)  # Deterministic
    phase_results.append(phase5_result)

# Proposed (swap calls)
# Phase 4: Prepare Report Data
if config.generate_training_plan:
    phase4_result = self._execute_phase_4(config, phase_results)  # Deterministic
    phase_results.append(phase4_result)

    if not phase4_result.success:
        return self._create_failed_workflow_result(...)

# Phase 5: Report Generation
phase5_result = self._execute_phase_5(config, phase_results)  # LLM
phase_results.append(phase5_result)
```

### 4. Update Progress Tracker

**File**: `src/cycling_ai/cli/commands/generate.py:31-58`

```python
self.phases: dict[str, dict[str, Any]] = {
    "data_preparation": {...},
    "performance_analysis": {...},
    "training_planning": {...},
    "report_data_preparation": {  # ← Phase 4 (was Phase 5)
        "name": "Report Data Preparation",
        "status": PhaseStatus.PENDING,
    },
    "report_generation": {  # ← Phase 5 (was Phase 4)
        "name": "Report Generation",
        "status": PhaseStatus.PENDING,
    },
}
```

### 5. Update Tool Prompts

**File**: `prompts/default/1.0/report_generation.txt`

Update to reference structured `report_data` format:

```
You are a professional cycling coach and technical writer.

You have access to structured training plan data in report_data format.

**Input Format**:
The report_data contains:
- Athlete profile (name, age, FTP, goals, etc.)
- Power zones (Z1-Z5, Sweet Spot)
- Weekly workouts (12 weeks with detailed segments)
- Plan metadata (current FTP, target FTP, progression)

**Your Task**:
Generate comprehensive HTML reports using the generate_report tool.
...
```

## Migration Strategy

### Option 1: Simple Swap (Recommended)

1. Swap method implementations between `_execute_phase_4` and `_execute_phase_5`
2. Update `execute_workflow` to call in new order
3. Update progress tracker labels
4. Update prompts to reference new data format
5. Test end-to-end

**Pros**: Minimal code changes, preserves existing functionality
**Cons**: Method names don't match phase numbers

### Option 2: Rename Methods

1. Rename `_execute_phase_4` → `_execute_phase_4_new` (deterministic)
2. Rename `_execute_phase_5` → `_execute_phase_5_new` (LLM)
3. Update all calls
4. Update prompts and progress tracker

**Pros**: Clean naming, matches phase numbers
**Cons**: More changes, higher risk of bugs

### Option 3: Introduce Phase 3.5

Add intermediate phase between 3 and 4 for data preparation, keep current Phase 4/5 as is.

**Pros**: No breaking changes
**Cons**: More phases, doesn't fix the logical issue

## Testing Checklist

After implementing the swap:

- [ ] Phase 4 creates `report_data.json` successfully
- [ ] Phase 4 copies `training_plan_viewer.html`
- [ ] Phase 5 can read `report_data.json`
- [ ] Phase 5 LLM receives structured data
- [ ] Phase 5 generates HTML reports
- [ ] Progress tracker shows correct phase names
- [ ] Token usage is similar or improved
- [ ] Output files are identical to current implementation
- [ ] Error handling works for Phase 4 failures
- [ ] Error handling works for Phase 5 failures

## Expected Impact

### Performance
- **Neutral**: Same number of operations, just reordered
- **Possible improvement**: LLM might generate better reports with structured input

### Code Quality
- **Improved**: More logical flow
- **Improved**: Clear separation of concerns (deterministic → creative)
- **Improved**: Single data extraction pipeline

### User Experience
- **Unchanged**: Same output files
- **Unchanged**: Same execution time
- **Potential improvement**: More consistent HTML reports from Phase 5

## Recommendation

**Implement Option 1 (Simple Swap)** because:

1. Minimal code changes reduce risk
2. Fixes the logical inconsistency
3. Improves data flow without breaking functionality
4. Can rename methods later if needed (separate PR)

The swap should be straightforward since Phase 4 and Phase 5 are already largely independent of each other's implementation details.

## Related Files

- `src/cycling_ai/orchestration/multi_agent.py` (main changes)
- `src/cycling_ai/cli/commands/generate.py` (progress tracker)
- `prompts/default/1.0/report_generation.txt` (prompt updates)
- `src/cycling_ai/tools/wrappers/report_tool.py` (may need parameter updates)

## Future Enhancements

After fixing the phase order:

1. **Unified Data Format**: Use `report_data.json` schema as the standard throughout
2. **Eliminate Phase 4 Duplication**: Remove `extracted_data` from phase results, use session log exclusively
3. **Streaming**: Could stream data from Phase 4 to Phase 5 instead of file I/O
4. **Validation**: Add schema validation for `report_data.json` between phases
5. **Caching**: Cache Phase 4 output to allow Phase 5 retries without re-extraction

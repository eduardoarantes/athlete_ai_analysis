# Legacy Code Cleanup Summary

**Date:** 2025-10-31
**Issue:** `target_ftp: N/A` appearing in logs despite LLM correctly sending `target_ftp: 240`
**Root Cause:** Legacy handling code looking for data in wrong locations

## Problem Analysis

The system was generating data in NEW format (prompts/default/1.1) but had dead legacy handling code that:
1. Logged incorrect field paths
2. Checked for non-existent legacy fields
3. Created confusion about data structure

## Changes Made

### Phase 1: Fix Critical Logging Bugs ✅

**File:** `src/cycling_ai/orchestration/multi_agent.py`

**Fix 1 (Lines 369-372):** Correct `target_ftp` extraction
```python
# BEFORE (WRONG):
logger.info(f"Training plan target_ftp: {plan_data.get('target_ftp', 'N/A')}")

# AFTER (CORRECT):
plan_metadata = plan_data.get('plan_metadata', {})
target_ftp_value = plan_metadata.get('target_ftp', 'N/A')
logger.info(f"Training plan target_ftp: {target_ftp_value}")
```

**Fix 2 (Lines 995-1004):** Correct `weekly_plan` extraction
```python
# BEFORE (WRONG):
logger.info(f"weekly_workouts length: {len(tp.get('weekly_workouts', []))}")

# AFTER (CORRECT):
if 'training_plan' in tp and isinstance(tp['training_plan'], dict):
    nested_plan = tp['training_plan']
    weekly_plan_len = len(nested_plan.get('weekly_plan', []))
    plan_metadata = nested_plan.get('plan_metadata', {})
    target_ftp = plan_metadata.get('target_ftp', 'N/A')
    logger.info(f"weekly_plan length: {weekly_plan_len}")
    logger.info(f"target_ftp: {target_ftp}")
```

### Phase 2: Remove Legacy Handling ✅

**File:** `src/cycling_ai/tools/report_data_extractor.py`

**Changes:**
1. **Removed** legacy format detection (lines 318-395)
2. **Removed** `weekly_workouts` handling
3. **Added** validation for required NEW format fields
4. **Simplified** to only process NEW format with `plan_metadata` + `weekly_plan`
5. **Updated** logging in `create_report_data()` to use correct field names

**Before:** 77 lines with if/else legacy handling
**After:** 45 lines, single code path

### Phase 3: Schema Update (Pending)

**File:** `schemas/report_data_schema.json`
**Status:** Needs update to align with NEW format

Currently expects (WRONG):
- Flat `target_ftp`
- `weekly_workouts` array

Should expect (CORRECT):
- Nested `training_plan.training_plan` structure
- `plan_metadata.target_ftp`
- `weekly_plan` array

## Data Structure Reference

### Actual Structure (NEW Format)

**From `finalize_training_plan()`:**
```json
{
  "athlete_profile": {...},
  "plan_metadata": {
    "total_weeks": 4,
    "current_ftp": 236.0,
    "target_ftp": 240.0,  ← HERE!
    "ftp_gain_watts": 4.0,
    "ftp_gain_percent": 1.69
  },
  "coaching_notes": "...",
  "monitoring_guidance": "...",
  "weekly_plan": [...]  ← NOT weekly_workouts!
}
```

**After `consolidate_athlete_data()`:**
```json
{
  "id": "tom",
  "name": "Tom",
  "training_plan": {
    "training_plan": {  ← Double nesting for viewer compatibility
      "athlete_profile": {...},
      "plan_metadata": {
        "target_ftp": 240.0  ← Access path
      },
      "weekly_plan": [...]
    }
  }
}
```

## Testing

**Test File:** `tests/test_multi_agent_logging_fixes.py`

**Coverage:**
- ✅ Extract `target_ftp` from `plan_metadata` (not top level)
- ✅ Extract `weekly_plan` from nested structure (not `weekly_workouts`)
- ✅ Validate with real session data (interaction 3)
- ✅ Phase 4 nested structure extraction

**Results:** All 4 tests passing

## Verification with Real Data

**Session:** `logs/llm_interactions/session_20251031_142700.jsonl`
**Interaction 3:** LLM sent `target_ftp: 240` as parameter
**Tool Result:** Created structure with `plan_metadata.target_ftp: 240.0`

**Before fixes:** Logs showed `target_ftp: N/A`
**After fixes:** Logs will show `target_ftp: 240.0`

## Impact Assessment

🟢 **LOW RISK - All Safe Changes**

- ✅ No actual legacy data exists in production
- ✅ HTML viewer already expects NEW format
- ✅ All generators produce NEW format
- ✅ Only validators were wrong (and not strictly enforced)

## Files Modified

1. `src/cycling_ai/orchestration/multi_agent.py` - 2 logging fixes
2. `src/cycling_ai/tools/report_data_extractor.py` - Removed legacy handling
3. `tests/test_multi_agent_logging_fixes.py` - New unit tests

## Files Pending

1. `schemas/report_data_schema.json` - Needs alignment with NEW format
2. Documentation files - Update field references

## Next Steps

1. ✅ **Phase 1 Complete:** Critical bugs fixed
2. ✅ **Phase 2 Complete:** Legacy code removed
3. ⏳ **Phase 3 Pending:** Update schema to match reality
4. ⏳ **Phase 4 Pending:** Update documentation
5. ⏳ **Integration Test:** Run full workflow to verify

## Lessons Learned

1. **Dead code is misleading code** - Legacy handling was never used but caused confusion
2. **Schema should match reality** - `report_data_schema.json` was out of sync
3. **Log what you actually have** - Incorrect logging paths masked the real structure
4. **Unit tests prevent regression** - Tests ensure fixes stay fixed

## References

- Prompt version: `prompts/default/1.1/`
- Output schema: `schemas/training_plan_output_schema.json` (CORRECT)
- Report schema: `schemas/report_data_schema.json` (NEEDS UPDATE)
- HTML Viewer: `templates/training_plan_viewer.html:1273` (expects NEW format)

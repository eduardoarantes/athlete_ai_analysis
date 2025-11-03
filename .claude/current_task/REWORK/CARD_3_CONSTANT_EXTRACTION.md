# CARD 3: Extract Magic Numbers to Constants

**Status:** BLOCKED (Waiting for Cards 1-2)
**Priority:** MEDIUM
**Estimated Time:** 30 minutes
**Dependencies:** Card 1 (Linting Fixes), Card 2 (Test Implementation)

---

## Objective

Extract all magic numbers in `add_week_tool.py` to well-named constants at module level, improving code readability and maintainability.

---

## Current State

**Magic Numbers Identified:** 14 unique values

| Value | Usage Count | Lines |
|-------|-------------|-------|
| 60 | 1 | 389 |
| 15 | 2 | 388, 149 |
| 10 | 2 | 390, 154 |
| 80 | 2 | 239, 403 |
| 0.5 | 1 | 253 |
| 0.7 | 1 | 253 |
| 8 | 1 | 148 |
| 12 | 1 | 150 |
| 20 | 2 | 151, 155 |
| 25 | 1 | 157 |

---

## Constant Definitions

### Location

Add after imports, before helper functions (around line 24):

```python
logger = logging.getLogger(__name__)


# ============================================================================
# Validation Constants
# ============================================================================

# Time and TSS validation thresholds (percentage)
# Normal weeks: standard tolerances for base/build phases
NORMAL_TIME_WARN_THRESHOLD_PCT = 10  # ±10% warning
NORMAL_TIME_ERROR_THRESHOLD_PCT = 20  # ±20% error (hard limit)
NORMAL_TSS_WARN_THRESHOLD_PCT = 15  # ±15% warning
NORMAL_TSS_ERROR_THRESHOLD_PCT = 25  # ±25% error (hard limit)

# Recovery weeks: stricter tolerances to ensure adequate recovery
RECOVERY_TIME_WARN_THRESHOLD_PCT = 8  # ±8% warning (stricter)
RECOVERY_TIME_ERROR_THRESHOLD_PCT = 15  # ±15% error (stricter than normal)
RECOVERY_TSS_WARN_THRESHOLD_PCT = 12  # ±12% warning (stricter)
RECOVERY_TSS_ERROR_THRESHOLD_PCT = 20  # ±20% error (stricter than normal)

# Endurance workout identification thresholds
ENDURANCE_POWER_THRESHOLD_PCT = 80  # Power must be < 80% FTP to be endurance
ENDURANCE_SEGMENT_RATIO_THRESHOLD = 0.5  # At least 50% of segments must be endurance type
ENDURANCE_DURATION_RATIO_THRESHOLD = 0.7  # OR at least 70% of duration in endurance zones

# Auto-fix parameters for time budget violations
MIN_ENDURANCE_DURATION_MIN = 60  # Minimum endurance segment duration (don't reduce below)
AUTO_FIX_REDUCTION_INCREMENT_MIN = 15  # Reduce segments in 15-minute increments
MAX_AUTO_FIX_ITERATIONS = 10  # Maximum reduction attempts before giving up


# ============================================================================
# Helper Functions for Week Validation
# ============================================================================
```

---

## Replacement Plan

### Phase 1: Validation Thresholds

#### Location: `_validate_time_and_tss()` function (lines 145-158)

**BEFORE:**
```python
    if is_recovery_week:
        # Recovery weeks: tighter tolerances to ensure reduced volume
        time_warn_threshold = 8   # ±8% warning
        time_error_threshold = 15  # ±15% error (stricter than normal 20%)
        tss_warn_threshold = 12   # ±12% warning
        tss_error_threshold = 20  # ±20% error (stricter than normal 25%)
    else:
        # Normal weeks: standard tolerances
        time_warn_threshold = 10
        time_error_threshold = 20
        tss_warn_threshold = 15
        tss_error_threshold = 25
```

**AFTER:**
```python
    if is_recovery_week:
        # Recovery weeks: tighter tolerances to ensure reduced volume
        time_warn_threshold = RECOVERY_TIME_WARN_THRESHOLD_PCT
        time_error_threshold = RECOVERY_TIME_ERROR_THRESHOLD_PCT
        tss_warn_threshold = RECOVERY_TSS_WARN_THRESHOLD_PCT
        tss_error_threshold = RECOVERY_TSS_ERROR_THRESHOLD_PCT
    else:
        # Normal weeks: standard tolerances
        time_warn_threshold = NORMAL_TIME_WARN_THRESHOLD_PCT
        time_error_threshold = NORMAL_TIME_ERROR_THRESHOLD_PCT
        tss_warn_threshold = NORMAL_TSS_WARN_THRESHOLD_PCT
        tss_error_threshold = NORMAL_TSS_ERROR_THRESHOLD_PCT
```

**Verification:**
```bash
# After change, run:
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestValidateTimeAndTSS -v
# All 5 tests should still pass
```

---

### Phase 2: Endurance Workout Identification

#### Location 1: `_is_endurance_workout()` (line 239)

**BEFORE:**
```python
        # Endurance types: steady, endurance
        # Power threshold: < 80% FTP
        is_endurance_type = seg_type in ["steady", "endurance"]
        is_low_power = power_low < 80
```

**AFTER:**
```python
        # Endurance types: steady, endurance
        # Power threshold: < ENDURANCE_POWER_THRESHOLD_PCT
        is_endurance_type = seg_type in ["steady", "endurance"]
        is_low_power = power_low < ENDURANCE_POWER_THRESHOLD_PCT
```

#### Location 2: `_is_endurance_workout()` (line 253)

**BEFORE:**
```python
    # Return True if either threshold met
    return segment_ratio >= 0.5 or duration_ratio >= 0.7
```

**AFTER:**
```python
    # Return True if either threshold met
    return (
        segment_ratio >= ENDURANCE_SEGMENT_RATIO_THRESHOLD or
        duration_ratio >= ENDURANCE_DURATION_RATIO_THRESHOLD
    )
```

#### Location 3: `_attempt_auto_fix()` (line 403)

**BEFORE:**
```python
            # Endurance segment with low power
            if seg_type in ["steady", "endurance"] and power_low < 80:
                if duration > longest_duration:
                    longest_duration = duration
                    longest_seg_idx = idx
```

**AFTER:**
```python
            # Endurance segment with low power
            if (
                seg_type in ["steady", "endurance"]
                and power_low < ENDURANCE_POWER_THRESHOLD_PCT
                and duration > longest_duration
            ):
                longest_duration = duration
                longest_seg_idx = idx
```

**Verification:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestIsEnduranceWorkout -v
# All 4 tests should still pass
```

---

### Phase 3: Auto-Fix Parameters

#### Location: `_attempt_auto_fix()` (lines 388-390)

**BEFORE:**
```python
    # Step 2: Reduce main segments by 15-minute intervals
    # Find the longest endurance segment
    reduction_increment = 15  # minutes
    min_endurance_duration = 60  # minimum duration
    max_iterations = 10
```

**AFTER:**
```python
    # Step 2: Reduce main segments by incremental amounts
    # Find the longest endurance segment
    reduction_increment = AUTO_FIX_REDUCTION_INCREMENT_MIN
    min_endurance_duration = MIN_ENDURANCE_DURATION_MIN
    max_iterations = MAX_AUTO_FIX_ITERATIONS
```

**Verification:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestAttemptAutoFix -v
# All 8 tests should still pass
```

---

## Implementation Steps

### Step 1: Add Constant Definitions

**File:** `src/cycling_ai/tools/wrappers/add_week_tool.py`
**Line:** After line 23 (after `logger = logging.getLogger(__name__)`)

```bash
# Open file in editor
code src/cycling_ai/tools/wrappers/add_week_tool.py

# Add constants block (shown above)
# Save file
```

**Verify Syntax:**
```bash
python -m py_compile src/cycling_ai/tools/wrappers/add_week_tool.py
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict
```

### Step 2: Replace Validation Thresholds

**Edit function:** `_validate_time_and_tss()` (lines 145-158)

**Find and replace:**
```python
# Replace lines 148-157 with constant references
```

**Verify:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestValidateTimeAndTSS -v
```

### Step 3: Replace Endurance Thresholds

**Edit function:** `_is_endurance_workout()` (lines 239, 253)

**Replace:**
- Line 239: `80` → `ENDURANCE_POWER_THRESHOLD_PCT`
- Line 253: `0.5` → `ENDURANCE_SEGMENT_RATIO_THRESHOLD`
- Line 253: `0.7` → `ENDURANCE_DURATION_RATIO_THRESHOLD`

**Verify:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestIsEnduranceWorkout -v
```

### Step 4: Replace Auto-Fix Parameters

**Edit function:** `_attempt_auto_fix()` (lines 388-390, 403)

**Replace:**
- Line 388: `15` → `AUTO_FIX_REDUCTION_INCREMENT_MIN`
- Line 389: `60` → `MIN_ENDURANCE_DURATION_MIN`
- Line 390: `10` → `MAX_AUTO_FIX_ITERATIONS`
- Line 403: `80` → `ENDURANCE_POWER_THRESHOLD_PCT`

**Verify:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestAttemptAutoFix -v
```

### Step 5: Final Verification

**Run all tests:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v
# Expected: 36 passed
```

**Check linting:**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
# Expected: All checks passed!
```

**Check types:**
```bash
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict
# Expected: Success: no issues found
```

---

## Verification Checklist

After each phase:
- [ ] Syntax check passes: `python -m py_compile`
- [ ] Type check passes: `mypy --strict`
- [ ] Relevant tests pass: `pytest TestClassName -v`
- [ ] No new linting errors: `ruff check`

Final verification:
- [ ] All 36 tests pass
- [ ] Zero linting errors
- [ ] Type checking passes
- [ ] Constants are documented
- [ ] No magic numbers remain (except literal values like 2, 100, 1000)

---

## Benefits of This Change

### Before (Magic Numbers)
```python
if power_low < 80:  # What does 80 mean?
    ...

if segment_ratio >= 0.5 or duration_ratio >= 0.7:  # Why these values?
    ...
```

### After (Named Constants)
```python
if power_low < ENDURANCE_POWER_THRESHOLD_PCT:  # Clear: endurance threshold
    ...

if (segment_ratio >= ENDURANCE_SEGMENT_RATIO_THRESHOLD or
    duration_ratio >= ENDURANCE_DURATION_RATIO_THRESHOLD):  # Clear thresholds
    ...
```

### Advantages
1. **Self-documenting** - Names explain purpose
2. **Single source of truth** - Change threshold in one place
3. **Easier testing** - Can mock constants if needed
4. **Better maintenance** - Future developers understand intent
5. **Configuration ready** - Easy to move to config file later

---

## Acceptance Criteria

- [ ] All 14 magic numbers extracted
- [ ] Constants have clear, descriptive names
- [ ] Constants are documented with comments
- [ ] Constants grouped logically
- [ ] All tests still pass (36/36)
- [ ] No linting errors
- [ ] Type checking passes
- [ ] Code is more readable

---

## Commit Message

```
refactor: Extract magic numbers to named constants in add_week_tool

Extract 14 magic numbers to well-named module-level constants:

Validation Thresholds:
- NORMAL_TIME_WARN_THRESHOLD_PCT = 10
- NORMAL_TIME_ERROR_THRESHOLD_PCT = 20
- NORMAL_TSS_WARN_THRESHOLD_PCT = 15
- NORMAL_TSS_ERROR_THRESHOLD_PCT = 25
- RECOVERY_TIME_WARN_THRESHOLD_PCT = 8
- RECOVERY_TIME_ERROR_THRESHOLD_PCT = 15
- RECOVERY_TSS_WARN_THRESHOLD_PCT = 12
- RECOVERY_TSS_ERROR_THRESHOLD_PCT = 20

Endurance Detection:
- ENDURANCE_POWER_THRESHOLD_PCT = 80
- ENDURANCE_SEGMENT_RATIO_THRESHOLD = 0.5
- ENDURANCE_DURATION_RATIO_THRESHOLD = 0.7

Auto-Fix Parameters:
- MIN_ENDURANCE_DURATION_MIN = 60
- AUTO_FIX_REDUCTION_INCREMENT_MIN = 15
- MAX_AUTO_FIX_ITERATIONS = 10

Benefits:
- Self-documenting code
- Single source of truth for thresholds
- Easier future configuration
- All tests still pass (36/36)
```

---

## Notes

- **Don't extract ALL numbers** - Keep literal values like 0, 1, 2, 60 (seconds in minute), 100 (percentage base)
- **Group related constants** - Keep validation thresholds together
- **Document units** - Add comments for minutes, percentages, counts
- **Keep alphabetical order** within groups - Easier to find
- **Consider config file** - Future: move to YAML/JSON config

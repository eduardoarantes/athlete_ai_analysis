# CARD 1: Fix All Linting Errors

**Status:** READY
**Priority:** HIGH (Blocking)
**Estimated Time:** 1 hour
**Dependencies:** None

---

## Objective

Resolve all 24 linting errors in `add_week_tool.py` to achieve zero `ruff check` errors.

---

## Current State

**Linting Errors Breakdown:**
- E501: 12 line length violations (lines > 100 chars)
- F841: 1 unused variable (`warmup_cooldown_removed`)
- B007: 1 loop variable not used (`iteration`)
- SIM102: 1 nested if statement can be simplified
- B009: 1 unnecessary `getattr()` call
- C414: 1 unnecessary `list()` call in `sorted()`

**Auto-fixable:** 3 errors (with `--unsafe-fixes`)

---

## Implementation Steps

### Step 1: Auto-Fix Safe Issues

**Command:**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py --fix
```

**Expected:** 3 errors fixed automatically

**Verify:**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
```

### Step 2: Fix Line Length Violations (E501)

**12 lines to fix:**

#### Line 167
```python
# CURRENT:
f"({time_diff_pct:.0f}% difference, max {time_error_threshold}% allowed{phase_note})"

# FIX:
errors.append(
    f"Week {week_number} time budget violation: "
    f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
    f"({time_diff_pct:.0f}% difference, "
    f"max {time_error_threshold}% allowed{phase_note})"
)
```

#### Line 430
```python
# CURRENT:
f"Auto-fix successful: Reduced {target_weekday} endurance ride by {reduction_amount * 60:.0f} min. "

# FIX:
log_msg = (
    f"Auto-fix successful: Reduced {target_weekday} endurance ride "
    f"by {reduction_amount * 60:.0f} min. "
    f"Time reduced: {current_hours:.1f}h → {test_hours:.1f}h "
    f"(target: {target_hours:.1f}h)"
)
```

#### Line 516
```python
# CURRENT:
"segments (array with type, duration_min, power_low_pct, power_high_pct, description). "

# FIX:
description=(
    "Array of workout objects for this week. "
    "ONLY include training days, NOT rest days. "
    "Each workout: weekday (Monday-Sunday), description, "
    "segments (array with type, duration_min, power_low_pct, "
    "power_high_pct, description). "
    "Each segment MUST have all required fields."
),
```

#### Line 545
```python
# CURRENT:
"Enable automatic fixing of time budget violations by reducing endurance rides. "

# FIX:
description=(
    "Enable automatic fixing of time budget violations "
    "by reducing endurance rides. "
    "Default: true. Set to false for strict validation mode."
),
```

#### Line 637
```python
# CURRENT:
logger.warning(f"No training_days found in week {week_number} overview, skipping training day validation")

# FIX:
logger.warning(
    f"No training_days found in week {week_number} overview, "
    f"skipping training day validation"
)
```

#### Line 673-674
```python
# CURRENT:
raise ValueError(
    f"Week {week_number} has {len(workouts)} workouts but {len(training_days)} training days. "
    f"You must create exactly one workout for each training day: {', '.join(training_days)}"
)

# FIX:
raise ValueError(
    f"Week {week_number} has {len(workouts)} workouts but "
    f"{len(training_days)} training days. "
    f"You must create exactly one workout for each training day: "
    f"{', '.join(training_days)}"
)
```

#### Line 742
```python
# CURRENT:
logger.info(f"Week {week_number} validation failed in all scenarios. Attempting auto-fix...")

# FIX:
logger.info(
    f"Week {week_number} validation failed in all scenarios. "
    f"Attempting auto-fix..."
)
```

#### Line 780
```python
# CURRENT:
f"Week {week_number} validation failed. Please adjust workouts:\n{error_msg}\n\n"

# FIX:
raise ValueError(
    f"Week {week_number} validation failed. "
    f"Please adjust workouts:\n{error_msg}\n\n"
    f"Suggestions:\n"
    f"- To reduce time: Shorten segment durations or remove recovery segments\n"
    f"- To increase time: Add warmup/cooldown or extend main set duration\n"
    f"- To reduce TSS: Lower power targets or shorten high-intensity intervals\n"
    f"- To increase TSS: Raise power targets or extend work intervals"
)
```

#### Line 827
```python
# CURRENT:
overview_data["weeks_completed"] = len(completed_weeks)  # Update count from unique weeks

# FIX:
# Update count from unique weeks
overview_data["weeks_completed"] = len(completed_weeks)
```

#### Line 845
```python
# CURRENT:
else "All weeks complete! Your work in this phase is done. The plan will be finalized automatically."

# FIX:
next_step = (
    f"Call add_week_details for remaining {weeks_remaining} week(s)"
    if weeks_remaining > 0
    else (
        "All weeks complete! Your work in this phase is done. "
        "The plan will be finalized automatically."
    )
)
```

#### Line 849
```python
# CURRENT:
success_message = f"Week {week_number} details added. {weeks_completed}/{total_weeks} weeks complete."

# FIX:
success_message = (
    f"Week {week_number} details added. "
    f"{weeks_completed}/{total_weeks} weeks complete."
)
```

#### Line 854
```python
# CURRENT:
time_status = "✓" if abs(total_hours - target_hours) / target_hours * 100 <= 10 else "⚠"

# FIX:
time_diff_pct_check = abs(total_hours - target_hours) / target_hours * 100
time_status = "✓" if time_diff_pct_check <= 10 else "⚠"
```

### Step 3: Fix Unused Variable (F841)

**Line 370:**
```python
# CURRENT:
else:
    warmup_cooldown_removed = True

# FIX:
# Remove the entire else block (lines 369-370)
# The variable is never used, removal is safe
```

### Step 4: Fix Loop Variable Naming (B007)

**Line 392:**
```python
# CURRENT:
for iteration in range(max_iterations):

# FIX:
for _iteration in range(max_iterations):
```

### Step 5: Fix Nested If Simplification (SIM102)

**Lines 403-406:**
```python
# CURRENT:
if seg_type in ["steady", "endurance"] and power_low < 80:
    if duration > longest_duration:
        longest_duration = duration
        longest_seg_idx = idx

# FIX:
if (
    seg_type in ["steady", "endurance"]
    and power_low < 80
    and duration > longest_duration
):
    longest_duration = duration
    longest_seg_idx = idx
```

### Step 6: Fix Unnecessary getattr (B009)

**Line 458:**
```python
# CURRENT:
elif hasattr(obj, 'items') and callable(getattr(obj, 'items')):

# FIX:
elif hasattr(obj, 'items') and callable(obj.items):
```

### Step 7: Fix Unnecessary list() Call (C414)

**Line 826:**
```python
# CURRENT:
overview_data["weeks_completed_list"] = sorted(list(completed_weeks))

# FIX:
overview_data["weeks_completed_list"] = sorted(completed_weeks)
```

---

## Verification Steps

### After Each Fix

**1. Check Syntax:**
```bash
python -m py_compile src/cycling_ai/tools/wrappers/add_week_tool.py
```

**2. Check Types:**
```bash
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict
```

**3. Check Linting:**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
```

### Final Verification

**1. Zero Linting Errors:**
```bash
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py
# Expected output: "All checks passed!"
```

**2. Apply Formatting:**
```bash
ruff format src/cycling_ai/tools/wrappers/add_week_tool.py
```

**3. Verify No Functional Changes:**
```bash
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestDetectOptionalRecoveryWorkout::test_six_day_with_one_recovery -v
# Expected: PASSED (existing passing test still works)
```

**4. Check Git Diff:**
```bash
git diff src/cycling_ai/tools/wrappers/add_week_tool.py
# Review changes - should be ONLY formatting/cosmetic
```

---

## Acceptance Criteria

- [ ] `ruff check` returns 0 errors
- [ ] `mypy --strict` passes
- [ ] Existing passing test still passes
- [ ] No functional changes (only formatting)
- [ ] All 24 errors resolved
- [ ] Code formatted with `ruff format`

---

## Commit Message

```
fix: Resolve 24 linting errors in add_week_tool

- Fix 12 line length violations (E501)
- Remove unused variable warmup_cooldown_removed (F841)
- Rename loop variable to _iteration (B007)
- Simplify nested if statements (SIM102)
- Remove unnecessary getattr() call (B009)
- Remove unnecessary list() in sorted() (C414)

All fixes are cosmetic with no functional changes.
Type checking and existing tests still pass.
```

---

## Notes

- **Safe to run `ruff format`** - Will auto-fix most line length issues
- **Use `--fix` flag cautiously** - Review auto-fixes before committing
- **Test after each major change** - Don't batch all fixes together
- **Keep functional changes separate** - This card is ONLY linting fixes

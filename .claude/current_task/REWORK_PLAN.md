# Week Validation Improvements - Rework Plan

**Status:** BLOCKING ISSUES IDENTIFIED - REWORK REQUIRED
**Created:** 2025-11-03
**Branch:** feature/fit-workout-parser

---

## Executive Summary

The Week Validation Improvements feature is **functionally complete** with all features working correctly and type checking passing. However, **two blocking issues** prevent merge:

1. **24 Linting Errors** - Code style violations (line length, unused variables, inefficiencies)
2. **35/36 Tests Skipped** - Test suite is written but commented out/skipped

**Estimated Effort:** 2-3 hours
- Linting fixes: 1 hour
- Test implementation: 1-2 hours

**Risk Level:** LOW
- All fixes are mechanical (formatting, cleanup)
- Tests already written, just need uncommenting and verification
- No functional changes required

---

## Current State Analysis

### What Works ✓
- All validation features implemented correctly
- Type checking passes: `mypy --strict` ✓
- Core functionality tested manually (1 passing integration test)
- Multi-scenario validation working
- Auto-fix functionality working
- Recovery workout detection working

### What Blocks Merge ✗
1. **Linting Errors (24 total)**
   - 12 line length violations (E501)
   - 1 unused variable (F841)
   - 1 loop variable naming (B007)
   - 1 nested if simplification (SIM102)
   - 1 unnecessary getattr (B009)
   - 1 unnecessary list() call (C414)
   - 7 fixable with `--fix` flag

2. **Test Suite Issues**
   - 35 tests marked with `@pytest.mark.skip`
   - Test bodies commented out (but present)
   - Only 1 integration test passing

---

## Rework Strategy

### Phase 1: Linting Fixes (Priority: HIGH)
**Goal:** Achieve zero linting errors
**Estimated Time:** 1 hour
**Dependencies:** None

### Phase 2: Test Implementation (Priority: HIGH)
**Goal:** Uncomment and verify all tests pass
**Estimated Time:** 1-2 hours
**Dependencies:** Phase 1 complete

### Phase 3: Magic Number Extraction (Priority: MEDIUM)
**Goal:** Extract magic numbers to named constants
**Estimated Time:** 30 minutes
**Dependencies:** Phase 1 complete

### Phase 4: Final Validation (Priority: HIGH)
**Goal:** Verify all fixes don't break functionality
**Estimated Time:** 30 minutes
**Dependencies:** All phases complete

---

## Phase 1: Linting Fixes (DETAILED)

### 1.1 Line Length Violations (12 instances)

**Issue:** Lines exceed 100 character limit
**Fix:** Break long strings across multiple lines

#### Line 167
```python
# BEFORE:
f"({time_diff_pct:.0f}% difference, max {time_error_threshold}% allowed{phase_note})"

# AFTER:
(
    f"({time_diff_pct:.0f}% difference, "
    f"max {time_error_threshold}% allowed{phase_note})"
)
```

#### Line 430
```python
# BEFORE:
f"Auto-fix successful: Reduced {target_weekday} endurance ride by {reduction_amount * 60:.0f} min. "

# AFTER:
(
    f"Auto-fix successful: Reduced {target_weekday} endurance ride "
    f"by {reduction_amount * 60:.0f} min. "
)
```

#### Line 431
```python
# BEFORE:
f"Time reduced: {current_hours:.1f}h → {test_hours:.1f}h (target: {target_hours:.1f}h)"

# AFTER:
(
    f"Time reduced: {current_hours:.1f}h → {test_hours:.1f}h "
    f"(target: {target_hours:.1f}h)"
)
```

#### Line 516
```python
# BEFORE:
"segments (array with type, duration_min, power_low_pct, power_high_pct, description). "

# AFTER:
(
    "segments (array with type, duration_min, power_low_pct, "
    "power_high_pct, description). "
)
```

#### Line 545
```python
# BEFORE:
"Enable automatic fixing of time budget violations by reducing endurance rides. "

# AFTER:
(
    "Enable automatic fixing of time budget violations "
    "by reducing endurance rides. "
)
```

#### Line 637
```python
# BEFORE:
logger.warning(f"No training_days found in week {week_number} overview, skipping training day validation")

# AFTER:
logger.warning(
    f"No training_days found in week {week_number} overview, "
    f"skipping training day validation"
)
```

#### Lines 673-674
```python
# BEFORE:
f"Week {week_number} has {len(workouts)} workouts but {len(training_days)} training days. "
f"You must create exactly one workout for each training day: {', '.join(training_days)}"

# AFTER:
(
    f"Week {week_number} has {len(workouts)} workouts but "
    f"{len(training_days)} training days. "
    f"You must create exactly one workout for each training day: "
    f"{', '.join(training_days)}"
)
```

#### Line 742
```python
# BEFORE:
logger.info(f"Week {week_number} validation failed in all scenarios. Attempting auto-fix...")

# AFTER:
logger.info(
    f"Week {week_number} validation failed in all scenarios. "
    f"Attempting auto-fix..."
)
```

#### Line 780
```python
# BEFORE:
f"Week {week_number} validation failed. Please adjust workouts:\n{error_msg}\n\n"

# AFTER:
(
    f"Week {week_number} validation failed. "
    f"Please adjust workouts:\n{error_msg}\n\n"
)
```

#### Line 827
```python
# BEFORE:
overview_data["weeks_completed"] = len(completed_weeks)  # Update count from unique weeks

# AFTER:
# Update count from unique weeks
overview_data["weeks_completed"] = len(completed_weeks)
```

#### Line 845
```python
# BEFORE:
else "All weeks complete! Your work in this phase is done. The plan will be finalized automatically."

# AFTER:
(
    else "All weeks complete! Your work in this phase is done. "
    "The plan will be finalized automatically."
)
```

#### Line 849
```python
# BEFORE:
success_message = f"Week {week_number} details added. {weeks_completed}/{total_weeks} weeks complete."

# AFTER:
success_message = (
    f"Week {week_number} details added. "
    f"{weeks_completed}/{total_weeks} weeks complete."
)
```

#### Line 854
```python
# BEFORE:
time_status = "✓" if abs(total_hours - target_hours) / target_hours * 100 <= 10 else "⚠"

# AFTER:
time_diff_pct_validation = (
    abs(total_hours - target_hours) / target_hours * 100
)
time_status = "✓" if time_diff_pct_validation <= 10 else "⚠"
```

### 1.2 Unused Variable (F841)

**Line 370:**
```python
# BEFORE:
else:
    warmup_cooldown_removed = True

# AFTER:
# Variable was assigned but never used - remove it
# The fact that we skip appending warmup/cooldown is sufficient
```

**Fix:** Simply remove the assignment (line 370)

### 1.3 Loop Variable Naming (B007)

**Line 392:**
```python
# BEFORE:
for iteration in range(max_iterations):

# AFTER:
for _iteration in range(max_iterations):
```

**Reason:** Variable `iteration` is not used in loop body

### 1.4 Nested If Simplification (SIM102)

**Lines 403-404:**
```python
# BEFORE:
if seg_type in ["steady", "endurance"] and power_low < 80:
    if duration > longest_duration:
        longest_duration = duration
        longest_seg_idx = idx

# AFTER:
if (seg_type in ["steady", "endurance"] and
    power_low < 80 and
    duration > longest_duration):
    longest_duration = duration
    longest_seg_idx = idx
```

### 1.5 Unnecessary getattr (B009)

**Line 458:**
```python
# BEFORE:
elif hasattr(obj, 'items') and callable(getattr(obj, 'items')):

# AFTER:
elif hasattr(obj, 'items') and callable(obj.items):
```

**Reason:** Using getattr with constant attribute is unnecessary

### 1.6 Unnecessary list() Call (C414)

**Line 826:**
```python
# BEFORE:
overview_data["weeks_completed_list"] = sorted(list(completed_weeks))

# AFTER:
overview_data["weeks_completed_list"] = sorted(completed_weeks)
```

**Reason:** `sorted()` already accepts sets directly

---

## Phase 2: Test Implementation

### 2.1 Test Structure Analysis

**Current State:**
- 7 test classes with 36 total tests
- 1 passing test: `test_six_day_with_one_recovery`
- 35 skipped tests with bodies commented out

**Test Classes:**
1. `TestDetectOptionalRecoveryWorkout` - 5 tests (1 passing, 4 skipped)
2. `TestCalculateWeekMetrics` - 3 tests (all skipped)
3. `TestValidateTimeAndTSS` - 5 tests (all skipped)
4. `TestIsEnduranceWorkout` - 4 tests (all skipped)
5. `TestFindWeekendEnduranceRides` - 5 tests (all skipped)
6. `TestAttemptAutoFix` - 8 tests (all skipped)
7. `TestAddWeekDetailsToolIntegration` - 6 tests (all skipped)

### 2.2 Test Implementation Strategy

**Approach:** Uncomment tests in dependency order

#### Step 1: Helper Function Tests (No Dependencies)
**Order:**
1. `TestCalculateWeekMetrics` (3 tests)
2. `TestValidateTimeAndTSS` (5 tests)
3. `TestIsEnduranceWorkout` (4 tests)

**Why First:** These test pure functions with no side effects

#### Step 2: Composite Function Tests (Depends on Step 1)
**Order:**
1. `TestFindWeekendEnduranceRides` (5 tests) - depends on `_is_endurance_workout`
2. `TestDetectOptionalRecoveryWorkout` (4 remaining tests)

#### Step 3: Auto-Fix Tests (Depends on Steps 1-2)
**Order:**
1. `TestAttemptAutoFix` (8 tests) - depends on all helper functions

#### Step 4: Integration Tests (Depends on All)
**Order:**
1. `TestAddWeekDetailsToolIntegration` (6 tests) - full workflow tests

### 2.3 Test Uncommenting Process

**For Each Test:**
1. Remove `@pytest.mark.skip` decorator
2. Uncomment test body
3. Run test: `pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestClassName::test_name -v`
4. Fix any assertion failures
5. Verify test passes
6. Commit fix with message: `test: Enable test_name for add_week_tool validation`

**Example:**
```python
# BEFORE:
@pytest.mark.skip(reason="Function not implemented yet - TDD")
def test_calculate_all_workouts(self):
    """Calculate with all workouts"""
    # from cycling_ai.tools.wrappers.add_week_tool import _calculate_week_metrics

    # workouts = [...]
    # total_hours, actual_tss = _calculate_week_metrics(workouts, current_ftp)
    # assert total_hours == 3.25

# AFTER:
def test_calculate_all_workouts(self):
    """Calculate with all workouts"""
    workouts = [
        {"weekday": "Monday", "segments": [{"duration_min": 60, "power_low_pct": 70, "power_high_pct": 75}]},
        {"weekday": "Wednesday", "segments": [{"duration_min": 90, "power_low_pct": 65, "power_high_pct": 70}]},
        {"weekday": "Friday", "segments": [{"duration_min": 45, "power_low_pct": 90, "power_high_pct": 105}]},
    ]
    current_ftp = 250

    total_hours, actual_tss = _calculate_week_metrics(workouts, current_ftp)

    # 60 + 90 + 45 = 195 minutes = 3.25 hours
    assert total_hours == 3.25
    assert actual_tss > 0  # TSS should be calculated
```

### 2.4 Expected Test Failures

**Potential Issues:**
1. **Floating point precision** - Use `pytest.approx()` for float comparisons
2. **TSS calculation variations** - Use range checks or `pytest.approx()`
3. **String formatting** - Check exact error message formats

**Example Fix:**
```python
# Instead of:
assert total_hours == 3.25

# Use:
assert total_hours == pytest.approx(3.25, abs=0.01)
```

---

## Phase 3: Magic Number Extraction

### 3.1 Magic Numbers Identified

| Number | Usage | Suggested Constant Name | Location |
|--------|-------|-------------------------|----------|
| `60` | Minimum endurance duration | `MIN_ENDURANCE_DURATION_MIN` | Line 389 |
| `15` | Auto-fix reduction increment | `AUTO_FIX_REDUCTION_INCREMENT_MIN` | Line 388 |
| `10` | Max auto-fix iterations | `MAX_AUTO_FIX_ITERATIONS` | Line 390 |
| `80` | Endurance power threshold | `ENDURANCE_POWER_THRESHOLD_PCT` | Lines 239, 403 |
| `0.5` | Endurance segment ratio | `ENDURANCE_SEGMENT_RATIO_THRESHOLD` | Line 253 |
| `0.7` | Endurance duration ratio | `ENDURANCE_DURATION_RATIO_THRESHOLD` | Line 253 |
| `8` | Recovery time warn threshold | `RECOVERY_TIME_WARN_THRESHOLD_PCT` | Line 148 |
| `15` | Recovery time error threshold | `RECOVERY_TIME_ERROR_THRESHOLD_PCT` | Line 149 |
| `12` | Recovery TSS warn threshold | `RECOVERY_TSS_WARN_THRESHOLD_PCT` | Line 150 |
| `20` | Recovery TSS error threshold | `RECOVERY_TSS_ERROR_THRESHOLD_PCT` | Line 151 |
| `10` | Normal time warn threshold | `NORMAL_TIME_WARN_THRESHOLD_PCT` | Line 154 |
| `20` | Normal time error threshold | `NORMAL_TIME_ERROR_THRESHOLD_PCT` | Line 155 |
| `15` | Normal TSS warn threshold | `NORMAL_TSS_WARN_THRESHOLD_PCT` | Line 156 |
| `25` | Normal TSS error threshold | `NORMAL_TSS_ERROR_THRESHOLD_PCT` | Line 157 |

### 3.2 Constant Definitions

**Add at top of file (after imports, before helper functions):**

```python
# ============================================================================
# Validation Constants
# ============================================================================

# Time and TSS validation thresholds (percentage)
NORMAL_TIME_WARN_THRESHOLD_PCT = 10  # ±10% warning for normal weeks
NORMAL_TIME_ERROR_THRESHOLD_PCT = 20  # ±20% error for normal weeks
NORMAL_TSS_WARN_THRESHOLD_PCT = 15  # ±15% warning for normal weeks
NORMAL_TSS_ERROR_THRESHOLD_PCT = 25  # ±25% error for normal weeks

RECOVERY_TIME_WARN_THRESHOLD_PCT = 8  # ±8% warning for recovery weeks
RECOVERY_TIME_ERROR_THRESHOLD_PCT = 15  # ±15% error for recovery weeks (stricter)
RECOVERY_TSS_WARN_THRESHOLD_PCT = 12  # ±12% warning for recovery weeks
RECOVERY_TSS_ERROR_THRESHOLD_PCT = 20  # ±20% error for recovery weeks (stricter)

# Endurance workout identification thresholds
ENDURANCE_POWER_THRESHOLD_PCT = 80  # Power must be < 80% FTP
ENDURANCE_SEGMENT_RATIO_THRESHOLD = 0.5  # At least 50% of segments
ENDURANCE_DURATION_RATIO_THRESHOLD = 0.7  # At least 70% of duration

# Auto-fix parameters
MIN_ENDURANCE_DURATION_MIN = 60  # Minimum endurance segment duration (minutes)
AUTO_FIX_REDUCTION_INCREMENT_MIN = 15  # Reduce in 15-minute increments
MAX_AUTO_FIX_ITERATIONS = 10  # Maximum auto-fix attempts
```

### 3.3 Replacement Strategy

**Find and Replace (with verification):**

```bash
# Line 148-157: Replace validation thresholds
# Before: time_warn_threshold = 8
# After: time_warn_threshold = RECOVERY_TIME_WARN_THRESHOLD_PCT

# Line 239, 403: Replace power threshold
# Before: power_low < 80
# After: power_low < ENDURANCE_POWER_THRESHOLD_PCT

# Line 253: Replace ratio thresholds
# Before: segment_ratio >= 0.5 or duration_ratio >= 0.7
# After: (segment_ratio >= ENDURANCE_SEGMENT_RATIO_THRESHOLD or
#         duration_ratio >= ENDURANCE_DURATION_RATIO_THRESHOLD)

# Line 388-390: Replace auto-fix parameters
# Before: reduction_increment = 15
# After: reduction_increment = AUTO_FIX_REDUCTION_INCREMENT_MIN
```

**Verification:** After each replacement, run `mypy --strict` and `pytest`

---

## Phase 4: Final Validation

### 4.1 Validation Checklist

**Code Quality:**
- [ ] `ruff check src/cycling_ai/tools/wrappers/add_week_tool.py` returns 0 errors
- [ ] `mypy --strict src/cycling_ai/tools/wrappers/add_week_tool.py` passes
- [ ] `ruff format src/cycling_ai/tools/wrappers/add_week_tool.py` (apply formatting)

**Tests:**
- [ ] All 36 tests passing
- [ ] No skipped tests
- [ ] Test coverage for all helper functions
- [ ] Integration tests passing

**Functionality:**
- [ ] Multi-scenario validation works
- [ ] Auto-fix functionality works
- [ ] Recovery workout detection works
- [ ] Error messages are clear and helpful

### 4.2 Regression Testing

**Run Full Test Suite:**
```bash
# All add_week_tool tests
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v

# All tool tests (ensure no regressions)
pytest tests/tools/ -v

# Full test suite (ensure project stability)
pytest
```

### 4.3 Manual Testing

**Test Cases:**
1. Create 6-day week with recovery → Verify optional marking
2. Create week with time budget violation → Verify auto-fix
3. Create week within tolerance → Verify passes
4. Disable auto-fix with violation → Verify error raised

---

## Implementation Order

### Day 1: Linting + Core Tests (3-4 hours)

**Morning (2 hours):**
1. Phase 1: Fix all linting errors
2. Verify: `ruff check` passes
3. Commit: "fix: Resolve 24 linting errors in add_week_tool"

**Afternoon (1-2 hours):**
1. Phase 2 Step 1: Uncomment and verify helper function tests (12 tests)
2. Commit: "test: Enable helper function tests for add_week_tool"

### Day 2: Remaining Tests + Constants (2-3 hours)

**Morning (1-2 hours):**
1. Phase 2 Steps 2-4: Uncomment remaining tests (23 tests)
2. Fix any assertion failures
3. Commit: "test: Enable all validation tests for add_week_tool"

**Afternoon (1 hour):**
1. Phase 3: Extract magic numbers to constants
2. Verify: All tests still pass
3. Commit: "refactor: Extract magic numbers to named constants in add_week_tool"

**Final:**
1. Phase 4: Final validation
2. Commit: "chore: Final validation for week validation improvements"

---

## Risk Assessment

### Low Risk Items ✓
- **Linting fixes** - Purely cosmetic, no functional changes
- **Test uncommenting** - Tests already written, verified logic
- **Constant extraction** - Simple refactor with no logic changes

### Medium Risk Items ⚠
- **Float comparison precision** - May need `pytest.approx()` adjustments
- **TSS calculation variations** - May need tolerance ranges

### Mitigation Strategies
1. **Run tests after each change** - Catch regressions immediately
2. **Use pytest.approx() for floats** - Avoid precision issues
3. **Commit frequently** - Easy rollback if needed
4. **Keep changes atomic** - One fix per commit

---

## Success Criteria

### Must Have
- [ ] Zero linting errors
- [ ] All 36 tests passing
- [ ] No skipped tests
- [ ] Type checking passes
- [ ] All constants extracted
- [ ] Commit messages follow convention

### Nice to Have
- [ ] Test coverage report generated
- [ ] Documentation updated with validation examples
- [ ] Performance benchmarks for auto-fix

---

## Rollback Plan

**If issues arise:**

1. **Revert specific commit:**
   ```bash
   git revert <commit-hash>
   ```

2. **Reset to known good state:**
   ```bash
   git reset --hard HEAD~1
   ```

3. **Create fixup commit:**
   ```bash
   git commit --fixup=<commit-hash>
   ```

**Known Good State:** Current commit (all features working, type checking passing)

---

## Next Steps After Rework

1. **Request code review** with clean diff
2. **Update PR description** with:
   - Zero linting errors
   - 36/36 tests passing
   - All constants extracted
3. **Merge to main** after approval
4. **Document validation patterns** in CLAUDE.md
5. **Create follow-up task** for additional validation features (if any)

---

## Appendix: Quick Reference Commands

### Linting
```bash
# Check linting errors
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py

# Auto-fix safe issues
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py --fix

# Format code
ruff format src/cycling_ai/tools/wrappers/add_week_tool.py
```

### Type Checking
```bash
# Check types
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict
```

### Testing
```bash
# Run specific test class
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestClassName -v

# Run specific test
pytest tests/tools/wrappers/test_add_week_tool_validation.py::TestClassName::test_name -v

# Run all validation tests
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v

# Run with coverage
pytest tests/tools/wrappers/test_add_week_tool_validation.py --cov=src/cycling_ai/tools/wrappers/add_week_tool --cov-report=html -v
```

### Git
```bash
# Stage changes
git add src/cycling_ai/tools/wrappers/add_week_tool.py

# Commit with conventional message
git commit -m "fix: <description>"
git commit -m "test: <description>"
git commit -m "refactor: <description>"

# View diff before committing
git diff src/cycling_ai/tools/wrappers/add_week_tool.py
```

---

**END OF REWORK PLAN**

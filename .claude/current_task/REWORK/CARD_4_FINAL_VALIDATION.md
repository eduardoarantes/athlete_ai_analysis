# CARD 4: Final Validation and Documentation

**Status:** BLOCKED (Waiting for Cards 1-3)
**Priority:** HIGH
**Estimated Time:** 30 minutes
**Dependencies:** Cards 1, 2, 3 complete

---

## Objective

Perform comprehensive validation of all rework changes, ensure no regressions, and prepare for merge.

---

## Validation Checklist

### 1. Code Quality Checks

#### Linting
```bash
# Zero errors expected
ruff check src/cycling_ai/tools/wrappers/add_week_tool.py

# Should output:
# All checks passed!
```

**Expected:** ✓ PASS (0 errors, 0 warnings)

#### Formatting
```bash
# Apply final formatting
ruff format src/cycling_ai/tools/wrappers/add_week_tool.py

# Verify no changes needed
git diff src/cycling_ai/tools/wrappers/add_week_tool.py
# Should show minimal/no diff if already formatted
```

**Expected:** ✓ PASS (formatted consistently)

#### Type Checking
```bash
# Strict type checking
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict

# Should output:
# Success: no issues found in 1 source file
```

**Expected:** ✓ PASS (no type errors)

---

### 2. Test Suite Validation

#### All Validation Tests
```bash
# Run all validation tests
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v

# Expected output:
# ===== 36 passed in X.XXs =====
```

**Checklist:**
- [ ] 36/36 tests passing
- [ ] 0 skipped tests
- [ ] 0 failed tests
- [ ] No warnings or errors in output

#### Test Coverage
```bash
# Generate coverage report
pytest tests/tools/wrappers/test_add_week_tool_validation.py \
  --cov=src/cycling_ai/tools/wrappers/add_week_tool \
  --cov-report=term-missing \
  --cov-report=html \
  -v
```

**Expected Coverage:**
- Helper functions: > 95%
- Main execute() method: > 80%
- Overall: > 85%

**Checklist:**
- [ ] Coverage > 85%
- [ ] All validation helpers covered
- [ ] Auto-fix logic covered
- [ ] Multi-scenario validation covered

#### Regression Testing
```bash
# Run all tool tests (ensure no regressions)
pytest tests/tools/ -v

# Run full test suite
pytest
```

**Checklist:**
- [ ] All tool tests pass
- [ ] No new test failures
- [ ] No increase in skipped tests
- [ ] Overall test count stable or increased

---

### 3. Functional Validation

#### Manual Testing Scenarios

**Scenario 1: 6-Day Week with Recovery (Optional Marking)**

```bash
# Start Python REPL
python

# Test code:
from cycling_ai.tools.wrappers.add_week_tool import AddWeekDetailsTool
import json
import tempfile
from pathlib import Path

# Create test setup
temp_dir = Path(tempfile.mkdtemp())
plan_id = "test_6day_recovery"

# Create overview
overview_data = {
    "total_weeks": 1,
    "target_ftp": 250,
    "weeks_completed_list": [],
    "weeks_completed": 0,
    "weekly_overview": [{
        "week_number": 1,
        "phase": "Base",
        "target_tss": 400,
        "total_hours": 7.5,
        "training_days": [
            {"weekday": "Monday", "workout_type": "endurance"},
            {"weekday": "Tuesday", "workout_type": "intervals"},
            {"weekday": "Wednesday", "workout_type": "recovery"},
            {"weekday": "Thursday", "workout_type": "endurance"},
            {"weekday": "Friday", "workout_type": "intervals"},
            {"weekday": "Saturday", "workout_type": "endurance"},
            {"weekday": "Sunday", "workout_type": "rest"},
        ]
    }]
}

with open(temp_dir / f"{plan_id}_overview.json", "w") as f:
    json.dump(overview_data, f)

# Create workouts (passes without recovery)
workouts = [
    {"weekday": "Monday", "description": "Endurance", "segments": [
        {"type": "steady", "duration_min": 90, "power_low_pct": 65, "power_high_pct": 75, "description": "Z2"}
    ]},
    {"weekday": "Tuesday", "description": "Intervals", "segments": [
        {"type": "intervals", "duration_min": 60, "power_low_pct": 100, "power_high_pct": 110, "description": "VO2"}
    ]},
    {"weekday": "Wednesday", "description": "Recovery", "segments": [
        {"type": "recovery", "duration_min": 45, "power_low_pct": 45, "power_high_pct": 55, "description": "Easy"}
    ]},
    {"weekday": "Thursday", "description": "Endurance", "segments": [
        {"type": "steady", "duration_min": 90, "power_low_pct": 65, "power_high_pct": 75, "description": "Z2"}
    ]},
    {"weekday": "Friday", "description": "Intervals", "segments": [
        {"type": "intervals", "duration_min": 60, "power_low_pct": 100, "power_high_pct": 110, "description": "VO2"}
    ]},
    {"weekday": "Saturday", "description": "Long Endurance", "segments": [
        {"type": "steady", "duration_min": 120, "power_low_pct": 65, "power_high_pct": 75, "description": "Z2"}
    ]},
]

# Execute tool
tool = AddWeekDetailsTool()
result = tool.execute(plan_id=plan_id, week_number=1, workouts=workouts)

# Verify
assert result.success
print(f"Scenario used: {result.data['validation']['scenario_used']}")
print(f"Recovery optional: {workouts[2].get('optional', False)}")
```

**Expected Results:**
- ✓ Tool execution succeeds
- ✓ Validation passes (with or without recovery)
- ✓ If passes without recovery, Wednesday workout marked optional
- ✓ Clear validation summary in result

**Scenario 2: Time Budget Violation with Auto-Fix**

```python
# Continue in REPL or new session
# Create workouts that exceed budget
workouts_over_budget = [
    {"weekday": "Monday", "description": "Endurance", "segments": [
        {"type": "steady", "duration_min": 120, "power_low_pct": 65, "power_high_pct": 75, "description": "Z2"}
    ]},
    {"weekday": "Tuesday", "description": "Intervals", "segments": [
        {"type": "intervals", "duration_min": 90, "power_low_pct": 100, "power_high_pct": 110, "description": "VO2"}
    ]},
    {"weekday": "Thursday", "description": "Endurance", "segments": [
        {"type": "steady", "duration_min": 120, "power_low_pct": 65, "power_high_pct": 75, "description": "Z2"}
    ]},
    {"weekday": "Friday", "description": "Intervals", "segments": [
        {"type": "intervals", "duration_min": 90, "power_low_pct": 100, "power_high_pct": 110, "description": "VO2"}
    ]},
    {"weekday": "Saturday", "description": "Long Endurance", "segments": [
        {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60, "description": "WU"},
        {"type": "steady", "duration_min": 180, "power_low_pct": 65, "power_high_pct": 75, "description": "Z2"},
        {"type": "cooldown", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60, "description": "CD"},
    ]},
]

# Target: 7.5 hours, Actual: ~10 hours (over budget)
# Execute with auto-fix enabled
result = tool.execute(plan_id=plan_id, week_number=1, workouts=workouts_over_budget, auto_fix=True)

# Verify
assert result.success
print(f"Auto-fixed: {result.data['validation']['auto_fixed']}")
print(f"Fix log: {result.data['validation']['fix_log']}")
```

**Expected Results:**
- ✓ Auto-fix reduces Saturday endurance ride
- ✓ Warmup/cooldown removed OR main block reduced
- ✓ Final time budget within tolerance
- ✓ Fix log describes changes made

**Scenario 3: Strict Validation (auto_fix=False)**

```python
# Execute with auto-fix disabled
try:
    result = tool.execute(
        plan_id=plan_id,
        week_number=1,
        workouts=workouts_over_budget,
        auto_fix=False
    )
    print("ERROR: Should have raised ValueError")
except ValueError as e:
    print(f"Correctly raised error: {e}")
    assert "validation failed" in str(e).lower()
    assert "suggestions" in str(e).lower()
```

**Expected Results:**
- ✓ Raises ValueError with clear message
- ✓ Error message includes suggestions
- ✓ No auto-fix applied

---

### 4. Git Status Check

```bash
# Check git status
git status

# Expected files changed:
# M  src/cycling_ai/tools/wrappers/add_week_tool.py
# M  tests/tools/wrappers/test_add_week_tool_validation.py
```

**Review changes:**
```bash
# View diff summary
git diff --stat

# Expected:
# src/cycling_ai/tools/wrappers/add_week_tool.py    | XX +++---
# tests/tools/wrappers/test_add_week_tool_validation.py | XX +++---
```

**Review actual changes:**
```bash
# Check add_week_tool.py changes
git diff src/cycling_ai/tools/wrappers/add_week_tool.py | head -100

# Verify changes are:
# - Linting fixes (formatting)
# - Constant additions
# - Magic number replacements
```

**Checklist:**
- [ ] Only expected files modified
- [ ] No unintended changes
- [ ] Diff is clean and understandable
- [ ] No debug code or comments left behind

---

### 5. Documentation Check

#### Code Documentation

**Verify docstrings:**
```bash
# Check that all functions have docstrings
grep -n "def _" src/cycling_ai/tools/wrappers/add_week_tool.py | head -20
```

**Checklist:**
- [ ] All helper functions have docstrings
- [ ] Docstrings describe purpose, args, returns
- [ ] Constants have inline comments
- [ ] Complex logic has explanatory comments

#### CLAUDE.md Updates

**Check if CLAUDE.md needs updates:**
- [ ] New validation patterns documented?
- [ ] Auto-fix strategy documented?
- [ ] Multi-scenario validation explained?

**If yes, update CLAUDE.md:**
```markdown
### Validation Patterns in add_week_tool

**Multi-Scenario Validation:**
- 6-day weeks with recovery: Validates with/without recovery
- Auto-fix: Reduces endurance rides to meet time budget
- Phase-aware tolerances: Stricter for recovery weeks

**Constants:**
- All thresholds extracted to module-level constants
- Clear naming: NORMAL_TIME_WARN_THRESHOLD_PCT, etc.
- Easy to adjust for different coaching philosophies
```

---

### 6. Performance Validation

**Run timing tests:**
```bash
# Time test execution
time pytest tests/tools/wrappers/test_add_week_tool_validation.py -v

# Expected: < 5 seconds for all 36 tests
```

**Check for slow tests:**
```bash
# Run with durations
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v --durations=10

# Review slowest tests
# Expected: All tests < 0.5s
```

**Checklist:**
- [ ] All tests complete in < 5s total
- [ ] No individual test > 0.5s
- [ ] No performance regressions vs before

---

## Final Acceptance Criteria

### Must Have ✓
- [ ] Zero linting errors (`ruff check` passes)
- [ ] Type checking passes (`mypy --strict`)
- [ ] All 36 tests passing
- [ ] Zero skipped tests
- [ ] Test coverage > 85%
- [ ] All constants extracted
- [ ] Manual scenarios validated
- [ ] Clean git diff
- [ ] No regressions in other tests

### Nice to Have
- [ ] Coverage > 90%
- [ ] Test execution < 3s
- [ ] CLAUDE.md updated with patterns
- [ ] Inline code comments improved

---

## Pre-Merge Checklist

### Code Quality
- [ ] `ruff check` → All checks passed
- [ ] `ruff format` → No changes needed
- [ ] `mypy --strict` → Success: no issues found
- [ ] No debug prints or temporary code

### Testing
- [ ] 36/36 tests passing
- [ ] Coverage report generated
- [ ] All manual scenarios tested
- [ ] No test warnings

### Documentation
- [ ] All functions documented
- [ ] Constants have comments
- [ ] Complex logic explained
- [ ] CLAUDE.md updated if needed

### Git Hygiene
- [ ] Clean commit history
- [ ] Descriptive commit messages
- [ ] No merge conflicts
- [ ] Branch up to date with main

---

## Commit Strategy

**Final commits should be:**

1. `fix: Resolve 24 linting errors in add_week_tool`
2. `test: Enable all 35 validation tests for add_week_tool`
3. `refactor: Extract magic numbers to named constants in add_week_tool`
4. (Optional) `docs: Update CLAUDE.md with validation patterns`

**OR single squashed commit:**
```
feat: Complete week validation improvements with full test coverage

- Resolve 24 linting errors (line length, unused vars, simplifications)
- Enable all 35 validation tests (36/36 passing)
- Extract 14 magic numbers to named constants
- Achieve >85% test coverage for validation logic

All validation features working:
- Multi-scenario validation for 6-day weeks
- Auto-fix for time budget violations
- Phase-aware tolerances (stricter for recovery)
- Clear error messages with suggestions

Closes #[issue-number]
```

---

## Post-Validation Actions

### 1. Create PR or Update Existing PR

**PR Title:**
```
feat: Week validation improvements with auto-fix and multi-scenario support
```

**PR Description:**
```markdown
## Summary
Complete implementation of week validation improvements with full test coverage.

## Changes
- ✅ Multi-scenario validation for 6-day weeks with optional recovery
- ✅ Auto-fix for time budget violations (reduces endurance rides)
- ✅ Phase-aware tolerances (stricter for recovery/taper weeks)
- ✅ Clear error messages with actionable suggestions

## Code Quality
- Zero linting errors (fixed 24)
- Type checking passes (mypy --strict)
- 36/36 tests passing (enabled 35 skipped tests)
- >85% test coverage
- All magic numbers extracted to constants

## Testing
- All validation helpers tested
- Auto-fix logic tested (8 scenarios)
- Integration tests for full workflow
- Manual testing of key scenarios

## Review Checklist
- [ ] Code follows project patterns
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes
```

### 2. Request Review

**Reviewers:**
- Tag relevant team members
- Highlight: "Ready for final review - all blocking issues resolved"

### 3. Prepare for Merge

**Before merge:**
- [ ] All CI checks passing
- [ ] Reviewers approved
- [ ] No merge conflicts
- [ ] Branch up to date with main

**After merge:**
- [ ] Delete feature branch
- [ ] Close related issues
- [ ] Update project board
- [ ] Celebrate! 🎉

---

## Rollback Plan

**If critical issues found:**

1. **Revert specific commit:**
   ```bash
   git revert <commit-hash>
   ```

2. **Reset to known good state:**
   ```bash
   git reset --hard <previous-commit>
   ```

3. **Create hotfix:**
   ```bash
   git checkout -b hotfix/validation-issue
   # Fix issue
   git commit -m "fix: Resolve validation issue"
   ```

**Known good commit:** Before starting rework (current HEAD)

---

## Success Metrics

**Code Quality:**
- ✓ 0 linting errors (was 24)
- ✓ 0 type errors (maintained)
- ✓ 100% formatted code

**Testing:**
- ✓ 36/36 tests passing (was 1/36)
- ✓ >85% coverage (was ~20%)
- ✓ 0 skipped tests (was 35)

**Maintainability:**
- ✓ 0 magic numbers (was 14)
- ✓ All constants documented
- ✓ Clear, self-documenting code

---

## Notes

- **Take your time** - This is the final check before merge
- **Test thoroughly** - Better to catch issues now
- **Document well** - Future you will thank you
- **Celebrate success** - This is a significant improvement!

---

**END OF VALIDATION CARD**

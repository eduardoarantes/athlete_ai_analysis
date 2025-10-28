# Task Card 002: Fix Pre-Existing Test Failures

**Sub-Phase:** 4B - Fix Pre-Existing Test Failures
**Priority:** HIGH
**Duration:** 1 day
**Dependencies:** CARD_001 (Real-world testing complete)
**Status:** PENDING

---

## Objective

Fix 8 pre-existing test failures to achieve 100% test pass rate (253/253 tests passing). These failures existed before Phase 2-3 multi-agent implementation and are NOT related to the multi-agent orchestrator.

---

## Acceptance Criteria

- [ ] All 253 tests passing (100% pass rate)
- [ ] Multi-agent tests still passing (102/102)
- [ ] No regressions introduced
- [ ] Test coverage maintained at 85%+
- [ ] Type checking still passes (mypy --strict)

---

## Current Test Status

```
Total tests: 253
Passing: 245 (96.8%)
Failing: 8 (3.2%)

Multi-agent tests: 102/102 ✅ (no changes needed here)
```

---

## Failures to Fix

### 1. Config Loader Test (1 failure)

**Test:** `tests/config/test_loader.py::test_get_config_path_current_directory`

**Error:**
```
AssertionError: assert PosixPath('/Users/eduardo/.cycling-ai/config.yaml') ==
                      PosixPath('/private/var/folders/.../test_get_config_path_current_d0/.cycling-ai.yaml')
```

**Root Cause:** Test expects config file in temp directory but finds user's home directory config.

**Investigation Steps:**
```bash
# Run test with verbose output
.venv/bin/pytest tests/config/test_loader.py::test_get_config_path_current_directory -vv

# Check test code
cat tests/config/test_loader.py | grep -A 20 "test_get_config_path_current_directory"

# Check implementation
cat src/cycling_ai/config/loader.py | grep -A 10 "get_config_path"
```

**Fix Strategy:**
- Option A: Mock home directory in test
- Option B: Update test to search in multiple locations
- Option C: Fix path resolution logic to prioritize local over home

**Recommended:** Option A (mock home directory)

---

### 2. Cross-Training Tool Tests (2 failures)

**Test 2a:** `tests/tools/wrappers/test_cross_training.py::test_execute_success`

**Error:**
```
AssertionError: assert False is True
 +  where False = ToolExecutionResult(success=False, ...).success
```

**Root Cause:** Tool execution fails, likely due to test data format or mock setup.

**Investigation Steps:**
```bash
# Run with verbose output
.venv/bin/pytest tests/tools/wrappers/test_cross_training.py::test_execute_success -vv -s

# Check test setup
cat tests/tools/wrappers/test_cross_training.py | grep -A 30 "test_execute_success"

# Check what data the test provides
```

**Fix Strategy:**
- Examine error message in tool result
- Update test data to match expected format
- Or update mock to return valid data

---

**Test 2b:** `tests/tools/wrappers/test_cross_training.py::test_execute_invalid_weeks`

**Error:**
```
Failed: DID NOT RAISE <class 'ValueError'>
```

**Root Cause:** Validation not implemented or test bypasses validation.

**Investigation Steps:**
```bash
# Check what validation exists
cat src/cycling_ai/tools/wrappers/cross_training_tool.py | grep -i "weeks"

# Check test expectations
cat tests/tools/wrappers/test_cross_training.py | grep -A 10 "test_execute_invalid_weeks"
```

**Fix Strategy:**
- Option A: Implement validation in tool (if missing)
- Option B: Update test to not expect ValueError (if validation isn't needed)

**Recommended:** Review if validation is actually needed based on tool design.

---

### 3. Performance Tool Test (1 failure)

**Test:** `tests/tools/wrappers/test_performance.py::test_execute_success`

**Error:**
```
AssertionError: assert False is True
 +  where False = ToolExecutionResult(success=False, ...).success
```

**Root Cause:** Same pattern as cross-training test - data or mock issue.

**Investigation Steps:**
```bash
.venv/bin/pytest tests/tools/wrappers/test_performance.py::test_execute_success -vv -s
cat tests/tools/wrappers/test_performance.py | grep -A 30 "test_execute_success"
```

**Fix Strategy:** Update test data or mock to match tool expectations.

---

### 4. Training Tool Test (1 failure)

**Test:** `tests/tools/wrappers/test_training.py::test_execute_invalid_weeks`

**Error:**
```
Failed: DID NOT RAISE <class 'ValueError'>
```

**Root Cause:** Same as cross-training invalid weeks test.

**Fix Strategy:** Same approach - review if validation is needed.

---

### 5. Zones Tool Tests (3 failures)

**Test 5a:** `tests/tools/wrappers/test_zones.py::test_execute_success`

**Error:**
```
AssertionError: assert False is True
 +  where False = ToolExecutionResult(success=False,
                  data={'error': 'No power data found in processed files', ...}).success
```

**Root Cause:** Test FIT files don't have power data or parsing fails.

**Investigation Steps:**
```bash
.venv/bin/pytest tests/tools/wrappers/test_zones.py::test_execute_success -vv -s

# Check if test uses real FIT files or mocks
cat tests/tools/wrappers/test_zones.py | grep -A 30 "test_execute_success"

# Check if test data has power
ls tests/data/fit_files/
```

**Fix Strategy:**
- Use real FIT files with power data in test
- Or mock the FIT processing to return power data

---

**Test 5b:** `tests/tools/wrappers/test_zones.py::test_execute_invalid_period_months`

**Error:**
```
Failed: DID NOT RAISE <class 'ValueError'>
```

**Root Cause:** Validation not implemented.

**Fix Strategy:** Same as other validation tests.

---

**Test 5c:** `tests/tools/wrappers/test_zones.py::test_execute_with_cache`

**Error:**
```
AssertionError: assert (False is True or (not False and 'error' in 'no power data found...'))
```

**Root Cause:** Same as test_execute_success - no power data.

**Fix Strategy:** Same fix as test_execute_success.

---

## Implementation Approach

### Step 1: Investigate Each Failure (30 min)

```bash
# Create investigation log
touch .claude/current_task/PLAN/test_investigation.md

# For each failing test:
.venv/bin/pytest <test_path> -vv -s 2>&1 | tee -a investigation.log

# Document findings
```

### Step 2: Fix Tests (3-4 hours)

Priority order:
1. Config loader (easiest)
2. Validation tests (if validation not needed, update tests)
3. Tool execution tests (need proper data/mocks)

For each fix:
1. Make minimal change
2. Run the specific test
3. Run full test suite to check for regressions
4. Run multi-agent tests to ensure no impact

### Step 3: Verification (30 min)

```bash
# Run full test suite
.venv/bin/pytest tests/ -v

# Should show: 253 passed

# Verify coverage
.venv/bin/pytest tests/ --cov=src/cycling_ai --cov-report=term-missing

# Should maintain 85%+

# Type check
.venv/bin/mypy src/cycling_ai --strict

# Should pass with no errors
```

---

## Testing Strategy

**For Each Fix:**

```bash
# 1. Fix the test or code
vim tests/path/to/test.py  # or src/path/to/code.py

# 2. Run the specific test
.venv/bin/pytest tests/path/to/test.py::test_name -vv

# 3. If passes, run related tests
.venv/bin/pytest tests/path/to/ -v

# 4. Run multi-agent tests (regression check)
.venv/bin/pytest tests/orchestration/test_multi_agent.py -v

# 5. Run full suite
.venv/bin/pytest tests/ -v

# 6. If all pass, commit
git add .
git commit -m "Fix: <test name> - <brief description>"
```

---

## Expected Code Changes

### Files Likely to Modify

**Tests (prefer fixing tests over code):**
- `tests/config/test_loader.py` - Add home directory mock
- `tests/tools/wrappers/test_cross_training.py` - Fix test data or expectations
- `tests/tools/wrappers/test_performance.py` - Fix test data or expectations
- `tests/tools/wrappers/test_training.py` - Fix validation expectations
- `tests/tools/wrappers/test_zones.py` - Fix test data (use real FIT files or mock)

**Code (only if validation missing):**
- Potentially: `src/cycling_ai/tools/wrappers/*_tool.py` - Add parameter validation

---

## Success Criteria

- [ ] All 8 failing tests now pass
- [ ] Total: 253/253 tests passing (100%)
- [ ] Multi-agent tests: 102/102 still passing
- [ ] No new test failures introduced
- [ ] Test coverage ≥ 85%
- [ ] mypy --strict passes
- [ ] All fixes committed with clear messages

---

## Rollback Plan

If a fix introduces regressions:

```bash
# 1. Identify the problematic commit
git log --oneline

# 2. Revert the commit
git revert <commit-hash>

# 3. Re-run tests
.venv/bin/pytest tests/ -v

# 4. Try alternative fix approach
```

---

## Deliverables

1. **Investigation Report:**
   - `.claude/current_task/PLAN/test_investigation.md`
   - Root cause for each failure
   - Fix strategy chosen

2. **Fixed Test Files:**
   - Modified test files with fixes applied

3. **Test Results:**
   - `.claude/current_task/PLAN/all_tests_passing.log`
   - Output showing 253/253 passing

4. **Git Commits:**
   - One commit per fix (or logical grouping)
   - Clear commit messages

---

## Definition of Done

Task is complete when:
- [ ] All 8 pre-existing failures fixed
- [ ] 253/253 tests passing
- [ ] No regressions in multi-agent tests
- [ ] Test coverage maintained
- [ ] Type checking passes
- [ ] All changes committed
- [ ] Investigation report written

---

**Status:** PENDING
**Depends On:** CARD_001 (optional - can run in parallel)
**Next Task:** CARD_003 (Performance Benchmarking)

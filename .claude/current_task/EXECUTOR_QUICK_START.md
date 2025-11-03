# Executor Quick Start - Week Validation Improvements

**Status:** Ready for Implementation
**Main Document:** `.claude/current_task/IMPLEMENTATION_PREPARATION.md`
**Plan Document:** `plans/WEEK_VALIDATION_IMPROVEMENTS.md`

---

## TL;DR - What You're Building

Add intelligent week validation to `add_week_tool.py` that:
1. Validates 6-day weeks in dual scenarios (with/without recovery)
2. Auto-fixes time budget violations by reducing weekend endurance rides
3. Only modifies workouts as last resort (preserves LLM intent)

---

## Quick Facts

- **Target File:** `src/cycling_ai/tools/wrappers/add_week_tool.py`
- **Lines to Replace:** 253-332 (validation logic)
- **New Functions:** 6 helper functions (~225 lines)
- **New Test File:** `tests/tools/wrappers/test_add_week_tool_validation.py` (~800 lines)
- **Expected Time:** 7-10 hours (4-6 implementation, 3-4 testing)

---

## Implementation Order

### Step 1: Add Helper Functions (Before line 51)
Add these 6 functions in order:

1. `_detect_optional_recovery_workout()` - Detects 6-day weeks with recovery
2. `_calculate_week_metrics()` - Calculates hours + TSS (with optional exclude)
3. `_validate_time_and_tss()` - Validates against targets (extracts current logic)
4. `_is_endurance_workout()` - Identifies endurance rides
5. `_find_weekend_endurance_rides()` - Finds weekend endurance workouts
6. `_attempt_auto_fix()` - Non-destructive auto-fix by reducing endurance

**All signatures and implementations are in IMPLEMENTATION_PREPARATION.md**

### Step 2: Refactor Validation (Lines 253-332)
Replace current simple validation with multi-scenario system:
- Scenario 1: All workouts
- Scenario 2: Exclude recovery (if 6-day week with recovery)
- If both fail → Try auto-fix
- If auto-fix fails → Raise error with LLM feedback

**Complete replacement code is in IMPLEMENTATION_PREPARATION.md**

### Step 3: Add Parameter (Line 122+)
Add `auto_fix` boolean parameter to tool definition (default: true)

### Step 4: Update Result Data (Lines 405-412)
Add 3 new fields to validation dict:
- `scenario_used`: Which scenario passed
- `auto_fixed`: Was auto-fix applied
- `fix_log`: Auto-fix log message

### Step 5: Write Tests
Create `tests/tools/wrappers/test_add_week_tool_validation.py` with 36 test cases:
- 5 recovery detection tests
- 3 metrics calculation tests
- 5 validation tests
- 5 endurance detection tests
- 5 weekend endurance finding tests
- 7 auto-fix tests
- 6 integration tests

---

## Key Patterns to Follow

### Type Hints (Strict Mypy)
```python
def _calculate_week_metrics(
    workouts: list[dict[str, Any]],  # Use Any, not unknown
    current_ftp: float,
    exclude_workout_index: int | None = None  # Use | None, not Optional
) -> tuple[float, float]:  # Always specify return type
```

### Non-Destructive Auto-Fix
```python
# ALWAYS create deep copy before modifying
workouts_copy = [dict(w) for w in workouts]
for w in workouts_copy:
    w["segments"] = [dict(seg) for seg in w.get("segments", [])]
```

### Structured Logging
```python
logger.info(
    f"6-day week with recovery detected:\n"
    f"  - Recovery workout: {recovery_weekday}\n"
    f"  - Scenario 1: {total_hours_full:.1f}h, {actual_tss_full:.0f} TSS\n"
    f"  - Scenario 2: {total_hours_no_rec:.1f}h, {actual_tss_no_rec:.0f} TSS"
)
```

---

## Critical Rules

1. **Never modify original workouts during validation** - Only modify copies
2. **Try scenarios before auto-fix** - Auto-fix is last resort
3. **Weekend-only for endurance reduction** - No fallback to weekdays
4. **60 min minimum** for endurance rides - Don't reduce below this
5. **Type hints on everything** - Must pass `mypy --strict`

---

## Testing Commands

```bash
# Run new tests
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v

# Type checking
mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict

# Coverage
pytest --cov=src/cycling_ai/tools/wrappers/add_week_tool.py --cov-report=html

# Full test suite
pytest tests/tools/wrappers/ -v
```

---

## Files You'll Create/Modify

### Modified
- `src/cycling_ai/tools/wrappers/add_week_tool.py` (448 → ~750 lines)

### Created
- `tests/tools/wrappers/test_add_week_tool_validation.py` (~800 lines)

---

## Success Criteria

- [ ] All 36 tests pass
- [ ] `mypy --strict` passes with no errors
- [ ] Coverage ≥ 95% on new code
- [ ] Integration test with real LLM works
- [ ] Backward compatible with existing plans

---

## Get Help

**Read Full Details:** `.claude/current_task/IMPLEMENTATION_PREPARATION.md`

**Sections to Reference:**
- **Function signatures:** Phase 1 (lines 100-250)
- **Validation refactor:** Phase 2 (lines 260-400)
- **Test structure:** Testing Strategy (lines 600-700)
- **Edge cases:** Dependencies & Risks (lines 750-850)

---

**Ready to Start!** Begin with Step 1 - Add the 6 helper functions.

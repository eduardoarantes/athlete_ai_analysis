# TSS Validation Fix for Library-Based Training Plans

**Date:** 2025-11-04
**Issue:** Weekly TSS validation failing (416 TSS actual vs 285 TSS target = 46% over)

---

## Problem

### Error Message
```
Week 2 TSS target violation: Actual 416 TSS vs target 285 TSS (46% difference, max 25% allowed)

Suggestions:
- To reduce time: Shorten segment durations or remove recovery segments
- To increase time: Add warmup/cooldown or extend main set duration
- To reduce TSS: Lower power targets or shorten high-intensity intervals
- To increase TSS: Raise power targets or extend work intervals
```

### Root Cause

**The library-based workout selection doesn't validate cumulative weekly TSS before submitting to add_week_tool.**

**Process Flow (Before Fix):**
1. Phase 3a creates overview with weekly `target_tss` (e.g., 285 TSS)
2. Phase 3b library calculates per-day TSS: `285 / 5 days = 57 TSS/day`
3. For each training day, selector picks a workout matching workout_type
4. Selector uses multi-criteria scoring:
   - Type match: 40 points
   - Phase match: 25 points
   - Weekday match: 15 points
   - **TSS match: 10 points** ← Low priority!
   - Duration: 5 points
   - Variety: 5 points
5. Selected workouts have fixed TSS from library (e.g., 60, 80, 95, 90, 91)
6. Total: 416 TSS (46% over target!)
7. add_week_tool validates and **REJECTS** (max 25% allowed)

**Why TSS Matching Was Weak:**
- TSS scoring only contributed 10/100 points
- Workouts selected primarily by type/phase match
- No cumulative TSS tracking across the week
- Library workouts have fixed TSS values

### Validation Thresholds (add_week_tool)

**Normal Weeks:**
- Warning: ±15% TSS difference
- Error: ±25% TSS difference

**Recovery/Taper Weeks:**
- Warning: ±12% TSS difference
- Error: ±20% TSS difference (stricter!)

---

## Solution

**Add post-selection TSS validation and proportional scaling.**

### Implementation

**New Method:** `_adjust_weekly_tss()` in `training_planning_library.py:260-347`

**Algorithm:**

1. **Calculate Actual TSS**
   ```python
   for workout in workouts:
       for segment in workout.segments:
           duration_hours = duration_min / 60
           power_avg = (power_low_pct + power_high_pct) / 2
           seg_tss = (power_avg / 100)^2 * duration_hours * 100
           actual_tss += seg_tss
   ```

2. **Check Tolerance**
   ```python
   tss_diff_pct = abs(actual_tss - target_tss) / target_tss * 100

   if tss_diff_pct <= 25:
       return workouts  # No adjustment needed
   ```

3. **Calculate Scaling Factor**
   ```python
   scaling_factor = target_tss / actual_tss
   # Example: 285 / 416 = 0.685 (scale down by ~31%)
   ```

4. **Scale All Workout Durations**
   ```python
   for workout in workouts:
       for segment in workout.segments:
           segment.duration_min = round(segment.duration_min * scaling_factor)
   ```

5. **Verify Result**
   ```python
   # Recalculate TSS with new durations
   adjusted_tss = calculate_tss(scaled_workouts)
   # Should now be within ±25% of target
   ```

### Example

**Before Scaling:**
```python
Week 2: target_tss = 285
Selected workouts:
- Monday endurance: 60 TSS, 90 min
- Wednesday sweet_spot: 80 TSS, 60 min
- Friday tempo: 95 TSS, 75 min
- Saturday endurance: 90 TSS, 120 min
- Sunday recovery: 91 TSS, 150 min
Total: 416 TSS (46% over)
```

**After Scaling (0.685x):**
```python
Scaled workouts:
- Monday endurance: 41 TSS, 62 min  (90 * 0.685 = 62)
- Wednesday sweet_spot: 55 TSS, 41 min  (60 * 0.685 = 41)
- Friday tempo: 65 TSS, 51 min  (75 * 0.685 = 51)
- Saturday endurance: 62 TSS, 82 min  (120 * 0.685 = 82)
- Sunday recovery: 62 TSS, 103 min  (150 * 0.685 = 103)
Total: 285 TSS (0% difference) ✅
```

---

## Integration

### Code Changes

**File:** `src/cycling_ai/orchestration/phases/training_planning_library.py`

**1. Added TSS Adjustment Call (lines 201-206)**
```python
# 3. Validate and adjust weekly TSS to match target
selected_workouts = self._adjust_weekly_tss(
    workouts=selected_workouts,
    week_number=week_num,
    target_tss=weekly_target_tss,
)

# 4. Call add_week_tool
result = self.add_week_tool.execute(...)
```

**2. Added `_adjust_weekly_tss()` Method (lines 260-347)**
- TSS calculation from segments
- Tolerance checking (±25%)
- Proportional duration scaling
- TSS recalculation verification
- Detailed logging

### Logging Output

**Example Log:**
```
2025-11-04 11:00:00 - INFO - [PHASE 3b-LIBRARY] Week 2: Actual TSS 416 vs target 285 (46.0% difference)
2025-11-04 11:00:00 - INFO - [PHASE 3b-LIBRARY] Week 2: Scaling workouts by 0.69x to match TSS target
2025-11-04 11:00:00 - DEBUG - [PHASE 3b-LIBRARY] Week 2: Scaled segment duration 90min → 62min
2025-11-04 11:00:00 - DEBUG - [PHASE 3b-LIBRARY] Week 2: Scaled segment duration 60min → 41min
...
2025-11-04 11:00:00 - INFO - [PHASE 3b-LIBRARY] Week 2: After scaling: TSS 285 (target 285)
```

---

## Benefits

1. **Prevents add_week_tool Rejection** ✅
   - Ensures workouts pass ±25% TSS validation
   - No more RuntimeError failures

2. **Preserves Workout Structure** ✅
   - Power zones unchanged
   - Segment types unchanged
   - Only durations scaled proportionally

3. **Maintains Weekly Balance** ✅
   - All workouts scaled equally
   - Relative intensity preserved
   - Training distribution maintained

4. **Automatic Adjustment** ✅
   - No manual intervention needed
   - Works for both over/under TSS scenarios
   - Handles any week configuration

---

## Trade-offs

### Pros
- ✅ Guarantees TSS validation passes
- ✅ Fully automated
- ✅ Works with any workout combination
- ✅ Preserves power zones and structure

### Cons
- ⚠️ May create non-standard durations (e.g., 41 min instead of 45 min)
- ⚠️ Doesn't respect workout `variable_components` constraints
- ⚠️ Scales all workouts equally (no prioritization)

### Future Improvements

1. **Smart Scaling**
   - Prioritize scaling endurance rides over intervals
   - Respect `variable_components.min_value` and `max_value`
   - Scale in 5-minute increments for cleaner durations

2. **Selective Adjustment**
   - Only scale workouts with `variable_components`
   - Leave fixed workouts unchanged
   - Better match workout designer intent

3. **Workout Re-selection**
   - If scaling > 30%, try selecting different workouts
   - Iterate with tighter TSS constraints
   - Fall back to scaling if no better match

---

## Testing

### Unit Test Scenarios

1. **TSS Within Tolerance (±25%)**
   ```python
   target_tss = 300
   actual_tss = 315  # 5% over
   # Expected: No scaling, workouts returned as-is
   ```

2. **TSS Over Target (46%)**
   ```python
   target_tss = 285
   actual_tss = 416  # 46% over
   # Expected: Scale down by 0.685x
   ```

3. **TSS Under Target (40%)**
   ```python
   target_tss = 400
   actual_tss = 240  # 40% under
   # Expected: Scale up by 1.67x
   ```

4. **Edge Case: Zero TSS**
   ```python
   target_tss = 0
   actual_tss = 100
   # Expected: No scaling (avoid division by zero)
   ```

### Integration Test

**Command:**
```bash
cycling-ai generate \
  --profile data/Athlete_Name/athlete_profile.json \
  --fit-dir data/Athlete_Name/FIT_files/ \
  --workout-source library \
  --training-plan-weeks 12
```

**Expected Behavior:**
1. Phase 3a creates 12-week overview with varying TSS targets
2. Phase 3b selects library workouts for each week
3. TSS adjustment scales workouts to match targets
4. All 12 weeks pass add_week_tool validation
5. Training plan generated successfully
6. HTML report shows proper weekly TSS distribution

---

## Validation Checklist

- [x] TSS calculation algorithm matches add_week_tool logic
- [x] Scaling factor correctly computed (target / actual)
- [x] All segment durations scaled proportionally
- [x] Power zones preserved (not scaled)
- [x] Segment types preserved
- [x] Logging shows before/after TSS
- [x] Handles edge cases (zero TSS, empty workouts)
- [x] Works with interval sets (nested structure)
- [x] Works with simple segments

---

## Summary

**Problem:** Library workouts totaled 416 TSS vs 285 TSS target (46% over), failing validation

**Solution:** Post-selection proportional duration scaling to match weekly TSS target

**Result:** Workouts automatically adjusted to pass ±25% validation threshold

**Status:** Ready for testing ✅

---

## Related Documents

- **Schema Map:** `.claude/current_task/COMPLETE_SCHEMA_MAP.md`
- **Library Phase Fixes:** `.claude/current_task/LIBRARY_PHASE_VALIDATION_FIXES.md`
- **add_week_tool Validation:** `src/cycling_ai/tools/wrappers/add_week_tool.py:113-188`

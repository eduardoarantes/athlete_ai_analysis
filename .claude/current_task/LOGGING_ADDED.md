# Comprehensive Logging Added to Week Validation

## Summary

Added detailed logging throughout the week validation process to show exactly what the code is trying to do to fix validation issues. The logs provide clear visibility into:

1. Multi-scenario validation attempts
2. 6-day recovery detection
3. Auto-fix decision making
4. Step-by-step auto-fix operations
5. Success/failure outcomes

---

## Logging Locations

### 1. **6-Day Recovery Detection** (`_detect_optional_recovery_workout`)

**Location:** Line 72-76

**Logs:**
```
Week {X}: Detected 6-day week with recovery workout on {weekday} (workout index {idx})
```

**Purpose:** Shows when a 6-day week with recovery is detected for dual-scenario validation.

---

### 2. **Scenario 1 Validation** (All Workouts)

**Location:** Lines 709-734

**Logs:**
```
Week {X}: Validating scenario 1 (all workouts)
  - Calculated: {hours}h, {tss} TSS
  - Targets: {target_hours}h, {target_tss} TSS
  - Scenario 1 PASSED
OR
  - Scenario 1 FAILED with {N} error(s)
```

**Purpose:** Shows calculation and validation of all workouts scenario.

---

### 3. **Scenario 2 Validation** (Excluding Recovery)

**Location:** Lines 748-771

**Logs:**
```
Week {X}: Validating scenario 2 (excluding recovery on {weekday})
  - Calculated: {hours}h, {tss} TSS
  - Scenario 2 PASSED
OR
  - Scenario 2 FAILED with {N} error(s)
```

**Purpose:** Shows calculation and validation when recovery is excluded.

---

### 4. **Validation Summary**

**Location:** Lines 848-857

**Logs:**
```
Week {X}: VALIDATION PASSED ({M}/{N} scenario(s) passed)
OR
Week {X}: VALIDATION FAILED in all {N} scenario(s)
```

**Purpose:** High-level summary of validation outcome.

---

### 5. **Auto-Fix Decision**

**Location:** Lines 862-869

**Logs:**
```
Week {X}: Auto-fix is enabled, attempting to fix...
OR
Week {X}: Auto-fix is disabled (strict validation mode)
```

**Purpose:** Shows whether auto-fix will be attempted.

---

### 6. **Auto-Fix Start**

**Location:** Lines 332-335

**Logs:**
```
Week {X}: AUTO-FIX attempting to reduce time from {current}h to {target}h
```

**Purpose:** Shows the auto-fix goal.

---

### 7. **Already Within Budget Check**

**Location:** Lines 338-342

**Logs:**
```
Week {X}: Already within budget, no fix needed
```

**Purpose:** Early exit if no fix is needed.

---

### 8. **Weekend Endurance Search**

**Location:** Lines 345-364

**Logs:**
```
Week {X}: No weekend endurance rides found to reduce
OR
Week {X}: Found {N} weekend endurance ride(s)
Week {X}: Targeting longest ride on {weekday} ({duration} min)
```

**Purpose:** Shows which ride will be modified.

---

### 9. **Step 1: Warmup/Cooldown Removal**

**Location:** Lines 376-417

**Logs:**
```
Week {X}: Step 1 - Attempting to remove warmup/cooldown segments
Week {X}:   Removed: warmup (10 min), cooldown (10 min)
OR
Week {X}:   No warmup/cooldown segments to remove
Week {X}:   After warmup/cooldown removal: {hours}h (target: {target}h)
Week {X}: ✓ Auto-fix successful: Removed warmup/cooldown from {weekday} endurance ride...
```

**Purpose:** Shows warmup/cooldown removal attempt and result.

---

### 10. **Step 2: Main Block Reduction**

**Location:** Lines 420-434

**Logs:**
```
Week {X}: Step 2 - Reducing main endurance segments by 15 min intervals (min: 60 min)
Week {X}:   Iteration 1/10: Current {hours}h, target {target}h
Week {X}:     Reducing segment {idx} from {old} min to {new} min
```

**Purpose:** Shows iterative reduction of main block.

---

### 11. **Main Block Reduction - No Segments**

**Location:** Lines 454-458

**Logs:**
```
Week {X}:   No more endurance segments to reduce
```

**Purpose:** Shows when no more segments can be reduced.

---

### 12. **Main Block Reduction - Minimum Hit**

**Location:** Lines 460-467

**Logs:**
```
Week {X}: ✗ Auto-fix insufficient: Cannot reduce below 60 min minimum...
```

**Purpose:** Shows when minimum duration is reached.

---

### 13. **Main Block Reduction - Success**

**Location:** Lines 470-489

**Logs:**
```
Week {X}: ✓ Auto-fix successful: Reduced {weekday} endurance ride by {N} min...
```

**Purpose:** Shows successful auto-fix after main block reduction.

---

### 14. **Max Iterations Exceeded**

**Location:** Lines 492-495

**Logs:**
```
Week {X}: Exceeded 10 iterations, still at {hours}h (target: {target}h)
```

**Purpose:** Shows when max iterations is hit without success.

---

### 15. **Re-Validation After Auto-Fix**

**Location:** Lines 873-896

**Logs:**
```
Week {X}: Re-validating after auto-fix modifications
Week {X}: ✓ AUTO-FIX SUCCESSFUL - Week now passes validation
Week {X}: {fix_log}
```

**Purpose:** Shows re-validation result after auto-fix.

---

## Log Example Flow

### **Scenario: 6-Day Week with Recovery, Time Over Budget**

```
Week 3: Detected 6-day week with recovery workout on Wednesday (workout index 2)
Week 3: Validating scenario 1 (all workouts)
  - Calculated: 8.50h, 520 TSS
  - Targets: 7.00h, 450 TSS
  - Scenario 1 FAILED with 1 error(s)
Week 3: Validating scenario 2 (excluding recovery on Wednesday)
  - Calculated: 7.75h, 480 TSS
  - Scenario 2 FAILED with 1 error(s)
Week 3: VALIDATION FAILED in all 2 scenario(s)
Week 3: Auto-fix is enabled, attempting to fix...
Week 3: AUTO-FIX attempting to reduce time from 8.50h to 7.00h
Week 3: Found 2 weekend endurance ride(s)
Week 3: Targeting longest ride on Saturday (180 min)
Week 3: Step 1 - Attempting to remove warmup/cooldown segments
Week 3:   Removed: warmup (10 min), cooldown (10 min)
Week 3:   After warmup/cooldown removal: 8.17h (target: 7.00h)
Week 3: Step 2 - Reducing main endurance segments by 15 min intervals (min: 60 min)
Week 3:   Iteration 1/10: Current 8.17h, target 7.00h
Week 3:     Reducing segment 0 from 160 min to 145 min
Week 3:   Iteration 2/10: Current 7.92h, target 7.00h
Week 3:     Reducing segment 0 from 145 min to 130 min
Week 3:   Iteration 3/10: Current 7.67h, target 7.00h
Week 3:     Reducing segment 0 from 130 min to 115 min
Week 3:   Iteration 4/10: Current 7.42h, target 7.00h
Week 3:     Reducing segment 0 from 115 min to 100 min
Week 3: ✓ Auto-fix successful: Reduced Saturday endurance ride by 80 min. Time reduced: 8.5h → 6.9h (target: 7.0h)
Week 3: Re-validating after auto-fix modifications
Week 3: ✓ AUTO-FIX SUCCESSFUL - Week now passes validation
Week 3: Auto-fix successful: Reduced Saturday endurance ride by 80 min. Time reduced: 8.5h → 6.9h (target: 7.0h)
Week 3: VALIDATION PASSED (1/1 scenario(s) passed)
```

---

## Benefits

1. **Transparency:** Users can see exactly what the auto-fix logic is doing
2. **Debugging:** Easy to identify where validation fails or auto-fix struggles
3. **Confidence:** Clear feedback on successful fixes builds trust
4. **Auditing:** Complete trail of all validation decisions

---

## Log Levels Used

- **`logger.info`:** Normal operation, success messages
- **`logger.warning`:** Validation failures, insufficient auto-fix
- **Symbols:**
  - ✓ = Success
  - ✗ = Failure

---

## Where Logs Appear

Logs are written to the standard logger configured in the application:

**Default location:** `~/.cycling-ai/logs/cycling-ai.log`

**Console output:** Visible when running with `--verbose` flag

---

## Testing

All tests still pass with new logging (16/16 tests passing).

Type safety and linting verified:
- ✅ `mypy --strict` passes
- ✅ `ruff check` passes

---

**Added:** 2025-11-03
**Lines of Logging Added:** ~80 lines across 15 locations
**Impact:** Zero performance impact, high debugging value

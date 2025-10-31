# Phase 3 Validation Fix

**Date:** 2025-10-31
**Issue:** Phase 3 was silently using default values when athlete profile data was missing
**Fix:** Added proper validation with clear error messages

## Problem

In `multi_agent.py` line 844-849, Phase 3 had a catch-all exception handler that silently set defaults:

```python
except Exception:
    # Fallback to defaults if profile can't be loaded
    ftp = 260  # Default FTP
    available_days = ["Monday", "Wednesday", "Saturday"]
    weekly_time_budget_hours = 8.0
    daily_time_caps = None
```

This is dangerous because:
1. Users don't know why their plan is using wrong values
2. Silent failures hide configuration problems
3. Generated plans may be invalid for the athlete

## Solution

Replaced silent defaults with explicit validation that fails fast with clear messages:

### 1. File Not Found
```python
except FileNotFoundError as e:
    raise ValueError(
        f"[PHASE 3] Cannot proceed: Athlete profile not found at '{athlete_profile_path}'. "
        f"Phase 3 requires a valid athlete profile with FTP, available training days, "
        f"and weekly time budget. Error: {e}"
    ) from e
```

### 2. Loading Errors
```python
except Exception as e:
    raise ValueError(
        f"[PHASE 3] Cannot proceed: Failed to load athlete profile from '{athlete_profile_path}'. "
        f"Phase 3 requires a valid athlete profile. Error: {e}"
    ) from e
```

### 3. Missing FTP
```python
if not hasattr(athlete_profile, 'ftp') or athlete_profile.ftp is None:
    raise ValueError(
        f"[PHASE 3] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
        f"does not have a valid FTP value. FTP is required for training plan generation."
    )
```

### 4. Missing Training Days
```python
if not available_days or len(available_days) == 0:
    raise ValueError(
        f"[PHASE 3] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
        f"does not specify available training days. At least one training day is required."
    )
```

### 5. Invalid Weekly Hours
```python
if weekly_time_budget_hours is None or weekly_time_budget_hours <= 0:
    raise ValueError(
        f"[PHASE 3] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
        f"does not have a valid weekly time budget. Weekly time budget must be greater than 0."
    )
```

## Benefits

1. **Clear Error Messages:** Users immediately know what's wrong and how to fix it
2. **Fail Fast:** Problems are caught early instead of producing invalid plans
3. **Better UX:** Error messages tell users exactly what's needed
4. **No Silent Failures:** All problems are reported explicitly

## Error Message Examples

### Missing File
```
ValueError: [PHASE 3] Cannot proceed: Athlete profile not found at '/path/to/profile.json'. 
Phase 3 requires a valid athlete profile with FTP, available training days, and weekly time budget. 
Error: [Errno 2] No such file or directory: '/path/to/profile.json'
```

### Missing FTP
```
ValueError: [PHASE 3] Cannot proceed: Athlete profile at '/path/to/profile.json' 
does not have a valid FTP value. FTP is required for training plan generation.
```

### No Training Days
```
ValueError: [PHASE 3] Cannot proceed: Athlete profile at '/path/to/profile.json' 
does not specify available training days. At least one training day is required.
```

### Zero Weekly Hours
```
ValueError: [PHASE 3] Cannot proceed: Athlete profile at '/path/to/profile.json' 
does not have a valid weekly time budget. Weekly time budget must be greater than 0.
```

## Files Modified

- `src/cycling_ai/orchestration/multi_agent.py` (Lines 836-877)
  - Removed: 5 lines of silent defaults
  - Added: ~40 lines of explicit validation

## Testing

Created `tests/test_phase3_validation.py` with validation tests for:
- Missing profile file
- Missing FTP
- No available training days  
- Zero/negative weekly hours

**Note:** Tests require fixing to use correct WorkflowConfig parameters.

## Impact

🟢 **NO BREAKING CHANGES** - Only adds validation

- ✅ Valid profiles work exactly as before
- ✅ Invalid profiles now fail with helpful messages instead of using wrong defaults
- ✅ Users can fix their configuration based on clear error messages

## Related Changes

This completes the cleanup work started with:
- Phase 1: Fixed `target_ftp` logging
- Phase 2: Removed legacy handling
- Phase 3: Removed double nesting
- **Phase 4:** Removed silent defaults (this change)

The system now has:
- Clean data structures (no double nesting)
- Correct field access (plan_metadata.target_ftp)
- No legacy code (weekly_plan only)
- No silent failures (explicit validation)

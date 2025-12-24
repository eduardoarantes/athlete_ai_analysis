# Training Plan Assembly Bug Fix Plan

## Problem Summary

Training plans generated via the web UI only show 1 week instead of all weeks (e.g., shows 1 week when `weeks_total` is 12).

## Root Cause Analysis

### The Bug Location

**File:** `src/cycling_ai/api/services/ai_plan_service.py`
**Lines:** 237-244

```python
# Step 3: Load the finalized plan
plan_path = Path("/tmp") / f"{plan_id}_plan.json"
if not plan_path.exists():
    raise ValueError(f"Plan file not found: {plan_path}")
```

**The Problem:** This code expects a file at `/tmp/{plan_id}_plan.json` that is **never created**.

### Data Flow Analysis

#### What SHOULD Happen (Intended Design)

```
Step 1: PlanOverviewTool.execute()
  └─> Creates: /tmp/{plan_id}_overview.json
      (Contains: weekly_overview structure, coaching_notes, NO workouts)

Step 2: LibraryBasedTrainingPlanningWeeks.execute()
  └─> For each week 1..N:
      └─> AddWeekDetailsTool.execute()
          └─> Creates: /tmp/{plan_id}_week_{N}.json
              (Contains: week_number, workouts[])

Step 3: ??? (MISSING)
  └─> Should combine overview + all week files into final plan
  └─> Should create: /tmp/{plan_id}_plan.json

Step 4: ai_plan_service.py loads /tmp/{plan_id}_plan.json
```

#### What ACTUALLY Happens

```
Step 1: PlanOverviewTool.execute()           ✓ Works
Step 2: LibraryBasedTrainingPlanningWeeks    ✓ Works (creates week files)
Step 3: NOTHING - No finalization step       ✗ BUG
Step 4: ai_plan_service.py tries to load     ✗ File doesn't exist
        non-existent file
```

### Why This Happened

1. `FinalizePlanTool` exists but is **only used by the LLM-based workflow** in `training_planning.py`
2. `LibraryBasedTrainingPlanningWeeks` was created as an alternative to LLM workout generation but **forgot to include the finalization step**
3. `ai_plan_service.py` assumes finalization happens but doesn't verify it

### Evidence

1. `FinalizePlanTool` is imported in `training_planning.py` (LLM workflow) - line 22
2. `FinalizePlanTool` is NOT imported in `training_planning_library.py` (library workflow)
3. `/tmp/` contains orphaned week files from previous runs:
   - `{plan_id}_week_1.json` through `{plan_id}_week_12.json` exist
   - `{plan_id}_plan.json` does NOT exist

---

## Fix Options

### Option A: Modify LibraryBasedTrainingPlanningWeeks to Call FinalizePlanTool

**Approach:** After all weeks are added, call `FinalizePlanTool.execute(plan_id)`

**Pros:**
- Reuses existing finalization logic
- Consistent with LLM-based workflow pattern

**Cons:**
- `FinalizePlanTool` saves to `~/.cycling-ai/training_plans/`, not `/tmp/`
- Would need to either:
  - Modify FinalizePlanTool output path (affects CLI users)
  - Add a parameter to control output path (API change)

**Risk:** Medium - Changes tool behavior, could affect CLI usage

---

### Option B: Assemble Plan Inline in ai_plan_service.py (RECOMMENDED)

**Approach:** After `LibraryBasedTrainingPlanningWeeks.execute()` returns, manually load and combine all files.

**Implementation:**
```python
# Step 3: Assemble the finalized plan from overview + week files
overview_path = Path("/tmp") / f"{plan_id}_overview.json"
with open(overview_path) as f:
    overview_data = json.load(f)

# Load and combine all week details
weekly_plan = []
for week_num in range(1, request.weeks + 1):
    week_path = Path("/tmp") / f"{plan_id}_week_{week_num}.json"
    with open(week_path) as f:
        week_data = json.load(f)

    # Get overview metadata for this week
    week_overview = overview_data["weekly_overview"][week_num - 1]

    # Merge: week metadata from overview + workouts from week file
    merged_week = {
        "week_number": week_num,
        "phase": week_overview.get("phase"),
        "phase_rationale": week_overview.get("phase_rationale"),
        "weekly_focus": week_overview.get("weekly_focus"),
        "weekly_watch_points": week_overview.get("weekly_watch_points"),
        "week_tss": week_overview.get("target_tss", 0),
        "workouts": week_data.get("workouts", []),
    }
    weekly_plan.append(merged_week)

# Build complete plan structure
plan_data = {
    "athlete_profile": self._build_athlete_profile_data(request),
    "plan_metadata": {
        "total_weeks": request.weeks,
        "current_ftp": request.athlete_profile.ftp,
        "target_ftp": request.target_ftp or request.athlete_profile.ftp * 1.05,
    },
    "coaching_notes": overview_data.get("coaching_notes", ""),
    "monitoring_guidance": overview_data.get("monitoring_guidance", ""),
    "weekly_plan": weekly_plan,
}
```

**Pros:**
- Self-contained in API service (no tool changes)
- Explicit about what web API expects
- Doesn't affect CLI or other tool users
- Easy to test in isolation

**Cons:**
- Some code duplication with FinalizePlanTool logic
- Need to ensure structure matches what frontend expects

**Risk:** Low - Only affects web API code path

---

### Option C: Create New AssemblePlanForApi Method

**Approach:** Add a dedicated assembly method that can be reused.

**Pros:**
- Cleaner separation of concerns
- Reusable if needed elsewhere

**Cons:**
- More files to maintain
- Slightly more complex

**Risk:** Low

---

## Recommended Solution: Option B

### Rationale

1. **Minimal blast radius** - Only changes `ai_plan_service.py`
2. **No tool API changes** - Existing tools continue to work for CLI
3. **Clear ownership** - Web API assembles its own data
4. **Easy to test** - Can write unit tests for assembly logic
5. **Quick to implement** - ~30 lines of code

### Implementation Plan

#### Step 1: Add Assembly Logic (ai_plan_service.py)

Replace lines 237-244 with assembly logic that:
1. Loads overview file
2. Loads all week files (1 to N)
3. Merges overview metadata with week workouts
4. Builds complete plan structure matching TypeScript types

#### Step 2: Add Helper Method for Athlete Profile

Add `_build_athlete_profile_data()` to create profile dict from request.

#### Step 3: Update Cleanup Logic

Ensure all temp files are cleaned up:
- `{plan_id}_overview.json`
- `{plan_id}_week_{1..N}.json`

#### Step 4: Add Unit Tests

- Test assembly with mock overview and week files
- Test error handling for missing files
- Test structure matches TypeScript `TrainingPlanData` interface

---

## Testing Strategy

### Unit Tests (New)

1. `test_assemble_plan_from_files()` - Happy path
2. `test_assemble_plan_missing_week_file()` - Error handling
3. `test_assemble_plan_missing_overview()` - Error handling
4. `test_plan_structure_matches_typescript_types()` - Schema validation

### Integration Tests (Existing)

Run existing plan generation tests to ensure no regression:
```bash
pytest tests/api/test_plan_generation.py -v
```

### Manual E2E Test

1. Start FastAPI server
2. Start Next.js dev server
3. Generate a new 4-week plan
4. Verify all 4 weeks appear in UI
5. Verify workouts have correct structure

---

## Files to Modify

| File | Change |
|------|--------|
| `src/cycling_ai/api/services/ai_plan_service.py` | Add plan assembly logic after Step 2 |
| `tests/api/test_ai_plan_service.py` | Add unit tests for assembly (new file or extend) |

## Files NOT to Modify

| File | Reason |
|------|--------|
| `training_planning_library.py` | Keep focused on workout selection |
| `FinalizePlanTool` | Don't change tool behavior |
| `AddWeekDetailsTool` | Don't change tool behavior |
| `PlanOverviewTool` | Don't change tool behavior |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Assembly logic differs from FinalizePlanTool | Low | Medium | Compare output structures |
| Missing field in assembled plan | Low | High | Add schema validation |
| Breaks existing tests | Low | Low | Run full test suite |
| Frontend can't parse new structure | Low | High | Validate against TypeScript types |

---

## Rollback Plan

If issues arise after deployment:
1. Revert `ai_plan_service.py` to previous version
2. The bug will return (1 week instead of all) but system won't break

---

## Success Criteria

1. Generated plans show ALL weeks in UI
2. Each week has correct phase, focus, and workouts
3. Workout segments display correctly
4. All existing tests pass
5. No errors in FastAPI logs during generation

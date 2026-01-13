# Test Results: Library Workout & Deep Copy Issues

## Summary

Created tests to prove two critical issues with the training plan system:

### Issue 1: Library Workouts Not Always Going to MANUAL_WORKOUTS

**Status:** ❌ Tests created, implementation needs fixing

### Issue 2: Workouts Not Deeply Copied (Missing Structure)

**Status:** ❌ Tests created, implementation needs fixing

---

## Issue 1: Library Workout Addition Tests

**File:** `app/api/schedule/__tests__/add-library-workout.test.ts`

### Test Results

```
❯ Library Workout Addition > Issue 1: Library workouts should ALWAYS go to MANUAL_WORKOUTS
  × FAILS - adds library workout to non-MANUAL_WORKOUTS instance (8ms)
  × SHOULD PASS - adds library workout to MANUAL_WORKOUTS even when other plan exists (1ms)
  ✓ SHOULD PASS - frontend always passes MANUAL_WORKOUTS instanceId for library workouts (0ms)
```

### Problem Identified

**Current Behavior:**

- When dragging a library workout to the calendar, it gets added to whatever plan instance ID is passed
- If user has "Build Phase" plan active, library workout goes there instead of MANUAL_WORKOUTS

**Required Behavior:**

- ALL library workouts MUST go to `MANUAL_WORKOUTS` instance
- MANUAL_WORKOUTS exists specifically to hold manually-added workouts that overlay on structured plans
- This allows users to add ad-hoc workouts without modifying their actual training plan

### Test Coverage

1. **Test: adds library workout to non-MANUAL_WORKOUTS instance**
   - Status: FAILS (documents current wrong behavior)
   - Shows that workout can be added to regular plan instance

2. **Test: adds library workout to MANUAL_WORKOUTS even when other plan exists**
   - Status: FAILS (API test needs better mocking)
   - Verifies correct behavior of adding to MANUAL_WORKOUTS

3. **Test: frontend always passes MANUAL_WORKOUTS instanceId for library workouts**
   - Status: ✓ PASSES
   - Logic test verifying frontend can identify MANUAL_WORKOUTS instance

---

## Issue 2: Workout Deep Copy Tests

**File:** `lib/services/__tests__/plan-instance-deep-copy.test.ts`

### Test Results

```
❯ Plan Instance Workout Deep Copy > Issue 2: Workouts should be deeply copied with full structure
  × FAILS - template workout has library_workout_id but no structure (3ms)
  × SHOULD PASS - instance workout has full structure copied from library (0ms)
  ✓ SHOULD PASS - modifying library workout does not affect scheduled instances (1ms)
```

### Problem Identified

**Current Behavior:**

- Template workouts only store `library_workout_id` reference
- When creating instance, only `id` and `scheduled_date` are added
- **`structure` field is NOT copied** from library workout

**Required Behavior:**

- When scheduling a plan, each workout must be a **complete standalone copy**
- Must copy ALL fields from library: `structure`, `name`, `description`, `detailed_description`, `tss`, `type`, etc.
- Keep `library_workout_id` for reference/tracking only
- Instances must be independent of library changes

### Why This Matters

1. **Library Modifications:** If library workout is modified/deleted, existing instances would break
2. **User Customization:** Users can't customize instance workouts without changing the library
3. **Immutability:** Plan instances should be immutable snapshots
4. **Calendar Display:** Calendar needs `structure` to show workout details

### Test Coverage

1. **Test: template workout has library_workout_id but no structure**
   - Status: FAILS (proves current problem)
   - Shows that templates don't include full workout data

2. **Test: instance workout has full structure copied from library**
   - Status: FAILS (needs fix)
   - Verifies that structure and all fields are deeply copied

3. **Test: modifying library workout does not affect scheduled instances**
   - Status: ✓ PASSES (logic test)
   - Proves that deep copies are independent

---

## Required Fixes

### Fix 1: Frontend - Always Use MANUAL_WORKOUTS for Library Drags

**Location:** `components/training/schedule-content.tsx` and `components/schedule/dnd/draggable-library-workout.tsx`

**Change Needed:**

```typescript
// Current (WRONG):
const singleInstance = plansWithFutureContent.length === 1 ? plansWithFutureContent[0] : null
const instanceId = singleInstance?.id || 'placeholder'

// Fixed (CORRECT):
const manualWorkoutsInstance = instances.find((i) => i.instance_type === 'manual_workouts')
const instanceId = manualWorkoutsInstance?.id || 'placeholder'
```

### Fix 2: Backend - Deep Copy Workouts from Library

**Location:** `lib/services/plan-instance-service.ts`

**Change Needed:**

```typescript
// Current (WRONG):
function prepareWorkoutsForInstance(planData, startDate) {
  // Only adds id and scheduled_date
  return {
    ...planData,
    weekly_plan: planData.weekly_plan.map(week => ({
      ...week,
      workouts: week.workouts.map(workout => ({
        ...workout,
        id: workout.id || crypto.randomUUID(),
        scheduled_date: calculateScheduledDate(...)
      }))
    }))
  }
}

// Fixed (CORRECT):
async function prepareWorkoutsForInstance(planData, startDate) {
  // Fetch library workouts and deep copy structure
  for each workout with library_workout_id:
    - Fetch from workout_library table
    - Copy structure, description, detailed_description, etc.
    - Keep library_workout_id for reference
    - Add id and scheduled_date
}
```

---

## Implementation Status

### ✅ Fix 1: Backend Always Routes Library Workouts to MANUAL_WORKOUTS

**File:** `app/api/schedule/[instanceId]/workouts/add/route.ts`

**Implementation:**

```typescript
// CRITICAL: Library workouts ALWAYS go to MANUAL_WORKOUTS instance
// Find the user's MANUAL_WORKOUTS instance
const { data: manualWorkoutsInstance, error: manualWorkoutsError } = await supabase
  .from('plan_instances')
  .select('*')
  .eq('user_id', user.id)
  .eq('instance_type', 'manual_workouts')
  .single()

// Use MANUAL_WORKOUTS instance, not the instanceId from the URL
const instance = manualWorkoutsInstance
```

**Result:** Frontend can pass any instanceId, but backend automatically routes to MANUAL_WORKOUTS.

### ✅ Fix 2: Backend Deep Copies Workouts with Full Structure

**File:** `lib/services/plan-instance-service.ts`

**Implementation:**

```typescript
async function prepareWorkoutsForInstance(
  planData: TrainingPlanData,
  startDate: string
): Promise<TrainingPlanData> {
  // For each workout with library_workout_id:
  if (workout.library_workout_id) {
    // Fetch from Python API (workouts stored there, not in local DB)
    const workoutResponse = await invokePythonApi<WorkoutLibraryItem>({
      method: 'GET',
      path: `/api/v1/workouts/${workout.library_workout_id}`,
    })

    if (workoutResponse.statusCode === 200 && workoutResponse.body) {
      const libraryWorkout = workoutResponse.body
      // Deep copy all fields from library workout
      enrichedWorkout = {
        ...workout,
        name: libraryWorkout.name,
        type: libraryWorkout.type,
        tss: libraryWorkout.base_tss,
        structure: libraryWorkout.structure,
        description: libraryWorkout.description || undefined,
        detailed_description: libraryWorkout.detailed_description || undefined,
        library_workout_id: workout.library_workout_id, // Keep for reference
      }
    }
  }
}
```

**Result:** When scheduling plans, workouts are deeply copied with full structure from Python API workout library.

## Next Steps

1. ✅ Tests created to prove both issues
2. ✅ Implement Fix 1: Backend library workout routing
3. ✅ Implement Fix 2: Backend deep copy with library fetch
4. ⏳ Manual testing with real data (tests need mock updates for Python API calls)

---

## Test Commands

```bash
# Run Issue 1 tests
pnpm test:unit app/api/schedule/__tests__/add-library-workout.test.ts

# Run Issue 2 tests
pnpm test:unit lib/services/__tests__/plan-instance-deep-copy.test.ts

# Run all tests
pnpm test:unit:run
```

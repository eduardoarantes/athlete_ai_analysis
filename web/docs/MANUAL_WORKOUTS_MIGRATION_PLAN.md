# Manual Workouts Migration Plan

**Status:** Planning
**Created:** 2026-01-14
**Author:** Architecture Discussion

---

## Executive Summary

This document outlines the migration from the current `MANUAL_WORKOUTS` plan instance approach to a dedicated `manual_workouts` relational table. The current implementation stores all manually-added workouts in a single JSONB `plan_data` blob that grows unbounded, creating performance and scalability concerns.

**Key Change:** Move from JSONB storage to a dedicated relational table for all user-modified workouts (library drops + workouts extracted from training plans).

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Performance Issues](#performance-issues)
4. [Proposed Solution](#proposed-solution)
5. [New Schema](#new-schema)
6. [Migration Flows](#migration-flows)
7. [Implementation Checklist](#implementation-checklist)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)

---

## Problem Statement

### Current Behavior

Every user has a `MANUAL_WORKOUTS` plan instance created automatically during profile creation:

- Spans 10 years (520 weeks)
- Stores all manually-added workouts in `plan_data.weekly_plan[]` JSONB array
- Grows unbounded as users add workouts
- No cleanup or archival mechanism

### Growth Pattern

```
User adding 5 workouts/week over 5 years:
= 5 × 52 weeks × 5 years
= 1,300 workouts in one JSONB blob
≈ 650KB - 1.3MB per user
```

### Impact on Performance

1. **Every calendar view** loads the entire MANUAL_WORKOUTS JSONB blob
2. **Every add/move/delete** rewrites the entire blob
3. **Database query time** increases linearly with workout count
4. **Network transfer size** grows unbounded
5. **JSON parsing performance** degrades on client
6. **PostgreSQL JSONB indexing** becomes less effective

---

## Current Architecture

### MANUAL_WORKOUTS Plan Instance

**Created in:** `web/app/api/profile/create/route.ts:98-200`

```typescript
// Created automatically when user profile is created
const planData = {
  athlete_profile: { ftp, weight_kg },
  plan_metadata: {
    total_weeks: 520,  // 10 years!
    type: 'manual_workouts',
  },
  weekly_plan: [],  // ⚠️ Grows unbounded
}

// Inserted into plan_instances table
{
  instance_type: 'manual_workouts',
  start_date: '2026-01-14',
  end_date: '2036-01-14',  // 10 years later
  plan_data: planData,
}
```

### Current Workout Flows

#### Flow 1: Add Library Workout

**User Action:** Drag workout from library sidebar → calendar date

**API:** `POST /api/schedule/${instanceId}/workouts/add`

**Backend Logic:**

```typescript
1. IGNORES instanceId from URL
2. Finds user's MANUAL_WORKOUTS instance
3. Fetches workout from Python library API
4. Calculates week_number from target_date
5. Finds/creates week in plan_data.weekly_plan[]
6. Pushes workout to week.workouts[]
7. Updates entire plan_data JSONB to database ⚠️
```

**File:** `web/app/api/schedule/[instanceId]/workouts/add/route.ts`

#### Flow 2: Move Workout

**User Action:** Drag scheduled workout → different date

**API:** `PATCH /api/schedule/${instanceId}/workouts`

**Backend Logic:**

```typescript
1. Loads entire plan_data JSONB ⚠️
2. Finds workout by workout_id
3. Splices from source week
4. Pushes to target week
5. Updates workout.scheduled_date
6. Saves entire plan_data JSONB ⚠️
```

**File:** `web/app/api/schedule/[instanceId]/workouts/route.ts:137-327`

#### Flow 3: Delete Workout

**User Action:** Delete workout via context menu

**API:** `DELETE /api/schedule/${instanceId}/workouts`

**Backend Logic:**

```typescript
1. Loads entire plan_data JSONB ⚠️
2. Finds and splices workout
3. Saves entire plan_data JSONB ⚠️
4. Deletes from workout_activity_matches table
```

**File:** `web/app/api/schedule/[instanceId]/workouts/route.ts:342-490`

---

## Performance Issues

### Query Performance

**Current:**

```typescript
// Loads ALL plan_data for MANUAL_WORKOUTS instance
supabase
  .from('plan_instances')
  .select('*') // ⚠️ Includes entire weekly_plan array
  .eq('user_id', userId)
```

**Problem:** Every instance listing query transfers the full JSONB blob over the network.

### Write Performance

**Every mutation:**

```typescript
// Update entire JSONB blob
await supabase.from('plan_instances').update({
  plan_data: planData as any, // ⚠️ 650KB - 1.3MB for active users
  updated_at: new Date().toISOString(),
})
```

**Problem:** PostgreSQL must rewrite the entire JSONB document on every change.

### Scaling Concerns

| User Activity     | Workouts | JSONB Size   | Query Time (est) | Transfer Size |
| ----------------- | -------- | ------------ | ---------------- | ------------- |
| Light (1/week)    | 52/year  | ~25KB        | Fast             | Acceptable    |
| Moderate (3/week) | 156/year | ~75KB        | Acceptable       | Noticeable    |
| Active (5/week)   | 260/year | ~130KB       | Slow             | Significant   |
| 5 years active    | 1,300    | ~650KB-1.3MB | Very Slow        | Problematic   |

---

## Proposed Solution

### Design Principles

1. **Relational Model:** Workouts are first-class entities with proper table structure
2. **Scalability:** No growth limit, standard table pagination
3. **Performance:** Indexed queries by user_id and scheduled_date
4. **Flexibility:** Easy to add features (edit, bulk operations, archival)
5. **Source Tracking:** Preserve original plan instance ID for workouts extracted from plans

### Workout Ownership Model

**Training Plan Workouts (in `plan_data`):**

- Original template workouts from AI-generated plans
- Immutable after instance creation
- Stored in `plan_instances.plan_data.weekly_plan[]`
- Modifications → extract to `manual_workouts` table

**Manual Workouts (in dedicated table):**

- Library drops added by user
- Workouts extracted/moved from training plans
- Fully editable and deletable
- Stored in `manual_workouts` table

---

## New Schema

### Database Table

```sql
-- Create manual_workouts table
CREATE TABLE manual_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,

  -- Full workout data (structure, intervals, TSS, etc.)
  workout_data JSONB NOT NULL,

  -- Optional: Track if this workout was extracted from a training plan
  source_plan_instance_id UUID REFERENCES plan_instances(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_manual_workouts_user_date
  ON manual_workouts(user_id, scheduled_date);

CREATE INDEX idx_manual_workouts_user
  ON manual_workouts(user_id);

CREATE INDEX idx_manual_workouts_source_plan
  ON manual_workouts(source_plan_instance_id)
  WHERE source_plan_instance_id IS NOT NULL;

-- RLS Policies
ALTER TABLE manual_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own manual workouts"
  ON manual_workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own manual workouts"
  ON manual_workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual workouts"
  ON manual_workouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual workouts"
  ON manual_workouts FOR DELETE
  USING (auth.uid() = user_id);
```

### TypeScript Types

```typescript
// lib/types/manual-workout.ts
export interface ManualWorkout {
  id: string
  user_id: string
  scheduled_date: string // YYYY-MM-DD
  workout_data: Workout // Full workout object
  source_plan_instance_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateManualWorkoutInput {
  scheduled_date: string
  workout_data: Workout
  source_plan_instance_id?: string
}

export interface UpdateManualWorkoutInput {
  scheduled_date?: string
  workout_data?: Partial<Workout>
}
```

---

## Migration Flows

### Flow 1: Add Library Workout

**User Action:** Drag workout from library → calendar date

**NEW API:** `POST /api/manual-workouts`

**Request:**

```json
{
  "library_workout_id": "workout-123",
  "scheduled_date": "2026-02-15"
}
```

**Backend Logic:**

```typescript
1. Fetch workout from Python library API
2. INSERT INTO manual_workouts (
     user_id,
     scheduled_date,
     workout_data
   )
3. Return immediately (no JSONB update!)
```

**Performance:** O(1) insert with indexed lookup

---

### Flow 2a: Move Workout Within Training Plan

**User Action:** Drag workout within plan's date range

**API:** `PATCH /api/schedule/${instanceId}/workouts/${workoutId}`

**Request:**

```json
{
  "target_date": "2026-03-01"
}
```

**Backend Logic:**

```typescript
1. Verify target_date is within instance start_date and end_date
2. Load plan_data JSONB
3. Find workout, update scheduled_date and weekday
4. Move between weeks if needed
5. Save plan_data back to database
```

**Note:** Stays in `plan_data` - same as current behavior

---

### Flow 2b: Move Workout Outside Training Plan

**User Action:** Drag workout outside plan's date range

**API:** `PATCH /api/schedule/${instanceId}/workouts/${workoutId}`

**Request:**

```json
{
  "target_date": "2026-06-15" // Outside plan range
}
```

**Backend Logic:**

```typescript
1. Detect target_date > instance.end_date OR < instance.start_date
2. Load plan_data, find workout
3. INSERT INTO manual_workouts (
     workout_data,
     scheduled_date,
     source_plan_instance_id  // Track origin!
   )
4. Remove from plan_data.weekly_plan
5. Save updated plan_data
6. Return success with indication it moved to manual
```

**Performance:** Single insert + JSONB update (one-time cost)

---

### Flow 3: Move Manual Workout

**User Action:** Drag manual workout → different date

**NEW API:** `PATCH /api/manual-workouts/${workoutId}`

**Request:**

```json
{
  "scheduled_date": "2026-03-10"
}
```

**Backend Logic:**

```typescript
UPDATE manual_workouts
SET scheduled_date = '2026-03-10',
    updated_at = NOW()
WHERE id = $workoutId
  AND user_id = $userId
```

**Performance:** O(1) indexed row update - extremely fast!

---

### Flow 4: Delete Manual Workout

**User Action:** Delete manual workout via context menu

**NEW API:** `DELETE /api/manual-workouts/${workoutId}`

**Backend Logic:**

```typescript
1. DELETE FROM manual_workouts
   WHERE id = $workoutId AND user_id = $userId

2. DELETE FROM workout_activity_matches
   WHERE workout_id = $workoutId
```

**Performance:** O(1) indexed deletion

---

### Flow 5: Delete Training Plan Workout

**User Action:** Delete workout from training plan

**API:** `DELETE /api/schedule/${instanceId}/workouts/${workoutId}`

**Backend Logic:**

```typescript
1. Load plan_data JSONB
2. Find and remove workout from weekly_plan
3. Save updated plan_data
4. DELETE FROM workout_activity_matches
```

**Note:** Direct deletion from plan_data - same as current behavior

---

### Flow 6: Load Calendar View

**User Action:** View calendar for a month

**NEW API:** `GET /api/manual-workouts?start_date=2026-02-01&end_date=2026-03-01`

**Backend Logic:**

```typescript
// Fetch manual workouts for date range
SELECT * FROM manual_workouts
WHERE user_id = $userId
  AND scheduled_date >= '2026-02-01'
  AND scheduled_date <= '2026-03-01'
ORDER BY scheduled_date

// Also fetch training plan workouts from plan_instances
SELECT id, plan_data FROM plan_instances
WHERE user_id = $userId
  AND status IN ('scheduled', 'active')
  AND start_date <= '2026-03-01'
  AND end_date >= '2026-02-01'

// Merge results on frontend
```

**Performance:**

- Manual workouts: O(log n) indexed range query
- Plan workouts: Same as current (JSONB load)
- Huge improvement for users with many manual workouts

---

## Implementation Checklist

### Phase 1: Database Schema

- [ ] Create migration: `manual_workouts` table
- [ ] Add indexes: `user_id`, `scheduled_date`, `source_plan_instance_id`
- [ ] Set up RLS policies
- [ ] Regenerate Supabase types
- [ ] Test migration on local Supabase

### Phase 2: TypeScript Types & Utilities

- [ ] Create `lib/types/manual-workout.ts`
- [ ] Add type guards in `lib/types/type-guards.ts`
- [ ] Update `lib/types/database.ts` (auto-generated)

### Phase 3: API Routes - Manual Workouts

- [ ] Create `app/api/manual-workouts/route.ts` (GET, POST)
- [ ] Create `app/api/manual-workouts/[workoutId]/route.ts` (GET, PATCH, DELETE)
- [ ] Add validation schemas with Zod
- [ ] Add error handling and logging
- [ ] Write API route tests

### Phase 4: API Routes - Plan Workouts (Modified)

- [ ] Update `app/api/schedule/[instanceId]/workouts/route.ts`:
  - [ ] Add boundary detection for moves
  - [ ] Add logic to extract to manual_workouts when moved outside range
  - [ ] Update return types to indicate extraction
- [ ] Remove `app/api/schedule/[instanceId]/workouts/add/route.ts` (replaced by manual-workouts API)
- [ ] Write tests for boundary scenarios

### Phase 5: Services Layer

- [ ] Create `lib/services/manual-workout-service.ts`
- [ ] Implement CRUD operations
- [ ] Add date range queries
- [ ] Write service tests

### Phase 6: Frontend Components

- [ ] Update `components/training/schedule-calendar.tsx`:
  - [ ] Load manual workouts from new API
  - [ ] Merge with plan workouts for display
  - [ ] Update drag handlers to call correct API
  - [ ] Add visual indicator for extracted workouts
- [ ] Update optimistic UI helpers
- [ ] Update context menus
- [ ] Test all drag & drop scenarios

### Phase 7: Profile Creation

- [ ] Remove MANUAL_WORKOUTS instance creation from `app/api/profile/create/route.ts`
- [ ] Clean up related migrations
- [ ] Update documentation

### Phase 8: Migration & Cleanup

- [ ] Since we can delete data:
  - [ ] Delete all existing MANUAL_WORKOUTS instances
  - [ ] Clean up test data
- [ ] Remove `instance_type` column (no longer needed)
- [ ] Remove related code for MANUAL_WORKOUTS special handling

### Phase 9: Testing

- [ ] Unit tests for API routes
- [ ] Unit tests for services
- [ ] Integration tests for all flows
- [ ] E2E tests for drag & drop scenarios
- [ ] Performance testing with large datasets

### Phase 10: Documentation

- [ ] Update API documentation
- [ ] Update CLAUDE.md with new patterns
- [ ] Update web/CLAUDE.md
- [ ] Add migration notes to README

---

## Migration Strategy

### Development Environment (Can Delete Data)

Since we're not in production yet:

1. **Drop all existing data:**

   ```sql
   -- Delete all MANUAL_WORKOUTS instances
   DELETE FROM plan_instances
   WHERE instance_type = 'manual_workouts';

   -- Drop instance_type column
   ALTER TABLE plan_instances DROP COLUMN instance_type;
   ```

2. **Create new schema:**

   ```bash
   npx supabase migration new create_manual_workouts_table
   ```

3. **Update code to use new API**

4. **Test with fresh data**

### If We Had Production Data (Future Reference)

For future migrations with real user data:

```sql
-- Migration script to preserve existing data
INSERT INTO manual_workouts (user_id, scheduled_date, workout_data, created_at)
SELECT
  pi.user_id,
  (workout->>'scheduled_date')::date,
  workout,
  pi.created_at
FROM plan_instances pi,
     jsonb_array_elements(pi.plan_data->'weekly_plan') AS week,
     jsonb_array_elements(week->'workouts') AS workout
WHERE pi.instance_type = 'manual_workouts'
  AND workout->>'scheduled_date' IS NOT NULL;
```

---

## Testing Strategy

### Unit Tests

**API Routes:**

- [ ] POST /api/manual-workouts - success cases
- [ ] POST /api/manual-workouts - validation errors
- [ ] GET /api/manual-workouts - date range filtering
- [ ] PATCH /api/manual-workouts/[id] - update date
- [ ] DELETE /api/manual-workouts/[id] - cleanup matches
- [ ] PATCH /api/schedule/[instanceId]/workouts - boundary detection

**Services:**

- [ ] ManualWorkoutService CRUD operations
- [ ] Date range queries
- [ ] Source plan tracking

### Integration Tests

- [ ] Add library workout → manual_workouts table
- [ ] Move plan workout within range → stays in plan_data
- [ ] Move plan workout outside range → extracts to manual_workouts
- [ ] Move manual workout → updates row
- [ ] Delete manual workout → removes from table and matches
- [ ] Calendar view → merges manual + plan workouts

### E2E Tests (Playwright)

```typescript
test('drag library workout to calendar', async ({ page }) => {
  // Drag workout from library sidebar to calendar date
  // Verify workout appears on calendar
  // Verify manual_workouts table has entry
})

test('drag plan workout outside plan range', async ({ page }) => {
  // Drag workout from week 1 to beyond week 12
  // Verify workout moves to new date
  // Verify it's now in manual_workouts table
  // Verify source_plan_instance_id is set
})

test('move manual workout to different date', async ({ page }) => {
  // Drag manual workout to new date
  // Verify fast update (< 100ms)
  // Verify scheduled_date updated
})
```

### Performance Tests

- [ ] Load calendar with 1,000 manual workouts (should be fast with indexed query)
- [ ] Add 100 workouts in sequence (should be linear time)
- [ ] Move manual workout (should be < 50ms)
- [ ] Delete manual workout (should be < 50ms)

---

## Benefits Summary

### Performance

| Operation             | Current              | New                  | Improvement       |
| --------------------- | -------------------- | -------------------- | ----------------- |
| Add workout           | O(n) JSONB update    | O(1) indexed insert  | 10-100x faster    |
| Move manual workout   | O(n) JSONB update    | O(1) indexed update  | 10-100x faster    |
| Delete manual workout | O(n) JSONB update    | O(1) indexed delete  | 10-100x faster    |
| Load calendar         | O(n) full blob load  | O(log n) range query | 5-50x faster      |
| 5-year user data      | 650KB-1.3MB transfer | 10-50KB transfer     | 13-130x less data |

### Scalability

- ✅ No unbounded growth of JSONB blobs
- ✅ Standard table pagination
- ✅ Efficient date range queries
- ✅ Proper relational indexing

### Flexibility

- ✅ Easy to add workout edit functionality
- ✅ Simple bulk operations
- ✅ Archival/cleanup strategies
- ✅ Track workout provenance (source plan)

### Maintainability

- ✅ Standard SQL operations vs complex JSONB manipulation
- ✅ Clear separation: templates in plan_data, modifications in table
- ✅ Easier to reason about and debug

---

## Open Questions & Future Considerations

### Completed Workouts

**Question:** Should completed workouts (matched to activities) stay in `manual_workouts` or move to archive?

**Options:**

1. Keep in table (simple, allows historical queries)
2. Move to `manual_workouts_archive` after 6 months (optimize active queries)
3. Add `archived` boolean flag (flexible, one table)

**Recommendation:** Start with option 1, add archival later if needed.

### Workout Editing

**Question:** Should users be able to edit manual workout structure/TSS?

**Options:**

1. Allow full edit (update `workout_data` JSONB)
2. Allow only date/notes changes
3. Create new workout on edit (preserve original)

**Recommendation:** Option 1 for simplicity - JSONB allows flexible updates.

### UI Indicators

**Question:** How to show users which workouts came from plans vs manual?

**Options:**

1. Badge/icon on workout card
2. Different card style
3. Tooltip/info on hover
4. Color coding

**Recommendation:** Subtle badge + tooltip showing source plan name if `source_plan_instance_id` is set.

---

## References

### Files Modified

**Database:**

- `web/supabase/migrations/YYYYMMDDHHMMSS_create_manual_workouts_table.sql`

**API Routes:**

- `web/app/api/manual-workouts/route.ts` (new)
- `web/app/api/manual-workouts/[workoutId]/route.ts` (new)
- `web/app/api/schedule/[instanceId]/workouts/route.ts` (modified)
- `web/app/api/schedule/[instanceId]/workouts/add/route.ts` (deleted)
- `web/app/api/profile/create/route.ts` (modified)

**Services:**

- `web/lib/services/manual-workout-service.ts` (new)
- `web/lib/services/plan-instance-service.ts` (modified)

**Types:**

- `web/lib/types/manual-workout.ts` (new)
- `web/lib/types/database.ts` (regenerated)
- `web/lib/types/type-guards.ts` (modified)

**Components:**

- `web/components/training/schedule-calendar.tsx` (modified)
- `web/components/schedule/dnd/schedule-dnd-context.tsx` (modified)

### Related Documents

- `web/docs/API.md` - API documentation
- `web/CLAUDE.md` - Web app development guide
- `CLAUDE.md` - Project overview

---

**Last Updated:** 2026-01-14

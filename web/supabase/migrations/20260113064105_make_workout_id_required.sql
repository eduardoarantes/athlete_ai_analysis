-- Migration: Make workout_id required in workout_activity_matches
--
-- This migration completes the refactoring from date+index to workout_id lookups
-- by making workout_id the only required identifier for workout matches.
--
-- Changes:
-- 1. Delete any legacy matches without workout_id
-- 2. Make workout_id column NOT NULL
-- 3. Remove legacy unique constraint on (plan_instance_id, workout_date, workout_index)
--
-- Note: workout_date and workout_index columns are retained for potential analytics use,
-- but are no longer used for lookups or as part of any unique constraint.

-- Step 1: Delete any legacy matches without workout_id
-- The user confirmed it's okay to delete old data
DELETE FROM workout_activity_matches
WHERE workout_id IS NULL;

-- Step 2: Make workout_id NOT NULL
ALTER TABLE workout_activity_matches
ALTER COLUMN workout_id SET NOT NULL;

-- Step 3: Drop the legacy unique constraint on (plan_instance_id, workout_date, workout_index)
-- This constraint name might vary - check if it exists first
DO $$
BEGIN
    -- Try to drop the constraint if it exists
    -- The constraint might be named differently in different environments
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'workout_activity_matches_plan_instance_id_workout_date_work_key'
        AND conrelid = 'workout_activity_matches'::regclass
    ) THEN
        ALTER TABLE workout_activity_matches
        DROP CONSTRAINT workout_activity_matches_plan_instance_id_workout_date_work_key;
    END IF;

    -- Alternative constraint name pattern
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname LIKE 'workout_activity_matches%date%index%'
        AND conrelid = 'workout_activity_matches'::regclass
    ) THEN
        EXECUTE 'ALTER TABLE workout_activity_matches DROP CONSTRAINT ' ||
            (SELECT conname FROM pg_constraint
             WHERE conname LIKE 'workout_activity_matches%date%index%'
             AND conrelid = 'workout_activity_matches'::regclass
             LIMIT 1);
    END IF;
END $$;

-- Verify the primary unique constraint on (plan_instance_id, workout_id) exists
-- This should already exist, but we'll create it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'workout_activity_matches_plan_instance_id_workout_id_key'
        AND conrelid = 'workout_activity_matches'::regclass
    ) THEN
        ALTER TABLE workout_activity_matches
        ADD CONSTRAINT workout_activity_matches_plan_instance_id_workout_id_key
        UNIQUE (plan_instance_id, workout_id);
    END IF;
END $$;

-- Add comment to document the schema change
COMMENT ON COLUMN workout_activity_matches.workout_id IS
'Required UUID identifier linking to workout in plan_data.weekly_plan[].workouts[].id. Primary key for matches alongside plan_instance_id.';

COMMENT ON COLUMN workout_activity_matches.workout_date IS
'Workout date in YYYY-MM-DD format. Retained for analytics but not used for lookups.';

COMMENT ON COLUMN workout_activity_matches.workout_index IS
'Workout index for same-day workouts. Retained for analytics but not used for lookups.';

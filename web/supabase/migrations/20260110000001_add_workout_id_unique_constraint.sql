-- Add unique constraint for workout_id on workout_activity_matches
-- This enables ON CONFLICT upserts using workout_id as the identifier
-- Migration Phase 2: Add unique constraint for the new workflow

-- Create a partial unique index for (plan_instance_id, workout_id)
-- This only applies when workout_id is NOT NULL, allowing legacy records
-- without workout_id to continue working with the old composite key
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_matches_unique_workout_id
ON public.workout_activity_matches(plan_instance_id, workout_id)
WHERE workout_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX public.idx_workout_matches_unique_workout_id IS
  'Ensures one match per workout (by workout_id) per plan instance. Partial index excludes NULL workout_id values for backwards compatibility.';

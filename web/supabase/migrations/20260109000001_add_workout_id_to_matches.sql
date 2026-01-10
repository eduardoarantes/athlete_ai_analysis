-- Add workout_id column to workout_activity_matches
-- This enables stable workout identification that survives moves/deletes
-- Migration Phase 1: Add nullable column (data migration will populate it)

-- Add the workout_id column (nullable for now, will be made NOT NULL after data migration)
ALTER TABLE public.workout_activity_matches
ADD COLUMN IF NOT EXISTS workout_id TEXT;

-- Create index for efficient lookups by workout_id
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_workout_id
ON public.workout_activity_matches(workout_id);

-- Create composite index for plan_instance + workout_id queries
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_instance_workout
ON public.workout_activity_matches(plan_instance_id, workout_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.workout_activity_matches.workout_id IS
  'Unique identifier for the workout (UUID format). References workout.id in plan_data JSON. Replaces workout_date + workout_index composite key.';

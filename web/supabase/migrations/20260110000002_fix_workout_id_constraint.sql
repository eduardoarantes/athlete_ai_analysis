-- Fix: Replace partial index with regular unique constraint
-- PostgreSQL's ON CONFLICT doesn't work with partial indexes via Supabase client
-- NULL values are considered distinct in unique constraints, so this still allows
-- multiple rows with NULL workout_id (legacy data)

-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS public.idx_workout_matches_unique_workout_id;

-- Create a regular unique constraint
-- This works with ON CONFLICT and NULL values are treated as distinct
ALTER TABLE public.workout_activity_matches
ADD CONSTRAINT unique_instance_workout_id UNIQUE (plan_instance_id, workout_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_instance_workout_id ON public.workout_activity_matches IS
  'Ensures one match per workout (by workout_id) per plan instance. NULL workout_id values are treated as distinct for backwards compatibility.';

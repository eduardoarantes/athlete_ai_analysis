-- Remove legacy workout_date and workout_index columns from workout_activity_matches
-- These fields are no longer needed as workout_id is now the sole identifier

ALTER TABLE public.workout_activity_matches
  DROP COLUMN workout_date,
  DROP COLUMN workout_index;

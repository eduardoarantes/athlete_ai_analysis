-- Force PostgREST to reload schema cache
-- This ensures the workout_overrides column is visible to the API layer

NOTIFY pgrst, 'reload schema';

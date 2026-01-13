-- Migration: Drop workout_overrides column
-- The workout_overrides system has been removed in favor of directly modifying plan_data.
-- All workout operations now update the plan_data.weekly_plan array directly using scheduled_date.

-- Drop the index first
DROP INDEX IF EXISTS idx_plan_instances_has_overrides;

-- Drop the workout_overrides column
ALTER TABLE plan_instances
DROP COLUMN IF EXISTS workout_overrides;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

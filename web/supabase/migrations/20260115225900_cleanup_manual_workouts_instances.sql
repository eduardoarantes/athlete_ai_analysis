-- Phase 8: Cleanup MANUAL_WORKOUTS instances and instance_type column
-- Part of Manual Workouts Migration (Issue #131)
-- Removes legacy MANUAL_WORKOUTS infrastructure now that manual workouts
-- are stored in the dedicated manual_workouts table.

-- Step 1: Delete all MANUAL_WORKOUTS plan instances
-- These are no longer used since Phase 6 (calendar loads from manual_workouts table)
DELETE FROM plan_instances
WHERE instance_type = 'manual_workouts';

-- Step 2: Delete all MANUAL_WORKOUTS training plan templates
-- These were created during profile creation but are no longer needed
DELETE FROM training_plans
WHERE name = 'MANUAL_WORKOUTS'
  OR metadata->>'type' = 'manual_workouts';

-- Step 3: Drop the instance_type column
-- No longer needed since we only have regular plan instances
ALTER TABLE plan_instances DROP COLUMN IF EXISTS instance_type;

-- Verification queries (run these manually before/after):
-- Before: SELECT COUNT(*) FROM plan_instances WHERE instance_type = 'manual_workouts';
-- After: SELECT column_name FROM information_schema.columns
--        WHERE table_name = 'plan_instances' AND column_name = 'instance_type';
-- Should return 0 rows (column doesn't exist)

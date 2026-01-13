-- Allow 'system' as a valid value for training_plans.created_from
-- This is needed for the MANUAL_WORKOUTS plan that's automatically created during profile creation

ALTER TABLE training_plans
DROP CONSTRAINT IF EXISTS training_plans_created_from_check;

ALTER TABLE training_plans
ADD CONSTRAINT training_plans_created_from_check
CHECK (created_from IN ('wizard', 'custom_builder', 'imported', 'system'));

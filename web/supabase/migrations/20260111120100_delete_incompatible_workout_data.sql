-- Migration: Delete all training plans, plan instances, and workout matches
-- Reason: Workout library was recreated with new alphanumeric-only IDs
-- All existing data references old workout IDs that no longer exist

-- Delete workout activity matches (activity to workout matching)
DELETE FROM workout_activity_matches;

-- Delete workout compliance analyses
DELETE FROM workout_compliance_analyses;

-- Delete plan instance notes
DELETE FROM plan_instance_notes;

-- Delete plan instances (scheduled training plans)
DELETE FROM plan_instances;

-- Delete custom plan weeks
DELETE FROM custom_plan_weeks;

-- Delete training plans (plan templates)
DELETE FROM training_plans;

-- Add comments for documentation
COMMENT ON TABLE training_plans IS 'Training plan templates. Cleared on 2026-01-11 due to workout library ID migration to alphanumeric-only format.';
COMMENT ON TABLE plan_instances IS 'Scheduled plan instances. Cleared on 2026-01-11 due to workout library ID migration to alphanumeric-only format.';
COMMENT ON TABLE workout_activity_matches IS 'Activity to workout matching. Cleared on 2026-01-11 due to workout library ID migration to alphanumeric-only format.';

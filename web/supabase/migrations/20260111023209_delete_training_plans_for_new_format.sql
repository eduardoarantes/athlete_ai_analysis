-- Migration: Delete all training plans and scheduled sessions
-- Reason: Custom plans now store plan_data in standard format
-- Existing plans have empty plan_data and need to be recreated

-- Delete plan instance notes
DELETE FROM plan_instance_notes;

-- Delete plan instances (scheduled sessions)
DELETE FROM plan_instances;

-- Delete custom plan weeks
DELETE FROM custom_plan_weeks;

-- Delete training plans
DELETE FROM training_plans;

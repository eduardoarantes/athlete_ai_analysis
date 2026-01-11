-- Migration: Clear plans after weekday capitalization fix
-- Reason: Previous plans had lowercase weekday names causing scheduling issues

DELETE FROM plan_instance_notes;
DELETE FROM plan_instances;
DELETE FROM custom_plan_weeks;
DELETE FROM training_plans;

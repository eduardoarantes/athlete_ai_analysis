-- Add instance_type column to plan_instances table
-- This allows marking special plan instances like MANUAL_WORKOUTS
-- that have different behavior (e.g., never shown in UI, can overlap)

ALTER TABLE plan_instances
ADD COLUMN IF NOT EXISTS instance_type VARCHAR DEFAULT 'standard';

COMMENT ON COLUMN plan_instances.instance_type IS 'Type of plan instance: standard, manual_workouts';

-- Create index for filtering by type
CREATE INDEX IF NOT EXISTS idx_plan_instances_instance_type
ON plan_instances(instance_type);

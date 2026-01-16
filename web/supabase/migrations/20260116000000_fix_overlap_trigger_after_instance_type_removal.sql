-- Fix check_plan_instance_overlap() trigger function after instance_type column removal
-- Part of Manual Workouts Migration cleanup (Phase 8.2)
-- Issue: Phase 8.1 dropped the instance_type column but didn't update the trigger function
-- This caused 500 errors when creating plan instances

-- Update the overlap check function to remove instance_type references
CREATE OR REPLACE FUNCTION check_plan_instance_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for overlapping instances for the same user
  -- Only check against scheduled or active instances (not completed or cancelled)
  IF EXISTS (
    SELECT 1 FROM plan_instances
    WHERE user_id = NEW.user_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status NOT IN ('completed', 'cancelled')
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Plan instance overlaps with existing scheduled/active plan'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, just updated the function
-- Trigger name: prevent_plan_overlap
-- Applied to: plan_instances table (BEFORE INSERT OR UPDATE)

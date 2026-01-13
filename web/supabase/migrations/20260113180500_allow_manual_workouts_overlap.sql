-- Allow MANUAL_WORKOUTS plan instances to overlap with other plans
-- MANUAL_WORKOUTS is a special system-generated plan that serves as a container
-- for manually added workouts and should be allowed to coexist with regular training plans

CREATE OR REPLACE FUNCTION check_plan_instance_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip overlap check if this is a MANUAL_WORKOUTS instance
  -- (it can overlap with everything)
  IF NEW.instance_type = 'manual_workouts' THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping instances for the same user
  -- Only check against scheduled or active instances (not completed or cancelled)
  -- Exclude MANUAL_WORKOUTS instances from overlap detection
  IF EXISTS (
    SELECT 1 FROM plan_instances
    WHERE user_id = NEW.user_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status NOT IN ('completed', 'cancelled')
      AND instance_type != 'manual_workouts'
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Plan instance overlaps with existing scheduled/active plan'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already created in 20251219000001_plan_templates_and_instances.sql
-- This migration just updates the function

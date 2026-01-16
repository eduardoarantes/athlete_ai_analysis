-- Update workout_activity_matches to support manual workouts
-- This is a CRITICAL migration that enables matches for both plan and manual workouts

-- Add manual_workout_id column (nullable) - idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workout_activity_matches'
      AND column_name = 'manual_workout_id'
  ) THEN
    ALTER TABLE public.workout_activity_matches
    ADD COLUMN manual_workout_id UUID;
  END IF;
END $$;

-- Add foreign key constraint idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workout_activity_matches_manual_workout_id_fkey'
  ) THEN
    ALTER TABLE public.workout_activity_matches
    ADD CONSTRAINT workout_activity_matches_manual_workout_id_fkey
      FOREIGN KEY (manual_workout_id) REFERENCES public.manual_workouts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make plan_instance_id nullable (was NOT NULL)
ALTER TABLE public.workout_activity_matches
ALTER COLUMN plan_instance_id DROP NOT NULL;

-- Add CHECK constraint: exactly one of plan_instance_id or manual_workout_id must be set
ALTER TABLE public.workout_activity_matches
ADD CONSTRAINT workout_source_check
  CHECK (
    (plan_instance_id IS NOT NULL AND manual_workout_id IS NULL) OR
    (plan_instance_id IS NULL AND manual_workout_id IS NOT NULL)
  );

-- Add index for manual workout lookups
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_manual
  ON public.workout_activity_matches(manual_workout_id)
  WHERE manual_workout_id IS NOT NULL;

-- Update composite unique constraint to use workout_id globally
-- Old constraint: UNIQUE(plan_instance_id, workout_id)
-- New: workout_id is globally unique across both plan and manual workouts
-- Drop both possible constraint names (custom name and PostgreSQL auto-generated name)
ALTER TABLE public.workout_activity_matches
DROP CONSTRAINT IF EXISTS unique_instance_workout_id;

ALTER TABLE public.workout_activity_matches
DROP CONSTRAINT IF EXISTS workout_activity_matches_plan_instance_id_workout_id_key;

-- Add simple unique constraint on workout_id (globally unique)
ALTER TABLE public.workout_activity_matches
ADD CONSTRAINT workout_activity_matches_workout_id_unique UNIQUE(workout_id);

-- Add comment
COMMENT ON COLUMN public.workout_activity_matches.manual_workout_id IS
  'Reference to manual_workouts table. Exactly one of plan_instance_id or manual_workout_id must be set.';

COMMENT ON CONSTRAINT workout_source_check ON public.workout_activity_matches IS
  'Ensures exactly one workout source (either plan_instance_id or manual_workout_id) is set.';

COMMENT ON CONSTRAINT workout_activity_matches_workout_id_unique ON public.workout_activity_matches IS
  'Ensures workout_id is globally unique across both plan and manual workouts. Each workout can only be matched once.';

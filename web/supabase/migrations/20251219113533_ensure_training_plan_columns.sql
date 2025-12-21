-- Ensure training_plans table has all required columns
-- This migration ensures the columns exist regardless of previous migration state

-- Add goal column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_plans' AND column_name = 'goal'
  ) THEN
    ALTER TABLE training_plans ADD COLUMN goal TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add weeks_total column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_plans' AND column_name = 'weeks_total'
  ) THEN
    ALTER TABLE training_plans ADD COLUMN weeks_total INTEGER;
  END IF;
END $$;

-- Add description column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_plans' AND column_name = 'description'
  ) THEN
    ALTER TABLE training_plans ADD COLUMN description TEXT;
  END IF;
END $$;

-- Notify PostgREST to reload schema (works on hosted Supabase)
NOTIFY pgrst, 'reload schema';

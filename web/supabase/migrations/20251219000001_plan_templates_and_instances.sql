-- Migration: Transform training_plans into templates and add plan_instances table
-- This migration:
-- 1. Creates plan_instances table with overlap prevention trigger
-- 2. Removes start_date and end_date from training_plans (becomes template)

-- ============================================================================
-- STEP 1: Create plan_instances table
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES training_plans(id) ON DELETE SET NULL,  -- Keep instance if template deleted
  name TEXT NOT NULL,  -- Copied from template at creation
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,  -- Calculated: start_date + (weeks_total * 7)
  weeks_total INTEGER NOT NULL,
  plan_data JSONB NOT NULL,  -- SNAPSHOT: Copied from template at creation time
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for plan_instances
CREATE INDEX IF NOT EXISTS idx_plan_instances_user_id ON plan_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_instances_template_id ON plan_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_plan_instances_status ON plan_instances(status);
CREATE INDEX IF NOT EXISTS idx_plan_instances_date_range ON plan_instances(user_id, start_date, end_date);

-- ============================================================================
-- STEP 2: Create overlap prevention trigger
-- ============================================================================

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

DROP TRIGGER IF EXISTS prevent_plan_overlap ON plan_instances;
CREATE TRIGGER prevent_plan_overlap
  BEFORE INSERT OR UPDATE ON plan_instances
  FOR EACH ROW
  EXECUTE FUNCTION check_plan_instance_overlap();

-- ============================================================================
-- STEP 3: Enable RLS and create policies for plan_instances
-- ============================================================================

ALTER TABLE plan_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own plan instances" ON plan_instances;
CREATE POLICY "Users can view own plan instances" ON plan_instances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own plan instances" ON plan_instances;
CREATE POLICY "Users can create own plan instances" ON plan_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own plan instances" ON plan_instances;
CREATE POLICY "Users can update own plan instances" ON plan_instances
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own plan instances" ON plan_instances;
CREATE POLICY "Users can delete own plan instances" ON plan_instances
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: Add updated_at trigger for plan_instances
-- ============================================================================

DROP TRIGGER IF EXISTS update_plan_instances_updated_at ON plan_instances;
CREATE TRIGGER update_plan_instances_updated_at
  BEFORE UPDATE ON plan_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Remove date columns from training_plans (becomes template)
-- ============================================================================

ALTER TABLE training_plans DROP COLUMN IF EXISTS start_date;
ALTER TABLE training_plans DROP COLUMN IF EXISTS end_date;

-- ============================================================================
-- STEP 6: Add description column to training_plans if not exists
-- This is useful for templates to have a description separate from goal
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_plans' AND column_name = 'description'
  ) THEN
    ALTER TABLE training_plans ADD COLUMN description TEXT;
  END IF;
END $$;

-- Migration: Custom Plan Builder Schema
-- Part of Issue #21: Plan Builder Phase 1 - Foundation
--
-- This migration:
-- 1. Extends training_plans with custom builder fields
-- 2. Creates custom_plan_weeks table for per-week workout placements
-- 3. Adds RLS policies for security

-- ============================================================================
-- STEP 1: Extend training_plans table with custom builder fields
-- ============================================================================

-- Add 'is_draft' column to track in-progress custom plans
-- Using is_draft to avoid confusion with existing status='draft'
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Add 'created_from' to distinguish plan source
-- Values: 'wizard' (AI wizard), 'custom_builder' (drag-drop builder), 'imported' (external)
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS created_from TEXT DEFAULT 'wizard'
CHECK (created_from IN ('wizard', 'custom_builder', 'imported'));

-- Add 'target_ftp' for custom plans (used for TSS calculations)
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS target_ftp INTEGER;

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_training_plans_created_from
ON training_plans(created_from);

-- Create index for filtering drafts
CREATE INDEX IF NOT EXISTS idx_training_plans_is_draft
ON training_plans(is_draft) WHERE is_draft = true;

-- ============================================================================
-- STEP 2: Create custom_plan_weeks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_plan_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to parent plan
  plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE NOT NULL,

  -- Week position in plan (1-based)
  week_number INTEGER NOT NULL CHECK (week_number > 0),

  -- Training phase for this week
  phase TEXT NOT NULL CHECK (phase IN ('Base', 'Build', 'Peak', 'Recovery', 'Taper', 'Foundation')),

  -- JSONB array of workout placements
  -- Structure: { monday: [...], tuesday: [...], ... }
  -- Each placement: { id: uuid, workoutKey: string, order: number }
  workouts_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Calculated TSS for the week
  weekly_tss DECIMAL(6,2),

  -- Optional notes for the week
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique week numbers per plan
  CONSTRAINT unique_plan_week UNIQUE(plan_id, week_number)
);

-- Indexes for custom_plan_weeks
CREATE INDEX IF NOT EXISTS idx_custom_plan_weeks_plan_id
ON custom_plan_weeks(plan_id);

CREATE INDEX IF NOT EXISTS idx_custom_plan_weeks_phase
ON custom_plan_weeks(phase);

-- ============================================================================
-- STEP 3: Add updated_at trigger for custom_plan_weeks
-- ============================================================================

-- Reuse existing update_updated_at_column function
DROP TRIGGER IF EXISTS update_custom_plan_weeks_updated_at ON custom_plan_weeks;
CREATE TRIGGER update_custom_plan_weeks_updated_at
  BEFORE UPDATE ON custom_plan_weeks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable RLS and create policies for custom_plan_weeks
-- ============================================================================

ALTER TABLE custom_plan_weeks ENABLE ROW LEVEL SECURITY;

-- Users can only view weeks for plans they own
DROP POLICY IF EXISTS "Users can view own plan weeks" ON custom_plan_weeks;
CREATE POLICY "Users can view own plan weeks" ON custom_plan_weeks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = custom_plan_weeks.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

-- Users can only insert weeks for plans they own
DROP POLICY IF EXISTS "Users can create weeks for own plans" ON custom_plan_weeks;
CREATE POLICY "Users can create weeks for own plans" ON custom_plan_weeks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = custom_plan_weeks.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

-- Users can only update weeks for plans they own
DROP POLICY IF EXISTS "Users can update own plan weeks" ON custom_plan_weeks;
CREATE POLICY "Users can update own plan weeks" ON custom_plan_weeks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = custom_plan_weeks.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

-- Users can only delete weeks for plans they own
DROP POLICY IF EXISTS "Users can delete own plan weeks" ON custom_plan_weeks;
CREATE POLICY "Users can delete own plan weeks" ON custom_plan_weeks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = custom_plan_weeks.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 5: Add admin access to custom_plan_weeks
-- ============================================================================

-- Admins can view all plan weeks (for support/debugging)
DROP POLICY IF EXISTS "Admins can view all plan weeks" ON custom_plan_weeks;
CREATE POLICY "Admins can view all plan weeks" ON custom_plan_weeks
  FOR SELECT USING (is_admin());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE custom_plan_weeks IS
'Stores per-week workout placements for custom training plans built with drag-drop interface';

COMMENT ON COLUMN custom_plan_weeks.workouts_data IS
'JSONB structure: { monday: [{id, workoutKey, order}], tuesday: [...], ... }';

COMMENT ON COLUMN training_plans.is_draft IS
'True for in-progress custom plans that have not been published yet';

COMMENT ON COLUMN training_plans.created_from IS
'Source of plan: wizard (AI), custom_builder (drag-drop), imported (external)';

COMMENT ON COLUMN training_plans.target_ftp IS
'Target FTP for custom plans, used for TSS calculations';

-- Migration: Create plan_instance_notes table for Note Card feature
-- Allows users to add freeform notes with optional file attachments to the training schedule calendar
-- Part of Issue #49

-- ============================================================================
-- STEP 1: Create plan_instance_notes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_instance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_instance_id uuid NOT NULL REFERENCES plan_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  description text,
  note_date date NOT NULL,
  attachment_s3_key text,
  attachment_filename text,
  attachment_size_bytes bigint,
  attachment_content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_title_length CHECK (char_length(title) <= 200),
  CONSTRAINT valid_attachment_size CHECK (attachment_size_bytes IS NULL OR attachment_size_bytes <= 10485760)
);

-- Add comment explaining the table
COMMENT ON TABLE plan_instance_notes IS
  'Notes attached to specific dates in a training plan instance. Supports optional file attachments stored in S3.';

-- ============================================================================
-- STEP 2: Create indexes for efficient queries
-- ============================================================================

-- Index for querying notes by plan instance
CREATE INDEX IF NOT EXISTS idx_plan_instance_notes_instance_id
  ON plan_instance_notes(plan_instance_id);

-- Index for querying notes by user
CREATE INDEX IF NOT EXISTS idx_plan_instance_notes_user_id
  ON plan_instance_notes(user_id);

-- Index for querying notes by date
CREATE INDEX IF NOT EXISTS idx_plan_instance_notes_date
  ON plan_instance_notes(note_date);

-- Composite index for querying notes by instance and date range
CREATE INDEX IF NOT EXISTS idx_plan_instance_notes_instance_date
  ON plan_instance_notes(plan_instance_id, note_date);

-- ============================================================================
-- STEP 3: Enable RLS and create policies
-- ============================================================================

ALTER TABLE plan_instance_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own notes
DROP POLICY IF EXISTS "Users can view own notes" ON plan_instance_notes;
CREATE POLICY "Users can view own notes" ON plan_instance_notes
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Users can create their own notes
DROP POLICY IF EXISTS "Users can create own notes" ON plan_instance_notes;
CREATE POLICY "Users can create own notes" ON plan_instance_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own notes
DROP POLICY IF EXISTS "Users can update own notes" ON plan_instance_notes;
CREATE POLICY "Users can update own notes" ON plan_instance_notes
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: Users can delete their own notes
DROP POLICY IF EXISTS "Users can delete own notes" ON plan_instance_notes;
CREATE POLICY "Users can delete own notes" ON plan_instance_notes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: Add updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_plan_instance_notes_updated_at ON plan_instance_notes;
CREATE TRIGGER update_plan_instance_notes_updated_at
  BEFORE UPDATE ON plan_instance_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

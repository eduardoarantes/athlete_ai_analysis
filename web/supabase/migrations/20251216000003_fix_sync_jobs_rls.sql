-- Migration: Fix sync_jobs RLS policies to allow users to create and update their own jobs
-- The original migration only had SELECT policy for authenticated users

-- Add INSERT policy for authenticated users (they can create their own jobs)
CREATE POLICY "Users can create own jobs"
  ON sync_jobs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Add UPDATE policy for authenticated users (they can update their own jobs)
CREATE POLICY "Users can update own jobs"
  ON sync_jobs
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Grant INSERT and UPDATE to authenticated role
GRANT INSERT, UPDATE ON sync_jobs TO authenticated;

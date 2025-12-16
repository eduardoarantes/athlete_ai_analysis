-- Migration: Create sync_jobs table for background job tracking
-- Created: 2024-12-16
-- Purpose: Track Strava sync operations running in background with Vercel waitUntil()

-- Create job status enum
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Create job type enum
CREATE TYPE job_type AS ENUM ('strava_sync');

-- Create sync_jobs table
CREATE TABLE IF NOT EXISTS sync_jobs (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job metadata
  type job_type NOT NULL DEFAULT 'strava_sync',
  status job_status NOT NULL DEFAULT 'pending',

  -- Job data
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,

  -- Retry logic
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_created
  ON sync_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_created
  ON sync_jobs(status, created_at DESC);

-- Partial index for pending jobs (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_sync_jobs_pending
  ON sync_jobs(created_at ASC)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own jobs"
  ON sync_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all jobs"
  ON sync_jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER sync_jobs_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_jobs_updated_at();

-- Add comments for documentation
COMMENT ON TABLE sync_jobs IS 'Tracks background sync jobs (Strava activity sync, FIT file processing, etc.)';
COMMENT ON COLUMN sync_jobs.id IS 'Unique job identifier returned to client for status polling';
COMMENT ON COLUMN sync_jobs.user_id IS 'User who initiated the job';
COMMENT ON COLUMN sync_jobs.type IS 'Type of background job (strava_sync, fit_processing, etc.)';
COMMENT ON COLUMN sync_jobs.status IS 'Current job status (pending, running, completed, failed)';
COMMENT ON COLUMN sync_jobs.payload IS 'Input parameters for the job as JSON';
COMMENT ON COLUMN sync_jobs.result IS 'Job output/results as JSON (populated on completion)';
COMMENT ON COLUMN sync_jobs.error IS 'Error message if job failed';
COMMENT ON COLUMN sync_jobs.attempts IS 'Number of execution attempts (for retry logic)';
COMMENT ON COLUMN sync_jobs.max_attempts IS 'Maximum retry attempts before marking as failed';
COMMENT ON COLUMN sync_jobs.created_at IS 'When the job was created';
COMMENT ON COLUMN sync_jobs.started_at IS 'When the job started executing';
COMMENT ON COLUMN sync_jobs.completed_at IS 'When the job finished (success or failure)';
COMMENT ON COLUMN sync_jobs.updated_at IS 'Last update timestamp (auto-updated)';

-- Grant permissions
GRANT SELECT ON sync_jobs TO authenticated;
GRANT ALL ON sync_jobs TO service_role;

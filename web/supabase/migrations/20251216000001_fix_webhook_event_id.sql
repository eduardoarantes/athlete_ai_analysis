-- Fix Webhook Event ID Generation
-- This migration replaces the problematic event_id with a composite primary key
-- Safe to drop and recreate since not in production yet

-- Drop the existing table (no production data to preserve)
DROP TABLE IF EXISTS public.strava_webhook_events CASCADE;

-- Recreate table with composite primary key
CREATE TABLE public.strava_webhook_events (
  -- Composite primary key fields
  subscription_id BIGINT NOT NULL,
  object_id BIGINT NOT NULL, -- activity_id or athlete_id
  event_time TIMESTAMPTZ NOT NULL,

  -- Event details
  object_type TEXT NOT NULL, -- 'activity' or 'athlete'
  aspect_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  owner_id BIGINT NOT NULL, -- strava athlete_id
  raw_data JSONB NOT NULL, -- Store full webhook payload

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite primary key prevents duplicate events
  PRIMARY KEY (subscription_id, object_id, event_time)
);

-- Index for finding unprocessed events
CREATE INDEX idx_webhook_events_unprocessed
ON public.strava_webhook_events(processed, created_at)
WHERE processed = false;

-- Index for looking up events by object
CREATE INDEX idx_webhook_events_object
ON public.strava_webhook_events(object_type, object_id);

-- Index for looking up events by owner
CREATE INDEX idx_webhook_events_owner
ON public.strava_webhook_events(owner_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.strava_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view webhook events for their Strava athlete
DROP POLICY IF EXISTS "Users can view their webhook events" ON public.strava_webhook_events;
CREATE POLICY "Users can view their webhook events"
ON public.strava_webhook_events FOR SELECT
USING (
  owner_id IN (
    SELECT strava_athlete_id
    FROM public.strava_connections
    WHERE user_id = auth.uid()
  )
);

-- Add comment explaining the composite key
COMMENT ON TABLE public.strava_webhook_events IS
'Stores Strava webhook events with composite primary key (subscription_id, object_id, event_time) to prevent duplicate events without collision risk';

-- Create table for storing Strava webhook events
CREATE TABLE IF NOT EXISTS public.strava_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id BIGINT NOT NULL,
  object_type TEXT NOT NULL, -- 'activity' or 'athlete'
  aspect_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  object_id BIGINT NOT NULL, -- activity_id or athlete_id
  owner_id BIGINT NOT NULL, -- strava athlete_id
  subscription_id BIGINT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  raw_data JSONB NOT NULL, -- Store full webhook payload
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate events
  UNIQUE (event_id, object_id)
);

-- Index for finding unprocessed events
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
ON public.strava_webhook_events(processed, created_at)
WHERE processed = false;

-- Index for looking up events by object
CREATE INDEX IF NOT EXISTS idx_webhook_events_object
ON public.strava_webhook_events(object_type, object_id);

-- Index for looking up events by owner
CREATE INDEX IF NOT EXISTS idx_webhook_events_owner
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

-- Create table for storing webhook subscription info
CREATE TABLE IF NOT EXISTS public.strava_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id BIGINT UNIQUE NOT NULL,
  callback_url TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on subscriptions (admin-only access in production)
ALTER TABLE public.strava_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_strava_webhook_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_strava_webhook_subscriptions_updated_at
ON public.strava_webhook_subscriptions;

CREATE TRIGGER update_strava_webhook_subscriptions_updated_at
BEFORE UPDATE ON public.strava_webhook_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_strava_webhook_subscriptions_updated_at();

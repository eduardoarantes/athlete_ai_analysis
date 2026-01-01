-- Add retry_count column to strava_webhook_events table
-- This tracks the number of times we've attempted to process a failed event

ALTER TABLE public.strava_webhook_events
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- Add index for finding events that need retry
-- (failed events with retry_count < max_retries)
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry
ON public.strava_webhook_events(retry_count, created_at)
WHERE processed = true AND error IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.strava_webhook_events.retry_count IS
'Number of times this event has been retried after initial processing failure';

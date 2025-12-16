-- Add Performance Indexes
-- Optimizes common query patterns identified in code review

-- Index for calendar view queries (user's activities sorted by date)
-- Used in: app/(dashboard)/calendar page, recent activities lists
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date
ON public.strava_activities(user_id, start_date DESC);

-- Index for activity filtering by type (e.g., "show only rides")
-- Used in: activity filters, type-based dashboards
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_type
ON public.strava_activities(user_id, type);

-- Note: strava_connections.strava_athlete_id already has a UNIQUE constraint
-- which creates an index automatically (strava_connections_strava_athlete_id_key)
-- This index is used for webhook event processing in app/api/webhooks/strava/route.ts
-- No additional index needed!

-- Index for finding unprocessed webhook events
-- Already exists from previous migration, but documenting here for completeness
-- CREATE INDEX idx_webhook_events_unprocessed
-- ON public.strava_webhook_events(processed, created_at)
-- WHERE processed = false;

-- Add comment explaining the indexes
COMMENT ON INDEX public.idx_strava_activities_user_date IS
'Optimizes calendar and recent activity queries by user and date';

COMMENT ON INDEX public.idx_strava_activities_user_type IS
'Optimizes activity filtering by user and activity type';

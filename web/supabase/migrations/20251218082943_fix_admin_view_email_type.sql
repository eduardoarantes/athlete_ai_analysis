-- Migration: Fix admin_user_view email type mismatch
-- Created: 2025-12-18
-- Description: Cast email from varchar to text to match function return types

-- Must drop and recreate to change column type
DROP VIEW IF EXISTS public.admin_user_view;

CREATE VIEW public.admin_user_view AS
SELECT
  u.id AS user_id,
  u.email::TEXT AS email,
  u.raw_user_meta_data->>'role' AS role,
  u.created_at AS account_created_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  sp.id AS subscription_plan_id,
  sp.name AS plan_name,
  sp.display_name AS plan_display_name,
  us.status AS subscription_status,
  us.started_at AS subscription_started_at,
  us.ends_at AS subscription_ends_at,
  CASE WHEN sc.id IS NOT NULL THEN true ELSE false END AS strava_connected,
  sc.last_sync_at AS strava_last_sync_at,
  sc.sync_status AS strava_sync_status,
  sc.sync_error AS strava_sync_error,
  CASE WHEN ap.id IS NOT NULL THEN true ELSE false END AS profile_exists,
  ap.first_name,
  ap.last_name,
  ap.preferred_language,
  ap.timezone,
  ap.units_system,
  (SELECT COUNT(*) FROM public.activities WHERE user_id = u.id) AS total_activities,
  (SELECT COUNT(*) FROM public.training_plans WHERE user_id = u.id) AS total_training_plans,
  (SELECT COUNT(*) FROM public.reports WHERE user_id = u.id) AS total_reports
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN public.strava_connections sc ON u.id = sc.user_id
LEFT JOIN public.athlete_profiles ap ON u.id = ap.user_id;

COMMENT ON VIEW public.admin_user_view IS 'Admin-only view of users with subscription and connection status (privacy-safe, NO sensitive athlete data)';

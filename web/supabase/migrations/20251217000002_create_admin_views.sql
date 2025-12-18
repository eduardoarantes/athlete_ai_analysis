-- Migration: Create admin views for user management
-- Created: 2025-12-17
-- Description: Privacy-safe views for admin dashboard (NO sensitive data)

-- ============================================
-- Admin User View
-- ============================================
-- Provides admin dashboard with user information while protecting privacy
--
-- PRIVACY RULES:
-- ✅ CAN see: email, dates, role, subscription, connection status, aggregate counts
-- ❌ CANNOT see: FTP, weight, HR, goals, activity details, plan content, tokens

CREATE OR REPLACE VIEW public.admin_user_view AS
SELECT
  -- User identity
  u.id AS user_id,
  u.email::TEXT AS email,
  u.raw_user_meta_data->>'role' AS role,

  -- Account dates
  u.created_at AS account_created_at,
  u.email_confirmed_at,
  u.last_sign_in_at,

  -- Subscription information
  sp.id AS subscription_plan_id,
  sp.name AS plan_name,
  sp.display_name AS plan_display_name,
  us.status AS subscription_status,
  us.started_at AS subscription_started_at,
  us.ends_at AS subscription_ends_at,

  -- Strava connection status (NO TOKENS)
  CASE
    WHEN sc.id IS NOT NULL THEN true
    ELSE false
  END AS strava_connected,
  sc.last_sync_at AS strava_last_sync_at,
  sc.sync_status AS strava_sync_status,
  sc.sync_error AS strava_sync_error,

  -- Profile completeness (NO SENSITIVE DATA)
  CASE
    WHEN ap.id IS NOT NULL THEN true
    ELSE false
  END AS profile_exists,
  ap.first_name,
  ap.last_name,
  ap.preferred_language,
  ap.timezone,
  ap.units_system,

  -- Aggregate counts (not specific data)
  (SELECT COUNT(*) FROM public.activities WHERE user_id = u.id) AS total_activities,
  (SELECT COUNT(*) FROM public.training_plans WHERE user_id = u.id) AS total_training_plans,
  (SELECT COUNT(*) FROM public.reports WHERE user_id = u.id) AS total_reports

FROM auth.users u

-- Left join subscription (user may not have subscription)
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id

-- Left join Strava connection (user may not be connected)
LEFT JOIN public.strava_connections sc ON u.id = sc.user_id

-- Left join athlete profile (user may not have profile)
LEFT JOIN public.athlete_profiles ap ON u.id = ap.user_id;

-- ============================================
-- Admin Stats View
-- ============================================
-- Provides platform-wide statistics for admin dashboard

CREATE OR REPLACE VIEW public.admin_stats_view AS
SELECT
  -- User statistics
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days') AS users_last_7_days,
  (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days') AS users_last_30_days,
  (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at >= NOW() - INTERVAL '7 days') AS active_users_7_days,
  (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at >= NOW() - INTERVAL '30 days') AS active_users_30_days,

  -- Subscription statistics
  (SELECT COUNT(*) FROM public.user_subscriptions WHERE status = 'active') AS active_subscriptions,
  (SELECT COUNT(*) FROM public.user_subscriptions WHERE status = 'suspended') AS suspended_subscriptions,
  (SELECT COUNT(*) FROM public.user_subscriptions WHERE status = 'cancelled') AS cancelled_subscriptions,
  (SELECT COUNT(*) FROM public.user_subscriptions WHERE status = 'expired') AS expired_subscriptions,

  -- Subscription plan breakdown
  (SELECT COUNT(*) FROM public.user_subscriptions us
   JOIN public.subscription_plans sp ON us.plan_id = sp.id
   WHERE sp.name = 'free' AND us.status = 'active') AS free_plan_users,
  (SELECT COUNT(*) FROM public.user_subscriptions us
   JOIN public.subscription_plans sp ON us.plan_id = sp.id
   WHERE sp.name = 'pro' AND us.status = 'active') AS pro_plan_users,
  (SELECT COUNT(*) FROM public.user_subscriptions us
   JOIN public.subscription_plans sp ON us.plan_id = sp.id
   WHERE sp.name = 'team' AND us.status = 'active') AS team_plan_users,

  -- Strava statistics
  (SELECT COUNT(*) FROM public.strava_connections) AS total_strava_connections,
  (SELECT COUNT(*) FROM public.strava_connections WHERE sync_status = 'success') AS successful_syncs,
  (SELECT COUNT(*) FROM public.strava_connections WHERE sync_status = 'error') AS failed_syncs,
  (SELECT COUNT(*) FROM public.strava_connections WHERE last_sync_at >= NOW() - INTERVAL '24 hours') AS syncs_last_24h,

  -- Profile statistics
  (SELECT COUNT(*) FROM public.athlete_profiles) AS total_profiles_created,

  -- Activity statistics (aggregate only)
  (SELECT COUNT(*) FROM public.activities) AS total_activities,
  (SELECT COUNT(*) FROM public.activities WHERE created_at >= NOW() - INTERVAL '7 days') AS activities_last_7_days,
  (SELECT COUNT(*) FROM public.activities WHERE created_at >= NOW() - INTERVAL '30 days') AS activities_last_30_days,

  -- Training plan statistics
  (SELECT COUNT(*) FROM public.training_plans) AS total_training_plans,
  (SELECT COUNT(*) FROM public.training_plans WHERE status = 'active') AS active_training_plans,

  -- Report statistics
  (SELECT COUNT(*) FROM public.reports) AS total_reports,
  (SELECT COUNT(*) FROM public.reports WHERE status = 'completed') AS completed_reports,
  (SELECT COUNT(*) FROM public.reports WHERE status = 'failed') AS failed_reports;

-- ============================================
-- Security Model
-- ============================================
-- Views use owner's permissions (default security_invoker = false)
-- This allows the views to query auth.users
-- Access is controlled via SECURITY DEFINER functions in migration 3
-- that check is_admin() before returning data
--
-- IMPORTANT: These views should NOT be accessed directly by clients.
-- Always use the get_admin_users() and get_admin_stats() functions.

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON VIEW public.admin_user_view IS 'Admin-only view of users with subscription and connection status (privacy-safe, NO sensitive athlete data)';
COMMENT ON VIEW public.admin_stats_view IS 'Admin-only view of platform-wide statistics';

-- Document privacy guarantees
COMMENT ON COLUMN public.admin_user_view.user_id IS 'User UUID';
COMMENT ON COLUMN public.admin_user_view.email IS 'User email address';
COMMENT ON COLUMN public.admin_user_view.role IS 'User role (user or admin)';
COMMENT ON COLUMN public.admin_user_view.strava_connected IS 'Boolean: user has Strava connection';
COMMENT ON COLUMN public.admin_user_view.profile_exists IS 'Boolean: user has created athlete profile';
COMMENT ON COLUMN public.admin_user_view.total_activities IS 'Aggregate count of activities (NO activity details exposed)';
COMMENT ON COLUMN public.admin_user_view.total_training_plans IS 'Aggregate count of training plans (NO plan content exposed)';

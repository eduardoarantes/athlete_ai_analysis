-- Migration: Drop unused activities table
-- Created: 2025-12-18
-- Description: Remove the original 'activities' table which is no longer used.
--              All activity data is stored in 'strava_activities' table instead.
--
-- Background:
-- - 'activities' table was created in the initial schema (20251211001020)
-- - 'strava_activities' table was created later (20251214) for Strava sync
-- - All application code uses 'strava_activities'
-- - The 'activities' table is empty and unused

-- ============================================
-- Step 1: Update admin_stats_view to use strava_activities
-- ============================================

DROP VIEW IF EXISTS public.admin_stats_view;

CREATE VIEW public.admin_stats_view AS
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

  -- Activity statistics (from strava_activities)
  (SELECT COUNT(*) FROM public.strava_activities) AS total_activities,
  (SELECT COUNT(*) FROM public.strava_activities WHERE created_at >= NOW() - INTERVAL '7 days') AS activities_last_7_days,
  (SELECT COUNT(*) FROM public.strava_activities WHERE created_at >= NOW() - INTERVAL '30 days') AS activities_last_30_days,

  -- Training plan statistics
  (SELECT COUNT(*) FROM public.training_plans) AS total_training_plans,
  (SELECT COUNT(*) FROM public.training_plans WHERE status = 'active') AS active_training_plans,

  -- Report statistics
  (SELECT COUNT(*) FROM public.reports) AS total_reports,
  (SELECT COUNT(*) FROM public.reports WHERE status = 'completed') AS completed_reports,
  (SELECT COUNT(*) FROM public.reports WHERE status = 'failed') AS failed_reports;

COMMENT ON VIEW public.admin_stats_view IS 'Admin-only view of platform-wide statistics';

-- ============================================
-- Step 2: Drop activities table and related objects
-- ============================================

-- Drop the trigger first
DROP TRIGGER IF EXISTS update_activities_updated_at ON public.activities;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;

-- Drop indexes (they will be dropped with the table, but being explicit)
DROP INDEX IF EXISTS idx_activities_user_date;
DROP INDEX IF EXISTS idx_activities_strava_id;
DROP INDEX IF EXISTS idx_activities_type;
DROP INDEX IF EXISTS idx_activities_tss;

-- Finally drop the table
DROP TABLE IF EXISTS public.activities;

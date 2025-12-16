-- Migration: Add admin RLS policies and functions
-- Created: 2025-12-17
-- Description: Enable admin role checking and grant admin permissions

-- ============================================
-- Admin Role Check Function
-- ============================================
-- Checks if the current user has admin role in JWT user_metadata

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if current user has admin role in user_metadata';

-- ============================================
-- Admin User Query Function
-- ============================================
-- Allows admins to query users with filters and pagination

CREATE OR REPLACE FUNCTION public.get_admin_users(
  search_query TEXT DEFAULT NULL,
  role_filter TEXT DEFAULT NULL,
  subscription_filter TEXT DEFAULT NULL,
  strava_filter BOOLEAN DEFAULT NULL,
  limit_count INT DEFAULT 50,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  account_created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  plan_name TEXT,
  subscription_status TEXT,
  strava_connected BOOLEAN,
  total_activities BIGINT,
  total_training_plans BIGINT
) AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    avu.user_id,
    avu.email,
    avu.role,
    avu.account_created_at,
    avu.last_sign_in_at,
    avu.plan_name,
    avu.subscription_status,
    avu.strava_connected,
    avu.total_activities,
    avu.total_training_plans
  FROM public.admin_user_view avu
  WHERE
    -- Search filter (email or name)
    (search_query IS NULL OR (
      avu.email ILIKE '%' || search_query || '%' OR
      avu.first_name ILIKE '%' || search_query || '%' OR
      avu.last_name ILIKE '%' || search_query || '%'
    ))
    -- Role filter
    AND (role_filter IS NULL OR avu.role = role_filter)
    -- Subscription filter
    AND (subscription_filter IS NULL OR avu.plan_name = subscription_filter)
    -- Strava filter
    AND (strava_filter IS NULL OR avu.strava_connected = strava_filter)
  ORDER BY avu.account_created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_admin_users IS 'Admin-only function to query users with filters and pagination';

-- ============================================
-- Admin Stats Query Function
-- ============================================
-- Allows admins to fetch platform statistics

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_users_7_days BIGINT,
  active_subscriptions BIGINT,
  free_plan_users BIGINT,
  pro_plan_users BIGINT,
  total_strava_connections BIGINT,
  total_activities BIGINT,
  activities_last_7_days BIGINT
) AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    asv.total_users,
    asv.active_users_7_days,
    asv.active_subscriptions,
    asv.free_plan_users,
    asv.pro_plan_users,
    asv.total_strava_connections,
    asv.total_activities,
    asv.activities_last_7_days
  FROM public.admin_stats_view asv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_admin_stats IS 'Admin-only function to fetch platform statistics';

-- ============================================
-- Admin Single User Query Function
-- ============================================
-- Allows admins to fetch details for a single user

CREATE OR REPLACE FUNCTION public.get_admin_user_by_id(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  account_created_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  subscription_plan_id UUID,
  plan_name TEXT,
  plan_display_name TEXT,
  subscription_status TEXT,
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  strava_connected BOOLEAN,
  strava_last_sync_at TIMESTAMPTZ,
  strava_sync_status TEXT,
  strava_sync_error TEXT,
  profile_exists BOOLEAN,
  first_name TEXT,
  last_name TEXT,
  preferred_language TEXT,
  timezone TEXT,
  units_system TEXT,
  total_activities BIGINT,
  total_training_plans BIGINT,
  total_reports BIGINT
) AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    avu.user_id,
    avu.email,
    avu.role,
    avu.account_created_at,
    avu.email_confirmed_at,
    avu.last_sign_in_at,
    avu.subscription_plan_id,
    avu.plan_name,
    avu.plan_display_name,
    avu.subscription_status,
    avu.subscription_started_at,
    avu.subscription_ends_at,
    avu.strava_connected,
    avu.strava_last_sync_at,
    avu.strava_sync_status,
    avu.strava_sync_error,
    avu.profile_exists,
    avu.first_name,
    avu.last_name,
    avu.preferred_language,
    avu.timezone,
    avu.units_system,
    avu.total_activities,
    avu.total_training_plans,
    avu.total_reports
  FROM public.admin_user_view avu
  WHERE avu.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_admin_user_by_id IS 'Admin-only function to fetch a single user by ID';

-- ============================================
-- Admin User Count Function
-- ============================================
-- Returns total count of users matching filters (for pagination)

CREATE OR REPLACE FUNCTION public.get_admin_users_count(
  search_query TEXT DEFAULT NULL,
  role_filter TEXT DEFAULT NULL,
  subscription_filter TEXT DEFAULT NULL,
  strava_filter BOOLEAN DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  total_count BIGINT;
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT COUNT(*) INTO total_count
  FROM public.admin_user_view avu
  WHERE
    (search_query IS NULL OR (
      avu.email ILIKE '%' || search_query || '%' OR
      avu.first_name ILIKE '%' || search_query || '%' OR
      avu.last_name ILIKE '%' || search_query || '%'
    ))
    AND (role_filter IS NULL OR avu.role = role_filter)
    AND (subscription_filter IS NULL OR avu.plan_name = subscription_filter)
    AND (strava_filter IS NULL OR avu.strava_connected = strava_filter);

  RETURN total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_admin_users_count IS 'Admin-only function to count users matching filters';

-- ============================================
-- Admin Subscription Management Policies
-- ============================================
-- Allow admins to manage subscription plans and user subscriptions

-- Subscription Plans: Admins can INSERT
CREATE POLICY "Admins can create subscription plans"
  ON public.subscription_plans
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Subscription Plans: Admins can UPDATE
CREATE POLICY "Admins can update subscription plans"
  ON public.subscription_plans
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Subscription Plans: Admins can DELETE
CREATE POLICY "Admins can delete subscription plans"
  ON public.subscription_plans
  FOR DELETE
  USING (public.is_admin());

-- User Subscriptions: Admins can view all
CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.is_admin());

-- User Subscriptions: Admins can INSERT
CREATE POLICY "Admins can create user subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (public.is_admin());

-- User Subscriptions: Admins can UPDATE
CREATE POLICY "Admins can update user subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- User Subscriptions: Admins can DELETE
CREATE POLICY "Admins can delete user subscriptions"
  ON public.user_subscriptions
  FOR DELETE
  USING (public.is_admin());

-- ============================================
-- Grant Execute Permissions
-- ============================================
-- Allow authenticated users to call functions (admin check done inside)

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users(TEXT, TEXT, TEXT, BOOLEAN, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users_count(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

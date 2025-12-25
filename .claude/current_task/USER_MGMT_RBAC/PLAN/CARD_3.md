# CARD 3: Migration 3 - Add Admin RLS Policies

**Task:** Create RLS policies for admin access to subscription system and views
**File:** `web/supabase/migrations/20251217000003_add_admin_rls_policies.sql`
**Dependencies:** CARD_1 (subscription tables), CARD_2 (admin views)
**Estimated Time:** 1.5 hours

---

## Objective

Create database functions and RLS policies that:
1. Check if a user has admin role
2. Allow admins to query user data via admin views
3. Allow admins to manage subscriptions
4. Provide helper functions for admin operations

---

## Implementation Steps

### Step 1: Create the Migration File

Create file: `web/supabase/migrations/20251217000003_add_admin_rls_policies.sql`

### Step 2: Write the SQL Migration

```sql
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
```

### Step 3: Apply the Migration

```bash
cd web
npx supabase db push
```

### Step 4: Verify Functions and Policies

```bash
# In psql
psql <your-connection-string>
```

```sql
-- Verify functions exist
\df public.is_admin
\df public.get_admin_users
\df public.get_admin_stats

-- Test is_admin function (as non-admin user)
SELECT public.is_admin();
-- Expected: false (or true if you set admin role)

-- Test get_admin_users (as non-admin)
SELECT * FROM public.get_admin_users();
-- Expected: ERROR: Unauthorized: Admin access required

-- Verify RLS policies on subscription tables
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('subscription_plans', 'user_subscriptions');

-- Should see policies like:
-- - "Admins can create subscription plans"
-- - "Admins can view all subscriptions"
-- etc.
```

---

## Acceptance Criteria

- [ ] Migration file created at correct path
- [ ] `is_admin()` function created
- [ ] `get_admin_users()` function created
- [ ] `get_admin_stats()` function created
- [ ] All 7 RLS policies created on subscription tables
- [ ] Functions granted EXECUTE to authenticated role
- [ ] Non-admin users blocked from admin functions
- [ ] Admin users can call admin functions
- [ ] No SQL errors during migration

---

## Verification Commands

```bash
# Apply migration
cd web
npx supabase db push

# Test as regular user (should fail)
psql <connection-string> << EOF
SELECT public.get_admin_users();
EOF

# Test is_admin function
psql <connection-string> << EOF
SELECT public.is_admin();
EOF

# List policies
psql <connection-string> << EOF
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'subscription%';
EOF
```

---

## Testing with Admin User

To test admin functionality, you need to set a user's role to 'admin':

```sql
-- In Supabase Dashboard SQL Editor or psql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';
```

Then test:

```sql
-- Should return true
SELECT public.is_admin();

-- Should return users
SELECT * FROM public.get_admin_users(NULL, NULL, NULL, NULL, 10, 0);

-- Should return stats
SELECT * FROM public.get_admin_stats();
```

---

## Integration Points

### Depends On
- ✅ CARD_1: subscription_plans and user_subscriptions tables
- ✅ CARD_2: admin_user_view and admin_stats_view

### Enables
- CARD_6: Admin guard can use is_admin() function
- Future: Admin API routes can use get_admin_users() and get_admin_stats()
- Future: Admin UI can display filtered user lists

---

## Privacy & Security Notes

**Security:**
- ✅ SECURITY DEFINER allows function to check JWT metadata
- ✅ Functions explicitly check is_admin() before returning data
- ✅ RLS policies use is_admin() to enforce permissions
- ✅ Non-admins cannot bypass checks

**Audit:**
- All admin function calls should be logged (implement in application layer)
- Track who accessed admin views and when
- Monitor for unauthorized access attempts

---

## Next Steps

After completing CARD_3:

1. ✅ Proceed to **CARD_4**: Seed Default Plans
2. Test admin functions with test admin user
3. Verify non-admin users blocked
4. Update this card if any issues found

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

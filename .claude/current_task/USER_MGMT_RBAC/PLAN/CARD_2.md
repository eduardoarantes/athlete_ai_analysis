# CARD 2: Migration 2 - Create Admin Views

**Task:** Create privacy-safe database views for admin dashboard
**File:** `web/supabase/migrations/20251217000002_create_admin_views.sql`
**Dependencies:** CARD_1 (subscription tables must exist)
**Estimated Time:** 2 hours

---

## Objective

Create two database views that provide admin users with platform insights while strictly protecting user privacy:

1. **admin_user_view** - User list with subscription, Strava, and profile status (NO sensitive data)
2. **admin_stats_view** - Platform-wide statistics for dashboard

**CRITICAL:** These views must NOT expose:
- FTP, weight, HR, goals (athlete_profiles)
- Activity details, power data (activities)
- Training plan content (training_plans)
- Strava tokens (strava_connections)

---

## Implementation Steps

### Step 1: Create the Migration File

Create file: `web/supabase/migrations/20251217000002_create_admin_views.sql`

### Step 2: Write the SQL Migration

```sql
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
  u.email,
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
-- Row Level Security
-- ============================================
-- Views inherit RLS from underlying tables
-- Additional policies will be added in migration 3

-- Enable RLS on views (will be enforced via SELECT policies in migration 3)
ALTER VIEW public.admin_user_view SET (security_invoker = true);
ALTER VIEW public.admin_stats_view SET (security_invoker = true);

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
```

### Step 3: Apply the Migration

```bash
cd web
npx supabase db push
```

### Step 4: Verify Views Created

```bash
# In psql
psql <your-connection-string>
```

```sql
-- Verify views exist
\dv admin_user_view
\dv admin_stats_view

-- Test admin_user_view (should return data)
SELECT user_id, email, role, plan_name, strava_connected, total_activities
FROM admin_user_view
LIMIT 5;

-- Test admin_stats_view (should return single row with stats)
SELECT * FROM admin_stats_view;

-- PRIVACY TEST: Verify NO sensitive data exposed
-- This query should FAIL (columns don't exist in view)
SELECT ftp, weight_kg FROM admin_user_view LIMIT 1;
-- Expected: ERROR: column "ftp" does not exist

-- Verify counts are aggregates (not detail)
SELECT total_activities FROM admin_user_view WHERE user_id = '<some-user-id>';
-- Should return just a number, not activity names/routes
```

---

## Acceptance Criteria

- [ ] Migration file created at correct path
- [ ] `admin_user_view` view exists
- [ ] `admin_stats_view` view exists
- [ ] Views return data successfully
- [ ] NO sensitive data exposed (verified manually)
- [ ] View comments added for documentation
- [ ] Security invoker set on views
- [ ] No SQL errors during migration

### Privacy Verification Checklist

- [ ] ❌ FTP not in admin_user_view
- [ ] ❌ weight_kg not in admin_user_view
- [ ] ❌ max_hr not in admin_user_view
- [ ] ❌ resting_hr not in admin_user_view
- [ ] ❌ goals not in admin_user_view
- [ ] ❌ Activity names/details not in views
- [ ] ❌ Training plan content not in views
- [ ] ❌ Strava access_token not in admin_user_view
- [ ] ❌ Strava refresh_token not in admin_user_view
- [ ] ✅ Only aggregate counts visible (total_activities, etc.)

---

## Verification Commands

```bash
# Apply migration
cd web
npx supabase db push

# Test views
psql <connection-string> << EOF
-- List views
\dv public.admin*

-- Query user view
SELECT COUNT(*) FROM public.admin_user_view;

-- Query stats view
SELECT total_users, active_subscriptions FROM public.admin_stats_view;

-- Privacy test (should fail)
SELECT ftp FROM public.admin_user_view;
EOF
```

---

## Integration Points

### Depends On
- ✅ CARD_1: subscription_plans and user_subscriptions tables
- ✅ Existing tables: auth.users, athlete_profiles, strava_connections, activities, training_plans, reports

### Enables
- CARD_3: Admin RLS policies can reference these views
- Future: Admin dashboard UI can query these views
- Future: Admin API routes can use these views

### Future Usage
- Admin dashboard: User management table
- Admin dashboard: Platform statistics
- API routes: GET /api/admin/users
- API routes: GET /api/admin/stats

---

## Privacy & Security Notes

**Privacy Guarantees:**
- ✅ Views use explicit SELECT (never SELECT *)
- ✅ Only non-sensitive columns included
- ✅ Aggregate counts only (no detail data)
- ✅ Strava tokens excluded
- ✅ Athlete performance data excluded

**Security Considerations:**
- Views use security_invoker (RLS of underlying tables applies)
- Admin-only access enforced via RLS policies (added in migration 3)
- Views are read-only (no INSERT/UPDATE/DELETE)
- No bypassing of underlying table RLS

**Compliance:**
- Views suitable for GDPR compliance (no excessive data collection)
- Audit logs should track admin view access
- User data minimization principle followed

---

## Rollback Plan

If migration fails or needs to be reverted:

```sql
-- Rollback migration (run in psql)
DROP VIEW IF EXISTS public.admin_stats_view CASCADE;
DROP VIEW IF EXISTS public.admin_user_view CASCADE;
```

**Note:** Dropping views is safe (no data loss).

---

## Testing Checklist

After migration:

1. **View Creation**
   - [ ] admin_user_view exists
   - [ ] admin_stats_view exists

2. **Data Retrieval**
   - [ ] admin_user_view returns user data
   - [ ] admin_stats_view returns statistics
   - [ ] Queries execute without errors

3. **Privacy Verification**
   - [ ] FTP not exposed
   - [ ] Weight not exposed
   - [ ] HR data not exposed
   - [ ] Activity details not exposed
   - [ ] Strava tokens not exposed
   - [ ] Only aggregate counts visible

4. **Join Logic**
   - [ ] Users without subscriptions included (LEFT JOIN)
   - [ ] Users without Strava shown as not connected
   - [ ] Users without profiles shown as profile_exists = false
   - [ ] Counts accurate

5. **Performance**
   - [ ] Views query reasonably fast
   - [ ] No N+1 query issues
   - [ ] Indexes from existing tables used

---

## Next Steps

After completing CARD_2:

1. ✅ Proceed to **CARD_3**: Add Admin RLS Policies
2. Verify views return expected data
3. Document any privacy concerns
4. Update this card if any issues found

---

## Notes

- Views are read-only (cannot INSERT/UPDATE/DELETE)
- security_invoker ensures RLS policies from underlying tables apply
- LEFT JOINs ensure all users shown (even without subscription/Strava/profile)
- Aggregate counts prevent exposing specific user data
- Comments document privacy guarantees for future developers
- Views can be extended later without breaking existing queries

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

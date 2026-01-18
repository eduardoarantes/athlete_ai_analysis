-- Migration: Remove application logic functions replaced by TypeScript services
-- Created: 2026-01-17
-- Issue: #162 - Database Logic Migration Cleanup
-- Context: Part of #148 - Remove database triggers/functions for application logic
--
-- This migration removes PostgreSQL functions and triggers that have been
-- replaced by TypeScript services in the application layer:
-- - AdminUserService (replaces admin query functions)
-- - AdminStatsService (replaces stats function)
-- - PlanInstanceValidator (replaces overlap trigger)
--
-- IMPORTANT: The is_admin() function is KEPT as it's required for RLS policies

-- ============================================================================
-- Verification: Check Functions Exist Before Dropping
-- ============================================================================

-- Log which functions exist before migration
DO $$
DECLARE
  func_count INT;
  trigger_count INT;
BEGIN
  -- Count admin functions to be removed
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN ('get_admin_users', 'get_admin_user_by_id', 'get_admin_users_count', 'get_admin_stats', 'check_plan_instance_overlap');

  -- Count triggers to be removed
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname = 'prevent_plan_overlap';

  RAISE NOTICE 'Found % function(s) to remove', func_count;
  RAISE NOTICE 'Found % trigger(s) to remove', trigger_count;

  -- Verify is_admin exists (should NOT be removed)
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    RAISE WARNING 'is_admin() function not found - this is unexpected!';
  ELSE
    RAISE NOTICE 'is_admin() function exists and will be kept';
  END IF;
END $$;

-- ============================================================================
-- Remove Plan Instance Overlap Trigger (Replaced by TypeScript Validation)
-- ============================================================================

-- Overlap validation is now performed in the API layer using
-- PlanInstanceValidator before inserting/updating plan instances
-- The trigger must be dropped before the function to avoid dependency errors

DROP TRIGGER IF EXISTS prevent_plan_overlap ON public.plan_instances;
DROP FUNCTION IF EXISTS public.check_plan_instance_overlap();

-- ============================================================================
-- Remove Admin Query Functions (Replaced by TypeScript Services)
-- ============================================================================

-- These functions are no longer needed because TypeScript services now
-- query the underlying views (admin_user_view, admin_stats_view) directly

-- 1. get_admin_users() - Replaced by AdminUserService.queryUsers()
DROP FUNCTION IF EXISTS public.get_admin_users(TEXT, TEXT, TEXT, BOOLEAN, INT, INT);

-- 2. get_admin_user_by_id() - Replaced by AdminUserService.getUserById()
DROP FUNCTION IF EXISTS public.get_admin_user_by_id(UUID);

-- 3. get_admin_users_count() - Replaced by AdminUserService.countUsers()
DROP FUNCTION IF EXISTS public.get_admin_users_count(TEXT, TEXT, TEXT, BOOLEAN);

-- 4. get_admin_stats() - Replaced by AdminStatsService.getStats()
DROP FUNCTION IF EXISTS public.get_admin_stats();

-- ============================================================================
-- Verification Comments
-- ============================================================================

-- The following are KEPT and still in use:
--
-- 1. is_admin() function
--    - Required for RLS policies
--    - Used in: Multiple RLS policies across tables
--    - Location: Migration 20251217000003_add_admin_rls_policies.sql
--    - Status: KEEP
--
-- 2. admin_user_view
--    - Queried by AdminUserService
--    - Location: Migration 20251217000002_create_admin_views.sql
--    - Status: KEEP
--
-- 3. admin_stats_view
--    - Queried by AdminStatsService
--    - Location: Migration 20251217000002_create_admin_views.sql
--    - Status: KEEP
--
-- 4. All RLS policies
--    - Security layer, unaffected by this migration
--    - Status: KEEP

-- ============================================================================
-- Post-Migration Verification
-- ============================================================================

-- Verify functions were successfully removed
DO $$
DECLARE
  remaining_count INT;
BEGIN
  -- Check if any removed functions still exist
  SELECT COUNT(*) INTO remaining_count
  FROM pg_proc
  WHERE proname IN ('get_admin_users', 'get_admin_user_by_id', 'get_admin_users_count', 'get_admin_stats', 'check_plan_instance_overlap');

  IF remaining_count > 0 THEN
    RAISE WARNING 'Migration incomplete: % function(s) still exist after drop', remaining_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All application logic functions removed';
  END IF;

  -- Verify is_admin still exists
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    RAISE EXCEPTION 'CRITICAL: is_admin() function was accidentally removed! This breaks RLS policies.';
  ELSE
    RAISE NOTICE 'SUCCESS: is_admin() function preserved (required for RLS)';
  END IF;

  -- Verify trigger was removed
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_plan_overlap') THEN
    RAISE WARNING 'Migration incomplete: prevent_plan_overlap trigger still exists';
  ELSE
    RAISE NOTICE 'SUCCESS: prevent_plan_overlap trigger removed';
  END IF;

  RAISE NOTICE 'Migration completed successfully!';
END $$;

COMMENT ON SCHEMA public IS
  'Application logic migrated to TypeScript services (Issue #148). Database now contains only data integrity constraints and RLS policies.';

-- ============================================================================
-- POST-MIGRATION STEPS (IMPORTANT!)
-- ============================================================================
--
-- After applying this migration, you MUST regenerate TypeScript types to
-- remove references to deleted functions:
--
-- 1. Regenerate types:
--    cd web && npm run db:types
--
-- 2. Verify types are updated:
--    grep -E "get_admin_users|get_admin_stats|check_plan_instance_overlap" lib/types/database.ts
--    (should return no results)
--
-- 3. Verify is_admin is still present:
--    grep "is_admin" lib/types/database.ts
--    (should return results - this function is kept)
--
-- 4. Run type check:
--    npm run type-check
--
-- 5. Commit updated types:
--    git add lib/types/database.ts
--    git commit -m "chore: Regenerate Supabase types after removing application logic functions"
--
-- See: POST_MIGRATION_CHECKLIST.md for complete checklist

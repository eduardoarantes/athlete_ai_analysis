-- Migration: Fix admin views security - Revoke access from anon role
-- Created: 2025-12-24
-- Fixes: GitHub Issues #29 and #30
-- Description: Revoke direct SELECT access to admin views from anon and public roles
--              to prevent unauthorized access to auth.users data via PostgREST.
--              Access is only allowed through SECURITY DEFINER RPC functions that check is_admin().

-- ============================================
-- Security Issue
-- ============================================
-- The Supabase Security Advisor flagged:
-- - 0002_auth_users_exposed: Views expose auth.users to anon role
-- - 0010_security_definer_view: Views use SECURITY DEFINER
--
-- Root cause: Views in public schema are accessible via PostgREST to anon role
-- Fix: Revoke SELECT from anon and public, only allow access via RPC functions

-- ============================================
-- Revoke Access to admin_user_view
-- ============================================
-- This view contains user data from auth.users
-- Access should only be through get_admin_users() and get_admin_user_by_id()

REVOKE SELECT ON public.admin_user_view FROM anon;
REVOKE SELECT ON public.admin_user_view FROM public;

-- Also revoke from authenticated to force use of RPC functions
-- The RPC functions (get_admin_users, get_admin_user_by_id) check is_admin() before returning data
REVOKE SELECT ON public.admin_user_view FROM authenticated;

-- ============================================
-- Revoke Access to admin_stats_view
-- ============================================
-- This view contains aggregate statistics from auth.users
-- Access should only be through get_admin_stats()

REVOKE SELECT ON public.admin_stats_view FROM anon;
REVOKE SELECT ON public.admin_stats_view FROM public;

-- Also revoke from authenticated to force use of RPC functions
REVOKE SELECT ON public.admin_stats_view FROM authenticated;

-- ============================================
-- Verification Comments
-- ============================================
-- After this migration:
-- 1. Direct queries to admin_user_view and admin_stats_view will fail for anon/authenticated
-- 2. RPC functions (get_admin_users, get_admin_stats, get_admin_user_by_id) still work because:
--    - They are SECURITY DEFINER functions (run with owner privileges)
--    - They explicitly check is_admin() before returning any data
-- 3. The security linter warnings should be resolved

COMMENT ON VIEW public.admin_user_view IS 'Admin-only view of users. Direct access revoked - use get_admin_users() or get_admin_user_by_id() RPC functions.';
COMMENT ON VIEW public.admin_stats_view IS 'Admin-only view of platform stats. Direct access revoked - use get_admin_stats() RPC function.';

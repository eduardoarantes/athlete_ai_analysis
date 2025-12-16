-- Migration: Seed default subscription plans and migrate users
-- Created: 2025-12-17
-- Description: Insert Free, Pro, Team plans and assign all existing users to Free plan

-- ============================================
-- Insert Default Subscription Plans
-- ============================================

INSERT INTO public.subscription_plans (name, display_name, description, features, limits, price_monthly_cents, is_active, sort_order)
VALUES
  -- Free Plan
  (
    'free',
    'Free',
    'Get started with essential cycling analysis features',
    '["Basic performance analysis", "Up to 100 activities", "1 training plan", "Community support"]'::jsonb,
    '{"max_activities": 100, "max_training_plans": 1, "max_reports": 5}'::jsonb,
    0, -- Free
    true,
    0 -- Display first
  ),

  -- Pro Plan
  (
    'pro',
    'Pro',
    'Unlock advanced features for serious cyclists',
    '["Unlimited activities", "Unlimited training plans", "Advanced analytics", "FIT file analysis", "Priority support", "Custom reports"]'::jsonb,
    '{"max_activities": -1, "max_training_plans": -1, "max_reports": -1}'::jsonb, -- -1 = unlimited
    1999, -- $19.99/month
    true,
    1 -- Display second
  ),

  -- Team Plan
  (
    'team',
    'Team',
    'Perfect for coaches managing multiple athletes',
    '["Everything in Pro", "Up to 10 athletes", "Team analytics", "Coach dashboard", "Bulk reporting", "Dedicated support"]'::jsonb,
    '{"max_activities": -1, "max_training_plans": -1, "max_reports": -1, "max_athletes": 10}'::jsonb,
    4999, -- $49.99/month
    true,
    2 -- Display third
  )
ON CONFLICT (name) DO NOTHING; -- Prevent duplicate inserts if migration runs twice

-- ============================================
-- Migrate Existing Users to Free Plan
-- ============================================
-- Assign all users who don't have a subscription to the Free plan

INSERT INTO public.user_subscriptions (user_id, plan_id, status, started_at)
SELECT
  u.id AS user_id,
  sp.id AS plan_id,
  'active' AS status,
  NOW() AS started_at
FROM auth.users u
CROSS JOIN public.subscription_plans sp
WHERE sp.name = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING; -- Skip if user already has subscription

-- ============================================
-- Verification Query
-- ============================================
-- Log how many users were migrated (for debugging)

DO $$
DECLARE
  plan_count INTEGER;
  user_count INTEGER;
  subscription_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO plan_count FROM public.subscription_plans;
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO subscription_count FROM public.user_subscriptions;

  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Subscription plans: %', plan_count;
  RAISE NOTICE '  Total users: %', user_count;
  RAISE NOTICE '  Users with subscriptions: %', subscription_count;
END $$;

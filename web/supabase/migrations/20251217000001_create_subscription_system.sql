-- Migration: Create subscription system tables
-- Created: 2025-12-17
-- Description: Add subscription_plans and user_subscriptions tables for RBAC system

-- ============================================
-- Subscription Plans Table
-- ============================================
-- Defines available subscription tiers (Free, Pro, Team)

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Plan identification
  name TEXT NOT NULL UNIQUE CHECK (name ~ '^[a-z0-9_]+$'), -- Slug-friendly name (e.g., 'free', 'pro', 'team')
  display_name TEXT NOT NULL, -- Human-readable name (e.g., 'Free', 'Pro', 'Team')
  description TEXT,

  -- Plan features and limits (stored as JSONB for flexibility)
  features JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of feature strings
  limits JSONB NOT NULL DEFAULT '{}'::jsonb, -- Object with limit keys (e.g., {"max_activities": 100})

  -- Pricing
  price_monthly_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0, -- Display order (0 = first)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for active plans ordered by sort_order
CREATE INDEX idx_subscription_plans_active ON public.subscription_plans(is_active, sort_order);

-- ============================================
-- User Subscriptions Table
-- ============================================
-- Tracks each user's subscription status and billing information

CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User reference
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Subscription plan reference
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,

  -- Subscription status
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'suspended', 'cancelled', 'expired')
  ),

  -- Subscription dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ, -- NULL for active subscriptions without end date

  -- Stripe integration (for future payment processing)
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure one active subscription per user
  UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_plan ON public.user_subscriptions(plan_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe_customer ON public.user_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================
-- Updated At Triggers
-- ============================================
-- Automatically update updated_at timestamp on row changes
-- Note: Depends on update_updated_at_column() function from migration 20251211001020_create_initial_schema.sql

-- Create the function if it doesn't exist (for fresh installs)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
-- Enable RLS on new tables

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscription Plans Policies
-- Everyone can view active subscription plans
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Only admins can modify subscription plans (will be enforced in admin RLS migration)

-- User Subscriptions Policies
-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users cannot modify their own subscription (admin-only operation)
-- No INSERT, UPDATE, DELETE policies for regular users
-- Admin policies will be added in migration 3

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE public.subscription_plans IS 'Subscription plan definitions (Free, Pro, Team)';
COMMENT ON COLUMN public.subscription_plans.name IS 'Unique slug-friendly plan identifier';
COMMENT ON COLUMN public.subscription_plans.features IS 'Array of feature descriptions for display';
COMMENT ON COLUMN public.subscription_plans.limits IS 'Object mapping limit types to values (e.g., {"max_activities": 100})';
COMMENT ON COLUMN public.subscription_plans.price_monthly_cents IS 'Monthly price in cents (USD)';

COMMENT ON TABLE public.user_subscriptions IS 'User subscription records with status and billing info';
COMMENT ON COLUMN public.user_subscriptions.status IS 'Subscription status: active, suspended, cancelled, expired';
COMMENT ON COLUMN public.user_subscriptions.ends_at IS 'Expiration date for limited subscriptions (NULL for unlimited)';
COMMENT ON COLUMN public.user_subscriptions.stripe_subscription_id IS 'Stripe subscription ID for paid plans';
COMMENT ON COLUMN public.user_subscriptions.stripe_customer_id IS 'Stripe customer ID for billing';

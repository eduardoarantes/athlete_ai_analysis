# CARD 1: Migration 1 - Create Subscription System Tables

**Task:** Create database tables for subscription plans and user subscriptions
**File:** `web/supabase/migrations/20251217000001_create_subscription_system.sql`
**Dependencies:** None (creates new tables)
**Estimated Time:** 1.5 hours

---

## Objective

Create the foundation for the subscription system by adding two new tables:
1. `subscription_plans` - Defines available subscription tiers (Free, Pro, Team)
2. `user_subscriptions` - Tracks each user's subscription status and history

---

## Implementation Steps

### Step 1: Create the Migration File

Create file: `web/supabase/migrations/20251217000001_create_subscription_system.sql`

### Step 2: Write the SQL Migration

```sql
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

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

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
```

### Step 3: Apply the Migration

```bash
cd web
npx supabase db push
```

### Step 4: Verify Migration Applied

```bash
# Check tables exist
npx supabase db inspect

# Or connect to database and verify
psql <your-connection-string>
```

In psql:
```sql
\d subscription_plans
\d user_subscriptions

-- Verify indexes
\di idx_subscription_plans_active
\di idx_user_subscriptions_user

-- Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('subscription_plans', 'user_subscriptions');
```

---

## Acceptance Criteria

- [ ] Migration file created at correct path
- [ ] `subscription_plans` table exists with all columns
- [ ] `user_subscriptions` table exists with all columns
- [ ] All 6 indexes created successfully
- [ ] Updated_at triggers working
- [ ] RLS enabled on both tables
- [ ] Foreign key constraints working (user_id → auth.users, plan_id → subscription_plans)
- [ ] Status enum constraint enforcing valid values
- [ ] UNIQUE constraint on user_id in user_subscriptions
- [ ] No SQL errors during migration
- [ ] Table comments added for documentation

---

## Verification Commands

```bash
# Apply migration
cd web
npx supabase db push

# Verify tables created
npx supabase db inspect | grep subscription

# Test RLS enabled
psql <connection-string> -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'subscription%';"

# Verify foreign keys
psql <connection-string> -c "\d user_subscriptions"
```

---

## Integration Points

### Depends On
- ✅ Existing `auth.users` table (Supabase auth)
- ✅ `update_updated_at_column()` function (from existing migrations)

### Enables
- Migration 2: Admin views can join subscription data
- Migration 3: Admin RLS policies for subscription management
- Migration 4: Seed default plans

### Future Usage
- Admin dashboard: Display subscription plans
- User profile: Show current subscription
- Subscription management: Upgrade/downgrade functionality
- Payment integration: Stripe webhook handlers

---

## Privacy & Security Notes

**Data Privacy:**
- ✅ No sensitive personal data stored
- ✅ Stripe IDs are references only (not payment details)
- ✅ User subscriptions visible only to user and admins

**Security Considerations:**
- ✅ RLS prevents users from modifying their own subscription
- ✅ UNIQUE constraint prevents multiple active subscriptions
- ✅ Status enum prevents invalid states
- ✅ Foreign key cascades protect data integrity

**Compliance:**
- Subscription data may be subject to data retention policies
- Stripe IDs link to external payment processor
- Users can request subscription history deletion

---

## Rollback Plan

If migration fails or needs to be reverted:

```sql
-- Rollback migration (run in psql)
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
```

**Warning:** This will delete all subscription data. Only use in development/testing.

---

## Testing Checklist

After migration:

1. **Table Creation**
   - [ ] `subscription_plans` table exists
   - [ ] `user_subscriptions` table exists

2. **Constraints**
   - [ ] Foreign keys enforced (try inserting invalid user_id)
   - [ ] Status enum enforced (try inserting invalid status)
   - [ ] UNIQUE constraint enforced (try inserting duplicate user_id)
   - [ ] Price validation (try negative price)

3. **Indexes**
   - [ ] All 6 indexes created
   - [ ] Query performance acceptable

4. **RLS**
   - [ ] RLS enabled on both tables
   - [ ] Users can view active plans
   - [ ] Users can view own subscription
   - [ ] Users cannot view other subscriptions

5. **Triggers**
   - [ ] Updated_at auto-updates on modification

---

## Next Steps

After completing CARD_1:

1. ✅ Proceed to **CARD_2**: Create Admin Views
2. Verify no errors in database logs
3. Document any deviations from plan
4. Update this card if any issues found

---

## Notes

- Migration timestamp `20251217000001` ensures proper ordering
- JSONB used for flexible features/limits (allows adding new features without schema changes)
- Stripe fields prepared for future payment integration
- Status enum can be extended if needed (add to CHECK constraint)
- Metadata JSONB allows storing additional subscription-specific data

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

# CARD 4: Migration 4 - Seed Default Plans

**Task:** Insert default subscription plans and migrate existing users
**File:** `web/supabase/migrations/20251217000004_seed_default_plans.sql`
**Dependencies:** CARD_1 (subscription tables), CARD_3 (admin policies)
**Estimated Time:** 1 hour

---

## Objective

1. Insert three default subscription plans: Free, Pro, Team
2. Migrate all existing users to the Free plan
3. Ensure all users have a subscription record

---

## Implementation Steps

### Step 1: Create the Migration File

Create file: `web/supabase/migrations/20251217000004_seed_default_plans.sql`

### Step 2: Write the SQL Migration

```sql
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
```

### Step 3: Apply the Migration

```bash
cd web
npx supabase db push
```

### Step 4: Verify Plans and Subscriptions

```bash
# In psql
psql <your-connection-string>
```

```sql
-- Verify 3 plans created
SELECT name, display_name, price_monthly_cents, is_active FROM public.subscription_plans ORDER BY sort_order;

-- Expected output:
-- name  | display_name | price_monthly_cents | is_active
-- ------+--------------+---------------------+-----------
-- free  | Free         | 0                   | t
-- pro   | Pro          | 1999                | t
-- team  | Team         | 4999                | t

-- Verify all users have subscriptions
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM public.user_subscriptions) AS users_with_subscription;

-- Expected: numbers should match (all users have subscription)

-- Check subscription distribution
SELECT sp.name, sp.display_name, COUNT(us.id) AS user_count
FROM public.subscription_plans sp
LEFT JOIN public.user_subscriptions us ON sp.id = us.plan_id
GROUP BY sp.id, sp.name, sp.display_name
ORDER BY sp.sort_order;

-- Expected: most/all users on 'free' plan
```

---

## Acceptance Criteria

- [ ] Migration file created at correct path
- [ ] 3 subscription plans inserted (Free, Pro, Team)
- [ ] All existing users migrated to Free plan
- [ ] No users without subscription
- [ ] Plans have correct pricing
- [ ] Plans have correct features and limits
- [ ] Plans ordered correctly (sort_order)
- [ ] No SQL errors during migration
- [ ] Migration idempotent (can run multiple times safely)

---

## Verification Commands

```bash
# Apply migration
cd web
npx supabase db push

# Verify plans
psql <connection-string> << EOF
SELECT name, display_name, price_monthly_cents FROM public.subscription_plans ORDER BY sort_order;
EOF

# Verify all users have subscriptions
psql <connection-string> << EOF
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM public.user_subscriptions) AS subscribed_users;
EOF

# Check plan distribution
psql <connection-string> << EOF
SELECT sp.name, COUNT(us.id) AS user_count
FROM public.subscription_plans sp
LEFT JOIN public.user_subscriptions us ON sp.id = us.plan_id
GROUP BY sp.name
ORDER BY sp.name;
EOF
```

---

## Plan Details

### Free Plan
- **Price:** $0/month
- **Features:**
  - Basic performance analysis
  - Up to 100 activities
  - 1 training plan
  - Community support
- **Limits:**
  - `max_activities`: 100
  - `max_training_plans`: 1
  - `max_reports`: 5

### Pro Plan
- **Price:** $19.99/month
- **Features:**
  - Unlimited activities
  - Unlimited training plans
  - Advanced analytics
  - FIT file analysis
  - Priority support
  - Custom reports
- **Limits:**
  - `max_activities`: -1 (unlimited)
  - `max_training_plans`: -1 (unlimited)
  - `max_reports`: -1 (unlimited)

### Team Plan
- **Price:** $49.99/month
- **Features:**
  - Everything in Pro
  - Up to 10 athletes
  - Team analytics
  - Coach dashboard
  - Bulk reporting
  - Dedicated support
- **Limits:**
  - `max_activities`: -1 (unlimited)
  - `max_training_plans`: -1 (unlimited)
  - `max_reports`: -1 (unlimited)
  - `max_athletes`: 10

---

## Integration Points

### Depends On
- ✅ CARD_1: subscription_plans and user_subscriptions tables
- ✅ CARD_3: Admin policies for managing plans

### Enables
- Users can view available plans
- Admins can manage user subscriptions
- Feature gates can check plan limits
- Subscription upgrade/downgrade flows

---

## Data Migration Notes

**Idempotency:**
- Migration uses `ON CONFLICT DO NOTHING` to safely run multiple times
- Won't duplicate plans or subscriptions
- Safe to re-run if migration partially fails

**Backwards Compatibility:**
- All existing users get Free plan
- No users left without subscription
- No breaking changes to existing data

**Future Users:**
- New signups should be assigned Free plan automatically (handle in application code)
- Consider trigger for auto-assignment (future enhancement)

---

## Next Steps

After completing CARD_4:

1. ✅ Proceed to **CARD_5**: Create TypeScript Types
2. Verify all users have subscriptions
3. Test plan feature limits (in application code)
4. Update this card if any issues found

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

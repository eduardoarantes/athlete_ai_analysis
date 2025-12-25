# CARD 5: TypeScript Types for Subscription and Admin

**Task:** Create TypeScript type definitions for subscription and admin systems
**Files:** `web/lib/types/subscription.ts`, `web/lib/types/admin.ts`
**Dependencies:** CARD_1-4 (all migrations must be applied)
**Estimated Time:** 1.5 hours

---

## Objective

Create comprehensive TypeScript type definitions that:
1. Match the database schema for subscription system
2. Provide type safety for admin operations
3. Enable IntelliSense and compile-time checks
4. Follow TypeScript strict mode conventions

---

## Implementation Steps

### Step 1: Create `web/lib/types/subscription.ts`

```typescript
/**
 * Subscription System Types
 *
 * Type definitions for subscription plans and user subscriptions.
 * These types match the database schema created in migration 20251217000001.
 */

/**
 * Subscription plan definition
 */
export interface SubscriptionPlan {
  id: string
  name: string // Slug: 'free', 'pro', 'team'
  display_name: string // Display: 'Free', 'Pro', 'Team'
  description: string | null
  features: string[] // Array of feature descriptions
  limits: SubscriptionLimits // Limit configuration
  price_monthly_cents: number // Price in cents (0 for free)
  is_active: boolean
  sort_order: number
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

/**
 * Subscription plan limits
 * -1 means unlimited
 */
export interface SubscriptionLimits {
  max_activities?: number
  max_training_plans?: number
  max_reports?: number
  max_athletes?: number // For team plan
  [key: string]: number | undefined // Allow custom limits
}

/**
 * User subscription status
 */
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'expired'

/**
 * User subscription record
 */
export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  started_at: string // ISO timestamp
  ends_at: string | null // ISO timestamp or null for unlimited
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  metadata: Record<string, unknown>
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

/**
 * User subscription with plan details (joined data)
 */
export interface UserSubscriptionWithPlan extends UserSubscription {
  plan: SubscriptionPlan
}

/**
 * Feature gate check result
 */
export interface FeatureGateResult {
  allowed: boolean
  limit: number // -1 for unlimited
  current: number
  remaining: number // -1 for unlimited
  plan_name: string
}

/**
 * Subscription feature gates
 * Used to check if user can perform action based on plan limits
 */
export interface SubscriptionFeatureGate {
  /**
   * Check if user can add more activities
   */
  canAddActivity: (
    subscription: UserSubscriptionWithPlan,
    currentActivityCount: number
  ) => FeatureGateResult

  /**
   * Check if user can create training plan
   */
  canCreateTrainingPlan: (
    subscription: UserSubscriptionWithPlan,
    currentPlanCount: number
  ) => FeatureGateResult

  /**
   * Check if user can generate report
   */
  canGenerateReport: (
    subscription: UserSubscriptionWithPlan,
    currentReportCount: number
  ) => FeatureGateResult

  /**
   * Check if user can add athlete (team plan only)
   */
  canAddAthlete: (
    subscription: UserSubscriptionWithPlan,
    currentAthleteCount: number
  ) => FeatureGateResult
}

/**
 * Helper to check feature gate
 */
export function checkFeatureLimit(
  limit: number,
  current: number,
  planName: string
): FeatureGateResult {
  const unlimited = limit === -1
  const allowed = unlimited || current < limit
  const remaining = unlimited ? -1 : Math.max(0, limit - current)

  return {
    allowed,
    limit,
    current,
    remaining,
    plan_name: planName,
  }
}

/**
 * Create feature gate checker for a subscription
 */
export function createFeatureGate(
  subscription: UserSubscriptionWithPlan
): SubscriptionFeatureGate {
  return {
    canAddActivity: (subscription, currentActivityCount) =>
      checkFeatureLimit(
        subscription.plan.limits.max_activities ?? -1,
        currentActivityCount,
        subscription.plan.name
      ),

    canCreateTrainingPlan: (subscription, currentPlanCount) =>
      checkFeatureLimit(
        subscription.plan.limits.max_training_plans ?? -1,
        currentPlanCount,
        subscription.plan.name
      ),

    canGenerateReport: (subscription, currentReportCount) =>
      checkFeatureLimit(
        subscription.plan.limits.max_reports ?? -1,
        currentReportCount,
        subscription.plan.name
      ),

    canAddAthlete: (subscription, currentAthleteCount) =>
      checkFeatureLimit(
        subscription.plan.limits.max_athletes ?? 0,
        currentAthleteCount,
        subscription.plan.name
      ),
  }
}
```

### Step 2: Create `web/lib/types/admin.ts`

```typescript
/**
 * Admin System Types
 *
 * Type definitions for admin dashboard and user management.
 * These types match the database views created in migration 20251217000002.
 *
 * PRIVACY: These types expose NO sensitive user data (FTP, weight, HR, goals, activity details).
 */

import type { SubscriptionStatus } from './subscription'

/**
 * User role
 */
export type UserRole = 'user' | 'admin'

/**
 * Admin user view data (privacy-safe)
 */
export interface AdminUser {
  // User identity
  user_id: string
  email: string
  role: UserRole

  // Account dates
  account_created_at: string // ISO timestamp
  email_confirmed_at: string | null // ISO timestamp
  last_sign_in_at: string | null // ISO timestamp

  // Subscription information
  subscription: {
    plan_id: string | null
    plan_name: string | null
    plan_display_name: string | null
    status: SubscriptionStatus | null
    started_at: string | null // ISO timestamp
    ends_at: string | null // ISO timestamp
  }

  // Strava connection (NO TOKENS)
  strava: {
    connected: boolean
    last_sync_at: string | null // ISO timestamp
    sync_status: string | null // 'pending' | 'syncing' | 'success' | 'error'
    sync_error: string | null
  }

  // Profile status (NO SENSITIVE DATA)
  profile: {
    exists: boolean
    first_name: string | null
    last_name: string | null
    preferred_language: string | null
    timezone: string | null
    units_system: string | null
  }

  // Aggregate counts (NOT detail data)
  counts: {
    total_activities: number
    total_training_plans: number
    total_reports: number
  }
}

/**
 * Platform statistics for admin dashboard
 */
export interface AdminStats {
  // User statistics
  users: {
    total: number
    last_7_days: number
    last_30_days: number
    active_7_days: number
    active_30_days: number
  }

  // Subscription statistics
  subscriptions: {
    active: number
    suspended: number
    cancelled: number
    expired: number
    by_plan: {
      free: number
      pro: number
      team: number
    }
  }

  // Strava statistics
  strava: {
    total_connections: number
    successful_syncs: number
    failed_syncs: number
    syncs_last_24h: number
  }

  // Content statistics
  content: {
    total_profiles: number
    total_activities: number
    activities_last_7_days: number
    activities_last_30_days: number
    total_training_plans: number
    active_training_plans: number
    total_reports: number
    completed_reports: number
    failed_reports: number
  }
}

/**
 * Admin user list filters
 */
export interface AdminUserFilters {
  search?: string // Email or name search
  role?: UserRole
  subscription?: string // Plan name (e.g., 'free', 'pro')
  strava?: boolean // Has Strava connection
}

/**
 * Pagination for admin user list
 */
export interface AdminUserPagination {
  limit: number
  offset: number
  total?: number // Total count (if available)
}

/**
 * Admin user query result
 */
export interface AdminUserQueryResult {
  users: AdminUser[]
  pagination: AdminUserPagination
}

/**
 * Admin user update request
 */
export interface AdminUserUpdate {
  user_id: string
  role?: UserRole
  subscription?: {
    plan_id: string
    status?: SubscriptionStatus
    ends_at?: string | null
  }
}
```

### Step 3: Verify Types Compile

```bash
cd web
pnpm type-check
```

### Step 4: Test Types in Example File (Optional)

Create `web/lib/types/__test__/subscription.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { SubscriptionPlan, UserSubscription, SubscriptionFeatureGate } from '../subscription'
import { createFeatureGate, checkFeatureLimit } from '../subscription'

describe('Subscription Types', () => {
  it('should create valid subscription plan', () => {
    const plan: SubscriptionPlan = {
      id: '123',
      name: 'free',
      display_name: 'Free',
      description: 'Free plan',
      features: ['Basic analysis'],
      limits: { max_activities: 100 },
      price_monthly_cents: 0,
      is_active: true,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    expect(plan.name).toBe('free')
    expect(plan.limits.max_activities).toBe(100)
  })

  it('should check feature limits correctly', () => {
    const result = checkFeatureLimit(100, 50, 'free')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(50)

    const unlimited = checkFeatureLimit(-1, 999, 'pro')
    expect(unlimited.allowed).toBe(true)
    expect(unlimited.remaining).toBe(-1)
  })
})
```

Run test:
```bash
pnpm test:unit:run
```

---

## Acceptance Criteria

- [ ] `web/lib/types/subscription.ts` created
- [ ] `web/lib/types/admin.ts` created
- [ ] All types compile without errors (`pnpm type-check`)
- [ ] Types match database schema
- [ ] Feature gate helpers implemented
- [ ] Admin types expose NO sensitive data
- [ ] IntelliSense works in VS Code
- [ ] Tests pass (if created)

---

## Verification Commands

```bash
# Type check
cd web
pnpm type-check

# Run tests (if created)
pnpm test:unit:run

# Import types in a test file to verify
cat > web/lib/types/__test__/import-test.ts << 'EOF'
import type { SubscriptionPlan, UserSubscription } from '../subscription'
import type { AdminUser, AdminStats } from '../admin'

const plan: SubscriptionPlan = {} as any
const user: AdminUser = {} as any
console.log('Types imported successfully')
EOF

npx tsx web/lib/types/__test__/import-test.ts
```

---

## Integration Points

### Depends On
- ✅ CARD_1-4: Database migrations create the schema these types represent

### Enables
- CARD_6: Admin guard can use these types
- Future: API routes use these types for request/response
- Future: React components use these types for props
- Future: Feature gates enforce plan limits

---

## Usage Examples

### Subscription Feature Gate

```typescript
import { createFeatureGate } from '@/lib/types/subscription'

// Check if user can add activity
const gate = createFeatureGate(userSubscription)
const canAdd = gate.canAddActivity(userSubscription, currentActivityCount)

if (!canAdd.allowed) {
  return {
    error: `Activity limit reached (${canAdd.current}/${canAdd.limit}). Upgrade to Pro for unlimited activities.`
  }
}
```

### Admin User Display

```typescript
import type { AdminUser } from '@/lib/types/admin'

function UserRow({ user }: { user: AdminUser }) {
  return (
    <tr>
      <td>{user.email}</td>
      <td>{user.subscription.plan_display_name}</td>
      <td>{user.strava.connected ? 'Yes' : 'No'}</td>
      <td>{user.counts.total_activities}</td>
    </tr>
  )
}
```

---

## Next Steps

After completing CARD_5:

1. ✅ Proceed to **CARD_6**: Create Admin Guard
2. Use types in admin guard implementation
3. Verify IntelliSense works
4. Update this card if any issues found

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

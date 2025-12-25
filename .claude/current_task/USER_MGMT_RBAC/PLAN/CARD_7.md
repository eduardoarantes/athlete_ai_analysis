# CARD 7: Update Database Types

**Task:** Regenerate TypeScript database types after migrations
**File:** `web/lib/types/database.ts`
**Dependencies:** CARD_1-4 (all migrations applied)
**Estimated Time:** 0.5 hours

---

## Objective

Regenerate `web/lib/types/database.ts` to include:
1. New `subscription_plans` table types
2. New `user_subscriptions` table types
3. Updated database structure
4. Ensure type alignment with migrations

---

## Implementation Steps

### Step 1: Verify All Migrations Applied

```bash
cd web
npx supabase db push
```

Ensure all 4 migrations are applied successfully:
- 20251217000001_create_subscription_system.sql
- 20251217000002_create_admin_views.sql
- 20251217000003_add_admin_rls_policies.sql
- 20251217000004_seed_default_plans.sql

### Step 2: Regenerate Database Types

```bash
cd web
npx supabase gen types typescript --local > lib/types/database.ts
```

**Note:** If using Supabase cloud (not local), use:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/types/database.ts
```

### Step 3: Verify New Types Exist

Open `web/lib/types/database.ts` and verify it contains:

1. **subscription_plans table:**
```typescript
export type Database = {
  public: {
    Tables: {
      subscription_plans: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          features: Json
          limits: Json
          price_monthly_cents: number
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        // Insert, Update types...
      }
      // ... other tables
    }
  }
}
```

2. **user_subscriptions table:**
```typescript
user_subscriptions: {
  Row: {
    id: string
    user_id: string
    plan_id: string
    status: string
    started_at: string
    ends_at: string | null
    stripe_subscription_id: string | null
    stripe_customer_id: string | null
    metadata: Json
    created_at: string
    updated_at: string
  }
  // Insert, Update types...
}
```

3. **Functions:**
```typescript
Functions: {
  is_admin: {
    Args: {}
    Returns: boolean
  }
  get_admin_users: {
    Args: {
      search_query?: string
      role_filter?: string
      subscription_filter?: string
      strava_filter?: boolean
      limit_count?: number
      offset_count?: number
    }
    Returns: {
      user_id: string
      email: string
      role: string
      // ... other fields
    }[]
  }
  get_admin_stats: {
    Args: {}
    Returns: {
      total_users: number
      active_users_7_days: number
      // ... other stats
    }[]
  }
}
```

### Step 4: Fix Any Type Conflicts

If there are breaking changes from previous types:

1. **Find usages:**
```bash
cd web
grep -r "Tables<'subscription" . --include="*.ts" --include="*.tsx"
```

2. **Update imports:**
```typescript
// Before
import { Database } from '@/lib/types/database'

// After (if needed)
import { Database, Tables } from '@/lib/types/database'
type SubscriptionPlan = Tables<'subscription_plans'>
```

3. **Fix type errors:**
```bash
pnpm type-check
```

### Step 5: Run Type Check

```bash
cd web
pnpm type-check
```

Expected: No errors (or only unrelated errors)

### Step 6: Verify Build Works

```bash
cd web
pnpm build
```

Expected: Build succeeds

---

## Acceptance Criteria

- [ ] All migrations applied successfully
- [ ] Database types regenerated
- [ ] `subscription_plans` type exists in database.ts
- [ ] `user_subscriptions` type exists in database.ts
- [ ] `is_admin` function type exists
- [ ] `get_admin_users` function type exists
- [ ] `get_admin_stats` function type exists
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] Build succeeds (`pnpm build`)
- [ ] No breaking changes (or all fixed)

---

## Verification Commands

```bash
# Apply all migrations
cd web
npx supabase db push

# Regenerate types
npx supabase gen types typescript --local > lib/types/database.ts

# Verify types exist
grep -A 10 "subscription_plans" lib/types/database.ts
grep -A 10 "user_subscriptions" lib/types/database.ts

# Type check
pnpm type-check

# Build
pnpm build

# Check for usages
grep -r "Tables<'subscription" . --include="*.ts" --include="*.tsx"
```

---

## Integration Points

### Depends On
- ✅ CARD_1: subscription_plans table
- ✅ CARD_2: admin views (not in types, but referenced)
- ✅ CARD_3: is_admin(), get_admin_users(), get_admin_stats() functions
- ✅ CARD_4: Seeded data

### Enables
- All future development with correct types
- IntelliSense for subscription tables
- Type-safe database queries
- Function argument validation

---

## Troubleshooting

### Issue: Types not generated

**Solution:**
- Ensure Supabase CLI installed: `npx supabase --version`
- Ensure migrations applied: `npx supabase db push`
- Try with `--linked` flag: `npx supabase gen types typescript --linked`

### Issue: TypeScript errors after regeneration

**Solution:**
1. Check for breaking changes in database.ts
2. Update import statements
3. Fix type assignments
4. Run `pnpm type-check` to find all errors

### Issue: Functions not in types

**Solution:**
- Functions may not appear in local types
- Try regenerating from cloud: `--project-id YOUR_PROJECT_ID`
- Manually add function types if needed (rare)

---

## Type Usage Examples

### Using Generated Types

```typescript
import type { Database, Tables } from '@/lib/types/database'

// Table types
type SubscriptionPlan = Tables<'subscription_plans'>
type UserSubscription = Tables<'user_subscriptions'>

// Function return types
type AdminUsersResult = Database['public']['Functions']['get_admin_users']['Returns']

// Query with types
const { data: plans } = await supabase
  .from('subscription_plans')
  .select('*')
  .returns<SubscriptionPlan[]>()
```

### Type-Safe Queries

```typescript
// Insert with type checking
const { error } = await supabase
  .from('user_subscriptions')
  .insert({
    user_id: userId,
    plan_id: planId,
    status: 'active', // TypeScript validates this
    started_at: new Date().toISOString(),
  })

// Function call with type checking
const { data: users } = await supabase
  .rpc('get_admin_users', {
    search_query: 'john',
    limit_count: 50,
  })
```

---

## Next Steps

After completing CARD_7:

1. ✅ All Phase 1 tasks complete!
2. Verify all acceptance criteria met
3. Test full workflow end-to-end
4. Document any deviations from plan
5. Prepare for Phase 2 (Admin UI Components)

---

## Final Checklist

Before marking Phase 1 complete:

**Database:**
- [ ] All 4 migrations applied
- [ ] 3 subscription plans exist
- [ ] All users have subscriptions
- [ ] Admin views return data
- [ ] Admin functions work

**TypeScript:**
- [ ] subscription.ts created
- [ ] admin.ts created
- [ ] admin-guard.ts created
- [ ] database.ts regenerated
- [ ] No type errors
- [ ] Build succeeds

**Testing:**
- [ ] Admin guard tested
- [ ] Privacy verified (no sensitive data in views)
- [ ] RLS policies enforced
- [ ] Feature gates work

**Documentation:**
- [ ] All code commented
- [ ] README updated (if needed)
- [ ] Migration notes documented

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

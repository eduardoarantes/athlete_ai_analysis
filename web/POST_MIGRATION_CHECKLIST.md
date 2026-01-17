# Post-Migration Checklist for Issue #148

**Migration:** `20260117142727_remove_application_logic_functions.sql`
**Issue:** #163 - Regenerate Supabase types after function removal
**Parent Issue:** #148 - Database Logic Migration

---

## Overview

This checklist ensures proper type regeneration after removing PostgreSQL functions that have been replaced by TypeScript services.

**Functions Removed:**
- `get_admin_users()` → Replaced by `AdminUserService.queryUsers()`
- `get_admin_user_by_id()` → Replaced by `AdminUserService.getUserById()`
- `get_admin_users_count()` → Replaced by `AdminUserService.countUsers()`
- `get_admin_stats()` → Replaced by `AdminStatsService.getStats()`
- `check_plan_instance_overlap()` → Replaced by `PlanInstanceValidator`

**Functions/Views Kept:**
- `is_admin()` function (required for RLS policies)
- `admin_user_view` (queried by AdminUserService)
- `admin_stats_view` (queried by AdminStatsService)
- All RLS policies (security layer)

---

## Prerequisites

Before running this checklist, ensure:

- [ ] Migration `20260117142727_remove_application_logic_functions.sql` has been applied to production
- [ ] Supabase CLI is installed: `npm install -g supabase`
- [ ] You have access to the Supabase project (project ID: `yqaskiwzyhhovthbvmqq`)

---

## Step 1: Apply Migration (if not already applied)

```bash
cd web
npx supabase db push
```

**Expected output:** Migration should apply cleanly without errors.

**Verification:**
```bash
# Check that functions are removed
npx supabase db remote sql "SELECT proname FROM pg_proc WHERE proname IN ('get_admin_users', 'get_admin_stats', 'check_plan_instance_overlap');"
```

**Expected result:** Empty result (no rows)

- [ ] Migration applied successfully
- [ ] Old functions no longer exist in database

---

## Step 2: Regenerate TypeScript Types

```bash
cd web
npm run db:types
```

**What this does:** Fetches the current database schema and generates TypeScript type definitions in `lib/types/database.ts`.

**Expected output:** Command completes without errors and overwrites the existing types file.

- [ ] Types regenerated successfully
- [ ] No errors during generation

---

## Step 3: Verify Types Are Updated

### 3.1 Check Old Functions Are Removed

```bash
grep -E "get_admin_users|get_admin_stats|check_plan_instance_overlap" lib/types/database.ts
```

**Expected result:** No matches (empty output)

**If functions are still present:**
- Verify migration was applied: `npx supabase db remote sql "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;"`
- Re-run type generation: `npm run db:types`

- [ ] Old functions NOT found in database.ts

### 3.2 Check Kept Function Still Exists

```bash
grep "is_admin" lib/types/database.ts
```

**Expected result:** Should find `is_admin` function signature in the `Functions` type.

**Example output:**
```typescript
Functions: {
  is_admin: {
    Args: Record<PropertyKey, never>
    Returns: boolean
  }
  // ...
}
```

- [ ] `is_admin` function FOUND in database.ts

### 3.3 Check Views Still Exist

```bash
grep -E "admin_user_view|admin_stats_view" lib/types/database.ts
```

**Expected result:** Should find both view definitions.

- [ ] `admin_user_view` found in database.ts
- [ ] `admin_stats_view` found in database.ts

---

## Step 4: Run TypeScript Type Check

```bash
npm run type-check
```

**Expected result:** No type errors related to removed functions.

**If you see errors about missing RPC functions:**
- This means some code is still trying to call the old functions
- Search codebase: `grep -r "get_admin_users\|get_admin_stats\|check_plan_instance_overlap" --include="*.ts" --include="*.tsx"`
- Replace with TypeScript service calls (see migration notes in Phase 1/2)

- [ ] TypeScript compilation succeeds
- [ ] No errors related to removed functions

---

## Step 5: Verify Application Functionality

### 5.1 Admin Dashboard

```bash
# Start development server
npm run dev
```

**Test these endpoints:**

1. **Admin Users Page** (`/admin/users`)
   - [ ] Page loads without errors
   - [ ] User list displays correctly
   - [ ] Pagination works
   - [ ] Search/filter works
   - [ ] User details modal opens correctly

2. **Admin Dashboard** (`/admin`)
   - [ ] Stats display correctly (total users, active plans, etc.)
   - [ ] No console errors related to missing functions

### 5.2 API Routes

Test API routes directly:

```bash
# Get admin users (requires authentication)
curl http://localhost:3000/api/admin/users?page=1&limit=10

# Get admin stats
curl http://localhost:3000/api/admin/stats

# Create plan instance (tests overlap validation)
curl -X POST http://localhost:3000/api/training-plans/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id":"...","plan_id":"...","start_date":"2026-01-20"}'
```

- [ ] `/api/admin/users` works correctly
- [ ] `/api/admin/stats` works correctly
- [ ] Plan instance creation with overlap validation works

---

## Step 6: Check for Codebase References

Search for any remaining direct RPC calls to removed functions:

```bash
cd web
grep -r "\.rpc('get_admin_users" --include="*.ts" --include="*.tsx"
grep -r "\.rpc('get_admin_stats" --include="*.ts" --include="*.tsx"
grep -r "\.rpc('check_plan_instance_overlap" --include="*.ts" --include="*.tsx"
```

**Expected result:** No matches (all calls should go through TypeScript services)

**If matches found:**
- Update code to use TypeScript services instead:
  - `get_admin_users` → `AdminUserService.queryUsers()`
  - `get_admin_stats` → `AdminStatsService.getStats()`
  - Overlap checks → `PlanInstanceValidator.checkOverlap()`

- [ ] No direct RPC calls to removed functions

---

## Step 7: Run Tests

```bash
# Run unit tests
npm run test:unit:run

# Run E2E tests (if applicable)
npm run test:headed
```

**Expected result:** All tests pass, no errors related to removed functions.

- [ ] Unit tests pass
- [ ] E2E tests pass (or N/A)

---

## Step 8: Commit Updated Types

```bash
git add lib/types/database.ts
git add package.json
git add supabase/migrations/20260117142727_remove_application_logic_functions.sql
git add POST_MIGRATION_CHECKLIST.md
git commit -m "chore: Regenerate Supabase types after removing application logic functions

- Removed function signatures: get_admin_users, get_admin_stats, check_plan_instance_overlap
- Kept: is_admin() function, admin_user_view, admin_stats_view
- Added db:types and db:types:check scripts to package.json
- Added post-migration checklist

Related: #163, #162, #148"
```

- [ ] Types committed to repository
- [ ] Commit message references issue numbers

---

## Step 9: Deploy to Production (when ready)

**Before deploying:**
- [ ] All checklist items completed
- [ ] Tests passing in CI/CD
- [ ] Code reviewed and approved

**After deploying:**
- [ ] Verify production admin dashboard works
- [ ] Monitor error logs for any function-related errors
- [ ] Verify RLS policies still work correctly (is_admin function)

---

## Troubleshooting

### Types Still Reference Old Functions

**Problem:** After regeneration, old functions still appear in `database.ts`

**Solution:**
1. Verify migration was applied: `npx supabase db remote sql "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20260117142727';"`
2. If not applied, run: `npx supabase db push`
3. Re-run type generation: `npm run db:types`

### TypeScript Errors After Type Regeneration

**Problem:** Code tries to call removed RPC functions

**Solution:**
1. Search for usage: `grep -r "\.rpc('get_admin_users" --include="*.ts" --include="*.tsx"`
2. Replace with service calls:
   ```typescript
   // Before (RPC)
   const { data } = await supabase.rpc('get_admin_users', {...})

   // After (Service)
   const users = await AdminUserService.queryUsers(supabase, {...})
   ```

### Admin Dashboard Not Working

**Problem:** Admin pages show errors or missing data

**Solution:**
1. Check browser console for errors
2. Verify TypeScript services are imported correctly
3. Ensure `is_admin()` function still exists: `grep "is_admin" lib/types/database.ts`
4. Check RLS policies haven't been affected

### Type Check Script Fails

**Problem:** `npm run db:types:check` shows diff

**Solution:**
1. This is expected if database schema has changed
2. Regenerate types: `npm run db:types`
3. Review diff to ensure changes are expected
4. Commit updated types

---

## Completion Criteria

All items checked means the migration is complete and types are properly regenerated:

- [ ] Migration applied to production
- [ ] Types regenerated successfully
- [ ] Old functions removed from database.ts
- [ ] Kept functions/views still present
- [ ] TypeScript compilation succeeds
- [ ] Admin dashboard works correctly
- [ ] API routes work correctly
- [ ] No direct RPC calls to removed functions
- [ ] Tests passing
- [ ] Changes committed to repository

---

## Related Documentation

- **Issue #148:** Database Logic Migration (parent issue)
- **Issue #162:** Migration creation
- **Issue #163:** Type regeneration (this checklist)
- **Migration File:** `web/supabase/migrations/20260117142727_remove_application_logic_functions.sql`
- **Implementation Plan:** [Wiki - Issue 148 Implementation Plan](https://github.com/eduardoarantes/athlete_ai_analysis/wiki/Implementation-Issue-148-Database-Logic-Migration/Implementation-Plan)

---

## Quick Reference Commands

```bash
# Regenerate types
npm run db:types

# Check if types are in sync
npm run db:types:check

# Verify old functions are gone
grep -E "get_admin_users|get_admin_stats|check_plan_instance_overlap" lib/types/database.ts

# Verify kept function exists
grep "is_admin" lib/types/database.ts

# Run type check
npm run type-check

# Search for direct RPC calls
grep -r "\.rpc('get_admin_users" --include="*.ts" --include="*.tsx"
```

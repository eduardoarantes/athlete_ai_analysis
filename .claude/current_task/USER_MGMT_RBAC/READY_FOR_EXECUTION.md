# READY FOR EXECUTION

**Task:** User Management System with RBAC - Phase 1 (Foundation)
**Status:** 🟢 Complete Plan - Ready for Implementation
**Date:** 2025-12-16

---

## Task Preparation Summary

The Task Implementation Preparation Architect has completed comprehensive preparation for implementing Phase 1 (Foundation) of the User Management System with RBAC.

### What Has Been Prepared

✅ **Complete Implementation Plan** (PLAN.md)
- Architecture overview
- Database structure design
- Privacy guarantees documented
- Integration points mapped
- Risk mitigation strategies

✅ **7 Detailed Task Cards** (PLAN/CARD_1.md through CARD_7.md)
- Step-by-step implementation instructions
- Complete SQL and TypeScript code
- Acceptance criteria for each card
- Verification commands
- Testing checklists

✅ **Project Context Analysis**
- Reviewed existing database schema
- Analyzed current codebase patterns
- Verified existing migrations
- Confirmed TypeScript setup
- Checked logging utilities

✅ **Privacy & Security Review**
- Documented sensitive data that MUST NOT be exposed
- Defined privacy-safe admin views
- Outlined RLS policy requirements
- Specified audit logging approach

---

## Ready for Task-Implementation-Executor Agent

This preparation is now ready to be handed off to the **task-implementation-executor** agent.

### For the Executor Agent

**Start Here:**
1. Read `.claude/current_task/USER_MGMT_RBAC/README.md` for quick overview
2. Read `.claude/current_task/USER_MGMT_RBAC/PLAN.md` for detailed plan
3. Execute `PLAN/CARD_1.md` through `PLAN/CARD_7.md` sequentially

**Each Card Contains:**
- Complete code (SQL/TypeScript) ready to copy-paste
- Step-by-step instructions
- Acceptance criteria to verify
- Verification commands to run
- Integration notes

**Expected Execution Time:** 6-8 hours

**No Ambiguity:** All code is written, all decisions made, all steps documented.

---

## Files to Create/Modify

### New Migration Files (4 files)
1. `web/supabase/migrations/20251217000001_create_subscription_system.sql`
2. `web/supabase/migrations/20251217000002_create_admin_views.sql`
3. `web/supabase/migrations/20251217000003_add_admin_rls_policies.sql`
4. `web/supabase/migrations/20251217000004_seed_default_plans.sql`

### New TypeScript Files (3 files)
1. `web/lib/types/subscription.ts`
2. `web/lib/types/admin.ts`
3. `web/lib/guards/admin-guard.ts`

### Update Existing File (1 file)
1. `web/lib/types/database.ts` (regenerate from schema)

**Total:** 7 new files + 1 updated file

---

## Implementation Sequence

Execute in this exact order:

1. **CARD_1** - Create subscription_plans and user_subscriptions tables
2. **CARD_2** - Create admin_user_view and admin_stats_view (privacy-safe)
3. **CARD_3** - Create is_admin(), get_admin_users(), get_admin_stats() functions + RLS policies
4. **CARD_4** - Seed Free, Pro, Team plans + migrate existing users
5. **CARD_5** - Create TypeScript types (subscription.ts, admin.ts)
6. **CARD_6** - Create admin guard utility (requireAdmin function)
7. **CARD_7** - Regenerate database.ts from updated schema

---

## Success Criteria

Implementation is complete when:

### Database (CARD_1-4)
- [ ] All 4 migrations applied without errors
- [ ] 2 new tables exist (subscription_plans, user_subscriptions)
- [ ] 2 new views exist (admin_user_view, admin_stats_view)
- [ ] 3 new functions exist (is_admin, get_admin_users, get_admin_stats)
- [ ] 7 new RLS policies created
- [ ] 3 subscription plans seeded (Free, Pro, Team)
- [ ] All existing users have Free plan subscription

### TypeScript (CARD_5-7)
- [ ] subscription.ts created with plan and feature gate types
- [ ] admin.ts created with admin dashboard types
- [ ] admin-guard.ts created with requireAdmin function
- [ ] database.ts regenerated with new schema
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] Build succeeds (`pnpm build`)

### Privacy (Critical)
- [ ] Admin views expose NO FTP, weight, HR, goals
- [ ] Admin views expose NO activity details, power data
- [ ] Admin views expose NO training plan content
- [ ] Admin views expose NO Strava tokens
- [ ] Only aggregate counts visible in admin views

### Security
- [ ] RLS policies enforce admin-only access
- [ ] Non-admin users blocked from admin functions
- [ ] Admin guard logs all authorization checks
- [ ] JWT claims validate admin role

---

## Verification Commands

After implementation:

```bash
# 1. Apply all migrations
cd web
npx supabase db push

# 2. Verify database structure
psql <connection> << EOF
-- Tables
\d subscription_plans
\d user_subscriptions

-- Views
\dv admin_user_view
\dv admin_stats_view

-- Functions
\df is_admin
\df get_admin_users
\df get_admin_stats

-- Policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'subscription%';
EOF

# 3. Verify data seeded
psql <connection> << EOF
SELECT name, display_name, price_monthly_cents FROM subscription_plans;
SELECT COUNT(*) FROM user_subscriptions;
EOF

# 4. Type check
cd web
pnpm type-check

# 5. Build
pnpm build

# 6. Test admin guard (create test file)
npx tsx -e "
import { requireAdmin } from './web/lib/guards/admin-guard'
console.log('Admin guard imported successfully')
"
```

---

## Critical Privacy Requirements

**REPEAT FOR EMPHASIS:**

Admin views MUST NOT expose:
- ❌ FTP (athlete_profiles.ftp)
- ❌ Weight (athlete_profiles.weight_kg)
- ❌ Heart rate data (athlete_profiles.max_hr, resting_hr)
- ❌ Goals (athlete_profiles.goals)
- ❌ Activity names, routes, power data (activities.*)
- ❌ Training plan content (training_plans.plan_data)
- ❌ Strava tokens (strava_connections.access_token, refresh_token)
- ❌ Report content (reports.report_data)

Admin views CAN expose:
- ✅ User email, ID, account dates
- ✅ Subscription plan name and status
- ✅ Strava connection status (boolean)
- ✅ Strava sync status and errors (NOT tokens)
- ✅ Profile existence (boolean)
- ✅ First name, last name, language, timezone
- ✅ Aggregate counts (total activities, NOT activity details)

**Verify this manually after CARD_2 is implemented!**

---

## Known Dependencies

### Existing (Already Present)
- ✅ Next.js application in `web/`
- ✅ Supabase project configured
- ✅ TypeScript strict mode enabled
- ✅ Existing database schema
- ✅ errorLogger utility (`web/lib/monitoring/error-logger.ts`)
- ✅ Supabase server client (`web/lib/supabase/server.ts`)
- ✅ `update_updated_at_column()` function (from existing migrations)

### Required for Testing
- Database connection string
- Supabase CLI installed
- Test admin user (create after migrations)

---

## Post-Implementation Actions

After all cards complete:

1. **Create Admin Test User**
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';
```

2. **Test Admin Functions**
```sql
-- Should return true for admin user
SELECT is_admin();

-- Should return user list
SELECT * FROM get_admin_users(NULL, NULL, NULL, NULL, 10, 0);

-- Should return stats
SELECT * FROM get_admin_stats();
```

3. **Verify Privacy**
```sql
-- These queries should FAIL (columns don't exist)
SELECT ftp FROM admin_user_view LIMIT 1;
SELECT weight_kg FROM admin_user_view LIMIT 1;
SELECT access_token FROM admin_user_view LIMIT 1;
```

4. **Test Admin Guard**
```typescript
// In an API route
const supabase = await createClient()
const auth = await requireAdmin(supabase)

if (!auth.authorized) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}

// Proceed with admin logic
```

---

## Handoff to Executor

**Dear Task Implementation Executor Agent,**

This task is fully prepared and ready for implementation. All code is written, all decisions made, all acceptance criteria defined.

**Your mission:**
1. Execute CARD_1 through CARD_7 sequentially
2. Apply migrations using `npx supabase db push`
3. Create TypeScript files with provided code
4. Verify acceptance criteria after each card
5. Run verification commands to ensure correctness

**Expected output:**
- 4 migration files applied
- 3 TypeScript files created
- 1 TypeScript file updated (database.ts)
- All tests passing
- No TypeScript errors
- Privacy guarantees verified

**Estimated time:** 6-8 hours

**No blockers expected.** All dependencies exist, all code provided.

---

## Contact & Questions

If any questions arise during implementation:
1. Re-read the relevant CARD_X.md file
2. Check PLAN.md for architecture details
3. Review README.md for overview
4. Consult web/CLAUDE.md for project patterns
5. Check existing migrations for SQL patterns

All information should be in the prepared documentation.

---

**READY TO START!**

Begin with:
```
.claude/current_task/USER_MGMT_RBAC/PLAN/CARD_1.md
```

---

**Prepared By:** Task Implementation Preparation Architect
**Date:** 2025-12-16
**Status:** ✅ Complete - Ready for Execution

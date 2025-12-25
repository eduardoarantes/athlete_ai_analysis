# Phase 1 (Foundation) - User Management System with RBAC

**Task:** Implement User Management System with Role-Based Access Control
**Phase:** 1 - Foundation (Database Schema, Migrations, Role System, TypeScript Types)
**Status:** Ready for Execution
**Created:** 2025-12-16
**Prepared By:** Task Implementation Preparation Architect

---

## Executive Summary

This implementation plan provides a comprehensive, step-by-step guide for implementing Phase 1 of the User Management System with RBAC for the Cycling AI web application. The task focuses on establishing the foundational database infrastructure and type system that will enable admin functionality while strictly protecting user privacy.

### What This Plan Delivers

1. **Subscription System** - Complete database schema for subscription plans and user subscriptions
2. **Admin Views** - Privacy-safe database views for admin dashboard (NO sensitive data exposed)
3. **Admin RLS Policies** - Database-level enforcement of admin permissions
4. **TypeScript Types** - Full type definitions for subscription and admin systems
5. **Admin Guard Utility** - Server-side authentication check for admin routes

### Key Principles

**Privacy First:** Admin views expose ONLY:
- User email, account dates, role, subscription status
- Aggregate counts (activities, training plans)
- Connection status (NOT tokens or credentials)
- NO private athlete data (FTP, weight, HR, goals, activity details)

**Database-First Security:** RLS policies enforce permissions at the database level, not just application level.

**Type Safety:** Full TypeScript strict mode compliance matching Python backend quality.

---

## Architecture Overview

### Database Structure

```
Subscription System:
┌─────────────────────┐
│ subscription_plans  │ - Free, Pro, Team plans with features and limits
└─────────────────────┘
          │
          │ (plan_id FK)
          ↓
┌─────────────────────┐
│ user_subscriptions  │ - User's current subscription, status, dates
└─────────────────────┘
          │
          │ (user_id FK)
          ↓
    ┌──────────────┐
    │ auth.users   │ - Supabase auth users
    └──────────────┘

Admin Views:
┌──────────────────┐
│ admin_user_view  │ - Joins user, subscription, strava, profile data
└──────────────────┘   (privacy-safe, NO sensitive fields)

┌──────────────────┐
│ admin_stats_view │ - Platform-wide statistics
└──────────────────┘

Admin Functions:
┌──────────────────┐
│ is_admin()       │ - Check if user has admin role
└──────────────────┘

┌──────────────────┐
│ get_admin_users()│ - Query users with filters/pagination
└──────────────────┘

┌──────────────────┐
│ get_admin_stats()│ - Get platform statistics
└──────────────────┘
```

### Role System

Roles are stored in `auth.users.raw_user_meta_data.role`:
- `user` (default) - Regular authenticated user
- `admin` - Platform administrator

Admin role is checked via JWT claims in RLS policies and server-side code.

### Privacy Guarantees

**Admin CAN see:**
- ✅ User email, ID, account creation date
- ✅ Subscription plan and status
- ✅ Strava connection status (connected/disconnected, last sync date, sync errors)
- ✅ Aggregate counts (total activities, total training plans)
- ✅ Account activity (last sign in)

**Admin CANNOT see:**
- ❌ FTP, weight, max HR, resting HR, goals (athlete_profiles sensitive fields)
- ❌ Activity names, routes, power data, HR data (activities table)
- ❌ Training plan content, workout details (training_plans table)
- ❌ Strava access tokens, refresh tokens (strava_connections tokens)
- ❌ Report content (reports table)

---

## Implementation Tasks

This plan is broken down into 7 task cards:

### Task Cards

- **CARD_1.md**: Migration 1 - Create Subscription System Tables
- **CARD_2.md**: Migration 2 - Create Admin Views
- **CARD_3.md**: Migration 3 - Add Admin RLS Policies
- **CARD_4.md**: Migration 4 - Seed Default Plans
- **CARD_5.md**: TypeScript Types (subscription.ts, admin.ts)
- **CARD_6.md**: Admin Guard Utility
- **CARD_7.md**: Update Database Types

Each card contains:
- Detailed step-by-step instructions
- Complete code with all SQL/TypeScript
- Acceptance criteria
- Verification commands

---

## File Structure

```
web/
├── supabase/
│   └── migrations/
│       ├── 20251217000001_create_subscription_system.sql (NEW)
│       ├── 20251217000002_create_admin_views.sql (NEW)
│       ├── 20251217000003_add_admin_rls_policies.sql (NEW)
│       └── 20251217000004_seed_default_plans.sql (NEW)
├── lib/
│   ├── types/
│   │   ├── subscription.ts (NEW)
│   │   ├── admin.ts (NEW)
│   │   └── database.ts (UPDATE - regenerate after migrations)
│   └── guards/
│       └── admin-guard.ts (NEW - create guards directory)
```

---

## Prerequisites

Before starting implementation:

1. **Environment Setup**
   - ✅ Next.js application exists in `web/`
   - ✅ Supabase project configured
   - ✅ TypeScript strict mode enabled
   - ✅ Existing migrations applied

2. **Knowledge Requirements**
   - Understanding of PostgreSQL RLS
   - Familiarity with Supabase auth system
   - TypeScript type system knowledge
   - Understanding of privacy requirements

3. **Tools Required**
   - Supabase CLI installed
   - Database access
   - TypeScript compiler

---

## Implementation Sequence

Execute tasks in this order:

1. **CARD_1**: Create subscription tables (foundation)
2. **CARD_2**: Create admin views (read-only, privacy-safe)
3. **CARD_3**: Add admin RLS policies (security enforcement)
4. **CARD_4**: Seed default plans (data initialization)
5. **CARD_5**: Create TypeScript types (type safety)
6. **CARD_6**: Create admin guard (server-side auth)
7. **CARD_7**: Regenerate database types (final sync)

**Total Estimated Time:** 6-8 hours

---

## Verification Strategy

After each migration:
1. Apply migration: `npx supabase db push`
2. Check for SQL errors
3. Verify tables/views created: `\d table_name` in psql
4. Test RLS policies with test users
5. Verify no sensitive data exposed in views

After TypeScript changes:
1. Run type check: `pnpm type-check`
2. Verify no errors
3. Test imports in a test file
4. Verify IntelliSense works

Final verification:
1. All migrations applied successfully
2. All types compile without errors
3. Admin guard function works correctly
4. Privacy guarantees verified
5. Database types regenerated and aligned

---

## Risk Mitigation

### Risk 1: Privacy Data Leak
**Mitigation:**
- Explicit SELECT statements in views (NO SELECT *)
- Code review of every field in admin views
- Test with real user data to verify
- Document exact fields exposed

### Risk 2: RLS Policy Bypass
**Mitigation:**
- Use `auth.jwt() ->> 'user_metadata'->>'role'` for admin check
- Test with non-admin users
- Verify policies deny access correctly
- Use SECURITY DEFINER functions carefully

### Risk 3: Type Mismatch After Migration
**Mitigation:**
- Regenerate database.ts after all migrations
- Run type-check immediately
- Fix any breaking changes
- Update imports if needed

### Risk 4: Existing Data Migration
**Mitigation:**
- Migration 4 migrates ALL existing users to Free plan
- Handle NULL cases in views
- Test with users that have no subscriptions
- Ensure backwards compatibility

---

## Integration with Existing System

### Existing Tables (DO NOT MODIFY)
- `auth.users` - Supabase auth users
- `athlete_profiles` - User athlete data (KEEP PRIVATE)
- `strava_connections` - Strava OAuth (KEEP TOKENS PRIVATE)
- `activities` - Activity data (KEEP DETAILS PRIVATE)
- `training_plans` - Training plans (KEEP CONTENT PRIVATE)
- `reports` - Reports (KEEP CONTENT PRIVATE)

### New Tables (CREATED BY THIS PLAN)
- `subscription_plans` - Plan definitions
- `user_subscriptions` - User subscription records

### New Views (CREATED BY THIS PLAN)
- `admin_user_view` - Privacy-safe user data for admins
- `admin_stats_view` - Platform statistics

### New Functions (CREATED BY THIS PLAN)
- `is_admin()` - Check admin role
- `get_admin_users()` - Query users with filters
- `get_admin_stats()` - Get statistics

---

## Logging and Monitoring

Follow web/CLAUDE.md logging guidelines:

```typescript
import { errorLogger } from '@/lib/monitoring/error-logger'

// ✅ Good - Use errorLogger
errorLogger.logInfo('Admin guard checked', {
  userId: user.id,
  metadata: { role: user.role, authorized: true }
})

// ❌ Bad - Never use console.log
console.log('User is admin')
```

All admin guard calls must be logged for security audit trail.

---

## Testing Strategy

### Database Testing
1. Apply migrations in test environment first
2. Query views with test users
3. Verify RLS policies block non-admins
4. Test edge cases (NULL values, missing data)

### TypeScript Testing
1. Import types in test file
2. Create test objects
3. Verify type checking works
4. Test guard function with mock Supabase client

### Privacy Testing
1. Review every field in admin views
2. Confirm NO sensitive data present
3. Test with real user data
4. Get approval on exposed fields

---

## Success Criteria

Phase 1 is complete when:

1. ✅ All 4 migrations applied successfully
2. ✅ subscription_plans table exists with 3 plans
3. ✅ user_subscriptions table exists
4. ✅ admin_user_view returns data (privacy-safe)
5. ✅ admin_stats_view returns statistics
6. ✅ is_admin() function works
7. ✅ get_admin_users() function works with filters
8. ✅ get_admin_stats() function works
9. ✅ RLS policies enforce admin access
10. ✅ TypeScript types defined and compiling
11. ✅ Admin guard utility works
12. ✅ Database types regenerated
13. ✅ Privacy guarantees verified
14. ✅ All existing users migrated to Free plan

---

## Next Steps After Implementation

After Phase 1 is complete:

1. **Phase 2: Admin UI Components** (Future)
   - User management table
   - Subscription management
   - Platform statistics dashboard

2. **Phase 3: Admin API Routes** (Future)
   - User CRUD endpoints
   - Subscription management endpoints
   - Statistics endpoints

3. **Phase 4: Admin Dashboard Pages** (Future)
   - Admin route group
   - Protected admin pages
   - UI implementation

---

## References

### Project Documentation
- `web/CLAUDE.md` - Web application patterns and guidelines
- `web/supabase/migrations/20251211001020_create_initial_schema.sql` - Existing schema
- `web/supabase/migrations/20251211001136_enable_rls_policies.sql` - Existing RLS patterns
- `web/lib/monitoring/error-logger.ts` - Logging utility

### Supabase Documentation
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
- [Database Functions](https://supabase.com/docs/guides/database/functions)

### TypeScript Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Strict Mode](https://www.typescriptlang.org/tsconfig#strict)

---

## Ready for Execution

This plan is complete and ready for the task-executor-tdd agent to implement.

**Start with CARD_1** and proceed sequentially through all 7 cards.

All code is provided, all steps documented, all acceptance criteria defined.

**Estimated Time:** 6-8 hours for complete implementation.

---

**End of Implementation Plan**

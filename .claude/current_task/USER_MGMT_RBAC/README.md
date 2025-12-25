# User Management System with RBAC - Phase 1 (Foundation)

**Status:** 🟢 Ready for Execution
**Created:** 2025-12-16
**Estimated Time:** 6-8 hours

---

## Quick Start

To implement this task:

1. **Read the PLAN.md** - Complete implementation overview
2. **Execute CARD_1 through CARD_7 sequentially** - Each card is a complete implementation guide
3. **Verify acceptance criteria** - After each card, run verification commands
4. **Update database types** - Final step to align TypeScript with database schema

---

## What This Implements

Phase 1 of the User Management System creates:

### Database Infrastructure (4 Migrations)
1. **Subscription System** - Plans and user subscriptions tables
2. **Admin Views** - Privacy-safe views for admin dashboard
3. **Admin RLS Policies** - Database-level access control
4. **Default Plans** - Free, Pro, Team plans seeded

### TypeScript Types (3 Files)
1. **subscription.ts** - Subscription plan and feature gate types
2. **admin.ts** - Admin dashboard and user management types
3. **admin-guard.ts** - Server-side authorization utility

### Database Types Update
- Regenerate database.ts with new schema

---

## Files Created

```
web/
├── supabase/migrations/
│   ├── 20251217000001_create_subscription_system.sql (NEW)
│   ├── 20251217000002_create_admin_views.sql (NEW)
│   ├── 20251217000003_add_admin_rls_policies.sql (NEW)
│   └── 20251217000004_seed_default_plans.sql (NEW)
├── lib/
│   ├── types/
│   │   ├── subscription.ts (NEW)
│   │   ├── admin.ts (NEW)
│   │   └── database.ts (UPDATE)
│   └── guards/
│       └── admin-guard.ts (NEW)
```

---

## Implementation Sequence

Execute tasks in this order:

1. ✅ **CARD_1** (1.5h): Create subscription tables
2. ✅ **CARD_2** (2h): Create admin views (privacy-safe)
3. ✅ **CARD_3** (1.5h): Add admin RLS policies
4. ✅ **CARD_4** (1h): Seed default plans
5. ✅ **CARD_5** (1.5h): Create TypeScript types
6. ✅ **CARD_6** (1h): Create admin guard utility
7. ✅ **CARD_7** (0.5h): Update database types

**Total:** 8-9 hours (can be done over multiple sessions)

---

## Key Principles

### Privacy First
Admin views expose ONLY:
- ✅ User email, account dates, role
- ✅ Subscription status and plan
- ✅ Connection status (NOT tokens)
- ✅ Aggregate counts (NOT details)

**NEVER expose:**
- ❌ FTP, weight, HR, goals
- ❌ Activity details, power data
- ❌ Training plan content
- ❌ Strava access tokens

### Database-First Security
- RLS policies enforce permissions at database level
- Admin role checked via JWT claims
- SECURITY DEFINER functions validate access
- Application layer checks via admin-guard.ts

### Type Safety
- Full TypeScript strict mode compliance
- Generated types from database schema
- Helper functions for feature gates
- Type-safe admin authorization

---

## Success Criteria

Phase 1 is complete when:

1. ✅ All 4 migrations applied successfully
2. ✅ 3 subscription plans exist (Free, Pro, Team)
3. ✅ All existing users migrated to Free plan
4. ✅ Admin views return data (privacy-safe)
5. ✅ Admin functions work (is_admin, get_admin_users, get_admin_stats)
6. ✅ RLS policies enforce admin access
7. ✅ TypeScript types defined and compiling
8. ✅ Admin guard utility works
9. ✅ Database types regenerated
10. ✅ No TypeScript errors
11. ✅ Build succeeds

---

## Verification Commands

```bash
# Apply all migrations
cd web
npx supabase db push

# Verify tables and views
psql <connection-string> << EOF
\d subscription_plans
\d user_subscriptions
\dv admin_user_view
\dv admin_stats_view
EOF

# Verify functions
psql <connection-string> << EOF
SELECT public.is_admin();
SELECT * FROM public.get_admin_stats();
EOF

# Type check
cd web
pnpm type-check

# Build
pnpm build
```

---

## Testing Checklist

### Database Testing
- [ ] Migrations applied without errors
- [ ] Tables have correct columns and constraints
- [ ] Views return data
- [ ] Functions work correctly
- [ ] RLS policies enforce access

### Privacy Testing
- [ ] Admin views expose NO FTP, weight, HR data
- [ ] Admin views expose NO activity details
- [ ] Admin views expose NO training plan content
- [ ] Admin views expose NO Strava tokens
- [ ] Only aggregate counts visible

### Type Safety Testing
- [ ] All types compile without errors
- [ ] IntelliSense works in VS Code
- [ ] Feature gate helpers work
- [ ] Admin guard returns correct types

### Authorization Testing
- [ ] Non-admin users blocked from admin functions
- [ ] Admin users can call admin functions
- [ ] RLS policies prevent unauthorized access
- [ ] Admin guard logs all checks

---

## Next Steps After Phase 1

After completing all 7 cards:

1. **Phase 2: Admin UI Components** (Future)
   - User management table component
   - Subscription management UI
   - Platform statistics dashboard

2. **Phase 3: Admin API Routes** (Future)
   - GET /api/admin/users
   - PATCH /api/admin/users/:id
   - GET /api/admin/stats
   - POST /api/admin/subscriptions

3. **Phase 4: Admin Dashboard Pages** (Future)
   - /admin route group
   - Protected admin pages
   - Full UI implementation

---

## Troubleshooting

### Migrations Fail
- Check SQL syntax
- Ensure previous migrations applied
- Verify Supabase connection
- Check database logs

### Types Not Generated
- Ensure Supabase CLI installed
- Ensure migrations applied
- Try `--linked` flag
- Check connection to database

### TypeScript Errors
- Regenerate database types
- Check import paths
- Verify strict mode compliance
- Run `pnpm type-check` for details

### RLS Policies Not Working
- Verify policies created
- Check is_admin() function
- Test with admin user
- Check JWT claims

---

## References

### Documentation
- **PLAN.md** - Complete implementation overview
- **CARD_1.md** - Subscription system migration
- **CARD_2.md** - Admin views migration
- **CARD_3.md** - Admin RLS policies
- **CARD_4.md** - Seed default plans
- **CARD_5.md** - TypeScript types
- **CARD_6.md** - Admin guard utility
- **CARD_7.md** - Update database types

### Project Files
- `web/CLAUDE.md` - Web application patterns
- `web/lib/monitoring/error-logger.ts` - Logging utility
- Existing migrations in `web/supabase/migrations/`

### External Resources
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

---

## Notes

- **Idempotency:** All migrations use `ON CONFLICT DO NOTHING` for safe re-runs
- **Backwards Compatible:** Existing users automatically get Free plan
- **Privacy Safe:** Admin views explicitly exclude sensitive fields
- **Type Safe:** Full TypeScript strict mode compliance
- **Audit Trail:** All admin checks logged via errorLogger
- **Production Ready:** RLS policies enforce security at database level

---

**Ready for Execution!**

Start with **CARD_1** and proceed sequentially through all 7 cards.

All code is provided, all steps documented, all acceptance criteria defined.

---

**Last Updated:** 2025-12-16
**Created By:** Task Implementation Preparation Architect

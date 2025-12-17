# Phase 2 - User Management System with RBAC: Admin API Routes

**Status:** 🟢 Ready for Execution
**Created:** 2025-12-17
**Estimated Time:** 4-6 hours
**Phase:** 2 - Admin API Routes

---

## Quick Start

To implement Phase 2:

1. **Read PLAN.md** - Complete implementation overview
2. **Execute CARD_1 through CARD_5 sequentially** - Each card is a complete implementation guide
3. **Verify acceptance criteria** - After each card, run verification commands
4. **Test all endpoints** - Final integration testing

---

## What This Implements

Phase 2 builds on Phase 1's database foundation to create the Admin API routes:

### API Routes (5 Endpoints)
1. **GET /api/admin/users** - List users with pagination and filtering
2. **GET /api/admin/users/[id]** - Get single user details
3. **PATCH /api/admin/users/[id]** - Update user subscription
4. **GET /api/admin/stats** - Get platform statistics

### Supporting Code
1. **Validation Schemas** - Zod schemas for all inputs
2. **Constants** - Admin-specific constants and messages

---

## Files Created/Updated

```
web/
├── app/
│   └── api/
│       └── admin/
│           ├── users/
│           │   ├── route.ts (NEW)
│           │   └── [id]/
│           │       └── route.ts (NEW)
│           └── stats/
│               └── route.ts (NEW)
├── lib/
│   ├── validations/
│   │   └── admin.ts (NEW)
│   └── constants.ts (UPDATE - add admin constants)
```

---

## Implementation Sequence

Execute tasks in this order:

1. ✅ **CARD_1** (1h): Create Zod validation schemas
2. ✅ **CARD_2** (1.5h): Implement GET /api/admin/users
3. ✅ **CARD_3** (1h): Implement GET /api/admin/users/[id]
4. ✅ **CARD_4** (1.5h): Implement PATCH /api/admin/users/[id]
5. ✅ **CARD_5** (45min): Implement GET /api/admin/stats

**Total:** 4-6 hours

---

## Prerequisites

### Phase 1 Must Be Complete

Verify Phase 1 is complete:

```bash
# Check migrations applied
cd web
npx supabase db push

# Verify database functions exist
psql $DATABASE_URL << EOF
\df get_admin_users
\df get_admin_users_count
\df get_admin_user_by_id
\df get_admin_stats
\df is_admin
EOF

# Verify admin guard exists
ls web/lib/guards/admin-guard.ts

# Verify admin types exist
ls web/lib/types/admin.ts
ls web/lib/types/subscription.ts
```

All commands should succeed with no errors.

### Environment Setup

- ✅ Supabase connection configured
- ✅ TypeScript strict mode enabled
- ✅ errorLogger utility available
- ✅ Zod library installed

---

## Key Principles

### Security First
- **All routes protected** with requireAdmin() guard
- **401** for unauthenticated requests
- **403** for non-admin requests
- **All admin actions logged** with errorLogger

### Type Safety
- **Full TypeScript strict mode** compliance
- **Zod validation** for all inputs
- **Use existing types** from Phase 1
- **No type assertions** unless necessary

### API Consistency
- **Follow existing patterns** from web/app/api/profile/route.ts
- **Use HTTP_STATUS constants** for status codes
- **Use MESSAGES constants** for error messages
- **Return NextResponse.json()** responses

---

## Testing Strategy

### After Each Card

1. Run type-check: `pnpm type-check`
2. Test the specific endpoint
3. Verify audit logs
4. Check for errors

### Final Integration Testing

```bash
# Set environment
export ADMIN_TOKEN="your-admin-jwt-token"
export USER_ID="existing-user-uuid"
export PRO_PLAN_ID="pro-plan-uuid"

# Test all endpoints
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/stats

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/users

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/users/$USER_ID

curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"planId\":\"$PRO_PLAN_ID\"}" \
  http://localhost:3000/api/admin/users/$USER_ID
```

---

## Success Criteria

Phase 2 is complete when:

1. ✅ All 5 task cards implemented
2. ✅ GET /api/admin/users works with pagination
3. ✅ GET /api/admin/users/[id] returns user details
4. ✅ PATCH /api/admin/users/[id] updates subscriptions
5. ✅ GET /api/admin/stats returns statistics
6. ✅ All routes protected with requireAdmin()
7. ✅ All inputs validated with Zod
8. ✅ All admin actions logged
9. ✅ TypeScript type-check passes
10. ✅ Build succeeds without errors
11. ✅ Manual testing confirms all routes work
12. ✅ Non-admin users properly blocked

---

## Verification Commands

### Type Check
```bash
cd web
pnpm type-check
```
Expected: No errors

### Build Check
```bash
cd web
pnpm build
```
Expected: Build succeeds

### Endpoint Tests

See individual CARD files for detailed testing.

Quick smoke test:
```bash
# Start dev server
cd web
pnpm dev

# In another terminal, test each endpoint
export ADMIN_TOKEN="your-admin-jwt-token"

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/stats | jq .

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/users | jq .
```

---

## Troubleshooting

### Migrations Not Applied

**Problem:** Database functions not found

**Solution:**
```bash
cd web
npx supabase db push
```

### Type Errors

**Problem:** TypeScript compilation errors

**Solution:**
```bash
# Ensure Phase 1 types exist
ls web/lib/types/admin.ts
ls web/lib/guards/admin-guard.ts

# Run type-check for details
pnpm type-check
```

### Authentication Fails

**Problem:** requireAdmin() returns false for admin user

**Solution:**
1. Check user has role in JWT:
   ```sql
   SELECT raw_user_meta_data FROM auth.users WHERE email = 'admin@example.com';
   ```
2. Ensure role is 'admin' in user_metadata
3. Verify is_admin() function works:
   ```sql
   SELECT public.is_admin();
   ```

### RLS Policies Block Admin

**Problem:** Admin users can't update subscriptions

**Solution:**
1. Verify Phase 1 migration 3 applied
2. Check policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'user_subscriptions';
   ```
3. Should see policies allowing admin access

---

## Next Steps After Phase 2

After completing all 5 cards and verifying success criteria:

### Phase 3: Admin UI Components (Future)
- User management table component
- Subscription management form
- Statistics dashboard cards
- Filter and search UI components

### Phase 4: Admin Dashboard Pages (Future)
- /admin/users page
- /admin/stats page
- Admin layout with navigation
- Protected route wrapper

---

## References

### Project Documentation
- **PLAN.md** - Complete implementation overview
- **CARD_1.md** - Validation schemas
- **CARD_2.md** - GET /api/admin/users
- **CARD_3.md** - GET /api/admin/users/[id]
- **CARD_4.md** - PATCH /api/admin/users/[id]
- **CARD_5.md** - GET /api/admin/stats

### Existing Code
- `web/CLAUDE.md` - Web application patterns
- `web/lib/guards/admin-guard.ts` - Admin guard utility
- `web/lib/types/admin.ts` - Admin types
- `web/lib/monitoring/error-logger.ts` - Logging utility
- `web/app/api/profile/route.ts` - Example API route pattern

### External Resources
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Zod Validation](https://zod.dev/)
- [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc)

---

## Notes

- **Security:** All routes use requireAdmin() guard
- **Type Safety:** Full TypeScript strict mode compliance
- **Audit Trail:** All admin actions logged via errorLogger
- **Error Handling:** No internal details exposed to clients
- **API Consistency:** Follows existing project patterns
- **Production Ready:** Full validation and error handling

---

**Ready for Execution!**

Start with **CARD_1** and proceed sequentially through all 5 cards.

All code is provided, all steps documented, all acceptance criteria defined.

---

**Last Updated:** 2025-12-17
**Created By:** Task Implementation Preparation Architect

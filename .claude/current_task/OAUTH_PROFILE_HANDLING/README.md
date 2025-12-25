# Task 5: Profile Handling for OAuth Users

**Feature:** Google Login Integration
**Status:** Ready for Execution
**Created:** 2025-12-25
**Estimated Time:** 1-2 hours

---

## Quick Start

This task ensures new Google OAuth users are redirected to onboarding if they don't have an athlete profile.

### Implementation Order

1. **Read PLAN.md** - Understand the complete architecture
2. **Implement CARD_1** - Update dashboard layout with profile check
3. **Implement CARD_2** - Create Google metadata helper utility
4. **Test Manually** - Verify all scenarios work correctly

---

## What This Task Delivers

1. **Dashboard Profile Check** - Server-side check in `/app/(dashboard)/layout.tsx`
2. **Onboarding Redirect** - Automatic redirect for users without profiles
3. **Google Metadata Helper** - Utility to extract name/avatar from OAuth
4. **Structured Logging** - Proper logging following project patterns

---

## Files Modified/Created

### Modified
- `web/app/(dashboard)/layout.tsx` - Add profile check and redirect

### Created
- `web/lib/services/google-metadata.ts` - Metadata extraction utility
- `web/lib/services/__tests__/google-metadata.test.ts` - Unit tests (optional)

---

## Current OAuth Flow (Before)

```
1. User clicks "Sign in with Google"
2. OAuth consent → Google
3. Callback → /auth/callback
4. Redirect to /dashboard
5. PROBLEM: New users have no profile → errors
```

## Enhanced OAuth Flow (After)

```
1. User clicks "Sign in with Google"
2. OAuth consent → Google
3. Callback → /auth/callback
4. Redirect to /dashboard
5. Dashboard layout checks profile
   - Has profile → Show dashboard
   - No profile → Redirect to /onboarding
6. Onboarding creates profile
7. Redirect back to dashboard
```

---

## Testing Checklist

### Manual Testing Required

- [ ] New Google OAuth user redirected to /onboarding
- [ ] Existing user with profile sees dashboard normally
- [ ] Unauthenticated user redirected to /login
- [ ] Onboarding completion redirects to /dashboard
- [ ] Metadata helper extracts name and avatar correctly
- [ ] All logging uses errorLogger (no console.log)
- [ ] TypeScript compilation passes
- [ ] No breaking changes to existing auth flow

---

## Key Files Reference

### Documentation
- `PLAN.md` - Complete implementation plan
- `PLAN/CARD_1.md` - Dashboard layout changes
- `PLAN/CARD_2.md` - Google metadata helper

### Existing Code
- `web/app/(dashboard)/layout.tsx` - Dashboard layout (to modify)
- `web/app/auth/callback/route.ts` - OAuth callback (no changes)
- `web/app/(dashboard)/onboarding/page.tsx` - Onboarding flow (no changes)
- `web/lib/monitoring/error-logger.ts` - Logging utility

---

## Important Notes

### Do NOT Modify
- OAuth callback route (already correct)
- Onboarding page (already functional)
- Google login button (already correct)

### Must Follow
- Use `errorLogger` for all logging (never console.log)
- TypeScript strict mode compliance
- Proper error code handling (PGRST116 for no rows)
- Server-side checks only (no client-side auth checks)

---

## Success Criteria

Task is complete when:

1. ✅ Dashboard layout checks for athlete_profiles
2. ✅ New users redirected to /onboarding
3. ✅ Existing users see dashboard normally
4. ✅ Google metadata helper created and tested
5. ✅ All logging structured and correct
6. ✅ TypeScript compilation passes
7. ✅ Manual testing complete

---

## Rollback Plan

If issues occur:

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-management/web

# Revert dashboard layout
git checkout app/(dashboard)/layout.tsx

# Remove metadata helper
rm lib/services/google-metadata.ts
```

---

## Next Steps After Completion

This task enables:
- Smooth onboarding for Google OAuth users
- Better UX for new users
- Foundation for metadata pre-filling

Future enhancements (not in this task):
- Pre-fill onboarding form with Google data
- Display Google avatar in profile
- Support other OAuth providers (GitHub, Apple)

---

**Ready for Implementation**

Start with CARD_1, then CARD_2. All code provided in task cards.

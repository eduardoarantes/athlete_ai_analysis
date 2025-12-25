# Task 5: Profile Handling for OAuth Users

**Task:** Implement Profile Handling for Google OAuth Users
**Feature:** Google Login Integration
**Status:** Ready for Execution
**Created:** 2025-12-25
**Prepared By:** Task Implementation Preparation Architect

---

## Executive Summary

This implementation ensures new Google OAuth users are smoothly onboarded by checking for an athlete profile and redirecting to the onboarding flow if missing. Additionally, it extracts useful metadata from Google OAuth to pre-fill the profile during onboarding.

### What This Plan Delivers

1. **Dashboard Profile Check** - Server-side check in dashboard layout to verify athlete profile exists
2. **Onboarding Redirect** - Automatic redirect to `/onboarding` for new users without profiles
3. **Google Metadata Helper** - Utility to extract name and avatar from OAuth user metadata
4. **Structured Logging** - Proper error logging following project patterns

### Current OAuth Flow

```
1. User clicks "Sign in with Google" → /login
2. OAuth consent screen → Google
3. Callback with code → /auth/callback
4. Exchange code for session → Supabase Auth
5. Redirect to /dashboard (CURRENT)

PROBLEM: New users have no athlete_profiles record → potential errors
```

### Enhanced OAuth Flow

```
1. User clicks "Sign in with Google" → /login
2. OAuth consent screen → Google
3. Callback with code → /auth/callback
4. Exchange code for session → Supabase Auth
5. Redirect to /dashboard
6. Dashboard layout checks for athlete_profiles (NEW)
   - If exists → Show dashboard (normal flow)
   - If missing → Redirect to /onboarding (new users)
7. Onboarding extracts Google metadata (NEW)
   - Pre-fill name fields
   - Pre-fill avatar
```

---

## Architecture Overview

### File Structure

```
web/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx (MODIFY - add profile check)
│   │   └── onboarding/
│   │       └── page.tsx (EXISTS - already functional)
│   └── auth/
│       └── callback/
│           └── route.ts (NO CHANGES - already correct)
├── lib/
│   └── services/
│       └── google-metadata.ts (NEW - helper utility)
```

### Database Schema (Existing)

```
auth.users (Supabase Auth)
├── id (UUID)
├── email
├── user_metadata (JSONB)
│   ├── full_name (Google)
│   ├── avatar_url (Google)
│   └── picture (Google)

athlete_profiles (Application)
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users.id)
├── first_name
├── last_name
├── ftp, weight_kg, etc.
```

**Key Insight:** New OAuth users have `auth.users` record but NO `athlete_profiles` record initially.

---

## Implementation Strategy

### Approach: Server-Side Dashboard Check

We check for the profile in the dashboard layout (server component) because:

1. **Security** - Server-side check prevents client-side bypasses
2. **Performance** - Single query before rendering any dashboard content
3. **Clean UX** - Redirect happens before user sees dashboard loading
4. **Existing Pattern** - Dashboard already uses `createClient()` from server

### Alternative Approaches Considered

❌ **Middleware Check** - Too broad, would affect all routes including API
❌ **Client-Side Check** - Security risk, flash of content
❌ **Callback Check** - Would require coupling auth flow to profile logic
✅ **Dashboard Layout Check** - Clean, secure, minimal changes

---

## Implementation Tasks

This plan consists of 2 task cards:

### Task Cards

- **CARD_1.md**: Update Dashboard Layout (Profile Check & Redirect)
- **CARD_2.md**: Create Google Metadata Helper (Extraction Utility)

Each card contains:
- Step-by-step implementation instructions
- Complete code with TypeScript types
- Acceptance criteria
- Testing instructions

---

## Risk Assessment

### Risk 1: Infinite Redirect Loop
**Scenario:** Onboarding fails, redirects back to dashboard, which redirects to onboarding again

**Mitigation:**
- Dashboard only checks profile, never calls profile creation
- Onboarding is separate route, not protected by dashboard layout
- Only redirect if profile truly missing (NULL check)

**Likelihood:** Low
**Impact:** High
**Status:** Mitigated

### Risk 2: Race Condition (Profile Created During Redirect)
**Scenario:** User creates profile while redirect is processing

**Mitigation:**
- Single server-side query before render
- Database transaction ensures consistency
- Redirect happens synchronously

**Likelihood:** Very Low
**Impact:** Medium
**Status:** Mitigated

### Risk 3: Google Metadata Missing
**Scenario:** Google doesn't provide full_name or avatar_url

**Mitigation:**
- All fields optional with null coalescing
- Fallback to email for display
- No errors if metadata missing

**Likelihood:** Low
**Impact:** Low
**Status:** Mitigated

### Risk 4: Breaking Existing Email/Password Users
**Scenario:** Profile check affects users who signed up with email

**Mitigation:**
- Check applies to ALL users, regardless of auth method
- Email users already go through onboarding
- No change to existing user behavior

**Likelihood:** None
**Impact:** None
**Status:** N/A

---

## Integration with Existing System

### Existing Components (DO NOT MODIFY)

1. **OAuth Callback** (`/auth/callback/route.ts`)
   - Already handles Google OAuth correctly
   - Logs success/errors properly
   - Redirects to `/dashboard`

2. **Onboarding Flow** (`/app/(dashboard)/onboarding/page.tsx`)
   - 4-step wizard already complete
   - Creates athlete_profiles via API
   - Stores data in Zustand

3. **Google Login Button** (`/components/auth/google-login-button.tsx`)
   - Initiates OAuth flow correctly
   - Handles errors properly

### New Components (CREATED BY THIS PLAN)

1. **Profile Check** in Dashboard Layout
   - Query athlete_profiles
   - Redirect if missing
   - Log check results

2. **Google Metadata Helper** (`/lib/services/google-metadata.ts`)
   - Extract full_name, avatar_url, email
   - Type-safe extraction
   - Handles missing fields

---

## Logging Strategy

Follow `web/CLAUDE.md` logging guidelines:

```typescript
import { errorLogger } from '@/lib/monitoring/error-logger'

// Profile check result
errorLogger.logInfo('Profile check completed', {
  userId: user.id,
  metadata: {
    hasProfile: !!profile,
    action: profile ? 'continue' : 'redirect_onboarding'
  }
})

// Profile missing (not an error, expected for new users)
errorLogger.logInfo('New user redirected to onboarding', {
  userId: user.id,
  metadata: {
    authMethod: 'google_oauth',
    hasProfile: false
  }
})
```

**Key Points:**
- Use `logInfo` for normal flow (not errors)
- Include userId for tracking
- Include relevant context (hasProfile, authMethod)
- Never log sensitive data

---

## Testing Strategy

### Manual Testing

1. **Test New Google OAuth User**
   ```
   1. Sign out completely
   2. Go to /login
   3. Click "Sign in with Google"
   4. Complete OAuth consent
   5. VERIFY: Redirected to /onboarding
   6. Complete onboarding
   7. VERIFY: Redirected to /dashboard
   8. VERIFY: Can access dashboard normally
   ```

2. **Test Existing User with Profile**
   ```
   1. Sign in as existing user (with profile)
   2. Go to /dashboard
   3. VERIFY: Dashboard loads normally
   4. VERIFY: No redirect to onboarding
   ```

3. **Test Google Metadata Extraction**
   ```
   1. Sign in with Google (new user)
   2. Check onboarding form
   3. VERIFY: Name fields pre-filled (if Google provided)
   4. VERIFY: Avatar displayed (if Google provided)
   ```

### Edge Cases

1. **Google Metadata Missing**
   - Sign in with Google account that has no name set
   - Verify: No errors, fields empty

2. **Profile Creation During Redirect**
   - Unlikely but possible race condition
   - System handles gracefully (profile exists on next load)

3. **Multiple Tabs Open**
   - User creates profile in one tab
   - Other tab refreshes → sees dashboard (correct)

---

## Success Criteria

Task 5 is complete when:

1. ✅ Dashboard layout checks for athlete_profiles
2. ✅ New users without profiles redirected to /onboarding
3. ✅ Existing users with profiles see dashboard normally
4. ✅ Google metadata helper extracts name and avatar
5. ✅ All logging uses errorLogger (no console.log)
6. ✅ TypeScript strict mode passes
7. ✅ Manual testing complete (all scenarios)
8. ✅ No breaking changes to existing auth flow

---

## Implementation Sequence

Execute tasks in this order:

1. **CARD_1**: Update Dashboard Layout
   - Add profile check query
   - Add redirect logic
   - Add logging

2. **CARD_2**: Create Google Metadata Helper
   - Extract metadata utility
   - Type-safe implementation
   - Export for use in onboarding

**Total Estimated Time:** 1-2 hours

---

## Future Enhancements (Not in This Task)

1. **Pre-fill Onboarding from Metadata**
   - Use `extractGoogleMetadata()` in onboarding
   - Auto-populate name fields
   - Display Google avatar

2. **Profile Completion Tracking**
   - Track which OAuth users complete onboarding
   - Analytics on drop-off rates

3. **Social Login Options**
   - Add GitHub OAuth
   - Add Apple OAuth
   - Unified metadata extraction

---

## References

### Project Documentation
- `web/CLAUDE.md` - Logging guidelines, TypeScript patterns
- `web/app/(dashboard)/layout.tsx` - Current dashboard layout
- `web/app/auth/callback/route.ts` - OAuth callback implementation
- `web/lib/monitoring/error-logger.ts` - Logging utility

### Existing OAuth Implementation
- Google Login Button: `web/components/auth/google-login-button.tsx`
- Onboarding Flow: `web/app/(dashboard)/onboarding/page.tsx`

### Supabase Documentation
- [OAuth with Supabase](https://supabase.com/docs/guides/auth/social-login)
- [Server-Side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

## Ready for Execution

This plan is complete and ready for implementation.

**Start with CARD_1** (Dashboard Layout), then proceed to **CARD_2** (Google Metadata Helper).

All code is provided, all edge cases considered, all logging patterns defined.

**Estimated Time:** 1-2 hours for complete implementation.

---

**End of Implementation Plan**

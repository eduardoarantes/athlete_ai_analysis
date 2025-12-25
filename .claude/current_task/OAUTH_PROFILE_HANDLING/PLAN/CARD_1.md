# CARD 1: Update Dashboard Layout with Profile Check

**Task:** Add profile existence check to dashboard layout with redirect to onboarding
**File:** `web/app/(dashboard)/layout.tsx`
**Dependencies:** None (uses existing infrastructure)
**Estimated Time:** 30-45 minutes

---

## Objective

Modify the dashboard layout to check if the authenticated user has an athlete profile. If no profile exists, redirect the user to `/onboarding` before rendering any dashboard content.

This ensures new OAuth users (particularly Google login) are guided through the onboarding flow to create their athlete profile.

---

## Current Code

The current dashboard layout is minimal:

```typescript
// web/app/(dashboard)/layout.tsx
import { Navbar } from '@/components/layout/navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

**Issues:**
- No authentication check
- No profile existence check
- New OAuth users see empty/broken dashboard

---

## Implementation Steps

### Step 1: Convert to Async Server Component

Add async keyword and import necessary utilities:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { Navbar } from '@/components/layout/navbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Implementation in next steps
}
```

### Step 2: Add Authentication Check

Check if user is authenticated:

```typescript
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    errorLogger.logWarning('Unauthenticated dashboard access', {
      path: '/dashboard',
      metadata: {
        error: authError?.message || 'No user session',
      },
    })
    redirect('/login')
  }

  // Continue to profile check...
}
```

### Step 3: Add Profile Existence Check

Query athlete_profiles table:

```typescript
  // Check for athlete profile
  const { data: profile, error: profileError } = await supabase
    .from('athlete_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Handle query errors
  if (profileError && profileError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected for new users)
    // Any other error is unexpected
    errorLogger.logError(new Error(profileError.message), {
      userId: user.id,
      path: '/dashboard',
      metadata: {
        error: profileError.message,
        code: profileError.code,
      },
    })
    // Continue to dashboard (avoid breaking existing users on DB errors)
  }
```

### Step 4: Add Redirect Logic

Redirect to onboarding if no profile:

```typescript
  // Redirect to onboarding if no profile exists
  if (!profile) {
    errorLogger.logInfo('New user redirected to onboarding', {
      userId: user.id,
      path: '/dashboard',
      metadata: {
        hasProfile: false,
        action: 'redirect_onboarding',
      },
    })
    redirect('/onboarding')
  }

  // Profile exists, log and continue
  errorLogger.logInfo('Dashboard access authorized', {
    userId: user.id,
    path: '/dashboard',
    metadata: {
      hasProfile: true,
      profileId: profile.id,
    },
  })
```

### Step 5: Return Layout JSX

```typescript
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

---

## Complete Implementation

Here is the complete updated file:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { Navbar } from '@/components/layout/navbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    errorLogger.logWarning('Unauthenticated dashboard access', {
      path: '/dashboard',
      metadata: {
        error: authError?.message || 'No user session',
      },
    })
    redirect('/login')
  }

  // Check for athlete profile
  const { data: profile, error: profileError } = await supabase
    .from('athlete_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Handle query errors (but don't block dashboard for existing users)
  if (profileError && profileError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected for new users)
    errorLogger.logError(new Error(profileError.message), {
      userId: user.id,
      path: '/dashboard',
      metadata: {
        error: profileError.message,
        code: profileError.code,
        phase: 'profile_check',
      },
    })
  }

  // Redirect to onboarding if no profile exists
  if (!profile) {
    errorLogger.logInfo('New user redirected to onboarding', {
      userId: user.id,
      path: '/dashboard',
      metadata: {
        hasProfile: false,
        action: 'redirect_onboarding',
      },
    })
    redirect('/onboarding')
  }

  // Profile exists, log and continue to dashboard
  errorLogger.logInfo('Dashboard access authorized', {
    userId: user.id,
    path: '/dashboard',
    metadata: {
      hasProfile: true,
      profileId: profile.id,
    },
  })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

---

## Key Implementation Details

### Error Code Handling

**PGRST116** is the Supabase/PostgREST error code for "no rows returned" when using `.single()`.

- For new users: This is EXPECTED (no profile yet)
- For query errors: This is UNEXPECTED (log as error)

We distinguish between these cases to avoid false error logging.

### Logging Strategy

1. **Authentication failure**: `logWarning` (could be expired session)
2. **Profile query error**: `logError` (unexpected database issue)
3. **New user redirect**: `logInfo` (normal flow, not an error)
4. **Existing user access**: `logInfo` (successful authorization)

### Performance Considerations

- Single query: `SELECT id` only (minimal data transfer)
- Server component: Runs once per page navigation
- No client-side re-renders
- Redirect happens before any dashboard content loads

---

## Testing Instructions

### Test 1: New OAuth User (No Profile)

```bash
# Setup
1. Create new Google account (or use one without profile)
2. Sign out from application completely
3. Clear browser cookies

# Test Flow
1. Navigate to http://localhost:3000/login
2. Click "Sign in with Google"
3. Complete OAuth consent
4. VERIFY: Redirected to /onboarding (not /dashboard)
5. Complete onboarding wizard
6. VERIFY: Redirected to /dashboard after profile creation
7. VERIFY: Dashboard loads normally
```

**Expected Logs:**
```
[INFO] New user redirected to onboarding
{
  userId: "...",
  metadata: { hasProfile: false, action: "redirect_onboarding" }
}
```

### Test 2: Existing User (Has Profile)

```bash
# Setup
1. Sign in as existing user (completed onboarding)

# Test Flow
1. Navigate to http://localhost:3000/dashboard
2. VERIFY: Dashboard loads immediately
3. VERIFY: No redirect to onboarding
```

**Expected Logs:**
```
[INFO] Dashboard access authorized
{
  userId: "...",
  metadata: { hasProfile: true, profileId: "..." }
}
```

### Test 3: Unauthenticated Access

```bash
# Setup
1. Sign out completely
2. Clear cookies

# Test Flow
1. Navigate directly to http://localhost:3000/dashboard
2. VERIFY: Redirected to /login
```

**Expected Logs:**
```
[WARN] Unauthenticated dashboard access
{
  metadata: { error: "No user session" }
}
```

### Test 4: Database Error Handling

```bash
# Simulate by temporarily breaking database connection
# (Advanced testing, optional)

# Verify: Existing users still see dashboard (graceful degradation)
```

---

## Acceptance Criteria

- [ ] Dashboard layout is async server component
- [ ] Authentication check redirects to `/login` if not authenticated
- [ ] Profile check queries `athlete_profiles.id` for current user
- [ ] Redirect to `/onboarding` if no profile exists
- [ ] Continue to dashboard if profile exists
- [ ] All logging uses `errorLogger` (no console.log)
- [ ] Error code `PGRST116` handled separately (not logged as error)
- [ ] TypeScript compiles without errors
- [ ] All test scenarios pass

---

## Rollback Plan

If issues occur, revert to original layout:

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-management/web
git checkout app/(dashboard)/layout.tsx
```

---

## Integration Points

### Depends On
- ✅ Supabase client (`@/lib/supabase/server`)
- ✅ Error logger (`@/lib/monitoring/error-logger`)
- ✅ Onboarding page (`/app/(dashboard)/onboarding/page.tsx`)
- ✅ athlete_profiles table (existing schema)

### Enables
- New OAuth users automatically redirected to onboarding
- Graceful handling of users without profiles
- Security logging for dashboard access

---

## Next Steps

After completing CARD_1:

1. ✅ Test all scenarios manually
2. ✅ Verify logs in browser console/server logs
3. ✅ Proceed to **CARD_2**: Google Metadata Helper

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-25

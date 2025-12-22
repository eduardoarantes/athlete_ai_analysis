# Google Login Integration Plan

**Project:** Cycling AI Analysis
**Feature:** Google OAuth 2.0 Social Login
**Status:** Planned
**Created:** 2025-12-22

---

## Executive Summary

This document outlines the plan to integrate Google OAuth 2.0 login into the Cycling AI Analysis web application. Since the application already uses **Supabase Auth** as the authentication provider (with Strava OAuth already functional), adding Google login leverages Supabase's native OAuth support with minimal code changes.

### Scope
- **In Scope:** Web application Google login (Next.js frontend)
- **Out of Scope:** CLI authentication (remains local/file-based)

### Estimated Effort
- **Google Cloud Setup:** 30 minutes
- **Supabase Configuration:** 15 minutes
- **Frontend Implementation:** 2-3 hours
- **Testing & Polish:** 1-2 hours
- **Total:** ~4-5 hours

---

## Current Architecture

### Existing Authentication Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Next.js Web    │───▶│  Supabase Auth  │───▶│   PostgreSQL    │
│  (Frontend)     │    │  (Identity)     │    │   (auth.users)  │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
         │                      │
    ┌────▼────┐            ┌────▼────┐
    │  Strava │            │  Email/ │
    │  OAuth  │            │  Pass   │
    └─────────┘            └─────────┘
```

### Target Architecture (After Google Integration)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Next.js Web    │───▶│  Supabase Auth  │───▶│   PostgreSQL    │
│  (Frontend)     │    │  (Identity)     │    │   (auth.users)  │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
    ┌────┼────┬────────────────┼────┐
    │    │    │                │    │
┌───▼──┐ │ ┌──▼───┐       ┌────▼────┐
│Strava│ │ │Google│       │ Email/  │
│OAuth │ │ │OAuth │       │ Password│
└──────┘ │ └──────┘       └─────────┘
         │
    (Future providers)
```

### Key Files (Existing Auth)

| File | Purpose |
|------|---------|
| `web/lib/supabase/client.ts` | Browser Supabase client |
| `web/lib/supabase/server.ts` | Server-side Supabase client |
| `web/lib/supabase/middleware.ts` | Session refresh middleware |
| `web/app/(auth)/login/page.tsx` | Login page |
| `web/app/(auth)/signup/page.tsx` | Signup page |
| `web/components/auth/login-form.tsx` | Login form component |
| `web/app/api/auth/strava/*` | Strava OAuth routes |

---

## Implementation Plan

### Phase 1: Google Cloud Platform Setup

#### 1.1 Create Google Cloud Project

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing project
3. Enable **Google+ API** and **Google Identity API**

**Project naming recommendation:** `cycling-ai-analysis-prod`

#### 1.2 Configure OAuth Consent Screen

**Location:** APIs & Services → OAuth consent screen

| Setting | Value |
|---------|-------|
| User Type | External (allows any Google account) |
| App Name | Cycling AI Analysis |
| User Support Email | your-email@example.com |
| App Logo | Upload cycling-ai logo (optional) |
| App Domain | Your production domain |
| Privacy Policy | https://yourdomain.com/privacy |
| Terms of Service | https://yourdomain.com/terms |

**Scopes Required:**
- `email` - User's email address
- `profile` - User's name and profile picture
- `openid` - OpenID Connect authentication

#### 1.3 Create OAuth 2.0 Credentials

**Location:** APIs & Services → Credentials → Create Credentials → OAuth client ID

| Setting | Value |
|---------|-------|
| Application Type | Web application |
| Name | Cycling AI Web Client |
| Authorized JavaScript Origins | See table below |
| Authorized Redirect URIs | See table below |

**Environment-Specific URLs:**

| Environment | JavaScript Origin | Redirect URI |
|-------------|-------------------|--------------|
| Local Development | `http://localhost:3000` | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| Staging | `https://staging.yourdomain.com` | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| Production | `https://yourdomain.com` | `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |

> **Important:** Supabase handles the OAuth callback, not your application directly.

**Output:** Save the `Client ID` and `Client Secret`

---

### Phase 2: Supabase Configuration

#### 2.1 Enable Google Provider

**Location:** Supabase Dashboard → Authentication → Providers → Google

| Setting | Value |
|---------|-------|
| Enable Sign in with Google | ON |
| Client ID | `<from Google Cloud Console>` |
| Client Secret | `<from Google Cloud Console>` |
| Authorized Client IDs | Leave empty (unless using Android/iOS) |

#### 2.2 Verify Redirect URL

**Location:** Supabase Dashboard → Authentication → URL Configuration

Confirm the **Site URL** matches your app's URL:
- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

**Redirect URLs** should include:
- `http://localhost:3000/**` (development)
- `https://yourdomain.com/**` (production)

#### 2.3 Email Confirmation Settings

**Location:** Supabase Dashboard → Authentication → Email Templates

**Recommended Settings for OAuth:**
- **Confirm email:** OFF for OAuth providers (Google already verifies emails)
- **Enable email confirmations:** Consider ON only for email/password signups

---

### Phase 3: Frontend Implementation

#### 3.1 Create Google Login Button Component

**New File:** `web/components/auth/google-login-button.tsx`

```tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface GoogleLoginButtonProps {
  mode?: 'login' | 'signup';
  redirectTo?: string;
  className?: string;
}

export function GoogleLoginButton({
  mode = 'login',
  redirectTo = '/dashboard',
  className,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google login error:', error);
        setError(error.message);
        setIsLoading(false);
      }
      // Note: On success, user is redirected to Google, so no need to handle success here
    } catch (err) {
      console.error('Unexpected error during Google login:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        onClick={handleGoogleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
      </Button>
      {error && (
        <p className="text-sm text-red-500 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
```

#### 3.2 Create OAuth Callback Handler

**New File:** `web/app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    );
  }

  if (code) {
    const supabase = await createClient();

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      );
    }

    // Successfully authenticated - redirect to intended destination
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // No code provided - redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

#### 3.3 Update Login Page

**File:** `web/app/(auth)/login/page.tsx`

Add Google button to login form. The integration depends on the existing component structure:

```tsx
// Add import
import { GoogleLoginButton } from '@/components/auth/google-login-button';

// In the component, add after the login form or in a dedicated section:
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">
      Or continue with
    </span>
  </div>
</div>

<GoogleLoginButton mode="login" />
```

#### 3.4 Update Signup Page

**File:** `web/app/(auth)/signup/page.tsx`

```tsx
// Add import
import { GoogleLoginButton } from '@/components/auth/google-login-button';

// In the component, add similar to login page:
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">
      Or sign up with
    </span>
  </div>
</div>

<GoogleLoginButton mode="signup" />
```

#### 3.5 Display OAuth Errors on Login Page

**File:** `web/app/(auth)/login/page.tsx`

Add error display from URL parameters:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {decodeURIComponent(error)}
        </div>
      )}
      {/* Rest of login form */}
    </div>
  );
}
```

---

### Phase 4: Profile Handling for OAuth Users

#### 4.1 Auto-Create Athlete Profile for New OAuth Users

When a user signs in with Google for the first time, they won't have an athlete profile. Handle this gracefully.

**Option A: Redirect to Onboarding (Recommended)**

**File:** `web/middleware.ts` or dashboard layout

```typescript
// After successful auth, check if user has profile
const { data: profile } = await supabase
  .from('athlete_profiles')
  .select('id')
  .eq('user_id', user.id)
  .single();

if (!profile) {
  // Redirect to profile setup/onboarding
  return NextResponse.redirect(new URL('/onboarding', request.url));
}
```

**Option B: Create Default Profile**

**New File:** `web/lib/hooks/use-ensure-profile.ts`

```typescript
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useEnsureProfile(userId: string) {
  useEffect(() => {
    async function ensureProfile() {
      const supabase = createClient();

      // Check if profile exists
      const { data: existing } = await supabase
        .from('athlete_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!existing) {
        // Create default profile
        await supabase.from('athlete_profiles').insert({
          user_id: userId,
          preferred_language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          units_system: 'metric',
          goals: [],
        });
      }
    }

    ensureProfile();
  }, [userId]);
}
```

#### 4.2 Handle User Metadata from Google

Google OAuth provides useful metadata that can pre-fill the profile:

**File:** `web/lib/services/profile-service.ts`

```typescript
import type { User } from '@supabase/supabase-js';

export function extractGoogleMetadata(user: User) {
  const metadata = user.user_metadata;

  return {
    full_name: metadata?.full_name || metadata?.name,
    avatar_url: metadata?.avatar_url || metadata?.picture,
    email: user.email,
  };
}
```

---

### Phase 5: Account Linking (Optional Enhancement)

#### 5.1 Link Google to Existing Email Account

If a user has an existing email/password account and wants to add Google login:

**File:** `web/components/settings/link-google-account.tsx`

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function LinkGoogleAccount() {
  const handleLinkGoogle = async () => {
    const supabase = createClient();

    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
    });

    if (error) {
      console.error('Error linking Google account:', error);
    }
  };

  return (
    <Button onClick={handleLinkGoogle} variant="outline">
      Link Google Account
    </Button>
  );
}
```

#### 5.2 Display Linked Accounts in Settings

**File:** `web/app/settings/account/page.tsx`

```typescript
// Fetch user identities
const { data: { user } } = await supabase.auth.getUser();
const identities = user?.identities || [];

// Display linked providers
const linkedProviders = identities.map(identity => identity.provider);
// linkedProviders might be: ['email', 'google', 'strava']
```

---

### Phase 6: Testing

#### 6.1 Manual Testing Checklist

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Google Login - New User | Click "Continue with Google" → Select Google account | User created in Supabase, redirected to dashboard/onboarding |
| Google Login - Existing User | Login with email, logout, login with same Google email | Same user session, no duplicate account |
| Google Login - Error Handling | Deny Google permissions | Error message displayed on login page |
| Google Login - Session Persistence | Login with Google, close browser, reopen | Session still active |
| Callback Error | Navigate to `/auth/callback` without code | Redirected to login with error |
| Mobile Testing | Test on mobile browser | Google OAuth popup/redirect works |

#### 6.2 Environment Testing Matrix

| Environment | Test URL | Expected Behavior |
|-------------|----------|-------------------|
| Local Development | http://localhost:3000/login | Google OAuth works with development credentials |
| Staging | https://staging.example.com/login | Google OAuth works with staging credentials |
| Production | https://example.com/login | Google OAuth works with production credentials |

#### 6.3 Automated Tests (Optional)

**File:** `web/tests/auth/google-login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Google Login', () => {
  test('displays Google login button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('initiates OAuth flow on click', async ({ page }) => {
    await page.goto('/login');

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button:has-text("Continue with Google")'),
    ]);

    // Verify redirected to Google
    expect(popup.url()).toContain('accounts.google.com');
  });
});
```

---

### Phase 7: Production Deployment

#### 7.1 Deployment Checklist

- [ ] Google Cloud Console: Move from "Testing" to "Production" status
- [ ] Google Cloud Console: Submit for OAuth verification (if using sensitive scopes)
- [ ] Supabase: Update Site URL to production domain
- [ ] Supabase: Add production redirect URLs
- [ ] Google Cloud Console: Add production URLs to authorized origins/redirects
- [ ] Verify environment variables in production deployment
- [ ] Test OAuth flow on production domain

#### 7.2 Google OAuth Verification

**Required for 100+ users:**
1. Add privacy policy and terms of service URLs
2. Add homepage URL
3. Submit for Google verification
4. Wait for approval (1-3 weeks)

**Not required if:**
- App is internal (Workspace domain only)
- Less than 100 users (with unverified warning)

#### 7.3 Environment Variables

**Required in production:**

```bash
# Already configured (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# No additional env vars needed for Google OAuth
# (Credentials are stored in Supabase dashboard, not in app)
```

---

## File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `web/components/auth/google-login-button.tsx` | Google login button component |
| `web/app/auth/callback/route.ts` | OAuth callback handler |
| `web/lib/hooks/use-ensure-profile.ts` | (Optional) Auto-create profile hook |
| `web/components/settings/link-google-account.tsx` | (Optional) Account linking component |

### Files to Modify

| File | Changes |
|------|---------|
| `web/app/(auth)/login/page.tsx` | Add GoogleLoginButton, error display |
| `web/app/(auth)/signup/page.tsx` | Add GoogleLoginButton |
| `web/middleware.ts` | (Optional) Add profile check redirect |
| `web/app/settings/account/page.tsx` | (Optional) Show linked accounts |

### No Changes Required

- Backend API (`src/cycling_ai/api/`) - JWT validation already works with all Supabase auth methods
- Database schema - `auth.users` already supports OAuth identities
- CLI - Remains local-only, no auth required

---

## Security Considerations

### OAuth Security Best Practices

1. **PKCE (Proof Key for Code Exchange):** Supabase uses PKCE by default for OAuth flows
2. **State Parameter:** Supabase handles CSRF protection via state parameter
3. **Token Storage:** JWT stored in HTTP-only cookies by Supabase
4. **Scope Minimization:** Only request `email`, `profile`, `openid` scopes

### Data Privacy

1. **Minimal Data Collection:** Only email and display name from Google
2. **No Third-Party Sharing:** Google data not shared beyond authentication
3. **User Control:** Users can unlink Google account, delete account

### Compliance

1. **GDPR:** Update privacy policy to mention Google OAuth
2. **Google's Policies:** Comply with Google API Services User Data Policy

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate:** Disable Google provider in Supabase dashboard (1 click)
2. **Code Rollback:** Revert frontend changes, redeploy
3. **User Communication:** Email affected users about temporary unavailability

**Note:** Existing email/password users are unaffected by Google OAuth issues.

---

## Future Enhancements

### Potential Additional OAuth Providers

| Provider | Use Case | Priority |
|----------|----------|----------|
| Apple | iOS users, privacy-focused | Medium |
| GitHub | Developer audience | Low |
| Facebook | Social reach | Low |
| Microsoft | Enterprise users | Low |

### Advanced Features

1. **Single Sign-On (SSO):** For team/enterprise accounts
2. **Multi-Factor Authentication:** Require MFA for sensitive actions
3. **Social Profile Import:** Import profile picture from Google
4. **One-Click Signup:** Skip onboarding for OAuth users with defaults

---

## Appendix

### A. Google OAuth Flow Diagram

```
User                    App                     Supabase                Google
 │                       │                         │                       │
 │──Click "Google"──────▶│                         │                       │
 │                       │──signInWithOAuth()─────▶│                       │
 │                       │                         │──Redirect─────────────▶│
 │                       │                         │                       │
 │◀────────────────────────────────────────────────────User Login───────────│
 │                       │                         │                       │
 │                       │                         │◀──Auth Code────────────│
 │                       │                         │                       │
 │                       │                         │──Exchange Code────────▶│
 │                       │                         │◀──Access Token─────────│
 │                       │                         │                       │
 │                       │◀──JWT + Redirect────────│                       │
 │◀──Redirect to app─────│                         │                       │
 │                       │                         │                       │
```

### B. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "redirect_uri_mismatch" | Google OAuth redirect URL doesn't match | Update Authorized redirect URIs in Google Console |
| "access_denied" | User denied permissions | Handle gracefully in callback |
| User not created | Supabase email confirmation ON | Disable for OAuth or auto-confirm |
| Infinite redirect loop | Callback not exchanging code | Check `exchangeCodeForSession` implementation |
| "invalid_client" | Wrong client ID/secret | Verify credentials in Supabase dashboard |

### C. References

- [Supabase Auth with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Next.js Authentication Patterns](https://nextjs.org/docs/app/building-your-application/authentication)

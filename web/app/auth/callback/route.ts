import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

/**
 * Handle OAuth callback for Google Login and other OAuth providers
 * GET /auth/callback?code=xxx&next=/path
 *
 * Extracts the authorization code from the query parameters and exchanges it
 * for a session. Supports custom redirect via 'next' parameter.
 *
 * Error handling:
 * - OAuth errors (from provider): Redirect to /login?error={description}
 * - Missing code: Redirect to /login?error=Invalid+callback+request
 * - Exchange errors: Redirect to /login?error={error.message}
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const searchParams = requestUrl.searchParams

  // Extract query parameters
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (error) {
    const errorMessage = errorDescription || 'Authentication failed'

    errorLogger.logWarning('OAuth error received in callback', {
      path: '/auth/callback',
      metadata: {
        error,
        errorDescription: errorDescription || 'none',
      },
    })

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
    )
  }

  // Validate code parameter exists
  if (!code) {
    errorLogger.logWarning('No code parameter in OAuth callback', {
      path: '/auth/callback',
      metadata: {
        queryParams: Object.fromEntries(searchParams.entries()),
      },
    })

    return NextResponse.redirect(
      new URL('/login?error=Invalid+callback+request', requestUrl.origin)
    )
  }

  // Exchange code for session
  try {
    const supabase = await createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      errorLogger.logError(new Error(exchangeError.message), {
        path: '/auth/callback',
        metadata: {
          error: exchangeError.message,
          phase: 'code_exchange',
        },
      })

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      )
    }

    // Log successful authentication
    const userId = data?.session?.user?.id
    errorLogger.logInfo('OAuth authentication successful', {
      userId,
      path: '/auth/callback',
      metadata: {
        hasSession: !!data?.session,
      },
    })

    // Check if user has a profile
    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('id')
      .eq('user_id', userId!)
      .single()

    // If no profile exists, redirect to onboarding
    if (!profile) {
      errorLogger.logInfo('New user without profile, redirecting to onboarding', {
        userId,
        path: '/auth/callback',
      })
      return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
    }

    // Determine redirect destination
    const redirectPath = getSafeRedirectPath(next)

    return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/auth/callback',
      metadata: {
        phase: 'code_exchange',
      },
    })

    return NextResponse.redirect(new URL('/login?error=Authentication+failed', requestUrl.origin))
  }
}

/**
 * Sanitize redirect path to prevent open redirects
 * Only allow relative paths starting with /
 */
function getSafeRedirectPath(next: string | null): string {
  // Default redirect
  if (!next) {
    return '/dashboard'
  }

  // Only allow relative paths (must start with / and not //)
  if (next.startsWith('/') && !next.startsWith('//')) {
    return next
  }

  // Reject external URLs or protocol-relative URLs
  return '/dashboard'
}

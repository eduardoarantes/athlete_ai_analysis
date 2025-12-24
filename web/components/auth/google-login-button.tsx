'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GoogleLoginButtonProps {
  mode?: 'login' | 'signup'
  redirectTo?: string
  className?: string
}

/**
 * GoogleLoginButton Component
 *
 * Handles Google OAuth authentication via Supabase Auth.
 * Supports both login and signup modes with customizable redirect URLs.
 *
 * @example
 * ```tsx
 * // Login mode (default)
 * <GoogleLoginButton />
 *
 * // Signup mode
 * <GoogleLoginButton mode="signup" />
 *
 * // Custom redirect
 * <GoogleLoginButton redirectTo="/onboarding" />
 * ```
 */
export function GoogleLoginButton({
  mode = 'login',
  redirectTo = '/dashboard',
  className,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        errorLogger.logError(oauthError as Error, {
          path: '/auth/google',
          metadata: {
            provider: 'google',
            mode,
          },
        })
        setIsLoading(false)
        return
      }

      // OAuth redirect will happen automatically via data.url
      // The browser will navigate to Google's OAuth consent screen
      if (!data.url) {
        throw new Error('No OAuth URL returned from Supabase')
      }

      errorLogger.logInfo('Google OAuth initiated', {
        metadata: {
          provider: 'google',
          mode,
        },
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect with Google'
      setError(errorMessage)
      errorLogger.logError(err as Error, {
        path: '/auth/google',
        metadata: {
          provider: 'google',
          mode,
        },
      })
      setIsLoading(false)
    }
  }

  const buttonText = mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'
  const loadingText = mode === 'signup' ? 'Signing up...' : 'Signing in...'

  return (
    <div className="space-y-4">
      <Button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        variant="outline"
        className={className}
        type="button"
      >
        <GoogleIcon />
        {isLoading ? loadingText : buttonText}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/**
 * Google Icon Component
 *
 * Official Google logo in 4-color SVG format.
 * Source: Google Brand Resources
 */
function GoogleIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  )
}

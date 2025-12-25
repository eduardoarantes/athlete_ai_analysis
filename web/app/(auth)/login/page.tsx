'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/forms/login-form'
import { GoogleLoginButton } from '@/components/auth/google-login-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

function LoginPageContent() {
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

  // Safely decode the OAuth error message
  let decodedError: string | null = null
  if (oauthError) {
    try {
      decodedError = decodeURIComponent(oauthError)
    } catch {
      // If decoding fails, use the raw error string
      decodedError = oauthError
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your Cycling AI account</CardDescription>
        </CardHeader>
        <CardContent>
          {decodedError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{decodedError}</AlertDescription>
            </Alert>
          )}

          <LoginForm />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                Or continue with
              </span>
            </div>
          </div>

          <GoogleLoginButton mode="login" className="w-full" />

          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}

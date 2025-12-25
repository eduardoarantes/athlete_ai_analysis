import Link from 'next/link'
import { SignupForm } from '@/components/forms/signup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleLoginButton } from '@/components/auth/google-login-button'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Start analyzing your cycling performance with AI</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                Or sign up with
              </span>
            </div>
          </div>

          <GoogleLoginButton mode="signup" className="w-full" />

          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

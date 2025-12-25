import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { errorLogger } from '@/lib/monitoring/error-logger'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (userError || !user) {
    redirect('/login')
  }

  // Check if user already has a profile - if so, redirect to dashboard
  const { data: profile, error: profileError } = await supabase
    .from('athlete_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Handle profile check errors (PGRST116 = no rows found, which is expected for new users)
  if (profileError && profileError.code !== 'PGRST116') {
    errorLogger.logError(new Error(profileError.message), {
      userId: user.id,
      path: '/onboarding',
      metadata: {
        errorCode: profileError.code,
        errorDetails: profileError.details,
      },
    })
    // Allow user to continue to onboarding even if check fails
  }

  if (profile) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      <main>{children}</main>
    </div>
  )
}

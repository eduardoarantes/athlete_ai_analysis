import { Navbar } from '@/components/layout/navbar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { errorLogger } from '@/lib/monitoring/error-logger'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Check if user has an athlete profile
  try {
    const { data: profile, error: profileError } = await supabase
      .from('athlete_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    // PGRST116 error code means "no rows found" - this is expected for new users
    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // No profile found - redirect to onboarding
        errorLogger.logInfo('User has no athlete profile, redirecting to onboarding', {
          userId: user.id,
          path: '/dashboard',
        })
        redirect('/onboarding')
      } else {
        // Actual error occurred (not "no rows found")
        errorLogger.logError(new Error(profileError.message), {
          userId: user.id,
          path: '/dashboard',
          metadata: {
            errorCode: profileError.code,
            errorDetails: profileError.details,
          },
        })
        throw new Error('Failed to check athlete profile')
      }
    }

    // Profile exists - log success and continue
    if (profile) {
      errorLogger.logInfo('User has athlete profile', {
        userId: user.id,
        path: '/dashboard',
        metadata: {
          profileId: profile.id,
        },
      })
    }
  } catch (error) {
    // Re-throw errors that aren't related to profile checks
    if (error instanceof Error && error.message === 'Failed to check athlete profile') {
      throw error
    }
    // Unexpected errors
    errorLogger.logError(error as Error, {
      userId: user.id,
      path: '/dashboard',
    })
    throw error
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

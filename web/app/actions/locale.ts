'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'
import type { Locale } from '@/lib/locale'

/**
 * Server action to update user's locale preference
 * - Saves to user profile if authenticated
 * - Saves to cookie for unauthenticated users
 * - Revalidates the page to apply new locale
 */
export async function updateUserLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies()

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Save to cookie (for unauthenticated users and as fallback)
  cookieStore.set('NEXT_LOCALE', locale, {
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/',
  })

  // If user is authenticated, also update their profile
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase
      .from('athlete_profiles')
      .update({ preferred_language: locale })
      .eq('user_id', user.id)
  }

  // Revalidate the current path to apply the new locale
  revalidatePath('/', 'layout')
}

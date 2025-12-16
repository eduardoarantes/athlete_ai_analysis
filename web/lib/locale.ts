import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const locales = ['en', 'pt', 'es', 'fr'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

/**
 * Gets the user's preferred locale from:
 * 1. User profile in database (if authenticated)
 * 2. Cookie (if set)
 * 3. Browser language (from Accept-Language header)
 * 4. Default locale
 */
export async function getUserLocale(): Promise<Locale> {
  const cookieStore = await cookies()

  // Create Supabase client to check if user is authenticated
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

  // Try to get from user profile
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('preferred_language')
      .eq('user_id', user.id)
      .single()

    if (profile?.preferred_language && locales.includes(profile.preferred_language as Locale)) {
      return profile.preferred_language as Locale
    }
  }

  // Try to get from cookie
  const localeCookie = cookieStore.get('NEXT_LOCALE')
  if (localeCookie?.value && locales.includes(localeCookie.value as Locale)) {
    return localeCookie.value as Locale
  }

  // Try to get from Accept-Language header
  const acceptLanguage = cookieStore.get('accept-language')?.value
  if (acceptLanguage) {
    const browserLang = acceptLanguage.split(',')[0]?.split('-')[0]
    if (browserLang && locales.includes(browserLang as Locale)) {
      return browserLang as Locale
    }
  }

  // Default
  return defaultLocale
}

/**
 * Sets the user's locale preference in a cookie
 */
export async function setUserLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('NEXT_LOCALE', locale, {
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/',
  })
}

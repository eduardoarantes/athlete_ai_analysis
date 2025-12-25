import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'
import getConfig from 'next/config'

// Get server runtime config (embedded at build time in next.config.ts)
const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} }

// Get Supabase config - try env vars first (local dev), then serverRuntimeConfig (Amplify SSR)
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || serverRuntimeConfig?.supabaseUrl
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || serverRuntimeConfig?.supabaseAnonKey

  if (!url || !anonKey) {
    throw new Error(
      `Supabase config missing. URL: ${url ? 'set' : 'missing'}, ANON_KEY: ${anonKey ? 'set' : 'missing'}`
    )
  }

  return { url, anonKey }
}

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseConfig()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

/**
 * Get Supabase service role config for server-side operations that bypass RLS
 * Used for webhooks and background jobs that don't have a user session
 */
function getSupabaseServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || serverRuntimeConfig?.supabaseUrl
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || serverRuntimeConfig?.supabaseServiceRoleKey

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Supabase service config missing. URL: ${url ? 'set' : 'missing'}, SERVICE_ROLE_KEY: ${serviceRoleKey ? 'set' : 'missing'}. ` +
        'Set SUPABASE_SERVICE_ROLE_KEY environment variable for webhook operations.'
    )
  }

  return { url, serviceRoleKey }
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

/**
 * Create a Supabase client with service role key that bypasses RLS
 * USE WITH CAUTION: This client has full database access
 *
 * Use cases:
 * - Webhook handlers (no user session available)
 * - Background jobs
 * - Admin operations
 */
export function createServiceClient() {
  const { url, serviceRoleKey } = getSupabaseServiceConfig()

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

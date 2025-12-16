/**
 * Admin Guard Utility
 *
 * Server-side authorization check for admin routes.
 * Uses Supabase is_admin() function to check user role from JWT.
 *
 * Usage:
 *   import { requireAdmin } from '@/lib/guards/admin-guard'
 *
 *   export async function GET(request: Request) {
 *     const supabase = createClient()
 *     const auth = await requireAdmin(supabase)
 *
 *     if (!auth.authorized) {
 *       return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
 *     }
 *
 *     // Admin-only logic here
 *   }
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { errorLogger } from '@/lib/monitoring/error-logger'

/**
 * Admin authorization result
 */
export interface AdminAuthResult {
  /** Whether user is authorized as admin */
  authorized: boolean
  /** User ID (if authenticated) */
  userId: string | null
  /** User role from JWT */
  role: string | null
  /** Error message (if not authorized) */
  error?: string
}

/**
 * Check if current user has admin role
 *
 * This function:
 * 1. Checks if user is authenticated
 * 2. Calls Supabase is_admin() function to check role
 * 3. Logs the authorization attempt
 * 4. Returns authorization result
 *
 * @param supabase - Supabase client (server-side)
 * @returns Authorization result
 *
 * @example
 * ```typescript
 * const auth = await requireAdmin(supabase)
 * if (!auth.authorized) {
 *   return NextResponse.json({ error: auth.error }, { status: 403 })
 * }
 * ```
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<AdminAuthResult> {
  try {
    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      errorLogger.logWarning('Admin check: User not authenticated', {
        metadata: { authError: authError?.message },
      })

      return {
        authorized: false,
        userId: null,
        role: null,
        error: 'Authentication required',
      }
    }

    // Call Supabase is_admin() function
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')

    if (roleError) {
      errorLogger.logError(roleError as Error, {
        userId: user.id,
        path: '/lib/guards/admin-guard',
        metadata: { function: 'is_admin' },
      })

      return {
        authorized: false,
        userId: user.id,
        role: null,
        error: 'Failed to check admin role',
      }
    }

    // Get role from JWT metadata
    const role = (user.user_metadata?.role as string) || 'user'

    // Log authorization attempt
    if (isAdmin) {
      errorLogger.logInfo('Admin access granted', {
        userId: user.id,
        metadata: { role, email: user.email },
      })
    } else {
      errorLogger.logWarning('Admin access denied', {
        userId: user.id,
        metadata: { role, email: user.email },
      })
    }

    // Return result without error property if admin (exactOptionalPropertyTypes compliance)
    if (isAdmin === true) {
      return {
        authorized: true,
        userId: user.id,
        role,
      }
    }

    return {
      authorized: false,
      userId: user.id,
      role,
      error: 'Admin role required',
    }
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/lib/guards/admin-guard',
      metadata: { function: 'requireAdmin' },
    })

    return {
      authorized: false,
      userId: null,
      role: null,
      error: 'Authorization check failed',
    }
  }
}

/**
 * Check if current user has admin role (boolean only)
 *
 * Simplified version that returns only boolean result.
 * Use requireAdmin() if you need detailed authorization info.
 *
 * @param supabase - Supabase client (server-side)
 * @returns True if user is admin, false otherwise
 *
 * @example
 * ```typescript
 * const isAdmin = await checkAdmin(supabase)
 * if (!isAdmin) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 * }
 * ```
 */
export async function checkAdmin(supabase: SupabaseClient): Promise<boolean> {
  const result = await requireAdmin(supabase)
  return result.authorized
}

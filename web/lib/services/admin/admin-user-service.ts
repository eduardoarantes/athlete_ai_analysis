/**
 * Admin User Service
 *
 * Replaces PostgreSQL stored procedures with TypeScript:
 * - get_admin_users() → queryUsers()
 * - get_admin_user_by_id() → getUserById()
 * - get_admin_users_count() → countUsers()
 *
 * Queries admin_user_view directly using Supabase query builder.
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { AdminUser, AdminUserRow, AdminUserFilters } from '@/lib/types/admin'

// Re-export the transform function for convenience
export { transformAdminUserRow } from '@/lib/types/admin'

// =============================================================================
// Types
// =============================================================================

/**
 * Query parameters for admin user search
 */
export interface AdminUserQueryParams extends AdminUserFilters {
  limit?: number
  offset?: number
}

// =============================================================================
// Admin User Service
// =============================================================================

export class AdminUserService {
  /**
   * Query users with filters and pagination
   *
   * Replaces: get_admin_users(search_query, role_filter, subscription_filter, strava_filter, limit_count, offset_count)
   *
   * @param params Query parameters (search, role, subscription, strava, limit, offset)
   * @returns Array of AdminUser objects
   * @throws Error if database query fails
   */
  async queryUsers(params: AdminUserQueryParams): Promise<AdminUser[]> {
    try {
      const { search, role, subscription, strava, limit = 50, offset = 0 } = params

      const supabase = await createClient()

      // Start query
      let query = supabase.from('admin_user_view').select('*')

      // Apply search filter (email, first_name, last_name - case-insensitive)
      // Sanitize input to prevent PostgREST injection
      if (search) {
        const sanitized = search.replace(/[^a-zA-Z0-9@.\-\s]/g, '')
        query = query.or(
          `email.ilike.%${sanitized}%,first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%`
        )
      }

      // Apply role filter
      if (role) {
        query = query.eq('role', role)
      }

      // Apply subscription filter
      if (subscription) {
        query = query.eq('plan_name', subscription)
      }

      // Apply Strava filter
      if (strava !== undefined) {
        query = query.eq('strava_connected', strava)
      }

      // Apply ordering (DESC by account_created_at)
      query = query.order('account_created_at', { ascending: false })

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error } = await query

      if (error) {
        errorLogger.logError(error as Error, {
          path: 'AdminUserService.queryUsers',
          metadata: { params },
        })
        throw new Error('Failed to query admin users')
      }

      // Transform flat rows to nested AdminUser structure
      const { transformAdminUserRows } = await import('@/lib/types/admin')
      return transformAdminUserRows((data || []) as AdminUserRow[])
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'AdminUserService.queryUsers',
        metadata: { params },
      })
      throw error
    }
  }

  /**
   * Get a single user by ID
   *
   * Replaces: get_admin_user_by_id(target_user_id)
   *
   * @param userId User ID to query
   * @returns AdminUser object or null if not found
   * @throws Error if database query fails (except for not found)
   */
  async getUserById(userId: string): Promise<AdminUser | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('admin_user_view')
        .select('*')
        .eq('user_id', userId)
        .single()

      // Handle not found
      if (error && error.code === 'PGRST116') {
        return null
      }

      if (error) {
        errorLogger.logError(error as Error, {
          path: 'AdminUserService.getUserById',
          metadata: { userId },
        })
        throw new Error('Failed to get admin user by ID')
      }

      if (!data) {
        return null
      }

      // Transform flat row to nested AdminUser structure
      const { transformAdminUserRow } = await import('@/lib/types/admin')
      return transformAdminUserRow(data as AdminUserRow)
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'AdminUserService.getUserById',
        metadata: { userId },
      })
      throw error
    }
  }

  /**
   * Count users matching filters
   *
   * Replaces: get_admin_users_count(search_query, role_filter, subscription_filter, strava_filter)
   *
   * @param params Query parameters (search, role, subscription, strava)
   * @returns Total count of users matching filters
   * @throws Error if database query fails
   */
  async countUsers(params: AdminUserFilters): Promise<number> {
    try {
      const { search, role, subscription, strava } = params

      const supabase = await createClient()

      // Start query
      let query = supabase.from('admin_user_view').select('*', { count: 'exact', head: true })

      // Apply search filter (email, first_name, last_name - case-insensitive)
      // Sanitize input to prevent PostgREST injection
      if (search) {
        const sanitized = search.replace(/[^a-zA-Z0-9@.\-\s]/g, '')
        query = query.or(
          `email.ilike.%${sanitized}%,first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%`
        )
      }

      // Apply role filter
      if (role) {
        query = query.eq('role', role)
      }

      // Apply subscription filter
      if (subscription) {
        query = query.eq('plan_name', subscription)
      }

      // Apply Strava filter
      if (strava !== undefined) {
        query = query.eq('strava_connected', strava)
      }

      const { count, error } = await query

      if (error) {
        errorLogger.logError(error as Error, {
          path: 'AdminUserService.countUsers',
          metadata: { params },
        })
        throw new Error('Failed to count admin users')
      }

      return count || 0
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'AdminUserService.countUsers',
        metadata: { params },
      })
      throw error
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Singleton instance of AdminUserService
 * Use this for all admin user queries
 */
export const adminUserService = new AdminUserService()

/**
 * Admin Stats Service
 *
 * Replaces PostgreSQL stored procedure with TypeScript:
 * - get_admin_stats() → getStats()
 *
 * Queries admin_stats_view directly using Supabase query builder.
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { AdminStats, AdminStatsRow } from '@/lib/types/admin'

// Re-export the transform function for convenience
export { transformAdminStatsRow } from '@/lib/types/admin'

// =============================================================================
// Admin Stats Service
// =============================================================================

export class AdminStatsService {
  /**
   * Get platform-wide statistics
   *
   * Replaces: get_admin_stats()
   *
   * @returns AdminStats object with platform statistics
   * @throws Error if database query fails or no data is returned
   */
  async getStats(): Promise<AdminStats> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.from('admin_stats_view').select('*').single()

      if (error) {
        errorLogger.logError(error as Error, {
          path: 'AdminStatsService.getStats',
        })
        throw new Error('Failed to fetch admin stats')
      }

      if (!data) {
        throw new Error('No stats data returned from view')
      }

      // Transform flat row to nested AdminStats structure
      const { transformAdminStatsRow } = await import('@/lib/types/admin')
      return transformAdminStatsRow(data as AdminStatsRow)
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'AdminStatsService.getStats',
      })
      throw error
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Singleton instance of AdminStatsService
 * Use this for all admin stats queries
 */
export const adminStatsService = new AdminStatsService()

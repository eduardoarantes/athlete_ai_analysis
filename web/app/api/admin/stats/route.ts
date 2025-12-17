/**
 * Admin Platform Statistics API
 *
 * GET /api/admin/stats
 *
 * Returns platform-wide statistics for admin dashboard.
 * Requires admin authentication.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { transformAdminStatsRow } from '@/lib/types/admin'
import type { AdminStatsRow } from '@/lib/types/admin'
import { HTTP_STATUS, MESSAGES } from '@/lib/constants'

/**
 * GET /api/admin/stats
 *
 * No parameters required.
 *
 * Response:
 * {
 *   users: { total, last_7_days, last_30_days, active_7_days, active_30_days },
 *   subscriptions: { active, suspended, cancelled, expired, by_plan: {...} },
 *   strava: { total_connections, successful_syncs, failed_syncs, syncs_last_24h },
 *   content: { total_profiles, total_activities, ... }
 * }
 */
export async function GET() {
  try {
    // 1. Check admin authentication
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)

    if (!auth.authorized) {
      errorLogger.logWarning('Admin stats access denied', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/stats',
        method: 'GET',
        metadata: { reason: auth.error },
      })

      return NextResponse.json(
        { error: auth.error || MESSAGES.UNAUTHORIZED },
        { status: auth.userId ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // 2. Call database function to get statistics
    const { data: statsData, error: statsError } = await supabase.rpc('get_admin_stats' as never)

    if (statsError) {
      errorLogger.logError(new Error(`get_admin_stats failed: ${statsError.message}`), {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/stats',
        method: 'GET',
        metadata: { dbError: statsError },
      })

      return NextResponse.json(
        { error: MESSAGES.ADMIN_STATS_FETCH_FAILED },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // 3. Check if stats data exists
    const dataArray = statsData as AdminStatsRow[] | null
    if (!dataArray || dataArray.length === 0) {
      errorLogger.logWarning('Admin stats returned empty result', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/stats',
      })

      return NextResponse.json(
        { error: MESSAGES.ADMIN_STATS_FETCH_FAILED },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // 4. Transform database row to AdminStats object
    const stats = transformAdminStatsRow(dataArray[0]!)

    // 5. Log successful access
    errorLogger.logInfo('Admin stats accessed', {
      ...(auth.userId && { userId: auth.userId }),
      metadata: {
        totalUsers: stats.users.total,
        activeSubscriptions: stats.subscriptions.active,
        stravaConnections: stats.strava.total_connections,
      },
    })

    // 6. Return statistics
    return NextResponse.json(stats)
  } catch (error) {
    // Catch-all error handler
    errorLogger.logError(error as Error, {
      path: '/api/admin/stats',
      method: 'GET',
      metadata: { phase: 'unexpected' },
    })

    return NextResponse.json(
      { error: MESSAGES.INTERNAL_SERVER_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

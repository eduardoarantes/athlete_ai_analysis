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
import { adminStatsService } from '@/lib/services/admin'
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

    // 2. Get statistics using TypeScript service
    let stats
    try {
      stats = await adminStatsService.getStats()
    } catch (error) {
      errorLogger.logError(error as Error, {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/stats',
        method: 'GET',
      })

      return NextResponse.json(
        { error: MESSAGES.ADMIN_STATS_FETCH_FAILED },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // 3. Log successful access
    errorLogger.logInfo('Admin stats accessed', {
      ...(auth.userId && { userId: auth.userId }),
      metadata: {
        totalUsers: stats.users.total,
        activeSubscriptions: stats.subscriptions.active,
        stravaConnections: stats.strava.total_connections,
      },
    })

    // 4. Return statistics
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

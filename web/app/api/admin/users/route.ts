/**
 * Admin Users List API
 *
 * GET /api/admin/users
 *
 * Returns paginated list of users with filtering options.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { validateAdminUsersQuery } from '@/lib/validations/admin'
import { adminUserService } from '@/lib/services/admin'
import { HTTP_STATUS, MESSAGES } from '@/lib/constants'

/**
 * GET /api/admin/users
 *
 * Query parameters:
 * - search?: string - Search by email or name
 * - role?: 'user' | 'admin' - Filter by role
 * - subscription?: string - Filter by plan name
 * - strava?: boolean - Filter by Strava connection
 * - limit?: number - Items per page (default: 20, max: 100)
 * - offset?: number - Pagination offset (default: 0)
 *
 * Response:
 * {
 *   users: AdminUser[],
 *   pagination: { limit, offset, total }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Check admin authentication
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)

    if (!auth.authorized) {
      errorLogger.logWarning('Admin users list access denied', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users',
        method: 'GET',
        metadata: { reason: auth.error },
      })

      return NextResponse.json(
        { error: auth.error || MESSAGES.UNAUTHORIZED },
        { status: auth.userId ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // 2. Validate and parse query parameters
    const { searchParams } = new URL(request.url)
    let queryParams

    try {
      queryParams = validateAdminUsersQuery(searchParams)
    } catch (error) {
      errorLogger.logWarning('Invalid admin users query parameters', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users',
        metadata: { error: (error as Error).message },
      })

      return NextResponse.json(
        {
          error: MESSAGES.VALIDATION_FAILED,
          details: error instanceof Error ? error.message : 'Invalid query parameters',
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // 3. Query users using TypeScript service
    let users
    let totalCount
    try {
      // Build query params, only including defined values
      const queryFilters = {
        ...(queryParams.search && { search: queryParams.search }),
        ...(queryParams.role && { role: queryParams.role }),
        ...(queryParams.subscription && { subscription: queryParams.subscription }),
        ...(queryParams.strava !== undefined && { strava: queryParams.strava }),
        limit: queryParams.limit,
        offset: queryParams.offset,
      }

      const countFilters = {
        ...(queryParams.search && { search: queryParams.search }),
        ...(queryParams.role && { role: queryParams.role }),
        ...(queryParams.subscription && { subscription: queryParams.subscription }),
        ...(queryParams.strava !== undefined && { strava: queryParams.strava }),
      }

      users = await adminUserService.queryUsers(queryFilters)
      totalCount = await adminUserService.countUsers(countFilters)
    } catch (error) {
      errorLogger.logError(error as Error, {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users',
        method: 'GET',
        metadata: { query: queryParams },
      })

      return NextResponse.json(
        { error: MESSAGES.ADMIN_USERS_FETCH_FAILED },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // 4. Log successful access
    errorLogger.logInfo('Admin users list accessed', {
      ...(auth.userId && { userId: auth.userId }),
      metadata: {
        filters: {
          search: queryParams.search,
          role: queryParams.role,
          subscription: queryParams.subscription,
          strava: queryParams.strava,
        },
        pagination: {
          limit: queryParams.limit,
          offset: queryParams.offset,
        },
        resultCount: users.length,
        totalCount,
      },
    })

    // 5. Return response
    return NextResponse.json({
      users,
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset,
        total: totalCount,
      },
    })
  } catch (error) {
    // Catch-all error handler
    errorLogger.logError(error as Error, {
      path: '/api/admin/users',
      method: 'GET',
      metadata: { phase: 'unexpected' },
    })

    return NextResponse.json(
      { error: MESSAGES.INTERNAL_SERVER_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

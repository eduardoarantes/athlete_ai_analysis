import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { jobService } from '@/lib/services/job-service'
import { executeStravaSyncJob } from '@/lib/jobs/strava-sync-job'
import { StravaSyncService } from '@/lib/services/strava-sync-service'
import type { StravaSyncJobPayload } from '@/lib/types/jobs'
import { STRAVA_SYNC, HTTP_STATUS, MESSAGES } from '@/lib/constants'
import { rateLimiters, getClientIdentifier } from '@/lib/rate-limit'

/**
 * Sync activities from Strava (Background Job)
 * POST /api/strava/sync
 *
 * Triggers an async background job using Vercel waitUntil()
 * Returns immediately with job ID for status polling
 *
 * Optional query parameters:
 * - after: Unix timestamp - only sync activities after this date
 * - perPage: Number of activities per page (default: 30, max: 200)
 * - maxPages: Maximum pages to fetch (default: unlimited)
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Check rate limit
    const clientId = getClientIdentifier(user.id, request.headers.get('x-forwarded-for'))
    const rateLimit = rateLimiters.stravaSync.check(clientId)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many sync requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        {
          status: 429, // Too Many Requests
          headers: {
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.reset),
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
          },
        }
      )
    }

    // Atomically check and set sync status to 'syncing'
    // This prevents race conditions where multiple requests could start sync simultaneously
    // The UPDATE will only succeed if sync_status is NOT already 'syncing'
    // Valid values per DB constraint: 'pending', 'syncing', 'success', 'error'
    const { data: updateResult } = await supabase
      .from('strava_connections')
      .update({ sync_status: 'syncing' })
      .eq('user_id', user.id)
      .neq('sync_status', 'syncing')
      .select('id')
      .single<{ id: string }>()

    // If updateResult is null, the update failed (likely sync already in progress or no connection)
    if (!updateResult) {
      // Check if the connection exists at all
      const { data: connection } = await supabase
        .from('strava_connections')
        .select('sync_status')
        .eq('user_id', user.id)
        .single<{ sync_status: string }>()

      if (!connection) {
        return NextResponse.json(
          { error: MESSAGES.STRAVA_NOT_CONNECTED },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
      }

      // Connection exists but sync is already in progress
      return NextResponse.json(
        {
          error: MESSAGES.SYNC_IN_PROGRESS,
          message: MESSAGES.SYNC_IN_PROGRESS_MESSAGE,
        },
        {
          status: HTTP_STATUS.CONFLICT,
          headers: {
            'Retry-After': String(STRAVA_SYNC.RETRY_AFTER_SECONDS),
          },
        }
      )
    }

    try {
      // Parse and validate query parameters
      const { searchParams } = new URL(request.url)

      const syncOptions: {
        after?: number
        perPage?: number
        maxPages?: number
      } = {}

      const afterParam = searchParams.get('after')
      if (afterParam) {
        const after = parseInt(afterParam, 10)
        if (isNaN(after) || after < 0) {
          return NextResponse.json(
            { error: 'after must be a positive Unix timestamp' },
            { status: 400 }
          )
        }
        syncOptions.after = after
      }

      const perPageParam = searchParams.get('perPage')
      if (perPageParam) {
        const perPage = parseInt(perPageParam, 10)
        if (
          isNaN(perPage) ||
          perPage < STRAVA_SYNC.MIN_ACTIVITIES_PER_PAGE ||
          perPage > STRAVA_SYNC.MAX_ACTIVITIES_PER_PAGE
        ) {
          return NextResponse.json(
            {
              error: `perPage must be between ${STRAVA_SYNC.MIN_ACTIVITIES_PER_PAGE} and ${STRAVA_SYNC.MAX_ACTIVITIES_PER_PAGE}`,
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }
        syncOptions.perPage = perPage
      } else {
        syncOptions.perPage = STRAVA_SYNC.DEFAULT_ACTIVITIES_PER_PAGE
      }

      const maxPagesParam = searchParams.get('maxPages')
      if (maxPagesParam) {
        const maxPages = parseInt(maxPagesParam, 10)
        if (
          isNaN(maxPages) ||
          maxPages < STRAVA_SYNC.MIN_PAGES_LIMIT ||
          maxPages > STRAVA_SYNC.MAX_PAGES_LIMIT
        ) {
          return NextResponse.json(
            {
              error: `maxPages must be between ${STRAVA_SYNC.MIN_PAGES_LIMIT} and ${STRAVA_SYNC.MAX_PAGES_LIMIT}`,
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }
        syncOptions.maxPages = maxPages
      }

      // Create job record
      const payload: StravaSyncJobPayload = {
        userId: user.id,
        syncOptions,
      }

      const jobId = await jobService.createJob({
        userId: user.id,
        type: 'strava_sync',
        payload: payload as Record<string, unknown>,
        maxAttempts: 3,
      })

      // Execute sync in background using Vercel waitUntil()
      // This allows the function to return immediately while the sync continues
      waitUntil(
        executeStravaSyncJob(jobId, payload).catch((error) => {
          console.error(`[API] Background job ${jobId} failed:`, error)
          // Error is already handled in executeStravaSyncJob
        })
      )

      // Return immediately with job ID (202 Accepted)
      return NextResponse.json(
        {
          success: true,
          message: MESSAGES.SYNC_STARTED,
          jobId,
          statusUrl: `/api/strava/sync/status/${jobId}`,
        },
        {
          status: HTTP_STATUS.ACCEPTED,
          headers: {
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.reset),
          },
        }
      )
    } catch (jobError) {
      // Failed to create job or start background task
      // Release the lock by setting status back to 'error'
      console.error('[API] Failed to create sync job:', jobError)

      await supabase
        .from('strava_connections')
        .update({
          sync_status: 'error',
          sync_error:
            jobError instanceof Error
              ? jobError.message
              : 'Failed to start sync job',
        })
        .eq('user_id', user.id)

      throw jobError // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('[API] Sync error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : MESSAGES.FAILED_TO_START_SYNC,
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * Get sync status
 * GET /api/strava/sync
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Get sync status and activity count
    const { data: connection } = await supabase
      .from('strava_connections')
      .select('sync_status, sync_error, last_sync_at')
      .eq('user_id', user.id)
      .single<{
        sync_status: string
        sync_error: string | null
        last_sync_at: string | null
      }>()

    if (!connection) {
      return NextResponse.json(
        { error: 'Strava not connected' },
        { status: 400 }
      )
    }

    const syncService = new StravaSyncService()
    const activityCount = await syncService.getActivityCount(user.id)

    return NextResponse.json({
      syncStatus: connection.sync_status,
      syncError: connection.sync_error,
      lastSyncAt: connection.last_sync_at,
      activityCount,
    })
  } catch (error) {
    console.error('Get sync status error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

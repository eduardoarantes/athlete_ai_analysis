import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { jobService } from '@/lib/services/job-service'
import { executeStravaSyncJob } from '@/lib/jobs/strava-sync-job'
import type { StravaSyncJobPayload } from '@/lib/types/jobs'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Atomically check and set sync status to 'in_progress'
    // This prevents race conditions where multiple requests could start sync simultaneously
    // The UPDATE will only succeed if sync_status is NOT already 'in_progress'
    const { data: updateResult, count } = await supabase
      .from('strava_connections')
      .update({ sync_status: 'in_progress' })
      .eq('user_id', user.id)
      .neq('sync_status', 'in_progress')
      .select('id')
      .single<{ id: string }>()

    // If count is 0, it means sync_status was already 'in_progress'
    if (!updateResult || count === 0) {
      // Check if the connection exists at all
      const { data: connection } = await supabase
        .from('strava_connections')
        .select('sync_status')
        .eq('user_id', user.id)
        .single<{ sync_status: string }>()

      if (!connection) {
        return NextResponse.json(
          { error: 'Strava not connected. Please connect your Strava account first.' },
          { status: 400 }
        )
      }

      // Connection exists but sync is already in progress
      return NextResponse.json(
        {
          error: 'Sync already in progress',
          message: 'Another sync operation is currently running. Please wait for it to complete.',
        },
        {
          status: 409,
          headers: {
            'Retry-After': '30', // Suggest retry after 30 seconds
          },
        }
      )
    }

    try {
      // Parse query parameters
      const { searchParams } = new URL(request.url)
      const afterParam = searchParams.get('after')
      const perPageParam = searchParams.get('perPage')
      const maxPagesParam = searchParams.get('maxPages')

      const syncOptions: {
        after?: number
        perPage?: number
        maxPages?: number
      } = {}

      if (afterParam) {
        syncOptions.after = parseInt(afterParam)
      }
      if (perPageParam) {
        syncOptions.perPage = Math.min(parseInt(perPageParam), 200)
      } else {
        syncOptions.perPage = 30
      }
      if (maxPagesParam) {
        syncOptions.maxPages = parseInt(maxPagesParam)
      }

      // Create job record
      const payload: StravaSyncJobPayload = {
        userId: user.id,
        syncOptions,
      }

      const jobId = await jobService.createJob({
        userId: user.id,
        type: 'strava_sync',
        payload: payload as unknown as Record<string, unknown>,
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
          message: 'Sync started in background',
          jobId,
          statusUrl: `/api/strava/sync/status/${jobId}`,
        },
        { status: 202 } // 202 Accepted - request accepted, processing async
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
        error: error instanceof Error ? error.message : 'Failed to start sync',
      },
      { status: 500 }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

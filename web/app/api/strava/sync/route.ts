import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaSyncService } from '@/lib/services/strava-sync-service'

/**
 * Sync activities from Strava
 * POST /api/strava/sync
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

    // Check if user has a Strava connection
    const { data: connection } = await supabase
      .from('strava_connections')
      .select('id, sync_status')
      .eq('user_id', user.id)
      .single<{ id: string; sync_status: string }>()

    if (!connection) {
      return NextResponse.json(
        { error: 'Strava not connected' },
        { status: 400 }
      )
    }

    // Check if sync is already in progress
    if (connection.sync_status === 'in_progress') {
      return NextResponse.json(
        { error: 'Sync already in progress' },
        { status: 409 }
      )
    }

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

    // Start sync in background
    const syncService = new StravaSyncService()

    // Note: In production, this should be done in a background job
    // For now, we'll await it but consider implementing a job queue
    const result = await syncService.syncActivities(user.id, syncOptions)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Sync failed',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activitiesSynced: result.activitiesSynced,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync activities',
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

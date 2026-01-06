/**
 * API Route: GET /api/strava/streams/[activityId]
 *
 * Fetches activity streams (power, HR, time, cadence) from Strava API.
 * Requires authenticated user with Strava connection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'
import { errorLogger } from '@/lib/monitoring/error-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const { activityId } = await params

    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 })
    }

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional keys parameter (defaults to power, HR, time, cadence)
    const url = new URL(request.url)
    const keysParam = url.searchParams.get('keys')
    const keys = keysParam ? keysParam.split(',') : ['time', 'watts', 'heartrate', 'cadence']

    // Fetch streams from Strava
    const stravaService = await StravaService.create()
    const streams = await stravaService.getActivityStreamsWithRefresh(user.id, activityId, keys)

    // Return raw stream data
    return NextResponse.json({
      activityId,
      streams,
      // Include extracted arrays for convenience
      powerStream: streams.watts?.data || null,
      heartrateStream: streams.heartrate?.data || null,
      timeStream: streams.time?.data || null,
      cadenceStream: streams.cadence?.data || null,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/strava/streams/[activityId]',
      method: 'GET',
    })

    const message = error instanceof Error ? error.message : 'Failed to fetch activity streams'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

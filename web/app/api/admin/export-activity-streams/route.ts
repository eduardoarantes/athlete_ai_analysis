/**
 * Admin API Route: GET /api/admin/export-activity-streams
 *
 * Exports activity streams for test fixtures.
 * Requires authenticated admin user.
 *
 * Usage: GET /api/admin/export-activity-streams?activityIds=123,456,789
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'
import { errorLogger } from '@/lib/monitoring/error-logger'

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get activity IDs from query params
    const url = new URL(request.url)
    const activityIdsParam = url.searchParams.get('activityIds')

    if (!activityIdsParam) {
      return NextResponse.json(
        { error: 'activityIds parameter is required (comma-separated)' },
        { status: 400 }
      )
    }

    const activityIds = activityIdsParam.split(',').map((id) => id.trim())

    // Fetch streams for each activity
    const stravaService = await StravaService.create()
    const results: Record<
      string,
      {
        activityId: string
        powerStream: number[] | null
        heartrateStream: number[] | null
        timeStream: number[] | null
        cadenceStream: number[] | null
        error?: string
      }
    > = {}

    for (const activityId of activityIds) {
      try {
        const streams = await stravaService.getActivityStreamsWithRefresh(user.id, activityId, [
          'time',
          'watts',
          'heartrate',
          'cadence',
        ])

        results[activityId] = {
          activityId,
          powerStream: streams.watts?.data || null,
          heartrateStream: streams.heartrate?.data || null,
          timeStream: streams.time?.data || null,
          cadenceStream: streams.cadence?.data || null,
        }

        errorLogger.logInfo('Exported activity stream', {
          userId: user.id,
          metadata: { activityId, hasPower: !!streams.watts?.data },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results[activityId] = {
          activityId,
          powerStream: null,
          heartrateStream: null,
          timeStream: null,
          cadenceStream: null,
          error: message,
        }

        errorLogger.logWarning('Failed to fetch activity stream', {
          userId: user.id,
          metadata: { activityId, error: message },
        })
      }
    }

    // Return formatted for easy copy-paste into fixtures
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      userId: user.id,
      activityCount: activityIds.length,
      results,
      // Include TypeScript-ready format
      fixtureFormat: generateFixtureCode(results),
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/admin/export-activity-streams',
      method: 'GET',
    })

    const message = error instanceof Error ? error.message : 'Failed to export activity streams'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Generate TypeScript code for fixtures
 */
function generateFixtureCode(
  results: Record<
    string,
    {
      activityId: string
      powerStream: number[] | null
      heartrateStream: number[] | null
      timeStream: number[] | null
      cadenceStream: number[] | null
      error?: string
    }
  >
): string {
  const lines: string[] = []

  for (const [activityId, data] of Object.entries(results)) {
    if (data.powerStream && data.powerStream.length > 0) {
      lines.push(`// Activity ${activityId}`)
      lines.push(`export const ACTIVITY_${activityId}_POWER_STREAM: number[] = [`)

      // Format in chunks of 20 numbers per line for readability
      const chunks: string[] = []
      for (let i = 0; i < data.powerStream.length; i += 20) {
        const chunk = data.powerStream.slice(i, i + 20)
        chunks.push('  ' + chunk.join(', '))
      }
      lines.push(chunks.join(',\n'))
      lines.push(']')
      lines.push('')

      if (data.heartrateStream && data.heartrateStream.length > 0) {
        lines.push(`export const ACTIVITY_${activityId}_HR_STREAM: number[] = [`)
        const hrChunks: string[] = []
        for (let i = 0; i < data.heartrateStream.length; i += 20) {
          const chunk = data.heartrateStream.slice(i, i + 20)
          hrChunks.push('  ' + chunk.join(', '))
        }
        lines.push(hrChunks.join(',\n'))
        lines.push(']')
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getConfig from 'next/config'
import { createServiceClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { StravaService } from '@/lib/services/strava-service'
import {
  calculateTSS,
  type ActivityData,
  type AthleteData,
  type TSSResult,
} from '@/lib/services/tss-calculation-service'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Zod schema for Strava webhook event payload
 * This validates the structure before processing
 */
const StravaWebhookEventSchema = z.object({
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number(),
  aspect_type: z.enum(['create', 'update', 'delete']),
  owner_id: z.number(),
  subscription_id: z.number(),
  event_time: z.number(),
  updates: z.record(z.string(), z.unknown()).optional(),
})

type StravaWebhookEvent = z.infer<typeof StravaWebhookEventSchema>

/**
 * Get webhook verify token from serverRuntimeConfig (embedded at build time)
 * Falls back to process.env for local development
 */
function getWebhookVerifyToken(): string {
  // Try serverRuntimeConfig first (for Amplify SSR where env vars aren't available at runtime)
  const { serverRuntimeConfig } = getConfig() || {}
  const token =
    serverRuntimeConfig?.stravaWebhookVerifyToken || process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

  if (!token) {
    throw new Error(
      'STRAVA_WEBHOOK_VERIFY_TOKEN environment variable is required. ' +
        'This token is used to verify webhook requests from Strava. ' +
        'Set it in your .env.local file for development or in your deployment environment variables. ' +
        'Example: STRAVA_WEBHOOK_VERIFY_TOKEN=your_random_secure_token'
    )
  }
  return token
}

/**
 * Auto-match a newly uploaded activity to scheduled workouts
 */
async function autoMatchActivity(
  supabase: SupabaseClient<Database>,
  userId: string,
  activityId: string,
  activityDate: string,
  activityType: string,
  activityTss: number | null
): Promise<void> {
  try {
    const dateOnly = activityDate.split('T')[0]!

    // Get user's active plan instances
    const { data: instances } = await supabase
      .from('plan_instances')
      .select('id, plan_data, start_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lte('start_date', dateOnly)

    if (!instances || instances.length === 0) return

    // Cycling activity types that match cycling workouts
    const cyclingTypes = ['Ride', 'VirtualRide', 'EBikeRide', 'MountainBikeRide', 'GravelRide']
    const isCyclingActivity = cyclingTypes.includes(activityType)

    // For each instance, check if there's a workout on this date
    for (const instance of instances) {
      const planData = instance.plan_data as {
        weekly_plan?: Array<{
          week_number: number
          workouts?: Array<{
            weekday: string
            tss?: number
            type?: string
          }>
        }>
      }

      if (!planData?.weekly_plan) continue

      const startDate = new Date(instance.start_date)

      // Find workouts scheduled for this date
      for (const week of planData.weekly_plan) {
        if (!week.workouts) continue

        for (let workoutIdx = 0; workoutIdx < week.workouts.length; workoutIdx++) {
          const workout = week.workouts[workoutIdx]!

          // Calculate workout date
          const daysOfWeek = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ]
          const dayIndex = daysOfWeek.findIndex(
            (d) => d.toLowerCase() === workout.weekday.toLowerCase()
          )
          if (dayIndex === -1) continue

          const startDayOfWeek = startDate.getDay()
          const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
          const weekOneMonday = new Date(startDate)
          weekOneMonday.setDate(startDate.getDate() + daysToMonday)

          const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1
          const workoutDate = new Date(weekOneMonday)
          workoutDate.setDate(
            weekOneMonday.getDate() + (week.week_number - 1) * 7 + adjustedDayIndex
          )

          const workoutDateStr = workoutDate.toISOString().split('T')[0]

          // Check if this workout is on the same day as the activity
          if (workoutDateStr !== dateOnly) continue

          // Check if workout is already matched
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existingMatch } = await (supabase as any)
            .from('workout_activity_matches')
            .select('id')
            .eq('plan_instance_id', instance.id)
            .eq('workout_date', dateOnly)
            .eq('workout_index', workoutIdx)
            .single()

          if (existingMatch) continue // Already matched

          // Calculate match score
          let score = 50 // Base score for same-day match
          const isCyclingWorkout = !workout.type || workout.type !== 'rest'

          if (isCyclingActivity && isCyclingWorkout) {
            score += 20
          }

          // TSS similarity
          if (workout.tss && activityTss) {
            const tssDiff = Math.abs(workout.tss - activityTss)
            const tssPercent = tssDiff / workout.tss
            if (tssPercent < 0.1) score += 20
            else if (tssPercent < 0.2) score += 15
            else if (tssPercent < 0.3) score += 10
            else if (tssPercent < 0.5) score += 5
          }

          // Only match if score is high enough
          if (score >= 50) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('workout_activity_matches').upsert(
              {
                user_id: userId,
                plan_instance_id: instance.id,
                workout_date: dateOnly,
                workout_index: workoutIdx,
                strava_activity_id: activityId,
                match_type: 'auto',
                match_score: score,
              },
              { onConflict: 'plan_instance_id,workout_date,workout_index' }
            )

            errorLogger.logInfo('Auto-matched activity to workout', {
              userId,
              metadata: {
                activityId,
                planInstanceId: instance.id,
                workoutDate: dateOnly,
                workoutIndex: workoutIdx,
                score,
              },
            })

            return // Only match to one workout
          }
        }
      }
    }
  } catch (error) {
    // Log but don't fail the webhook processing
    errorLogger.logWarning('Auto-match failed', {
      userId,
      metadata: {
        activityId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}

/**
 * Webhook verification endpoint
 * GET /api/webhooks/strava
 *
 * Strava sends a GET request with:
 * - hub.mode=subscribe
 * - hub.verify_token=STRAVA_WEBHOOK_VERIFY_TOKEN
 * - hub.challenge=random_string
 *
 * We must return: { "hub.challenge": "random_string" }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    errorLogger.logInfo('Webhook verification request', {
      metadata: { mode, hasToken: !!token, hasChallenge: !!challenge },
    })

    // Verify the token
    if (mode === 'subscribe' && token === getWebhookVerifyToken()) {
      errorLogger.logInfo('Webhook verification successful')
      return NextResponse.json({ 'hub.challenge': challenge })
    } else {
      errorLogger.logWarning('Webhook verification failed')
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
    }
  } catch (error) {
    errorLogger.logError(error as Error, { path: '/api/webhooks/strava', method: 'GET' })
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}

/**
 * Webhook event receiver
 * POST /api/webhooks/strava
 *
 * Strava sends POST with event data when activities are created/updated/deleted
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate payload structure with Zod
    const parseResult = StravaWebhookEventSchema.safeParse(body)
    if (!parseResult.success) {
      errorLogger.logWarning('Invalid webhook payload', {
        path: '/api/webhooks/strava',
        method: 'POST',
        metadata: { errors: parseResult.error.issues },
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const event = parseResult.data

    errorLogger.logInfo('Webhook event received', {
      metadata: {
        objectType: event.object_type,
        aspectType: event.aspect_type,
        objectId: event.object_id,
      },
    })

    // Store event in database for processing
    // Use service client to bypass RLS (webhooks have no user session)
    const supabase = createServiceClient()

    const { error } = await supabase.from('strava_webhook_events').insert({
      subscription_id: event.subscription_id,
      object_id: event.object_id,
      event_time: new Date(event.event_time * 1000).toISOString(),
      object_type: event.object_type,
      aspect_type: event.aspect_type,
      owner_id: event.owner_id,
      raw_data: event as never,
      processed: false,
    } as never)

    if (error) {
      // If it's a duplicate, that's okay (composite primary key prevents duplicates)
      if (error.code === '23505') {
        errorLogger.logInfo('Duplicate webhook event, skipping', {
          metadata: { objectId: event.object_id },
        })
        return NextResponse.json({ success: true })
      }

      errorLogger.logError(new Error(`Webhook database error: ${error.message}`), {
        path: '/api/webhooks/strava',
        method: 'POST',
      })
      return NextResponse.json({ error: 'Failed to store event' }, { status: 500 })
    }

    errorLogger.logInfo('Webhook event stored', {
      metadata: { objectId: event.object_id },
    })

    // Trigger background processing (in production, use a queue)
    // For now, we'll process it immediately
    processWebhookEvent(event).catch((err) => {
      errorLogger.logError(err as Error, {
        path: '/api/webhooks/strava',
        metadata: { objectId: event.object_id },
      })
    })

    // Return 200 quickly to acknowledge receipt
    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, { path: '/api/webhooks/strava', method: 'POST' })
    return NextResponse.json({ error: 'Failed to process event' }, { status: 500 })
  }
}

/**
 * Fetch athlete profile data for TSS calculation
 * Returns null if profile not found or missing required fields
 */
async function getAthleteDataForWebhook(userId: string): Promise<AthleteData | null> {
  const supabase = createServiceClient()

  const { data: profile, error } = await supabase
    .from('athlete_profiles')
    .select('ftp, max_hr, resting_hr, gender')
    .eq('user_id', userId)
    .single<{
      ftp: number | null
      max_hr: number | null
      resting_hr: number | null
      gender: string | null
    }>()

  if (error || !profile) {
    errorLogger.logWarning('Athlete profile not found for TSS calculation', {
      userId,
      metadata: { error: error?.message },
    })
    return null
  }

  return {
    ftp: profile.ftp ?? undefined,
    maxHr: profile.max_hr ?? undefined,
    restingHr: profile.resting_hr ?? undefined,
    gender: (profile.gender as AthleteData['gender']) ?? undefined,
  }
}

/**
 * Calculate TSS for a webhook activity
 * Returns null if insufficient data for calculation
 */
function calculateWebhookActivityTSS(
  activity: Record<string, unknown>,
  athleteData: AthleteData | null
): TSSResult | null {
  if (!athleteData) {
    return null
  }

  const activityData: ActivityData = {
    movingTimeSeconds: activity.moving_time as number,
    normalizedPower: (activity.weighted_average_watts as number) ?? undefined,
    averageWatts: (activity.average_watts as number) ?? undefined,
    averageHeartRate: (activity.average_heartrate as number) ?? undefined,
    maxHeartRate: (activity.max_heartrate as number) ?? undefined,
  }

  return calculateTSS(activityData, athleteData)
}

/**
 * Process webhook event (background task)
 * This fetches the activity details and stores them in the database
 */
async function processWebhookEvent(event: StravaWebhookEvent): Promise<void> {
  // Use service client to bypass RLS (webhooks have no user session)
  const supabase = createServiceClient()

  // Handle athlete deauthorization (user revoked access)
  if (event.object_type === 'athlete' && event.aspect_type === 'delete') {
    errorLogger.logInfo('Processing athlete deauthorization', {
      metadata: { athleteId: event.owner_id },
    })

    // Delete the Strava connection for this athlete
    const { error: deleteError } = await supabase
      .from('strava_connections')
      .delete()
      .eq('strava_athlete_id', event.owner_id)

    if (deleteError) {
      errorLogger.logError(new Error(`Failed to delete connection: ${deleteError.message}`), {
        path: '/api/webhooks/strava',
        metadata: { athleteId: event.owner_id, phase: 'athlete_deauthorization' },
      })
    } else {
      errorLogger.logInfo('Athlete deauthorization processed - connection removed', {
        metadata: { athleteId: event.owner_id },
      })
    }

    // Mark event as processed
    await supabase
      .from('strava_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      } as never)
      .match({
        subscription_id: event.subscription_id,
        object_id: event.object_id,
        event_time: new Date(event.event_time * 1000).toISOString(),
      } as never)

    return
  }

  // Skip other non-activity events (e.g., athlete updates)
  if (event.object_type !== 'activity') {
    errorLogger.logInfo('Skipping non-activity webhook event', {
      metadata: { objectType: event.object_type, objectId: event.object_id },
    })
    return
  }

  // Find the user associated with this Strava athlete
  const { data: connection, error: connectionError } = await supabase
    .from('strava_connections')
    .select('user_id, access_token')
    .eq('strava_athlete_id', event.owner_id)
    .single<{ user_id: string; access_token: string }>()

  if (connectionError || !connection) {
    errorLogger.logWarning('User not found for webhook athlete', {
      metadata: { athleteId: event.owner_id, error: connectionError?.message },
    })
    return
  }

  try {
    // Handle different event types
    if (event.aspect_type === 'delete') {
      // Delete activity from database
      await supabase
        .from('strava_activities')
        .delete()
        .eq('strava_activity_id', event.object_id)
        .eq('user_id', connection.user_id)

      errorLogger.logInfo('Webhook deleted activity', {
        userId: connection.user_id,
        metadata: { activityId: event.object_id },
      })
    } else {
      // For create/update: fetch activity details from Strava
      const stravaService = await StravaService.create()

      // Get valid access token (refreshes automatically if expired)
      // Use service client to bypass RLS since webhooks have no user session
      const accessToken = await stravaService.getValidAccessToken(connection.user_id, {
        useServiceClient: true,
      })

      const activityResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${event.object_id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!activityResponse.ok) {
        throw new Error(`Strava API error: ${activityResponse.statusText}`)
      }

      const activity = await activityResponse.json()

      errorLogger.logInfo('Fetched activity from Strava API', {
        userId: connection.user_id,
        metadata: {
          activityId: event.object_id,
          activityType: activity.type,
          activityName: activity.name,
        },
      })

      // Fetch athlete data for TSS calculation
      let tssResult: TSSResult | null = null
      try {
        const athleteData = await getAthleteDataForWebhook(connection.user_id)
        tssResult = calculateWebhookActivityTSS(activity, athleteData)

        if (tssResult) {
          errorLogger.logInfo('TSS calculated for webhook activity', {
            userId: connection.user_id,
            metadata: {
              activityId: event.object_id,
              tss: tssResult.tss,
              method: tssResult.method,
              confidence: tssResult.confidence,
            },
          })
        } else {
          errorLogger.logWarning('TSS calculation returned null', {
            userId: connection.user_id,
            metadata: {
              activityId: event.object_id,
              reason: athleteData ? 'Insufficient activity data' : 'Missing athlete profile',
              hasAthleteData: !!athleteData,
              hasPowerData: !!(activity.weighted_average_watts || activity.average_watts),
              hasHRData: !!activity.average_heartrate,
            },
          })
        }
      } catch (tssError) {
        // Don't fail the entire webhook processing if TSS calculation fails
        errorLogger.logWarning('TSS calculation failed for webhook activity', {
          userId: connection.user_id,
          metadata: {
            activityId: event.object_id,
            error: tssError instanceof Error ? tssError.message : 'Unknown error',
            activityType: activity.type,
          },
        })
        // tssResult remains null, activity will be stored without TSS
      }

      // Upsert activity to database WITH TSS data
      await supabase.from('strava_activities').upsert(
        {
          user_id: connection.user_id,
          strava_activity_id: activity.id,
          name: activity.name,
          type: activity.type,
          sport_type: activity.sport_type,
          start_date: activity.start_date,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain,
          average_watts: activity.average_watts,
          max_watts: activity.max_watts,
          weighted_average_watts: activity.weighted_average_watts,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          raw_data: activity,
          // NEW: TSS fields
          tss: tssResult?.tss ?? null,
          tss_method: tssResult?.method ?? null,
        } as never,
        {
          onConflict: 'strava_activity_id',
        }
      )

      errorLogger.logInfo('Webhook synced activity with TSS', {
        userId: connection.user_id,
        metadata: {
          activityId: event.object_id,
          aspectType: event.aspect_type,
          tss: tssResult?.tss ?? null,
          tssMethod: tssResult?.method ?? null,
          tssConfidence: tssResult?.confidence ?? null,
        },
      })

      // Auto-match activity to scheduled workouts
      // Get the saved activity's UUID
      const { data: savedActivity } = await supabase
        .from('strava_activities')
        .select('id')
        .eq('strava_activity_id', activity.id)
        .single()

      if (savedActivity) {
        await autoMatchActivity(
          supabase,
          connection.user_id,
          savedActivity.id,
          activity.start_date,
          activity.type,
          tssResult?.tss ?? null
        )
      }
    }

    // Mark event as processed
    await supabase
      .from('strava_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      } as never)
      .match({
        subscription_id: event.subscription_id,
        object_id: event.object_id,
        event_time: new Date(event.event_time * 1000).toISOString(),
      } as never)
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/webhooks/strava',
      metadata: { objectId: event.object_id, phase: 'processWebhookEvent' },
    })

    // Mark event as failed
    await supabase
      .from('strava_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      } as never)
      .match({
        subscription_id: event.subscription_id,
        object_id: event.object_id,
        event_time: new Date(event.event_time * 1000).toISOString(),
      } as never)
  }
}

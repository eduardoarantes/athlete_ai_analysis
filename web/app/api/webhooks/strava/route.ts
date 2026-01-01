import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { StravaService } from '@/lib/services/strava-service'
import {
  calculateTSS,
  type ActivityData,
  type AthleteData,
  type TSSResult,
} from '@/lib/services/tss-calculation-service'

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
 * Get webhook verify token at runtime (not build time)
 * This prevents build failures when the env var is not set during CI
 */
function getWebhookVerifyToken(): string {
  const token = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
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
    const supabase = await createClient()

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
  const supabase = await createClient()

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
  const supabase = await createClient()

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
      const accessToken = await stravaService.getValidAccessToken(connection.user_id)

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

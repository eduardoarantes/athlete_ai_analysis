import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

// Webhook verify token - MUST be set in environment variables
const WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

if (!WEBHOOK_VERIFY_TOKEN) {
  throw new Error(
    'STRAVA_WEBHOOK_VERIFY_TOKEN environment variable is required. ' +
    'This token is used to verify webhook requests from Strava. ' +
    'Set it in your .env.local file for development or in your deployment environment variables. ' +
    'Example: STRAVA_WEBHOOK_VERIFY_TOKEN=your_random_secure_token'
  )
}

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
  subscription_id: number
  event_time: number
  updates?: Record<string, unknown>
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
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      errorLogger.logInfo('Webhook verification successful')
      return NextResponse.json({ 'hub.challenge': challenge })
    } else {
      errorLogger.logWarning('Webhook verification failed')
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
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
    const event: StravaWebhookEvent = await request.json()

    errorLogger.logInfo('Webhook event received', {
      metadata: { objectType: event.object_type, aspectType: event.aspect_type, objectId: event.object_id },
    })

    // Store event in database for processing
    const supabase = await createClient()

    const { error } = await supabase
      .from('strava_webhook_events')
      .insert({
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
      return NextResponse.json({ error: 'Failed to store event' }, {status: 500 })
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
 * Process webhook event (background task)
 * This fetches the activity details and stores them in the database
 */
async function processWebhookEvent(event: StravaWebhookEvent): Promise<void> {
  // Only process activity events
  if (event.object_type !== 'activity') {
    errorLogger.logInfo('Skipping non-activity webhook event', {
      metadata: { objectType: event.object_type, objectId: event.object_id },
    })
    return
  }

  const supabase = await createClient()

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
      const activityResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${event.object_id}`,
        {
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
          },
        }
      )

      if (!activityResponse.ok) {
        throw new Error(`Strava API error: ${activityResponse.statusText}`)
      }

      const activity = await activityResponse.json()

      // Upsert activity to database
      await supabase
        .from('strava_activities')
        .upsert({
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
        } as never, {
          onConflict: 'strava_activity_id',
        })

      errorLogger.logInfo('Webhook synced activity', {
        userId: connection.user_id,
        metadata: { activityId: event.object_id, aspectType: event.aspect_type },
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    console.log('[Webhook] Verification request:', { mode, token, challenge })

    // Verify the token
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('[Webhook] Verification successful')
      return NextResponse.json({ 'hub.challenge': challenge })
    } else {
      console.log('[Webhook] Verification failed')
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('[Webhook] Verification error:', error)
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

    console.log('[Webhook] Received event:', event)

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
        console.log('[Webhook] Duplicate event, skipping')
        return NextResponse.json({ success: true })
      }

      console.error('[Webhook] Database error:', error)
      return NextResponse.json({ error: 'Failed to store event' }, {status: 500 })
    }

    console.log('[Webhook] Event stored successfully')

    // Trigger background processing (in production, use a queue)
    // For now, we'll process it immediately
    processWebhookEvent(event).catch((err) => {
      console.error('[Webhook] Processing error:', err)
    })

    // Return 200 quickly to acknowledge receipt
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Event error:', error)
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
    console.log('[Webhook] Skipping non-activity event')
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
    console.error('[Webhook] User not found for athlete:', event.owner_id)
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

      console.log('[Webhook] Deleted activity:', event.object_id)
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

      console.log('[Webhook] Synced activity:', event.object_id)
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
    console.error('[Webhook] Processing failed:', error)

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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID!
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!
const WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'CYCLING_AI'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const CALLBACK_URL = `${APP_URL}/api/webhooks/strava`

/**
 * Create or view webhook subscription
 * POST /api/webhooks/strava/subscription - Create subscription
 * GET /api/webhooks/strava/subscription - View current subscription
 */
export async function POST(_request: NextRequest) {
  try {
    // Check if user is admin (in production, add proper auth check)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create subscription with Strava
    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        callback_url: CALLBACK_URL,
        verify_token: WEBHOOK_VERIFY_TOKEN,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[Subscription] Strava API error:', error)
      return NextResponse.json(
        {
          error: 'Failed to create subscription',
          details: error,
        },
        { status: response.status }
      )
    }

    const subscription = await response.json()

    // Store subscription in database
    await supabase.from('strava_webhook_subscriptions').upsert(
      {
        subscription_id: subscription.id,
        callback_url: CALLBACK_URL,
        verify_token: WEBHOOK_VERIFY_TOKEN,
      } as never,
      {
        onConflict: 'subscription_id',
      }
    )

    return NextResponse.json({
      success: true,
      subscription,
    })
  } catch (error) {
    console.error('[Subscription] Create error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      },
      { status: 500 }
    )
  }
}

/**
 * View current subscription
 */
export async function GET() {
  try {
    // Check if user is admin (in production, add proper auth check)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get subscription from Strava
    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${STRAVA_CLIENT_ID}&client_secret=${STRAVA_CLIENT_SECRET}`
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('[Subscription] Strava API error:', error)
      return NextResponse.json(
        {
          error: 'Failed to get subscription',
          details: error,
        },
        { status: response.status }
      )
    }

    const subscriptions = await response.json()

    return NextResponse.json({
      subscriptions,
      callback_url: CALLBACK_URL,
    })
  } catch (error) {
    console.error('[Subscription] Get error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get subscription',
      },
      { status: 500 }
    )
  }
}

/**
 * Delete webhook subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check if user is admin (in production, add proper auth check)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
    }

    // Delete subscription from Strava
    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions/${subscriptionId}?client_id=${STRAVA_CLIENT_ID}&client_secret=${STRAVA_CLIENT_SECRET}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('[Subscription] Strava API error:', error)
      return NextResponse.json(
        {
          error: 'Failed to delete subscription',
          details: error,
        },
        { status: response.status }
      )
    }

    // Delete from database
    await supabase
      .from('strava_webhook_subscriptions')
      .delete()
      .eq('subscription_id', parseInt(subscriptionId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Subscription] Delete error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete subscription',
      },
      { status: 500 }
    )
  }
}

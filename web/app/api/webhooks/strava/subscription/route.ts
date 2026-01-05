import { NextRequest, NextResponse } from 'next/server'
import getConfig from 'next/config'
import { createClient } from '@/lib/supabase/server'

/**
 * Get Strava credentials from serverRuntimeConfig (embedded at build time)
 * Falls back to process.env for local development
 */
function getStravaCredentials() {
  const { serverRuntimeConfig } = getConfig() || {}
  const clientId = serverRuntimeConfig?.stravaClientId || process.env.STRAVA_CLIENT_ID
  const clientSecret = serverRuntimeConfig?.stravaClientSecret || process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET environment variables are required')
  }

  return { clientId, clientSecret }
}

/**
 * Get webhook verify token from serverRuntimeConfig (embedded at build time)
 * Falls back to process.env for local development
 */
function getWebhookVerifyToken(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  const token = serverRuntimeConfig?.stravaWebhookVerifyToken || process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

  if (!token) {
    throw new Error(
      'STRAVA_WEBHOOK_VERIFY_TOKEN environment variable is required. ' +
        'Generate a secure token with: openssl rand -base64 32'
    )
  }
  return token
}

function getCallbackUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/webhooks/strava`
}

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

    // Get credentials at runtime
    const { clientId, clientSecret } = getStravaCredentials()
    const verifyToken = getWebhookVerifyToken()
    const callbackUrl = getCallbackUrl()

    // Create subscription with Strava
    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
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
        callback_url: callbackUrl,
        verify_token: verifyToken,
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

    // Get credentials at runtime
    const { clientId, clientSecret } = getStravaCredentials()
    const callbackUrl = getCallbackUrl()

    // Get subscription from Strava
    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
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
      callback_url: callbackUrl,
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

    // Get credentials at runtime
    const { clientId, clientSecret } = getStravaCredentials()

    // Delete subscription from Strava
    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions/${subscriptionId}?client_id=${clientId}&client_secret=${clientSecret}`,
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

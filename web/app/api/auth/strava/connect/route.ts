import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'
import { randomBytes } from 'crypto'

/**
 * Initiate Strava OAuth flow
 * GET /api/auth/strava/connect
 */
export async function GET(_request: NextRequest) {
  try {
    // Debug: Check env vars availability
    const debugInfo = {
      hasClientId: !!process.env.STRAVA_CLIENT_ID,
      hasClientSecret: !!process.env.STRAVA_CLIENT_SECRET,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      nodeEnv: process.env.NODE_ENV,
      clientIdLength: process.env.STRAVA_CLIENT_ID?.length,
    }
    console.log('Strava connect debug:', debugInfo)

    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Strava not configured', debug: debugInfo },
        { status: 500 }
      )
    }

    // Check if user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString('hex')

    // Generate Strava authorization URL
    const stravaService = new StravaService()
    const authUrl = stravaService.getAuthorizationUrl(state)

    // Create redirect response to Strava with cookies
    const response = NextResponse.redirect(authUrl)

    // Store state in session cookie (expires in 10 minutes)
    response.cookies.set('strava_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Store user ID in session for callback
    response.cookies.set('strava_oauth_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Strava connect error:', error)
    return NextResponse.json({ error: 'Failed to initiate Strava connection' }, { status: 500 })
  }
}

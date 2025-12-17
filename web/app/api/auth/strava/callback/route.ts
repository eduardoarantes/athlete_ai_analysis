import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'

/**
 * Handle Strava OAuth callback
 * GET /api/auth/strava/callback?state=xxx&code=yyy&scope=zzz
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const scope = searchParams.get('scope')
    const error = searchParams.get('error')

    // Handle user denial
    if (error === 'access_denied') {
      return NextResponse.redirect(new URL('/dashboard?strava_error=access_denied', request.url))
    }

    // Validate required parameters
    if (!code || !state || !scope) {
      return NextResponse.redirect(new URL('/dashboard?strava_error=invalid_request', request.url))
    }

    // Verify state token (CSRF protection)
    const storedState = request.cookies.get('strava_oauth_state')?.value
    const storedUserId = request.cookies.get('strava_oauth_user_id')?.value

    if (!storedState || !storedUserId || storedState !== state) {
      return NextResponse.redirect(new URL('/dashboard?strava_error=invalid_state', request.url))
    }

    // Exchange code for tokens
    const stravaService = new StravaService()
    const tokenResponse = await stravaService.exchangeCodeForToken(code)

    // Store connection in database
    const supabase = await createClient()
    const { error: dbError } = await supabase.from('strava_connections').upsert(
      {
        user_id: storedUserId,
        strava_athlete_id: tokenResponse.athlete.id,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: new Date(tokenResponse.expires_at * 1000).toISOString(),
        scope: scope,
        sync_status: 'pending',
      },
      {
        onConflict: 'user_id',
      }
    )

    if (dbError) {
      console.error('Failed to store Strava connection:', dbError)
      return NextResponse.redirect(new URL('/dashboard?strava_error=db_error', request.url))
    }

    // Clear state cookies
    const response = NextResponse.redirect(new URL('/dashboard?strava_connected=true', request.url))
    response.cookies.delete('strava_oauth_state')
    response.cookies.delete('strava_oauth_user_id')

    return response
  } catch (error) {
    console.error('Strava callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?strava_error=callback_failed', request.url))
  }
}

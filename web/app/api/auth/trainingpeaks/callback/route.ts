import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TrainingPeaksService } from '@/lib/services/trainingpeaks-service'
import { errorLogger } from '@/lib/monitoring/error-logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

/**
 * Handle TrainingPeaks OAuth callback
 * GET /api/auth/trainingpeaks/callback?state=xxx&code=yyy
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denial
    if (error === 'access_denied') {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?tp_error=access_denied', request.url)
      )
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?tp_error=invalid_request', request.url)
      )
    }

    // Verify state token (CSRF protection)
    const storedState = request.cookies.get('tp_oauth_state')?.value
    const storedUserId = request.cookies.get('tp_oauth_user_id')?.value

    if (!storedState || !storedUserId || storedState !== state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?tp_error=invalid_state', request.url)
      )
    }

    // Exchange code for tokens
    const tpService = await TrainingPeaksService.create()
    const tokenResponse = await tpService.exchangeCodeForToken(code)

    // Get athlete profile to get athlete ID and premium status
    const athlete = await tpService.getAthlete(tokenResponse.access_token)

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    // Store connection in database
    const supabase: UntypedSupabaseClient = await createClient()
    const { error: dbError } = await supabase.from('trainingpeaks_connections').upsert(
      {
        user_id: storedUserId,
        tp_athlete_id: athlete.Id,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokenResponse.scope,
        is_premium: athlete.IsPremium,
      },
      {
        onConflict: 'user_id',
      }
    )

    if (dbError) {
      errorLogger.logDatabaseError(
        new Error(`Failed to store TrainingPeaks connection: ${dbError.message}`),
        'trainingpeaks_connections.upsert',
        storedUserId
      )
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?tp_error=db_error', request.url)
      )
    }

    // Clear state cookies
    const response = NextResponse.redirect(
      new URL('/dashboard/settings/integrations?tp_connected=true', request.url)
    )
    response.cookies.delete('tp_oauth_state')
    response.cookies.delete('tp_oauth_user_id')

    return response
  } catch (error) {
    errorLogger.logIntegrationError(
      error instanceof Error ? error : new Error('TrainingPeaks callback failed'),
      'trainingpeaks'
    )
    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?tp_error=callback_failed', request.url)
    )
  }
}

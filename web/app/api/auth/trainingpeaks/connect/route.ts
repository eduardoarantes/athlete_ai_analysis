import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TrainingPeaksService } from '@/lib/services/trainingpeaks-service'
import { randomBytes } from 'crypto'

/**
 * Initiate TrainingPeaks OAuth flow
 * GET /api/auth/trainingpeaks/connect
 */
export async function GET(_request: NextRequest) {
  try {
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

    // Generate TrainingPeaks authorization URL
    const tpService = await TrainingPeaksService.create()
    const authUrl = tpService.getAuthorizationUrl(state)

    // Create redirect response to TrainingPeaks with cookies
    const response = NextResponse.redirect(authUrl)

    // Store state in session cookie (expires in 10 minutes)
    response.cookies.set('tp_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Store user ID in session for callback
    response.cookies.set('tp_oauth_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('TrainingPeaks connect error:', error)
    return NextResponse.json(
      {
        error: 'Failed to initiate TrainingPeaks connection',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

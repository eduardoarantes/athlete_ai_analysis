import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get Strava connection status
 * GET /api/auth/strava/status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ connected: false })
    }

    // Check for existing connection
    const { data: connection, error } = await supabase
      .from('strava_connections')
      .select('strava_athlete_id, expires_at, sync_status, last_sync_at')
      .eq('user_id', user.id)
      .single()

    if (error || !connection) {
      return NextResponse.json({ connected: false })
    }

    // Check if token is expired
    const expiresAt = new Date(connection.expires_at)
    const isExpired = expiresAt < new Date()

    return NextResponse.json({
      connected: true,
      athlete_id: connection.strava_athlete_id,
      token_expired: isExpired,
      sync_status: connection.sync_status,
      last_sync_at: connection.last_sync_at,
    })
  } catch (error) {
    console.error('Strava status error:', error)
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}

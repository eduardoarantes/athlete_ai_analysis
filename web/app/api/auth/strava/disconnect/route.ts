import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'

/**
 * Disconnect Strava integration
 * POST /api/auth/strava/disconnect
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing connection
    const { data: connection } = await supabase
      .from('strava_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    // Revoke access on Strava
    if (connection?.access_token) {
      try {
        const stravaService = new StravaService()
        await stravaService.deauthorize(connection.access_token)
      } catch (error) {
        // Continue even if deauthorization fails
        console.error('Failed to deauthorize on Strava:', error)
      }
    }

    // Delete connection from database
    const { error: deleteError } = await supabase
      .from('strava_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete connection:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Strava disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

/**
 * Get TrainingPeaks connection status
 * GET /api/auth/trainingpeaks/status
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id yqaskiwzyhhovthbvmqq --schema public > lib/types/database.ts
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase: UntypedSupabaseClient = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ connected: false })
    }

    // Check for existing connection
    const { data: connection, error } = await supabase
      .from('trainingpeaks_connections')
      .select('tp_athlete_id, expires_at, is_premium')
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
      athlete_id: connection.tp_athlete_id,
      token_expired: isExpired,
      is_premium: connection.is_premium,
    })
  } catch (error) {
    errorLogger.logIntegrationError(
      error instanceof Error ? error : new Error('TrainingPeaks status check failed'),
      'trainingpeaks'
    )
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

/**
 * Disconnect TrainingPeaks integration
 * POST /api/auth/trainingpeaks/disconnect
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id yqaskiwzyhhovthbvmqq --schema public > lib/types/database.ts
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase: UntypedSupabaseClient = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete connection from database
    // Note: TrainingPeaks doesn't have a deauthorization endpoint like Strava
    // The user can revoke access from their TP account settings
    const { error: deleteError } = await supabase
      .from('trainingpeaks_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      errorLogger.logDatabaseError(
        new Error(`Failed to delete TrainingPeaks connection: ${deleteError.message}`),
        'trainingpeaks_connections.delete',
        user.id
      )
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    // Also delete any workout sync records
    await supabase.from('trainingpeaks_workout_syncs').delete().eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logIntegrationError(
      error instanceof Error ? error : new Error('TrainingPeaks disconnect failed'),
      'trainingpeaks'
    )
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}

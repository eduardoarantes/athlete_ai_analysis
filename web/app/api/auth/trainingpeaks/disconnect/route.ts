import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

/**
 * Disconnect TrainingPeaks integration
 * POST /api/auth/trainingpeaks/disconnect
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
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
      console.error('Failed to delete connection:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    // Also delete any workout sync records
    await supabase.from('trainingpeaks_workout_syncs').delete().eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('TrainingPeaks disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}

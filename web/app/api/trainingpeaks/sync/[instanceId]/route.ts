import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TrainingPeaksSyncService } from '@/lib/services/trainingpeaks-sync-service'
import { errorLogger } from '@/lib/monitoring/error-logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

/**
 * Get sync status for a plan instance
 * GET /api/trainingpeaks/sync/[instanceId]
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params
    const supabase: UntypedSupabaseClient = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this plan instance
    const { data: planInstance, error: planError } = await supabase
      .from('plan_instances')
      .select('id')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single()

    if (planError || !planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    const syncService = new TrainingPeaksSyncService()
    const status = await syncService.getSyncStatus(instanceId)

    return NextResponse.json(status)
  } catch (error) {
    errorLogger.logIntegrationError(
      error instanceof Error ? error : new Error('TrainingPeaks sync status check failed'),
      'trainingpeaks'
    )
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 })
  }
}

/**
 * Delete synced workouts for a plan instance from TrainingPeaks
 * DELETE /api/trainingpeaks/sync/[instanceId]
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params
    const supabase: UntypedSupabaseClient = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this plan instance
    const { data: planInstance, error: planError } = await supabase
      .from('plan_instances')
      .select('id')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single()

    if (planError || !planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Check TrainingPeaks connection
    const { data: tpConnection } = await supabase
      .from('trainingpeaks_connections')
      .select('tp_athlete_id')
      .eq('user_id', user.id)
      .single()

    if (!tpConnection) {
      return NextResponse.json({ error: 'TrainingPeaks not connected' }, { status: 400 })
    }

    const syncService = new TrainingPeaksSyncService()
    const result = await syncService.deleteSyncedWorkouts(user.id, instanceId)

    return NextResponse.json(result)
  } catch (error) {
    errorLogger.logIntegrationError(
      error instanceof Error ? error : new Error('TrainingPeaks delete sync failed'),
      'trainingpeaks'
    )
    return NextResponse.json({ error: 'Failed to delete synced workouts' }, { status: 500 })
  }
}

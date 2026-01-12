import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TrainingPeaksSyncService } from '@/lib/services/trainingpeaks-sync-service'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { PlanInstance } from '@/lib/types/training-plan'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

/**
 * Sync a plan instance to TrainingPeaks
 * POST /api/trainingpeaks/sync
 * Body: { planInstanceId: string }
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id yqaskiwzyhhovthbvmqq --schema public > lib/types/database.ts
 */
export async function POST(request: NextRequest) {
  try {
    const supabase: UntypedSupabaseClient = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { planInstanceId } = body

    if (!planInstanceId) {
      return NextResponse.json({ error: 'planInstanceId is required' }, { status: 400 })
    }

    // Get TrainingPeaks connection
    const { data: tpConnection, error: tpError } = await supabase
      .from('trainingpeaks_connections')
      .select('tp_athlete_id, is_premium')
      .eq('user_id', user.id)
      .single()

    if (tpError || !tpConnection) {
      return NextResponse.json(
        { error: 'TrainingPeaks not connected. Please connect your account first.' },
        { status: 400 }
      )
    }

    // Check if user has premium (required for planned workouts)
    if (!tpConnection.is_premium) {
      return NextResponse.json(
        {
          error:
            'TrainingPeaks Premium account required. Basic accounts cannot have planned workouts.',
        },
        { status: 403 }
      )
    }

    // Get plan instance
    const { data: planInstance, error: planError } = await supabase
      .from('plan_instances')
      .select('*')
      .eq('id', planInstanceId)
      .eq('user_id', user.id)
      .single()

    if (planError || !planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Sync to TrainingPeaks
    const syncService = new TrainingPeaksSyncService()
    const result = await syncService.syncPlanInstance(
      user.id,
      planInstance as PlanInstance,
      tpConnection.tp_athlete_id
    )

    return NextResponse.json(result)
  } catch (error) {
    errorLogger.logIntegrationError(
      error instanceof Error ? error : new Error('TrainingPeaks sync failed'),
      'trainingpeaks'
    )
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync' },
      { status: 500 }
    )
  }
}

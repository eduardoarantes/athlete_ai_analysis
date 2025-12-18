import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { TrainingPlan, TrainingPlanData } from '@/lib/types/training-plan'

/**
 * Get a specific training plan by ID
 * GET /api/training-plans/[planId]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: plan, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Training plan not found' }, { status: 404 })
      }
      errorLogger.logDatabaseError(new Error(error.message), 'fetch_training_plan', user.id)
      return NextResponse.json({ error: 'Failed to fetch training plan' }, { status: 500 })
    }

    // Parse plan_data if it's a string (shouldn't be, but just in case)
    const planData: TrainingPlanData =
      typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data

    const trainingPlan: TrainingPlan = {
      ...plan,
      plan_data: planData,
    }

    return NextResponse.json({ plan: trainingPlan })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/training-plans/${planId}`,
      method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch training plan' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type {
  SavePlanRequest,
  SavePlanResponse,
  WeekState,
  WorkoutsData,
} from '@/lib/types/plan-builder'
import type { TrainingPhase } from '@/lib/types/workout-library'

// Note: custom_plan_weeks table and extended training_plans columns
// require regenerating Supabase types after migration is applied.
// Using type assertions until types are regenerated.

// Extended training plan type with custom builder fields
interface ExtendedTrainingPlan {
  id: string
  user_id: string
  name: string
  description: string | null
  goal?: string
  target_ftp?: number | null
  is_draft?: boolean
  status: string | null
  created_at: string
  updated_at: string
}

/**
 * Custom plan week record from database
 */
interface CustomPlanWeekRow {
  id: string
  plan_id: string
  week_number: number
  phase: string
  workouts_data: WorkoutsData
  weekly_tss: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Get a specific custom plan by ID
 * GET /api/custom-plans/[planId]
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

    // Fetch the plan
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError) {
      if (planError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      errorLogger.logDatabaseError(new Error(planError.message), 'fetch_custom_plan', user.id)
      return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
    }

    // Fetch the weeks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: weeks, error: weeksError } = await (supabase as any)
      .from('custom_plan_weeks')
      .select('*')
      .eq('plan_id', planId)
      .order('week_number', { ascending: true })

    if (weeksError) {
      errorLogger.logDatabaseError(
        new Error(weeksError.message),
        'fetch_custom_plan_weeks',
        user.id
      )
      return NextResponse.json({ error: 'Failed to fetch plan weeks' }, { status: 500 })
    }

    // Transform weeks to WeekState format
    const weekStates: WeekState[] = ((weeks || []) as CustomPlanWeekRow[]).map((row) => ({
      id: row.id,
      weekNumber: row.week_number,
      phase: row.phase as TrainingPhase,
      workouts: row.workouts_data ?? {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
      weeklyTss: row.weekly_tss ?? 0,
      notes: row.notes ?? undefined,
    }))

    // Cast to extended type for accessing custom builder fields
    const extendedPlan = plan as unknown as ExtendedTrainingPlan

    return NextResponse.json({
      plan: {
        id: extendedPlan.id,
        name: extendedPlan.name,
        description: extendedPlan.description,
        goal: extendedPlan.goal,
        targetFtp: extendedPlan.target_ftp,
        isDraft: extendedPlan.is_draft,
        status: extendedPlan.status,
        createdAt: extendedPlan.created_at,
        updatedAt: extendedPlan.updated_at,
      },
      weeks: weekStates,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/custom-plans/${planId}`,
      method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
  }
}

/**
 * Update an existing custom plan
 * PUT /api/custom-plans/[planId]
 */
export async function PUT(
  request: NextRequest,
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

    const body: SavePlanRequest = await request.json()

    // Verify plan ownership
    const { data: existingPlan, error: verifyError } = await supabase
      .from('training_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (verifyError || !existingPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Update the training plan
    const { error: planError } = await supabase
      .from('training_plans')
      .update({
        name: body.metadata.name,
        description: body.metadata.description ?? null,
        goal: body.metadata.goal ?? '',
        weeks_total: body.weeks.length,
        target_ftp: body.metadata.targetFtp ?? null,
        is_draft: !body.publish,
        status: body.publish ? 'active' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)

    if (planError) {
      errorLogger.logDatabaseError(new Error(planError.message), 'update_custom_plan', user.id)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    // Delete existing weeks and reinsert (simplest approach for now)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('custom_plan_weeks')
      .delete()
      .eq('plan_id', planId)

    if (deleteError) {
      errorLogger.logDatabaseError(
        new Error(deleteError.message),
        'delete_custom_plan_weeks',
        user.id
      )
      return NextResponse.json({ error: 'Failed to update plan weeks' }, { status: 500 })
    }

    // Insert new weeks
    if (body.weeks.length > 0) {
      const weeksToInsert = body.weeks.map((week) => ({
        plan_id: planId,
        week_number: week.weekNumber,
        phase: week.phase,
        workouts_data: week.workouts,
        weekly_tss: week.weeklyTss,
        notes: week.notes ?? null,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: weeksError } = await (supabase as any)
        .from('custom_plan_weeks')
        .insert(weeksToInsert)

      if (weeksError) {
        errorLogger.logDatabaseError(
          new Error(weeksError.message),
          'insert_custom_plan_weeks',
          user.id
        )
        return NextResponse.json({ error: 'Failed to save plan weeks' }, { status: 500 })
      }
    }

    const response: SavePlanResponse = {
      success: true,
      planId,
      savedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/custom-plans/${planId}`,
      method: 'PUT',
    })
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

/**
 * Delete a custom plan
 * DELETE /api/custom-plans/[planId]
 */
export async function DELETE(
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

    // Verify ownership and delete (cascade will delete weeks)
    const { error } = await supabase
      .from('training_plans')
      .delete()
      .eq('id', planId)
      .eq('user_id', user.id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      errorLogger.logDatabaseError(new Error(error.message), 'delete_custom_plan', user.id)
      return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/custom-plans/${planId}`,
      method: 'DELETE',
    })
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}

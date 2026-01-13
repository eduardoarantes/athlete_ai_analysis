import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type {
  SavePlanRequest,
  SavePlanResponse,
  WeekState,
  WorkoutsData,
} from '@/lib/types/plan-builder'
import type { TrainingPlanData, WeeklyPlan, Workout } from '@/lib/types/training-plan'
import type { TrainingPhase } from '@/lib/types/workout-library'
import type { Json } from '@/lib/types/database'
import { DAYS_OF_WEEK } from '@/lib/types/plan-builder'
import { isWorkoutPlacementArray } from '@/lib/types/type-guards'

/**
 * Capitalize first letter of a string (monday -> Monday)
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert WorkoutsData (custom builder format) to Workout[] (standard format)
 */
function convertWorkoutsDataToWorkouts(workoutsData: WorkoutsData): Workout[] {
  const workouts: Workout[] = []

  for (const day of DAYS_OF_WEEK) {
    const placements = workoutsData[day]
    // Validate that placements is an array of WorkoutPlacement
    if (!isWorkoutPlacementArray(placements)) {
      throw new Error(`Invalid workout placements for ${day}`)
    }
    for (const placement of placements) {
      workouts.push({
        id: placement.id,
        weekday: capitalize(day), // Capitalize to match schedule format (Monday, Tuesday, etc.)
        name: placement.workout?.name || 'Workout',
        type: placement.workout?.type || 'mixed',
        tss: placement.workout?.base_tss || 0,
        ...(placement.workoutKey && { library_workout_id: placement.workoutKey }),
      })
    }
  }

  return workouts
}

/**
 * Convert SavePlanRequest to TrainingPlanData (standard format)
 */
function convertToTrainingPlanData(body: SavePlanRequest): TrainingPlanData {
  const weeklyPlan: WeeklyPlan[] = body.weeks.map((week) => ({
    week_number: week.weekNumber,
    phase: week.phase,
    week_tss: week.weeklyTss,
    workouts: convertWorkoutsDataToWorkouts(week.workouts),
    ...(week.notes && { weekly_focus: week.notes }),
  }))

  return {
    athlete_profile: {
      ftp: body.metadata.targetFtp || 0,
    },
    plan_metadata: {
      total_weeks: body.weeks.length,
      current_ftp: body.metadata.targetFtp || 0,
      target_ftp: body.metadata.targetFtp || 0,
    },
    weekly_plan: weeklyPlan,
  }
}

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
    const { data: weeks, error: weeksError } = await supabase
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
    const weekStates: WeekState[] = (weeks || []).map((row) => ({
      id: row.id,
      weekNumber: row.week_number,
      phase: row.phase as TrainingPhase,
      workouts: (row.workouts_data as unknown as WorkoutsData) ?? {
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

    // Convert to standard TrainingPlanData format (same as AI plans)
    const planData = convertToTrainingPlanData(body)

    // Update the training plan with plan_data
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
        plan_data: planData as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)

    if (planError) {
      errorLogger.logDatabaseError(new Error(planError.message), 'update_custom_plan', user.id)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    // Delete existing weeks and reinsert (simplest approach for now)
    const { error: deleteError } = await supabase
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
        workouts_data: week.workouts as unknown as Json,
        weekly_tss: week.weeklyTss,
        notes: week.notes ?? null,
      }))

      const { error: weeksError } = await supabase.from('custom_plan_weeks').insert(weeksToInsert)

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

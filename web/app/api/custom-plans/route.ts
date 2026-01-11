import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { SavePlanRequest, SavePlanResponse, WorkoutsData, WorkoutPlacement } from '@/lib/types/plan-builder'
import type { TrainingPlanData, WeeklyPlan, Workout } from '@/lib/types/training-plan'
import type { Json } from '@/lib/types/database'
import { DAYS_OF_WEEK } from '@/lib/types/plan-builder'

/**
 * Convert WorkoutsData (custom builder format) to Workout[] (standard format)
 */
function convertWorkoutsDataToWorkouts(workoutsData: WorkoutsData): Workout[] {
  const workouts: Workout[] = []

  for (const day of DAYS_OF_WEEK) {
    const placements = workoutsData[day] as WorkoutPlacement[]
    for (const placement of placements) {
      workouts.push({
        id: placement.id,
        weekday: day,
        name: placement.workout?.name || 'Workout',
        type: placement.workout?.type || 'mixed',
        tss: placement.workout?.base_tss || 0,
        // Conditionally include library_workout_id
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

/**
 * Create a new custom training plan
 * POST /api/custom-plans
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

    const body: SavePlanRequest = await request.json()

    // Validate request
    if (!body.metadata?.name) {
      return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    }

    // Convert to standard TrainingPlanData format (same as AI plans)
    const planData = convertToTrainingPlanData(body)

    // Create the training plan with plan_data populated
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        name: body.metadata.name,
        description: body.metadata.description ?? null,
        goal: body.metadata.goal ?? '',
        weeks_total: body.weeks.length,
        target_ftp: body.metadata.targetFtp ?? null,
        created_from: 'custom_builder',
        is_draft: !body.publish,
        status: body.publish ? 'active' : 'draft',
        // Store plan_data in standard format (same as AI plans)
        plan_data: planData as unknown as Json,
        metadata: {
          source: 'manual',
          generated_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single()

    if (planError) {
      errorLogger.logDatabaseError(new Error(planError.message), 'create_custom_plan', user.id)
      return NextResponse.json(
        { error: 'Failed to create plan', details: planError.message },
        { status: 500 }
      )
    }

    // Insert weeks
    if (body.weeks.length > 0) {
      const weeksToInsert = body.weeks.map((week) => ({
        plan_id: plan.id,
        week_number: week.weekNumber,
        phase: week.phase,
        workouts_data: week.workouts as unknown as Json,
        weekly_tss: week.weeklyTss,
        notes: week.notes ?? null,
      }))

      const { error: weeksError } = await supabase.from('custom_plan_weeks').insert(weeksToInsert)

      if (weeksError) {
        // Rollback: delete the plan if weeks insertion fails
        await supabase.from('training_plans').delete().eq('id', plan.id)
        errorLogger.logDatabaseError(
          new Error(weeksError.message),
          'create_custom_plan_weeks',
          user.id
        )
        return NextResponse.json(
          { error: 'Failed to save plan weeks', details: weeksError.message },
          { status: 500 }
        )
      }
    }

    const response: SavePlanResponse = {
      success: true,
      planId: plan.id,
      savedAt: new Date().toISOString(),
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/custom-plans',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}

/**
 * List custom plans for the current user
 * GET /api/custom-plans
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: plans, error } = await supabase
      .from('training_plans')
      .select('id, name, description, goal, weeks_total, status, is_draft, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('created_from', 'custom_builder')
      .order('updated_at', { ascending: false })

    if (error) {
      errorLogger.logDatabaseError(new Error(error.message), 'list_custom_plans', user.id)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    return NextResponse.json({ plans })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/custom-plans',
      method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}

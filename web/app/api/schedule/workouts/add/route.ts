/**
 * Add Library Workout API
 *
 * POST /api/schedule/workouts/add
 *
 * Adds a workout from the library to the user's MANUAL_WORKOUTS instance.
 * This replaces the old override-based approach with direct plan_data modification.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { invokePythonApi } from '@/lib/services/lambda-client'
import { z } from 'zod'
import { differenceInDays } from 'date-fns'
import { parseLocalDate } from '@/lib/utils/date-utils'
import { getWeekdayName as getWeekdayNameFromIndex } from '@/lib/constants/weekdays'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import type { Workout } from '@/lib/types/training-plan'
import { assertTrainingPlanData } from '@/lib/types/type-guards'

const addLibraryWorkoutSchema = z.object({
  workout_id: z.string().min(1, 'Workout ID is required'),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
})

/**
 * Calculate week number from plan start date and target date
 */
function calculateWeekNumber(startDate: string, targetDate: string): number {
  const start = parseLocalDate(startDate)
  const target = parseLocalDate(targetDate)
  const days = differenceInDays(target, start)
  return Math.floor(days / 7) + 1
}

/**
 * Get weekday name from date string
 */
function getWeekdayName(dateString: string): string {
  const date = parseLocalDate(dateString)
  return getWeekdayNameFromIndex(date.getDay())
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = addLibraryWorkoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { workout_id, target_date } = validation.data

    // Validate date is not in the past
    const targetDateObj = parseLocalDate(target_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (targetDateObj < today) {
      return NextResponse.json({ error: 'Cannot add workout to past date' }, { status: 409 })
    }

    // Library workouts always go to MANUAL_WORKOUTS instance
    // Find the user's MANUAL_WORKOUTS instance
    const { data: manualWorkoutsInstance, error: manualWorkoutsError } = await supabase
      .from('plan_instances')
      .select('*')
      .eq('user_id', user.id)
      .eq('instance_type', 'manual_workouts')
      .single()

    if (manualWorkoutsError || !manualWorkoutsInstance) {
      errorLogger.logWarning('MANUAL_WORKOUTS instance not found', {
        userId: user.id,
        path: '/api/schedule/workouts/add',
      })
      return NextResponse.json({ error: 'MANUAL_WORKOUTS instance not found' }, { status: 404 })
    }

    const instance = manualWorkoutsInstance

    // Fetch workout from Python API
    errorLogger.logInfo('Fetching workout from Python API', {
      userId: user.id,
      path: '/api/schedule/workouts/add',
      metadata: {
        workout_id,
        instanceId: instance.id,
        instanceType: 'manual_workouts',
      },
    })

    const workoutResponse = await invokePythonApi<WorkoutLibraryItem>({
      method: 'GET',
      path: `/api/v1/workouts/${workout_id}`,
    })

    if (workoutResponse.statusCode !== 200) {
      errorLogger.logWarning('Failed to fetch workout from Python API', {
        userId: user.id,
        path: '/api/schedule/workouts/add',
        metadata: { workout_id, statusCode: workoutResponse.statusCode },
      })

      return NextResponse.json(
        { error: 'Workout not found', details: workoutResponse.body },
        { status: workoutResponse.statusCode }
      )
    }

    const libraryWorkout = workoutResponse.body

    // Calculate week and weekday for the target date
    const weekNumber = calculateWeekNumber(instance.start_date, target_date)
    const weekday = getWeekdayName(target_date)

    // Get current plan_data and validate structure
    const planData = assertTrainingPlanData(instance.plan_data, 'schedule/workouts/add')

    // Find or create the week in weekly_plan
    const existingWeek = planData.weekly_plan.find((w) => w.week_number === weekNumber)

    if (!existingWeek) {
      // Create new week
      const newWeek = {
        week_number: weekNumber,
        phase: 'base',
        week_tss: 0,
        workouts: [],
      }
      planData.weekly_plan.push(newWeek)
      // Sort weeks by week_number
      planData.weekly_plan.sort((a, b) => a.week_number - b.week_number)
    }

    // Get the week (either existing or newly created)
    const week = planData.weekly_plan.find((w) => w.week_number === weekNumber)!

    // Create the workout object with direct scheduled_date
    const newWorkout: Workout = {
      id: crypto.randomUUID(),
      weekday,
      scheduled_date: target_date,
      name: libraryWorkout.name,
      type: libraryWorkout.type,
      tss: libraryWorkout.base_tss,
      ...(libraryWorkout.detailed_description && {
        description: libraryWorkout.detailed_description,
      }),
      ...(libraryWorkout.structure && { structure: libraryWorkout.structure }),
      library_workout_id: libraryWorkout.id,
    }

    // Add workout to the week
    week.workouts.push(newWorkout)

    // Update week TSS
    week.week_tss = week.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)

    // Update plan_data in database (using MANUAL_WORKOUTS instance)
    const { error: updateError } = await supabase
      .from('plan_instances')
      .update({
        plan_data: planData as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id)
      .eq('user_id', user.id)

    if (updateError) {
      errorLogger.logError(new Error(`Failed to update plan_data: ${updateError.message}`), {
        userId: user.id,
        path: '/api/schedule/workouts/add',
        metadata: {
          workout_id,
          target_date,
          instanceId: instance.id,
        },
      })
      return NextResponse.json({ error: 'Failed to add workout to plan' }, { status: 500 })
    }

    errorLogger.logInfo('Library workout added to MANUAL_WORKOUTS', {
      userId: user.id,
      path: '/api/schedule/workouts/add',
      metadata: {
        workout_id,
        target_date,
        workout_name: libraryWorkout.name,
        week_number: weekNumber,
        weekday,
        instanceId: instance.id,
      },
    })

    return NextResponse.json({
      success: true,
      workout: newWorkout,
      week_number: weekNumber,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/workouts/add',
      method: 'POST',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Schedule Workouts API
 *
 * Handles modifications to scheduled workouts:
 * - PATCH: Move or copy a workout to a different date
 * - DELETE: Remove a workout from the schedule
 *
 * All operations modify plan_data.weekly_plan directly and update scheduled_date fields.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { z } from 'zod'
import { startOfDay, parseISO, differenceInDays } from 'date-fns'
import { parseLocalDate } from '@/lib/utils/date-utils'
import { getWeekdayName } from '@/lib/constants/weekdays'
import type { Workout } from '@/lib/types/training-plan'
import { assertTrainingPlanData } from '@/lib/types/type-guards'

// Validation schemas
const workoutLocationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  index: z.number().int().min(0),
})

const moveOrCopyRequestSchema = z.object({
  action: z.enum(['move', 'copy']),
  source: workoutLocationSchema,
  target: workoutLocationSchema,
})

const deleteRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  index: z.number().int().min(0),
})

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

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
 * Validate that the user owns this instance and operation is allowed
 */
async function validateAccess(
  instanceId: string,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: instance, error } = await supabase
    .from('plan_instances')
    .select('id, user_id, status')
    .eq('id', instanceId)
    .single()

  if (error || !instance) {
    return { valid: false, error: 'Plan instance not found' }
  }

  if (instance.user_id !== userId) {
    return { valid: false, error: 'Not authorized to edit this plan' }
  }

  if (instance.status === 'cancelled' || instance.status === 'completed') {
    return { valid: false, error: 'Cannot edit a completed or cancelled plan' }
  }

  return { valid: true }
}

/**
 * Validate that the target date is not in the past
 */
function validateTargetDate(targetDate: string): { valid: boolean; error?: string } {
  const target = parseISO(targetDate)
  const today = startOfDay(new Date())

  if (target < today) {
    return { valid: false, error: 'Cannot move or copy workouts to past dates' }
  }

  return { valid: true }
}

/**
 * Validate that the source workout is not in the past (for moves only)
 */
function validateSourceDateForMove(sourceDate: string): { valid: boolean; error?: string } {
  const source = parseISO(sourceDate)
  const today = startOfDay(new Date())

  if (source < today) {
    return { valid: false, error: 'Cannot move workouts from past dates' }
  }

  return { valid: true }
}

/**
 * Check if a workout has a matched activity (blocks move, not copy)
 */
async function hasMatchedActivity(
  instanceId: string,
  date: string,
  index: number
): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workout_activity_matches')
    .select('id')
    .eq('plan_instance_id', instanceId)
    .eq('workout_date', date)
    .eq('workout_index', index)
    .maybeSingle()

  if (error) {
    errorLogger.logWarning('Error checking workout match', {
      metadata: { instanceId, date, index, error: error.message },
    })
    return false
  }

  return !!data
}

/**
 * PATCH /api/schedule/[instanceId]/workouts
 *
 * Move or copy a workout to a different date
 *
 * Request body:
 * {
 *   action: 'move' | 'copy',
 *   source: { date: 'YYYY-MM-DD', index: number },
 *   target: { date: 'YYYY-MM-DD', index: number }
 * }
 *
 * Constraints:
 * - Move: blocked if workout has matched activity
 * - Move: source must be current or future date
 * - Copy: allowed even if workout has matched activity
 * - Target must be current or future date
 */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instanceId } = await params

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
    const validation = moveOrCopyRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { action, source, target } = validation.data

    // Validate access
    const accessResult = await validateAccess(instanceId, user.id)
    if (!accessResult.valid) {
      return NextResponse.json({ error: accessResult.error }, { status: 403 })
    }

    // Validate target date
    const targetValidation = validateTargetDate(target.date)
    if (!targetValidation.valid) {
      return NextResponse.json({ error: targetValidation.error }, { status: 400 })
    }

    // For moves, validate source date and check for matches
    if (action === 'move') {
      const sourceValidation = validateSourceDateForMove(source.date)
      if (!sourceValidation.valid) {
        return NextResponse.json({ error: sourceValidation.error }, { status: 400 })
      }

      const hasMatch = await hasMatchedActivity(instanceId, source.date, source.index)
      if (hasMatch) {
        return NextResponse.json(
          { error: 'Cannot move a workout with a matched activity. Use copy instead.' },
          { status: 400 }
        )
      }
    }

    // Fetch the plan instance
    const { data: instance, error: instanceError } = await supabase
      .from('plan_instances')
      .select('plan_data, start_date')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Validate plan_data structure
    const planData = assertTrainingPlanData(instance.plan_data, 'schedule/workouts')

    // Find the source workout by scheduled_date
    let foundWorkout: Workout | null = null
    let sourceWeekIndex: number | null = null
    let sourceWorkoutIndex: number | null = null

    if (planData.weekly_plan) {
      for (let weekIdx = 0; weekIdx < planData.weekly_plan.length; weekIdx++) {
        const week = planData.weekly_plan[weekIdx]
        if (!week) continue

        for (let workoutIdx = 0; workoutIdx < week.workouts.length; workoutIdx++) {
          const workout = week.workouts[workoutIdx]
          if (!workout) continue

          if (workout.scheduled_date === source.date) {
            foundWorkout = workout
            sourceWeekIndex = weekIdx
            sourceWorkoutIndex = workoutIdx
            break
          }
        }
        if (foundWorkout) break
      }
    }

    if (!foundWorkout || sourceWeekIndex === null || sourceWorkoutIndex === null) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Calculate target week number
    const targetWeekNumber = calculateWeekNumber(instance.start_date, target.date)

    // Find or create target week
    let targetWeek = planData.weekly_plan.find((w) => w.week_number === targetWeekNumber)

    if (!targetWeek) {
      // Create new week if it doesn't exist
      targetWeek = {
        week_number: targetWeekNumber,
        phase: 'base',
        week_tss: 0,
        workouts: [],
      }
      planData.weekly_plan.push(targetWeek)
      planData.weekly_plan.sort((a, b) => a.week_number - b.week_number)
    }

    if (action === 'move') {
      // MOVE: Update workout's scheduled_date and weekday, then move it between weeks
      foundWorkout.scheduled_date = target.date
      foundWorkout.weekday = getWeekdayName(parseLocalDate(target.date).getDay())

      // Remove from source week
      const sourceWeek = planData.weekly_plan[sourceWeekIndex]
      if (sourceWeek) {
        sourceWeek.workouts.splice(sourceWorkoutIndex, 1)
        sourceWeek.week_tss = sourceWeek.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
      }

      // Add to target week
      targetWeek.workouts.push(foundWorkout)
      targetWeek.week_tss = targetWeek.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
    } else {
      // COPY: Create a duplicate workout with new scheduled_date
      const copiedWorkout: Workout = {
        ...foundWorkout,
        id: crypto.randomUUID(), // New unique ID
        scheduled_date: target.date,
        weekday: getWeekdayName(parseLocalDate(target.date).getDay()),
      }

      // Add to target week
      targetWeek.workouts.push(copiedWorkout)
      targetWeek.week_tss = targetWeek.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
    }

    // Save updated plan_data to database
    const { error: updateError } = await supabase
      .from('plan_instances')
      .update({
        plan_data: planData as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanceId)

    if (updateError) {
      errorLogger.logError(new Error(`Failed to ${action} workout: ${updateError.message}`), {
        userId: user.id,
        path: `/api/schedule/${instanceId}/workouts`,
        metadata: { instanceId, action, source, target },
      })
      return NextResponse.json({ error: `Failed to ${action} workout` }, { status: 500 })
    }

    errorLogger.logInfo(`Workout ${action} successful`, {
      userId: user.id,
      metadata: {
        instanceId,
        workoutName: foundWorkout.name,
        sourceDate: source.date,
        targetDate: target.date,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/workouts',
      method: 'PATCH',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/schedule/[instanceId]/workouts
 *
 * Remove a workout from the schedule
 *
 * Request body:
 * {
 *   date: 'YYYY-MM-DD',
 *   index: number
 * }
 *
 * Constraints:
 * - Can only delete from current or future dates
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instanceId } = await params

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
    const validation = deleteRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { date, index } = validation.data

    // Validate access
    const accessResult = await validateAccess(instanceId, user.id)
    if (!accessResult.valid) {
      return NextResponse.json({ error: accessResult.error }, { status: 403 })
    }

    // Validate date (must be current or future)
    const dateValidation = validateTargetDate(date)
    if (!dateValidation.valid) {
      return NextResponse.json({ error: 'Cannot delete workouts from past dates' }, { status: 400 })
    }

    // Fetch the plan instance
    const { data: instance, error: instanceError } = await supabase
      .from('plan_instances')
      .select('plan_data')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Validate plan_data structure
    const planData = assertTrainingPlanData(instance.plan_data, 'schedule/workouts')

    // Find and remove the workout by scheduled_date
    let removed = false
    let removedWorkoutName = ''
    let removedWorkoutId: string | null = null

    if (planData.weekly_plan) {
      for (let weekIdx = 0; weekIdx < planData.weekly_plan.length; weekIdx++) {
        const week = planData.weekly_plan[weekIdx]
        if (!week) continue

        for (let workoutIdx = 0; workoutIdx < week.workouts.length; workoutIdx++) {
          const workout = week.workouts[workoutIdx]
          if (!workout) continue

          if (workout.scheduled_date === date) {
            removedWorkoutName = workout.name
            removedWorkoutId = workout.id || null
            week.workouts.splice(workoutIdx, 1)
            week.week_tss = week.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
            removed = true
            break
          }
        }
        if (removed) break
      }
    }

    if (!removed) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Save updated plan_data to database
    const { error: updateError } = await supabase
      .from('plan_instances')
      .update({
        plan_data: planData as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanceId)

    if (updateError) {
      errorLogger.logError(new Error(`Failed to delete workout: ${updateError.message}`), {
        userId: user.id,
        path: `/api/schedule/${instanceId}/workouts`,
        metadata: { instanceId, date, index },
      })
      return NextResponse.json({ error: 'Failed to delete workout' }, { status: 500 })
    }

    // Delete any associated match from workout_activity_matches
    // Use workout_id if available (preferred), otherwise fall back to date+index
    let matchDeleteQuery = supabase
      .from('workout_activity_matches')
      .delete()
      .eq('plan_instance_id', instanceId)

    if (removedWorkoutId) {
      matchDeleteQuery = matchDeleteQuery.eq('workout_id', removedWorkoutId)
    } else {
      matchDeleteQuery = matchDeleteQuery.eq('workout_date', date).eq('workout_index', index)
    }

    const { error: matchDeleteError } = await matchDeleteQuery

    if (matchDeleteError) {
      // Log but don't fail the delete operation
      errorLogger.logWarning('Failed to delete workout match', {
        metadata: {
          instanceId,
          workoutId: removedWorkoutId,
          date,
          index,
          error: matchDeleteError.message,
        },
      })
    }

    errorLogger.logInfo('Workout deleted successfully', {
      userId: user.id,
      metadata: {
        instanceId,
        workoutName: removedWorkoutName,
        date,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/workouts',
      method: 'DELETE',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

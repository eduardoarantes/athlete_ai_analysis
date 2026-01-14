/**
 * Individual Manual Workout API
 *
 * Handles operations on a single manual workout:
 * - GET: Fetch a single manual workout
 * - PATCH: Update a manual workout (date or workout data)
 * - DELETE: Delete a manual workout (cascades to matches)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { z } from 'zod'
import {
  getManualWorkout,
  updateManualWorkout,
  deleteManualWorkout,
} from '@/lib/services/manual-workout-service'
import { isPastDate } from '@/lib/utils/date-utils'

// Validation schema for PATCH request
const updateManualWorkoutSchema = z.object({
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduled_date must be YYYY-MM-DD format')
    .optional(),
  workout_data: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      tss: z.number().optional(),
      structure: z.any(),
      detailed_description: z.string().optional(),
      weekday: z.string().optional(),
      scheduled_date: z.string().optional(),
      source: z.string().optional(),
      library_workout_id: z.string().optional(),
    })
    .optional(),
  source_plan_instance_id: z.string().nullish(),
})

interface RouteParams {
  params: Promise<{ workoutId: string }>
}

/**
 * GET /api/manual-workouts/[workoutId]
 *
 * Fetch a single manual workout by ID
 *
 * Returns: Manual workout object
 */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { workoutId } = await params

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch workout from service layer
    const workout = await getManualWorkout(supabase, workoutId)

    if (!workout) {
      return NextResponse.json({ error: 'Manual workout not found' }, { status: 404 })
    }

    // Verify ownership (RLS should handle this, but double-check)
    if (workout.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    errorLogger.logInfo('Manual workout fetched', {
      userId: user.id,
      metadata: { workout_id: workoutId },
    })

    return NextResponse.json({ success: true, data: workout })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/manual-workouts/${(await params).workoutId}`,
      method: 'GET',
    })

    return NextResponse.json({ error: 'Failed to fetch manual workout' }, { status: 500 })
  }
}

/**
 * PATCH /api/manual-workouts/[workoutId]
 *
 * Update a manual workout
 *
 * Request body:
 * {
 *   scheduled_date?: string (YYYY-MM-DD),
 *   workout_data?: Workout,
 *   source_plan_instance_id?: string | null
 * }
 *
 * Returns: Updated manual workout
 */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { workoutId } = await params

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
    const validation = updateManualWorkoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Validate date is not in the past (only if scheduled_date is being updated)
    if (validation.data.scheduled_date !== undefined) {
      if (isPastDate(validation.data.scheduled_date)) {
        return NextResponse.json({ error: 'Cannot update workout to past date' }, { status: 409 })
      }
    }

    // Check if workout exists and user owns it
    const existingWorkout = await getManualWorkout(supabase, workoutId)

    if (!existingWorkout) {
      return NextResponse.json({ error: 'Manual workout not found' }, { status: 404 })
    }

    if (existingWorkout.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update input by explicitly including only defined fields
    // This approach avoids the exactOptionalPropertyTypes issue
    const updateInput: Record<string, unknown> = {}

    if (validation.data.scheduled_date !== undefined) {
      updateInput.scheduled_date = validation.data.scheduled_date
    }
    if (validation.data.workout_data !== undefined) {
      updateInput.workout_data = validation.data.workout_data
    }
    if (validation.data.source_plan_instance_id !== undefined) {
      updateInput.source_plan_instance_id = validation.data.source_plan_instance_id
    }

    // Update workout - use any to bypass exactOptionalPropertyTypes limitation
    // The input is validated by Zod and constructed safely above
    const updatedWorkout = await updateManualWorkout(supabase, workoutId, updateInput as any)

    errorLogger.logInfo('Manual workout updated', {
      userId: user.id,
      metadata: {
        workout_id: workoutId,
        updated_fields: Object.keys(validation.data),
      },
    })

    return NextResponse.json({ success: true, data: updatedWorkout })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/manual-workouts/${(await params).workoutId}`,
      method: 'PATCH',
    })

    return NextResponse.json({ error: 'Failed to update manual workout' }, { status: 500 })
  }
}

/**
 * DELETE /api/manual-workouts/[workoutId]
 *
 * Delete a manual workout
 * Note: Cascade delete will remove associated workout_matches via ON DELETE CASCADE
 *
 * Returns: Success response
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { workoutId } = await params

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if workout exists and user owns it
    const existingWorkout = await getManualWorkout(supabase, workoutId)

    if (!existingWorkout) {
      return NextResponse.json({ error: 'Manual workout not found' }, { status: 404 })
    }

    if (existingWorkout.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete workout
    await deleteManualWorkout(supabase, workoutId)

    errorLogger.logInfo('Manual workout deleted', {
      userId: user.id,
      metadata: {
        workout_id: workoutId,
        scheduled_date: existingWorkout.scheduled_date,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/manual-workouts/${(await params).workoutId}`,
      method: 'DELETE',
    })

    return NextResponse.json({ error: 'Failed to delete manual workout' }, { status: 500 })
  }
}

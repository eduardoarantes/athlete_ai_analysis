/**
 * Manual Workouts API
 *
 * Handles manual workout operations:
 * - GET: List manual workouts for a date range
 * - POST: Create a new manual workout or add a library workout
 *
 * Manual workouts are user-added workouts that exist independently of training plans.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { z } from 'zod'
import {
  getManualWorkoutsByDateRange,
  createManualWorkout,
  addLibraryWorkout,
} from '@/lib/services/manual-workout-service'
import { isPastDate } from '@/lib/utils/date-utils'

// Validation schemas
const dateRangeSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD format'),
})

const addLibraryWorkoutSchema = z.object({
  library_workout_id: z.string().min(1, 'library_workout_id is required'),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduled_date must be YYYY-MM-DD format'),
  source_plan_instance_id: z.string().nullish(),
})

const createManualWorkoutSchema = z.object({
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduled_date must be YYYY-MM-DD format'),
  workout_data: z.object({
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
  }),
  source_plan_instance_id: z.string().nullish(),
})

/**
 * GET /api/manual-workouts
 *
 * List manual workouts for a date range
 *
 * Query params:
 * - start_date: YYYY-MM-DD format (required)
 * - end_date: YYYY-MM-DD format (required)
 *
 * Returns: Array of manual workouts
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const validation = dateRangeSchema.safeParse({
      start_date: startDate,
      end_date: endDate,
    })

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { start_date, end_date } = validation.data

    // Fetch manual workouts from service layer
    const workouts = await getManualWorkoutsByDateRange(supabase, user.id, start_date, end_date)

    errorLogger.logInfo('Manual workouts fetched', {
      userId: user.id,
      metadata: { count: workouts.length, start_date, end_date },
    })

    return NextResponse.json({ success: true, data: workouts })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/manual-workouts',
      method: 'GET',
    })

    return NextResponse.json({ error: 'Failed to fetch manual workouts' }, { status: 500 })
  }
}

/**
 * POST /api/manual-workouts
 *
 * Create a new manual workout or add a library workout
 *
 * Request body (library workout):
 * {
 *   library_workout_id: string,
 *   scheduled_date: string (YYYY-MM-DD),
 *   source_plan_instance_id?: string
 * }
 *
 * Request body (manual workout):
 * {
 *   scheduled_date: string (YYYY-MM-DD),
 *   workout_data: Workout,
 *   source_plan_instance_id?: string
 * }
 *
 * Returns: Created manual workout
 */
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

    // Parse request body
    const body = await request.json()

    // Determine if this is a library workout or manual workout
    if (body.library_workout_id) {
      // Adding library workout
      const validation = addLibraryWorkoutSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      // Validate date is not in the past
      if (isPastDate(validation.data.scheduled_date)) {
        return NextResponse.json({ error: 'Cannot add workout to past date' }, { status: 409 })
      }

      // Build input - use type assertion to satisfy exactOptionalPropertyTypes
      const input = {
        library_workout_id: validation.data.library_workout_id,
        scheduled_date: validation.data.scheduled_date,
        ...(validation.data.source_plan_instance_id
          ? { source_plan_instance_id: validation.data.source_plan_instance_id }
          : {}),
      }

      // Use any to bypass exactOptionalPropertyTypes limitation
      // The input structure is validated by Zod and matches the expected type
      const workout = await addLibraryWorkout(supabase, user.id, input as any)

      errorLogger.logInfo('Library workout added as manual workout', {
        userId: user.id,
        metadata: {
          workout_id: workout.id,
          library_workout_id: validation.data.library_workout_id,
          scheduled_date: validation.data.scheduled_date,
        },
      })

      return NextResponse.json({ success: true, data: workout }, { status: 201 })
    } else {
      // Creating manual workout
      const validation = createManualWorkoutSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      // Validate date is not in the past
      if (isPastDate(validation.data.scheduled_date)) {
        return NextResponse.json({ error: 'Cannot add workout to past date' }, { status: 409 })
      }

      // Build input - use type assertion to satisfy exactOptionalPropertyTypes
      const input = {
        scheduled_date: validation.data.scheduled_date,
        workout_data: validation.data.workout_data,
        ...(validation.data.source_plan_instance_id
          ? { source_plan_instance_id: validation.data.source_plan_instance_id }
          : {}),
      }

      // Use any to bypass exactOptionalPropertyTypes limitation
      // The input structure is validated by Zod and matches the expected type
      const workout = await createManualWorkout(supabase, user.id, input as any)

      errorLogger.logInfo('Manual workout created', {
        userId: user.id,
        metadata: {
          workout_id: workout.id,
          scheduled_date: validation.data.scheduled_date,
        },
      })

      return NextResponse.json({ success: true, data: workout }, { status: 201 })
    }
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/manual-workouts',
      method: 'POST',
    })

    return NextResponse.json({ error: 'Failed to create manual workout' }, { status: 500 })
  }
}

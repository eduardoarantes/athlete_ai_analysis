/**
 * Add Library Workout API
 *
 * POST /api/schedule/[instanceId]/workouts/add
 *
 * Adds a workout from the library to the schedule.
 * Library workouts are stored as copies with source_date="library"
 * and source_index containing the library workout ID (stored as string in JSON).
 *
 * Part of Issue #72: Workout Library Sidebar
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { scheduleEditService } from '@/lib/services/schedule-edit-service'
import { z } from 'zod'
import { startOfDay, parseISO } from 'date-fns'

const intervalPartSchema = z.object({
  duration_min: z.number(),
  power_low_pct: z.number(),
  power_high_pct: z.number(),
  description: z.string().optional(),
})

const workoutSegmentSchema = z.object({
  type: z.string(),
  duration_min: z.number(),
  power_low_pct: z.number().nullish(),
  power_high_pct: z.number().nullish(),
  description: z.string().nullish(),
  sets: z.number().nullish(),
  work: intervalPartSchema.nullish(),
  recovery: intervalPartSchema.nullish(),
})

const workoutDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  tss: z.number(),
  duration_min: z.number().nullish(),
  description: z.string().nullish(),
  segments: z.array(workoutSegmentSchema).nullish(),
})

const addLibraryWorkoutSchema = z.object({
  workout_id: z.string().min(1, 'Workout ID is required'),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  workout_data: workoutDataSchema.optional(),
})

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    const validation = addLibraryWorkoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { workout_id, target_date, workout_data } = validation.data

    // Validate date is not in the past
    const targetDateObj = parseISO(target_date)
    const today = startOfDay(new Date())
    if (targetDateObj < today) {
      return NextResponse.json({ error: 'Cannot add workout to past date' }, { status: 409 })
    }

    // Transform workout_data to convert nulls to undefined (Zod nullish produces null | undefined)
    const normalizedWorkoutData = workout_data
      ? {
          name: workout_data.name,
          type: workout_data.type,
          tss: workout_data.tss,
          duration_min: workout_data.duration_min ?? undefined,
          description: workout_data.description ?? undefined,
          segments: workout_data.segments?.map((seg) => ({
            type: seg.type as 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'work' | 'tempo',
            duration_min: seg.duration_min,
            power_low_pct: seg.power_low_pct ?? undefined,
            power_high_pct: seg.power_high_pct ?? undefined,
            description: seg.description ?? undefined,
            sets: seg.sets ?? undefined,
            work: seg.work ?? undefined,
            recovery: seg.recovery ?? undefined,
          })),
        }
      : undefined

    // Add library workout to schedule with workout data for persistence
    const result = await scheduleEditService.addLibraryWorkout(
      instanceId,
      user.id,
      workout_id,
      target_date,
      normalizedWorkoutData
    )

    if (!result.success) {
      errorLogger.logWarning('Add library workout failed', {
        userId: user.id,
        path: `/api/schedule/${instanceId}/workouts/add`,
        metadata: { error: result.error, workout_id, target_date },
      })

      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    errorLogger.logInfo('Library workout added to schedule', {
      userId: user.id,
      path: `/api/schedule/${instanceId}/workouts/add`,
      metadata: { workout_id, target_date },
    })

    return NextResponse.json({
      success: true,
      updatedOverrides: result.updatedOverrides,
      assignedIndex: result.assignedIndex,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/workouts/add',
      method: 'POST',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

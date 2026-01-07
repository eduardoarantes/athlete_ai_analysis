/**
 * Schedule Workouts API
 *
 * Handles modifications to scheduled workouts:
 * - PATCH: Move or copy a workout to a different date
 * - DELETE: Remove a workout from the schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { scheduleEditService } from '@/lib/services/schedule-edit-service'
import { z } from 'zod'

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

    // Execute the operation
    let result
    if (action === 'move') {
      result = await scheduleEditService.moveWorkout(instanceId, user.id, source, target)
    } else {
      result = await scheduleEditService.copyWorkout(instanceId, user.id, source, target)
    }

    if (!result.success) {
      errorLogger.logWarning(`Schedule edit ${action} failed`, {
        userId: user.id,
        path: `/api/schedule/${instanceId}/workouts`,
        metadata: {
          action,
          source,
          target,
          error: result.error,
        },
      })

      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    errorLogger.logInfo(`Schedule edit ${action} successful`, {
      userId: user.id,
      path: `/api/schedule/${instanceId}/workouts`,
      metadata: {
        action,
        source,
        target,
      },
    })

    return NextResponse.json({
      success: true,
      updatedOverrides: result.updatedOverrides,
    })
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

    // Execute the delete
    const result = await scheduleEditService.deleteWorkout(instanceId, user.id, { date, index })

    if (!result.success) {
      errorLogger.logWarning('Schedule edit delete failed', {
        userId: user.id,
        path: `/api/schedule/${instanceId}/workouts`,
        metadata: {
          date,
          index,
          error: result.error,
        },
      })

      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    errorLogger.logInfo('Schedule edit delete successful', {
      userId: user.id,
      path: `/api/schedule/${instanceId}/workouts`,
      metadata: {
        date,
        index,
      },
    })

    return NextResponse.json({
      success: true,
      updatedOverrides: result.updatedOverrides,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/workouts',
      method: 'DELETE',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

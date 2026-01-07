/**
 * Schedule Reset API
 *
 * POST: Reset schedule to original plan (removes all modifications)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { scheduleEditService } from '@/lib/services/schedule-edit-service'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

/**
 * POST /api/schedule/[instanceId]/reset
 *
 * Reset all workout modifications to the original plan
 * Clears all moves, copies, and deletes
 */
export async function POST(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

    // Execute the reset
    const result = await scheduleEditService.resetToOriginal(instanceId, user.id)

    if (!result.success) {
      errorLogger.logWarning('Schedule reset failed', {
        userId: user.id,
        path: `/api/schedule/${instanceId}/reset`,
        metadata: {
          error: result.error,
        },
      })

      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    errorLogger.logInfo('Schedule reset successful', {
      userId: user.id,
      path: `/api/schedule/${instanceId}/reset`,
    })

    return NextResponse.json({
      success: true,
      message: 'Schedule reset to original plan',
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/reset',
      method: 'POST',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

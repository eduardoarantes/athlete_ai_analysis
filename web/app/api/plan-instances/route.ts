import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { planInstanceService } from '@/lib/services/plan-instance-service'
import type { CreatePlanInstanceInput } from '@/lib/types/training-plan'

/**
 * List plan instances for the current user
 * GET /api/plan-instances
 *
 * Query params:
 * - status: comma-separated list of statuses to filter by (scheduled,active,completed,cancelled)
 * - includeCompleted: if true, include completed and cancelled instances
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const includeCompleted = searchParams.get('includeCompleted') === 'true'

    const status = statusParam
      ? (statusParam.split(',') as ('scheduled' | 'active' | 'completed' | 'cancelled')[])
      : undefined

    const instances = await planInstanceService.listInstances(user.id, {
      ...(status && { status }),
      includeCompleted,
    })

    return NextResponse.json({ instances })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/plan-instances',
      method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch plan instances' }, { status: 500 })
  }
}

/**
 * Create a new plan instance from a template
 * POST /api/plan-instances
 *
 * Body:
 * - template_id: string - ID of the training plan template
 * - start_date: string - ISO date string (YYYY-MM-DD)
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

    const body = (await request.json()) as CreatePlanInstanceInput

    // Validate input
    if (!body.template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
    }

    if (!body.start_date) {
      return NextResponse.json({ error: 'start_date is required' }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(body.start_date)) {
      return NextResponse.json(
        { error: 'start_date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    try {
      const instance = await planInstanceService.createInstance(user.id, body)
      return NextResponse.json({ instance }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      // Handle overlap error specifically
      if (message.includes('conflict') || message.includes('overlap')) {
        // Get the conflicting instances for better error response
        const weeksTotal = 12 // Default, will be recalculated in service
        const endDate = new Date(body.start_date)
        endDate.setDate(endDate.getDate() + weeksTotal * 7)

        const overlapCheck = await planInstanceService.checkOverlap(
          user.id,
          body.start_date,
          endDate.toISOString().split('T')[0]!
        )

        return NextResponse.json(
          {
            error: 'OVERLAP',
            message,
            conflicts: overlapCheck.conflicts,
          },
          { status: 409 }
        )
      }

      // Handle template not found
      if (message.includes('not found')) {
        return NextResponse.json({ error: message }, { status: 404 })
      }

      throw error
    }
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/plan-instances',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Failed to create plan instance' }, { status: 500 })
  }
}

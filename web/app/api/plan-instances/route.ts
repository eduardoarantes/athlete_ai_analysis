import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { planInstanceService } from '@/lib/services/plan-instance-service'
import { planInstanceValidator } from '@/lib/services/validation/plan-instance-validator'
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

    // Fetch template to calculate end date for validation
    const { data: template, error: templateError } = await supabase
      .from('training_plans')
      .select('id, weeks_total, plan_data')
      .eq('id', body.template_id)
      .eq('user_id', user.id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Training plan template not found' }, { status: 404 })
    }

    // Calculate end date based on template duration
    const weeksTotal =
      template.weeks_total ||
      (template.plan_data as { plan_metadata?: { total_weeks?: number } })?.plan_metadata
        ?.total_weeks ||
      12
    const endDate = new Date(body.start_date)
    endDate.setDate(endDate.getDate() + weeksTotal * 7)
    const endDateStr = endDate.toISOString().split('T')[0]!

    // Validate no overlap with existing plan instances using PlanInstanceValidator
    const overlapCheck = await planInstanceValidator.checkOverlap({
      userId: user.id,
      startDate: body.start_date,
      endDate: endDateStr,
    })

    if (overlapCheck.hasOverlap) {
      return NextResponse.json(
        {
          error: 'Plan instance overlaps with existing plan',
          overlappingInstance: overlapCheck.overlappingInstance,
        },
        { status: 409 }
      )
    }

    try {
      const instance = await planInstanceService.createInstance(user.id, body)
      return NextResponse.json({ instance }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      // Handle template not found (shouldn't happen after our check above)
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

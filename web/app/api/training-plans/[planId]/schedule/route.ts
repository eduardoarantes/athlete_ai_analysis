import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

/**
 * POST /api/training-plans/:planId/schedule
 * Schedule a training plan (create an instance with a start date)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId } = await params

    // Parse request body
    const body = await request.json()
    const { start_date } = body

    // Validation
    if (!start_date || typeof start_date !== 'string') {
      return NextResponse.json({ error: 'Start date is required' }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(start_date)) {
      return NextResponse.json(
        { error: 'Start date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // Check if start date is not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDateObj = new Date(start_date)

    if (startDateObj < today) {
      return NextResponse.json({ error: 'Start date cannot be in the past' }, { status: 400 })
    }

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('training_plans')
      .select('id, name, weeks_total, plan_data')
      .eq('id', planId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Plan template not found' }, { status: 404 })
    }

    // Calculate end date
    const endDate = new Date(startDateObj)
    endDate.setDate(endDate.getDate() + (template.weeks_total || 12) * 7 - 1)
    const end_date = endDate.toISOString().split('T')[0]

    // Create the plan instance
    const { data: instance, error: instanceError } = await supabase
      .from('plan_instances')
      .insert({
        user_id: user.id,
        template_id: template.id,
        name: template.name,
        start_date,
        end_date,
        weeks_total: template.weeks_total || 12,
        plan_data: template.plan_data,
        status: 'scheduled',
      })
      .select('id')
      .single()

    if (instanceError) {
      errorLogger.logError(new Error(instanceError.message), {
        path: '/api/training-plans/:planId/schedule',
        method: 'POST',
        userId: user.id,
        metadata: { error: instanceError, planId },
      })
      return NextResponse.json({ error: 'Failed to schedule plan' }, { status: 500 })
    }

    errorLogger.logInfo('Plan instance created', {
      userId: user.id,
      metadata: {
        instanceId: instance.id,
        templateId: template.id,
        startDate: start_date,
      },
    })

    return NextResponse.json({
      instance_id: instance.id,
      template_id: template.id,
      start_date,
      end_date,
      status: 'scheduled',
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/training-plans/:planId/schedule',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

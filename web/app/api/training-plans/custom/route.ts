import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

/**
 * POST /api/training-plans/custom
 * Create a new custom training plan (empty plan ready for manual workout addition)
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const { name, weeks, goal } = body

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    }

    if (!weeks || typeof weeks !== 'number' || weeks < 1 || weeks > 52) {
      return NextResponse.json(
        { error: 'Duration must be between 1 and 52 weeks' },
        { status: 400 }
      )
    }

    // Create empty plan data structure
    const emptyPlanData = {
      athlete_profile: {
        ftp: 200, // Default FTP, will be overridden if user has profile
        weight: 70, // Default weight
      },
      weeks: Array.from({ length: weeks }, (_, weekIndex) => ({
        week_number: weekIndex + 1,
        days: [],
      })),
    }

    // Insert the plan template
    const { data: templateData, error: templateError } = await supabase
      .from('training_plans')
      .insert({
        name,
        description: `Custom ${weeks}-week plan`,
        weeks_total: weeks,
        plan_data: emptyPlanData,
        user_id: user.id,
        goal: goal || '',
        status: 'draft',
      })
      .select('id')
      .single()

    if (templateError) {
      errorLogger.logError(new Error(templateError.message), {
        path: '/api/training-plans/custom',
        method: 'POST',
        userId: user.id,
        metadata: { error: templateError },
      })
      return NextResponse.json({ error: 'Failed to create plan template' }, { status: 500 })
    }

    errorLogger.logInfo('Custom plan template created', {
      userId: user.id,
      metadata: {
        templateId: templateData.id,
        planName: name,
        weeks,
      },
    })

    return NextResponse.json({
      id: templateData.id,
      name,
      weeks,
      goal,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/training-plans/custom',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

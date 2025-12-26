import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { SavePlanRequest, SavePlanResponse } from '@/lib/types/plan-builder'
import type { Json } from '@/lib/types/database'

/**
 * Create a new custom training plan
 * POST /api/custom-plans
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

    const body: SavePlanRequest = await request.json()

    // Validate request
    if (!body.metadata?.name) {
      return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    }

    // Create the training plan first
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        name: body.metadata.name,
        description: body.metadata.description ?? null,
        goal: body.metadata.goal ?? '',
        weeks_total: body.weeks.length,
        target_ftp: body.metadata.targetFtp ?? null,
        created_from: 'custom_builder',
        is_draft: !body.publish,
        status: body.publish ? 'active' : 'draft',
        // Custom plans don't use plan_data JSONB - they use custom_plan_weeks table
        plan_data: {},
        metadata: {
          source: 'manual',
          generated_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single()

    if (planError) {
      errorLogger.logDatabaseError(new Error(planError.message), 'create_custom_plan', user.id)
      return NextResponse.json(
        { error: 'Failed to create plan', details: planError.message },
        { status: 500 }
      )
    }

    // Insert weeks
    if (body.weeks.length > 0) {
      const weeksToInsert = body.weeks.map((week) => ({
        plan_id: plan.id,
        week_number: week.weekNumber,
        phase: week.phase,
        workouts_data: week.workouts as unknown as Json,
        weekly_tss: week.weeklyTss,
        notes: week.notes ?? null,
      }))

      const { error: weeksError } = await supabase.from('custom_plan_weeks').insert(weeksToInsert)

      if (weeksError) {
        // Rollback: delete the plan if weeks insertion fails
        await supabase.from('training_plans').delete().eq('id', plan.id)
        errorLogger.logDatabaseError(
          new Error(weeksError.message),
          'create_custom_plan_weeks',
          user.id
        )
        return NextResponse.json(
          { error: 'Failed to save plan weeks', details: weeksError.message },
          { status: 500 }
        )
      }
    }

    const response: SavePlanResponse = {
      success: true,
      planId: plan.id,
      savedAt: new Date().toISOString(),
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/custom-plans',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}

/**
 * List custom plans for the current user
 * GET /api/custom-plans
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: plans, error } = await supabase
      .from('training_plans')
      .select('id, name, description, goal, weeks_total, status, is_draft, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('created_from', 'custom_builder')
      .order('updated_at', { ascending: false })

    if (error) {
      errorLogger.logDatabaseError(new Error(error.message), 'list_custom_plans', user.id)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    return NextResponse.json({ plans })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/custom-plans',
      method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}

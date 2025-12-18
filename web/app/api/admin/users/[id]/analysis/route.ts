/**
 * Admin API Route: Trigger Performance Analysis for a User
 *
 * POST /api/admin/users/[id]/analysis
 * Triggers performance analysis for the specified user by calling the Python backend.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invokePythonApi } from '@/lib/services/lambda-client'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { requireAdmin } from '@/lib/guards/admin-guard'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface AnalysisJobResponse {
  job_id: string
  status: string
  message: string
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params
    const supabase = await createClient()

    // Verify admin role
    const auth = await requireAdmin(supabase)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 })
    }

    // Parse request body for period_months
    const body = await request.json().catch(() => ({}))
    const periodMonths = body.period_months || 6

    // Fetch target user's athlete profile
    const { data: targetProfile, error: profileError } = await supabase
      .from('athlete_profiles')
      .select('ftp, weight_kg, max_hr, age, goals')
      .eq('user_id', userId)
      .single()

    if (profileError || !targetProfile) {
      errorLogger.logWarning('Athlete profile not found for user', {
        ...(auth.userId && { userId: auth.userId }),
        metadata: { targetUserId: userId },
      })
      return NextResponse.json(
        { error: 'User does not have an athlete profile configured' },
        { status: 400 }
      )
    }

    // Validate required profile fields
    if (!targetProfile.ftp || !targetProfile.weight_kg || !targetProfile.age) {
      return NextResponse.json(
        {
          error: 'Incomplete athlete profile',
          details: 'User must have FTP, weight, and age configured',
        },
        { status: 400 }
      )
    }

    // Call Python backend to start analysis
    const response = await invokePythonApi<AnalysisJobResponse>({
      method: 'POST',
      path: '/api/v1/analysis/performance',
      body: {
        user_id: userId,
        athlete_profile: {
          ftp: targetProfile.ftp,
          weight_kg: Number(targetProfile.weight_kg),
          max_hr: targetProfile.max_hr,
          age: targetProfile.age,
          goals: targetProfile.goals || [],
        },
        period_months: periodMonths,
      },
    })

    if (response.statusCode !== 202) {
      errorLogger.logError(new Error('Failed to start performance analysis'), {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]/analysis',
        method: 'POST',
        metadata: { targetUserId: userId, response: response.body },
      })
      return NextResponse.json(
        { error: 'Failed to start analysis', details: response.body },
        { status: response.statusCode }
      )
    }

    errorLogger.logInfo('Admin triggered performance analysis', {
      ...(auth.userId && { userId: auth.userId }),
      metadata: { targetUserId: userId, jobId: response.body.job_id },
    })

    return NextResponse.json({
      success: true,
      job_id: response.body.job_id,
      status: response.body.status,
      message: response.body.message,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/admin/users/[id]/analysis',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/users/[id]/analysis?job_id=xxx
 * Check status of an analysis job
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await params // Extract params (userId not needed for job status check)
    const supabase = await createClient()

    // Verify admin role
    const auth = await requireAdmin(supabase)
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 })
    }

    // Get job_id from query params
    const jobId = request.nextUrl.searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    // Call Python backend to get job status
    const response = await invokePythonApi({
      method: 'GET',
      path: `/api/v1/analysis/status/${jobId}`,
    })

    return NextResponse.json(response.body, { status: response.statusCode })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/admin/users/[id]/analysis',
      method: 'GET',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

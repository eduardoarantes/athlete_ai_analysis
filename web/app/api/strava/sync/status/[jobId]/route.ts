/**
 * Job Status Polling Endpoint
 * GET /api/strava/sync/status/[jobId]
 *
 * Allows clients to poll for background job status and results
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jobService } from '@/lib/services/job-service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Await params (Next.js 15 requirement)
    const { jobId } = await params

    // Get job status
    const job = await jobService.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify job belongs to authenticated user
    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - This job belongs to another user' },
        { status: 403 }
      )
    }

    // Return job status
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      updatedAt: job.updated_at,
    })
  } catch (error) {
    console.error('[API] Failed to get job status:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get job status',
      },
      { status: 500 }
    )
  }
}

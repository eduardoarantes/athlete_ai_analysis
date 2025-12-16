import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cyclingCoachService } from '@/lib/services/cycling-coach-service'

/**
 * Get training plan generation job status
 * GET /api/coach/plan/status/[jobId]
 *
 * Returns:
 * - status: queued | running | completed | failed
 * - progress: { phase, percentage }
 * - result: { plan_id, plan_data } (when completed)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { jobId } = await params

    // Get job status from service
    const job = await cyclingCoachService.getJobStatus(jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Job status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

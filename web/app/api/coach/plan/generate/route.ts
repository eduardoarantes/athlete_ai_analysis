import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cyclingCoachService } from '@/lib/services/cycling-coach-service'

/**
 * Generate a training plan using the Python AI backend
 * POST /api/coach/plan/generate
 *
 * This endpoint:
 * 1. Receives wizard data from the frontend
 * 2. Exports user activities and profile to CSV/JSON
 * 3. Spawns Python CLI process to generate plan
 * 4. Returns job ID for status polling
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

    // Parse request body (wizard data)
    const wizardData = await request.json()

    // Validate required fields
    const validationErrors: string[] = []

    if (!wizardData.goal) {
      validationErrors.push('Goal is required')
    }

    if (!wizardData.profile) {
      validationErrors.push('Profile is required')
    } else {
      if (!wizardData.profile.ftp || wizardData.profile.ftp <= 0) {
        validationErrors.push('FTP must be a positive number')
      }
      if (!wizardData.profile.weight || wizardData.profile.weight <= 0) {
        validationErrors.push('Weight must be a positive number')
      }
      if (!wizardData.profile.trainingDays || wizardData.profile.trainingDays.length === 0) {
        validationErrors.push('At least one training day must be selected')
      }
    }

    if (!wizardData.timeline) {
      validationErrors.push('Timeline is required')
    } else if (wizardData.timeline.hasEvent && !wizardData.timeline.eventDate) {
      validationErrors.push('Event date is required when training for an event')
    } else if (!wizardData.timeline.hasEvent && !wizardData.timeline.weeks) {
      validationErrors.push('Training duration is required')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // Generate training plan using Python backend
    const job = await cyclingCoachService.generateTrainingPlan(user.id, wizardData)

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: 'Training plan generation started. Poll /api/coach/plan/status/{jobId} for updates.',
    })
  } catch (error) {
    console.error('Training plan generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate training plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

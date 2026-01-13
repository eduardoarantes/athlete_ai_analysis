import { NextRequest, NextResponse } from 'next/server'
import { WorkoutMatchService } from '@/lib/services/workout-match-service'

/**
 * GET /api/schedule/matches?instanceIds=id1,id2
 * Get all matches for plan instances
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instanceIds = searchParams.get('instanceIds')?.split(',').filter(Boolean) || []

    if (instanceIds.length === 0) {
      return NextResponse.json({ error: 'instanceIds required' }, { status: 400 })
    }

    const service = await WorkoutMatchService.create()
    const matches = await service.getMatchesForInstances(instanceIds)

    // Convert Map to object for JSON serialization
    const matchesObject: Record<string, unknown> = {}
    matches.forEach((value, key) => {
      matchesObject[key] = value
    })

    return NextResponse.json({ matches: matchesObject })
  } catch (error) {
    console.error('Error getting matches:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get matches' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/schedule/matches
 * Create or update a workout match
 *
 * Body params:
 * - plan_instance_id: string (required)
 * - strava_activity_id: string (required)
 * - workout_id: string (required - unique workout identifier)
 * - match_type?: 'auto' | 'manual' (defaults to 'manual')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_instance_id, workout_id, strava_activity_id, match_type } = body

    // Require plan_instance_id, workout_id, and strava_activity_id
    if (!plan_instance_id || !workout_id || !strava_activity_id) {
      return NextResponse.json(
        { error: 'plan_instance_id, workout_id, and strava_activity_id are required' },
        { status: 400 }
      )
    }

    const service = await WorkoutMatchService.create()
    const match = await service.matchWorkout({
      plan_instance_id,
      workout_id,
      strava_activity_id,
      match_type: match_type ?? 'manual',
    })

    return NextResponse.json({ match })
  } catch (error) {
    console.error('Error creating match:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create match' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/schedule/matches
 * Remove a workout match
 *
 * Query params:
 * - plan_instance_id: string (required)
 * - workout_id: string (required - unique workout identifier)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planInstanceId = searchParams.get('plan_instance_id')
    const workoutId = searchParams.get('workout_id')

    if (!planInstanceId) {
      return NextResponse.json({ error: 'plan_instance_id required' }, { status: 400 })
    }

    // Require workout_id
    if (!workoutId) {
      return NextResponse.json({ error: 'workout_id is required' }, { status: 400 })
    }

    const service = await WorkoutMatchService.create()
    await service.unmatchWorkout(planInstanceId, workoutId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting match:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete match' },
      { status: 500 }
    )
  }
}

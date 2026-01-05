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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_instance_id, workout_date, workout_index, strava_activity_id, match_type } = body

    if (!plan_instance_id || !workout_date || !strava_activity_id) {
      return NextResponse.json(
        { error: 'plan_instance_id, workout_date, and strava_activity_id required' },
        { status: 400 }
      )
    }

    const service = await WorkoutMatchService.create()
    const match = await service.matchWorkout({
      plan_instance_id,
      workout_date,
      workout_index: workout_index ?? 0,
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
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planInstanceId = searchParams.get('plan_instance_id')
    const workoutDate = searchParams.get('workout_date')
    const workoutIndex = parseInt(searchParams.get('workout_index') || '0', 10)

    if (!planInstanceId || !workoutDate) {
      return NextResponse.json(
        { error: 'plan_instance_id and workout_date required' },
        { status: 400 }
      )
    }

    const service = await WorkoutMatchService.create()
    await service.unmatchWorkout(planInstanceId, workoutDate, workoutIndex)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting match:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete match' },
      { status: 500 }
    )
  }
}

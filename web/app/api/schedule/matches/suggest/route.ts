import { NextRequest, NextResponse } from 'next/server'
import { WorkoutMatchService } from '@/lib/services/workout-match-service'

/**
 * POST /api/schedule/matches/suggest
 * Get auto-match suggestions for a plan instance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_instance_id, workouts } = body

    if (!plan_instance_id || !workouts || !Array.isArray(workouts)) {
      return NextResponse.json(
        { error: 'plan_instance_id and workouts array required' },
        { status: 400 }
      )
    }

    const service = await WorkoutMatchService.create()
    const suggestions = await service.suggestAutoMatches(plan_instance_id, workouts)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get suggestions' },
      { status: 500 }
    )
  }
}

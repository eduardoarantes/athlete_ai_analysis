import { NextRequest, NextResponse } from 'next/server'
import { WorkoutMatchService } from '@/lib/services/workout-match-service'

/**
 * POST /api/schedule/matches/auto
 * Automatically match activities to workouts for a plan instance
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

    // Get suggestions
    const suggestions = await service.suggestAutoMatches(plan_instance_id, workouts)

    if (suggestions.length === 0) {
      return NextResponse.json({
        matched: 0,
        suggestions: [],
        message: 'No activities found to match',
      })
    }

    // Apply the suggestions automatically
    const matchedCount = await service.applyAutoMatches(plan_instance_id, suggestions)

    return NextResponse.json({
      matched: matchedCount,
      suggestions,
      message: `Auto-matched ${matchedCount} activities`,
    })
  } catch (error) {
    console.error('Error auto-matching:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-match' },
      { status: 500 }
    )
  }
}

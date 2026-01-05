import { NextRequest, NextResponse } from 'next/server'
import { WorkoutMatchService } from '@/lib/services/workout-match-service'

/**
 * GET /api/schedule/matches/activities?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Get unmatched activities in a date range for manual matching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
    }

    const service = await WorkoutMatchService.create()
    const activities = await service.getUnmatchedActivities(startDate, endDate)

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error getting unmatched activities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get activities' },
      { status: 500 }
    )
  }
}

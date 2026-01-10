import { NextRequest, NextResponse } from 'next/server'
import { WorkoutMatchService } from '@/lib/services/workout-match-service'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/schedule/matches/activities?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Get unmatched activities in a date range for manual matching
 *
 * Query params:
 * - start_date: Start date in YYYY-MM-DD format (required)
 * - end_date: End date in YYYY-MM-DD format (required)
 * - category: Activity category filter: 'cycling', 'running', 'swimming', 'strength' (optional, defaults to all)
 * - timezone: User timezone override (optional, defaults to user profile timezone)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category') as
      | 'cycling'
      | 'running'
      | 'swimming'
      | 'strength'
      | null
    let userTimezone = searchParams.get('timezone') || undefined

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
    }

    // Get user timezone from profile if not provided
    if (!userTimezone) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('athlete_profiles')
          .select('timezone')
          .eq('user_id', user.id)
          .single()

        userTimezone = profile?.timezone || undefined
      }
    }

    const service = await WorkoutMatchService.create()
    const activities = await service.getUnmatchedActivities(
      startDate,
      endDate,
      category || undefined,
      userTimezone
    )

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error getting unmatched activities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get activities' },
      { status: 500 }
    )
  }
}

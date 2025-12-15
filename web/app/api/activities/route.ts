import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get user's activities with filtering, sorting, and pagination
 * GET /api/activities
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (default: start_date)
 * - sortOrder: asc or desc (default: desc)
 * - sportType: Filter by sport_type
 * - startDate: Filter activities after this date (ISO string)
 * - endDate: Filter activities before this date (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const sortBy = searchParams.get('sortBy') || 'start_date'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const sportType = searchParams.get('sportType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build query
    let query = supabase
      .from('strava_activities')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filters
    if (sportType) {
      query = query.eq('sport_type', sportType)
    }
    if (startDate) {
      query = query.gte('start_date', startDate)
    }
    if (endDate) {
      query = query.lte('start_date', endDate)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(from, to)

    const { data: activities, error, count } = await query

    if (error) {
      console.error('Activities fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      activities,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Activities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

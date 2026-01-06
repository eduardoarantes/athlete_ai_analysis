/**
 * API Route: GET /api/compliance/history
 *
 * Fetches historical compliance analyses for the authenticated user.
 *
 * Query params:
 * - limit: number (default 20, max 100) - Number of results to return
 * - offset: number (default 0) - Pagination offset
 * - grade: 'A' | 'B' | 'C' | 'D' | 'F' (optional) - Filter by grade
 * - min_score: number (optional) - Minimum score filter
 * - max_score: number (optional) - Maximum score filter
 * - from_date: string (optional) - Start date (YYYY-MM-DD)
 * - to_date: string (optional) - End date (YYYY-MM-DD)
 *
 * Returns: { analyses: ComplianceHistoryItem[], total: number, hasMore: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

interface ComplianceHistoryItem {
  id: string
  match_id: string
  overall_score: number
  overall_grade: string
  overall_summary: string
  segments_completed: number
  segments_skipped: number
  segments_total: number
  analyzed_at: string
  athlete_ftp: number
  athlete_lthr: number | null
  power_data_quality: string
  // Joined from workout_activity_matches
  workout_date: string
  workout_index: number
  strava_activity_id: string
  match_type: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const grade = url.searchParams.get('grade')
    const minScore = url.searchParams.get('min_score')
    const maxScore = url.searchParams.get('max_score')
    const fromDate = url.searchParams.get('from_date')
    const toDate = url.searchParams.get('to_date')

    // Build query
    let query = supabase
      .from('workout_compliance_analyses')
      .select(
        `
        id,
        match_id,
        overall_score,
        overall_grade,
        overall_summary,
        segments_completed,
        segments_skipped,
        segments_total,
        analyzed_at,
        athlete_ftp,
        athlete_lthr,
        power_data_quality,
        workout_activity_matches!inner (
          workout_date,
          workout_index,
          strava_activity_id,
          match_type
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('analyzed_at', { ascending: false })

    // Apply filters
    if (grade) {
      const validGrades = ['A', 'B', 'C', 'D', 'F']
      if (validGrades.includes(grade.toUpperCase())) {
        query = query.eq('overall_grade', grade.toUpperCase())
      }
    }

    if (minScore) {
      const minScoreNum = parseInt(minScore, 10)
      if (!isNaN(minScoreNum)) {
        query = query.gte('overall_score', minScoreNum)
      }
    }

    if (maxScore) {
      const maxScoreNum = parseInt(maxScore, 10)
      if (!isNaN(maxScoreNum)) {
        query = query.lte('overall_score', maxScoreNum)
      }
    }

    if (fromDate) {
      query = query.gte('workout_activity_matches.workout_date', fromDate)
    }

    if (toDate) {
      query = query.lte('workout_activity_matches.workout_date', toDate)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      errorLogger.logError(error as Error, {
        userId: user.id,
        path: '/api/compliance/history',
        method: 'GET',
      })
      return NextResponse.json({ error: 'Failed to fetch compliance history' }, { status: 500 })
    }

    // Transform the data to flatten the joined table
    const analyses: ComplianceHistoryItem[] = (data || []).map((item) => {
      // The joined data comes as workout_activity_matches object
      const match = item.workout_activity_matches as unknown as {
        workout_date: string
        workout_index: number
        strava_activity_id: string
        match_type: string
      }

      return {
        id: item.id,
        match_id: item.match_id,
        overall_score: item.overall_score,
        overall_grade: item.overall_grade,
        overall_summary: item.overall_summary,
        segments_completed: item.segments_completed,
        segments_skipped: item.segments_skipped,
        segments_total: item.segments_total,
        analyzed_at: item.analyzed_at,
        athlete_ftp: item.athlete_ftp,
        athlete_lthr: item.athlete_lthr,
        power_data_quality: item.power_data_quality,
        workout_date: match.workout_date,
        workout_index: match.workout_index,
        strava_activity_id: match.strava_activity_id,
        match_type: match.match_type,
      }
    })

    const total = count || 0
    const hasMore = offset + limit < total

    errorLogger.logInfo('Compliance history fetched', {
      userId: user.id,
      metadata: {
        resultCount: analyses.length,
        total,
        filters: { grade, minScore, maxScore, fromDate, toDate },
      },
    })

    return NextResponse.json({
      analyses,
      total,
      hasMore,
      pagination: {
        limit,
        offset,
        nextOffset: hasMore ? offset + limit : null,
      },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/compliance/history',
      method: 'GET',
    })

    const message = error instanceof Error ? error.message : 'Failed to fetch compliance history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

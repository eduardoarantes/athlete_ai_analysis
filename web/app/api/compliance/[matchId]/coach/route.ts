/**
 * API Route: POST /api/compliance/[matchId]/coach
 *
 * Generate AI coaching feedback for a compliance analysis.
 * Calls the Python API coach endpoint and stores the feedback.
 *
 * Query params:
 * - regenerate: boolean (optional) - Force regeneration even if cached
 *
 * Returns: CoachFeedback with metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invokePythonApi } from '@/lib/services/lambda-client'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { parseLocalDate } from '@/lib/utils/date-utils'
import type { WorkoutComplianceAnalysis } from '@/lib/services/compliance-analysis-service'
import type { TrainingPlanData, Workout } from '@/lib/types/training-plan'
import type { Json } from '@/lib/types/database'

// ============================================================================
// Types
// ============================================================================

interface SegmentNote {
  segment_index: number
  note: string
}

interface CoachFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
  action_items: string[]
  segment_notes: SegmentNote[]
}

interface CoachResponse {
  feedback: CoachFeedback
  generated_at: string
  model: string
  prompt_version: string
  cached: boolean
}

interface StoredAnalysisRow {
  id: string
  analysis_data: Json
  athlete_ftp: number
  athlete_lthr: number | null
  coach_feedback: Json | null
  coach_model: string | null
  coach_prompt_version: string | null
  coach_generated_at: string | null
  updated_at: string
}

interface MatchRow {
  id: string
  plan_instance_id: string
  workout_date: string
  workout_index: number
  strava_activity_id: string
  user_id: string
}

interface PlanInstanceRow {
  plan_data: TrainingPlanData
  start_date: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get workout from plan instance for a specific date and index
 */
function getWorkoutFromPlan(
  planData: TrainingPlanData,
  startDate: string,
  targetDate: string,
  workoutIndex: number
): Workout | null {
  // Use parseLocalDate to avoid timezone issues with date strings
  const start = parseLocalDate(startDate)
  const target = parseLocalDate(targetDate)

  // Calculate weekOneMonday - the Monday of the week containing the start date
  // This matches how schedule-calendar.tsx places workouts on dates
  const startDayOfWeek = start.getDay() // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
  const weekOneMonday = new Date(start)
  weekOneMonday.setDate(start.getDate() + daysToMonday)

  // Calculate week number based on distance from weekOneMonday
  const diffFromMonday = Math.floor(
    (target.getTime() - weekOneMonday.getTime()) / (1000 * 60 * 60 * 24)
  )
  const weekNumber = Math.floor(diffFromMonday / 7) + 1
  const dayOfWeek = target.getDay()

  const weekdayMap: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  }
  const targetWeekday = weekdayMap[dayOfWeek]

  const week = planData.weekly_plan?.find((w) => w.week_number === weekNumber)
  if (!week) return null

  const dayWorkouts = week.workouts.filter(
    (w) => w.weekday?.toLowerCase() === targetWeekday?.toLowerCase()
  )

  return dayWorkouts[workoutIndex] || null
}

/**
 * Transform WorkoutComplianceAnalysis to Python API format
 */
function transformAnalysisForPythonApi(
  analysis: WorkoutComplianceAnalysis,
  workout: Workout,
  workoutDate: string,
  athleteFtp: number,
  athleteLthr: number | null
): Record<string, unknown> {
  return {
    workout_name: workout.name,
    workout_type: workout.type || 'unknown',
    workout_date: workoutDate,
    workout_description: workout.description || null,
    athlete_ftp: athleteFtp,
    athlete_lthr: athleteLthr,
    compliance_analysis: {
      overall: {
        score: analysis.overall.score,
        grade: analysis.overall.grade,
        summary: analysis.overall.summary,
        segments_completed: analysis.overall.segments_completed,
        segments_skipped: analysis.overall.segments_skipped,
        segments_total: analysis.overall.segments_total,
      },
      segments: analysis.segments.map((seg) => ({
        segment_index: seg.segment_index,
        segment_name: seg.segment_name,
        segment_type: seg.segment_type,
        match_quality: seg.match_quality,
        planned_duration_sec: seg.planned_duration_sec,
        planned_power_low: seg.planned_power_low,
        planned_power_high: seg.planned_power_high,
        planned_zone: seg.planned_zone,
        actual_start_sec: seg.actual_start_sec,
        actual_end_sec: seg.actual_end_sec,
        actual_duration_sec: seg.actual_duration_sec,
        actual_avg_power: seg.actual_avg_power,
        actual_max_power: seg.actual_max_power,
        actual_min_power: seg.actual_min_power,
        actual_dominant_zone: seg.actual_dominant_zone,
        time_in_zone: seg.time_in_zone,
        power_compliance: seg.scores.power_compliance,
        zone_compliance: seg.scores.zone_compliance,
        duration_compliance: seg.scores.duration_compliance,
        overall_segment_score: seg.scores.overall_segment_score,
        assessment: seg.assessment,
      })),
      metadata: {
        algorithm_version: analysis.metadata.algorithm_version,
        power_data_quality: analysis.metadata.power_data_quality,
        analysis_duration_ms: null,
      },
    },
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 })
    }

    // Get query params
    const url = new URL(request.url)
    const forceRegenerate = url.searchParams.get('regenerate') === 'true'

    // Get current user and session (for access token)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get session to extract access token for Python API
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    // Fetch match record
    const { data: match, error: matchError } = await supabase
      .from('workout_activity_matches')
      .select('id, plan_instance_id, workout_date, workout_index, strava_activity_id, user_id')
      .eq('id', matchId)
      .single<MatchRow>()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Verify user owns this match
    if (match.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check for existing analysis with coach feedback
    const { data: existingAnalysis } = await supabase
      .from('workout_compliance_analyses')
      .select(
        'id, analysis_data, athlete_ftp, athlete_lthr, coach_feedback, coach_model, coach_prompt_version, coach_generated_at, updated_at'
      )
      .eq('match_id', matchId)
      .single<StoredAnalysisRow>()

    // Return cached feedback if available and not forcing regeneration
    if (!forceRegenerate && existingAnalysis?.coach_feedback) {
      errorLogger.logInfo('Returning cached coach feedback', {
        userId: user.id,
        metadata: {
          matchId,
          analysisId: existingAnalysis.id,
          generatedAt: existingAnalysis.updated_at,
        },
      })

      return NextResponse.json({
        feedback: existingAnalysis.coach_feedback as unknown as CoachFeedback,
        generated_at: existingAnalysis.coach_generated_at || existingAnalysis.updated_at,
        model: existingAnalysis.coach_model || 'unknown',
        prompt_version: existingAnalysis.coach_prompt_version,
        cached: true,
      })
    }

    // Need compliance analysis to generate feedback
    if (!existingAnalysis?.analysis_data) {
      return NextResponse.json(
        {
          error: 'No compliance analysis found. Please run compliance analysis first.',
          hint: `GET /api/compliance/${matchId}`,
        },
        { status: 400 }
      )
    }

    // Get workout details for context
    const { data: planInstance } = await supabase
      .from('plan_instances')
      .select('plan_data, start_date')
      .eq('id', match.plan_instance_id)
      .single<PlanInstanceRow>()

    if (!planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    const workout = getWorkoutFromPlan(
      planInstance.plan_data,
      planInstance.start_date,
      match.workout_date,
      match.workout_index
    )

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found in plan' }, { status: 404 })
    }

    // Transform analysis for Python API
    const analysis = existingAnalysis.analysis_data as unknown as WorkoutComplianceAnalysis
    const requestBody = transformAnalysisForPythonApi(
      analysis,
      workout,
      match.workout_date,
      existingAnalysis.athlete_ftp,
      existingAnalysis.athlete_lthr
    )

    // Call Python coach API
    errorLogger.logInfo('Calling Python coach API', {
      userId: user.id,
      metadata: {
        matchId,
        workoutName: workout.name,
        overallScore: analysis.overall.score,
      },
    })

    const pythonResponse = await invokePythonApi<CoachResponse>({
      method: 'POST',
      path: '/api/v1/coach/compliance',
      body: requestBody,
      headers: {
        // Use Supabase access token for Python API authentication
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    })

    if (pythonResponse.statusCode !== 200) {
      errorLogger.logWarning('Python coach API returned error', {
        userId: user.id,
        metadata: {
          matchId,
          statusCode: pythonResponse.statusCode,
          response: pythonResponse.body,
        },
      })

      return NextResponse.json(
        {
          error: 'Failed to generate coach feedback',
          details: pythonResponse.body,
        },
        { status: pythonResponse.statusCode }
      )
    }

    const coachResponse = pythonResponse.body

    // Store feedback in database with metadata
    const { error: updateError } = await supabase
      .from('workout_compliance_analyses')
      .update({
        coach_feedback: coachResponse.feedback as unknown as Json,
        coach_model: coachResponse.model,
        coach_prompt_version: coachResponse.prompt_version,
        coach_generated_at: coachResponse.generated_at,
      })
      .eq('id', existingAnalysis.id)

    if (updateError) {
      errorLogger.logWarning('Failed to store coach feedback', {
        userId: user.id,
        metadata: {
          matchId,
          analysisId: existingAnalysis.id,
          error: updateError.message,
        },
      })
      // Don't fail the request - we still have the feedback
    }

    errorLogger.logInfo('Coach feedback generated and stored', {
      userId: user.id,
      metadata: {
        matchId,
        analysisId: existingAnalysis.id,
        model: coachResponse.model,
        strengthsCount: coachResponse.feedback.strengths.length,
        improvementsCount: coachResponse.feedback.improvements.length,
      },
    })

    return NextResponse.json({
      feedback: coachResponse.feedback,
      generated_at: coachResponse.generated_at,
      model: coachResponse.model,
      prompt_version: coachResponse.prompt_version,
      cached: false,
      context: {
        match_id: matchId,
        workout_name: workout.name,
        workout_type: workout.type,
        overall_score: analysis.overall.score,
        overall_grade: analysis.overall.grade,
      },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/compliance/[matchId]/coach',
      method: 'POST',
    })

    const message = error instanceof Error ? error.message : 'Failed to generate coach feedback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET handler - retrieve cached coach feedback
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 })
    }

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch analysis with coach feedback
    const { data: analysis, error: analysisError } = await supabase
      .from('workout_compliance_analyses')
      .select(
        `
        id,
        coach_feedback,
        coach_model,
        coach_prompt_version,
        coach_generated_at,
        updated_at,
        overall_score,
        overall_grade,
        workout_activity_matches!inner (
          user_id,
          workout_date
        )
      `
      )
      .eq('match_id', matchId)
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // Verify ownership
    const matchData = analysis.workout_activity_matches as unknown as { user_id: string }
    if (matchData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!analysis.coach_feedback) {
      return NextResponse.json(
        {
          error: 'No coach feedback available',
          hint: 'POST to this endpoint to generate feedback',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      feedback: analysis.coach_feedback as unknown as CoachFeedback,
      generated_at: analysis.coach_generated_at || analysis.updated_at,
      model: analysis.coach_model || 'unknown',
      prompt_version: analysis.coach_prompt_version,
      cached: true,
      context: {
        match_id: matchId,
        overall_score: analysis.overall_score,
        overall_grade: analysis.overall_grade,
      },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/compliance/[matchId]/coach',
      method: 'GET',
    })

    const message = error instanceof Error ? error.message : 'Failed to get coach feedback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

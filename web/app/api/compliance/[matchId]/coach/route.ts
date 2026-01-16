/**
 * API Route: POST /api/compliance/[matchId]/coach
 *
 * Generate AI coaching feedback for a compliance analysis.
 * Calls the Python API coach endpoint with workout structure and power streams.
 *
 * Query params:
 * - regenerate: boolean (optional) - Force regeneration even if cached
 *
 * Returns: Coach analysis with feedback
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invokePythonApi } from '@/lib/services/lambda-client'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { getWorkoutById } from '@/lib/utils/workout-helpers'
import { StravaService } from '@/lib/services/strava-service'
import type { TrainingPlanData } from '@/lib/types/training-plan'
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

interface CoachAnalysisResponse {
  system_prompt: string
  user_prompt: string
  response_text: string
  response_json: CoachFeedback | null
  model: string
  provider: string
  generated_at: string
}

interface StoredAnalysisRow {
  id: string
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
  workout_id: string | null
  strava_activity_id: string
  user_id: string
}

interface PlanInstanceRow {
  plan_data: TrainingPlanData
  start_date: string
}

interface StravaActivityRow {
  name: string
  start_date: string
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
      .select('id, plan_instance_id, workout_id, strava_activity_id, user_id')
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
        'id, athlete_ftp, athlete_lthr, coach_feedback, coach_model, coach_prompt_version, coach_generated_at, updated_at'
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
        feedback: existingAnalysis.coach_feedback,
        generated_at: existingAnalysis.coach_generated_at || existingAnalysis.updated_at,
        model: existingAnalysis.coach_model || 'unknown',
        prompt_version: existingAnalysis.coach_prompt_version,
        cached: true,
      })
    }

    // Need athlete FTP to generate feedback
    if (!existingAnalysis?.athlete_ftp) {
      return NextResponse.json(
        {
          error: 'No compliance analysis found. Please run compliance analysis first.',
          hint: `GET /api/compliance/${matchId}`,
        },
        { status: 400 }
      )
    }

    // Get workout details
    const { data: planInstance } = await supabase
      .from('plan_instances')
      .select('plan_data, start_date')
      .eq('id', match.plan_instance_id)
      .single<PlanInstanceRow>()

    if (!planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Require workout_id for lookup
    if (!match.workout_id) {
      errorLogger.logWarning('Match missing workout_id', {
        userId: user.id,
        metadata: { matchId },
      })
      return NextResponse.json(
        { error: 'Legacy match without workout_id. Please re-match this workout.' },
        { status: 400 }
      )
    }

    const workout = getWorkoutById(planInstance.plan_data, match.workout_id)

    if (!workout) {
      return NextResponse.json(
        { error: `Workout not found in plan for ID ${match.workout_id}` },
        { status: 404 }
      )
    }

    // Get activity details
    const { data: activity } = await supabase
      .from('strava_activities')
      .select('name, start_date')
      .eq('strava_id', match.strava_activity_id)
      .single<StravaActivityRow>()

    // Fetch power streams from Strava
    errorLogger.logInfo('Fetching power streams from Strava', {
      userId: user.id,
      metadata: {
        matchId,
        activityId: match.strava_activity_id,
      },
    })

    const stravaService = await StravaService.create()
    const streams = await stravaService.getActivityStreamsWithRefresh(
      user.id,
      match.strava_activity_id,
      ['time', 'watts'],
      { supabaseClient: supabase }
    )

    if (!streams.watts || !streams.time) {
      return NextResponse.json(
        { error: 'Activity does not have power data' },
        { status: 400 }
      )
    }

    // Validate stream data quality
    const wattsLength = streams.watts.data.length
    const timeLength = streams.time.data.length

    if (wattsLength !== timeLength) {
      errorLogger.logWarning('Stream length mismatch detected', {
        userId: user.id,
        metadata: {
          matchId,
          activityId: match.strava_activity_id,
          wattsLength,
          timeLength,
          difference: Math.abs(wattsLength - timeLength),
        },
      })
      return NextResponse.json(
        {
          error: 'Power data is corrupted',
          details: `Stream length mismatch: ${wattsLength} power samples vs ${timeLength} time samples`
        },
        { status: 400 }
      )
    }

    // Validate minimum data points
    if (wattsLength < 60) {
      errorLogger.logWarning('Insufficient power data', {
        userId: user.id,
        metadata: {
          matchId,
          activityId: match.strava_activity_id,
          samplesCount: wattsLength,
        },
      })
      return NextResponse.json(
        {
          error: 'Insufficient power data',
          details: `Activity has only ${wattsLength} samples (minimum 60 required for analysis)`
        },
        { status: 400 }
      )
    }

    // Convert streams to power stream format
    const powerStreams = streams.watts.data.map((power, index) => ({
      time_offset: streams.time!.data[index],
      power,
    }))

    // Prepare request for Python API
    const requestBody = {
      activity_id: parseInt(match.strava_activity_id),
      activity_name: activity?.name || 'Unknown',
      activity_date: activity?.start_date
        ? activity.start_date.split('T')[0]
        : new Date().toISOString().split('T')[0],
      workout: {
        id: workout.id,
        name: workout.name,
        type: workout.type || 'mixed',
        description: workout.description || null,
        structure: workout.structure || { structure: [] },
      },
      power_streams: powerStreams,
      athlete_ftp: existingAnalysis.athlete_ftp,
      athlete_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
      athlete_lthr: existingAnalysis.athlete_lthr,
    }

    // Call Python coach API
    errorLogger.logInfo('Calling Python coach API', {
      userId: user.id,
      metadata: {
        matchId,
        workoutName: workout.name,
        powerStreamLength: powerStreams.length,
      },
    })

    const pythonResponse = await invokePythonApi<CoachAnalysisResponse>({
      method: 'POST',
      path: '/api/v1/coach/analyze',
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
        coach_feedback: coachResponse.response_json as unknown as Json,
        coach_model: coachResponse.model,
        coach_prompt_version: `${coachResponse.provider}:${coachResponse.model}`,
        coach_generated_at: coachResponse.generated_at,
      })
      .eq('match_id', matchId)

    if (updateError) {
      errorLogger.logWarning('Failed to store coach feedback', {
        userId: user.id,
        metadata: {
          matchId,
          analysisId: existingAnalysis?.id,
          error: updateError.message,
        },
      })
      // Don't fail the request - we still have the feedback
    }

    errorLogger.logInfo('Coach feedback generated and stored', {
      userId: user.id,
      metadata: {
        matchId,
        analysisId: existingAnalysis?.id,
        model: coachResponse.model,
        provider: coachResponse.provider,
      },
    })

    return NextResponse.json({
      feedback: coachResponse.response_json,
      generated_at: coachResponse.generated_at,
      model: coachResponse.model,
      prompt_version: `${coachResponse.provider}:${coachResponse.model}`,
      cached: false,
      context: {
        match_id: matchId,
        workout_name: workout.name,
        workout_type: workout.type,
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
          user_id
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
      feedback: analysis.coach_feedback,
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

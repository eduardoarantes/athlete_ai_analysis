/**
 * API Route: POST /api/compliance/analyze
 *
 * Analyzes workout compliance by comparing planned workout segments
 * with actual activity power data from Strava.
 *
 * Request body:
 * - plan_instance_id: string - ID of the plan instance
 * - workout_date: string - Date of the workout (YYYY-MM-DD)
 * - workout_index?: number - Index of workout on that date (default 0)
 * - strava_activity_id: string - Strava activity ID to analyze
 *
 * Or alternatively:
 * - match_id: string - ID of the workout_activity_match record
 *
 * Returns: WorkoutComplianceAnalysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'
import { analyzeWorkoutCompliance } from '@/lib/services/compliance-analysis-service'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { getWorkoutById } from '@/lib/utils/workout-helpers'
import type { TrainingPlanData } from '@/lib/types/training-plan'
import { hasValidStructure } from '@/lib/types/training-plan'
import type { Json } from '@/lib/types/database'

interface AnalyzeRequest {
  // Option 1: Direct specification
  plan_instance_id?: string
  strava_activity_id?: string

  // Option 2: From match record
  match_id?: string

  // Optional override for FTP (otherwise fetched from profile)
  ftp_override?: number
}

interface PlanInstanceRow {
  id: string
  user_id: string
  plan_data: TrainingPlanData
  start_date: string
}

interface ProfileRow {
  ftp: number | null
  lthr: number | null
}

interface AnalyzeRequestWithSave extends AnalyzeRequest {
  // Whether to save the analysis to the database (default: true)
  save?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequestWithSave = await request.json()
    const shouldSave = body.save !== false // Default to true

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let planInstanceId: string
    let workoutId: string | null = null
    let stravaActivityId: string
    let matchId: string | null = body.match_id || null

    // Resolve inputs - either from match_id or direct parameters
    if (body.match_id) {
      // Fetch from match record
      const { data: match, error: matchError } = await supabase
        .from('workout_activity_matches')
        .select('id, plan_instance_id, workout_id, strava_activity_id')
        .eq('id', body.match_id)
        .single()

      if (matchError || !match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      }

      matchId = match.id
      planInstanceId = match.plan_instance_id
      workoutId = match.workout_id
      stravaActivityId = match.strava_activity_id
    } else {
      // Direct specification is no longer supported - must use match_id
      return NextResponse.json(
        {
          error: 'match_id is required. Direct workout specification is no longer supported.',
        },
        { status: 400 }
      )
    }

    // Fetch plan instance
    const { data: planInstance, error: planError } = await supabase
      .from('plan_instances')
      .select('id, user_id, plan_data, start_date')
      .eq('id', planInstanceId)
      .eq('user_id', user.id)
      .single<PlanInstanceRow>()

    if (planError || !planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Require workout_id for lookup
    if (!workoutId) {
      errorLogger.logWarning('Analysis request missing workout_id', {
        userId: user.id,
        metadata: { matchId },
      })
      return NextResponse.json(
        { error: 'workout_id is required. Legacy date+index lookups are no longer supported.' },
        { status: 400 }
      )
    }

    const workout = getWorkoutById(planInstance.plan_data, workoutId)

    if (!workout) {
      return NextResponse.json({ error: `No workout found for ID ${workoutId}` }, { status: 404 })
    }

    // Check if workout has valid structure
    if (!hasValidStructure(workout.structure)) {
      return NextResponse.json(
        {
          error: 'Workout has no structure defined for compliance analysis',
          workout_name: workout.name,
          workout_type: workout.type,
        },
        { status: 400 }
      )
    }

    // Get athlete FTP and LTHR
    let ftp = body.ftp_override
    let lthr: number | null = null

    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('ftp, lthr')
      .eq('user_id', user.id)
      .single<ProfileRow>()

    if (!ftp) {
      ftp = profile?.ftp ?? undefined

      if (!ftp) {
        return NextResponse.json(
          { error: 'Athlete FTP not found. Please set your FTP in your profile.' },
          { status: 400 }
        )
      }
    }

    lthr = profile?.lthr ?? null

    // Fetch power stream from Strava
    const stravaService = await StravaService.create()
    const streams = await stravaService.getActivityStreamsWithRefresh(user.id, stravaActivityId, [
      'watts',
      'time',
    ])

    const powerStream = streams.watts?.data

    if (!powerStream || powerStream.length === 0) {
      return NextResponse.json(
        {
          error: 'No power data available for this activity',
          activity_id: stravaActivityId,
        },
        { status: 400 }
      )
    }

    // Run compliance analysis
    const analysis = analyzeWorkoutCompliance(undefined, powerStream, ftp, workout.structure)

    // Store analysis to database if we have a match_id and save is enabled
    let savedAnalysisId: string | null = null
    if (shouldSave && matchId) {
      // Check if analysis already exists for this match
      const { data: existingAnalysis } = await supabase
        .from('workout_compliance_analyses')
        .select('id')
        .eq('match_id', matchId)
        .single()

      if (existingAnalysis) {
        // Update existing analysis
        const { data: updated, error: updateError } = await supabase
          .from('workout_compliance_analyses')
          .update({
            overall_score: analysis.overall.score,
            overall_grade: analysis.overall.grade,
            overall_summary: analysis.overall.summary,
            segments_completed: analysis.overall.segments_completed,
            segments_skipped: analysis.overall.segments_skipped,
            segments_total: analysis.overall.segments_total,
            analysis_data: analysis as unknown as Json,
            athlete_ftp: ftp,
            athlete_lthr: lthr,
            algorithm_version: analysis.metadata.algorithm_version,
            power_data_quality: analysis.metadata.power_data_quality,
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', existingAnalysis.id)
          .select('id')
          .single()

        if (!updateError && updated) {
          savedAnalysisId = updated.id
        }
      } else {
        // Insert new analysis
        const { data: inserted, error: insertError } = await supabase
          .from('workout_compliance_analyses')
          .insert({
            match_id: matchId,
            user_id: user.id,
            overall_score: analysis.overall.score,
            overall_grade: analysis.overall.grade,
            overall_summary: analysis.overall.summary,
            segments_completed: analysis.overall.segments_completed,
            segments_skipped: analysis.overall.segments_skipped,
            segments_total: analysis.overall.segments_total,
            analysis_data: analysis as unknown as Json,
            athlete_ftp: ftp,
            athlete_lthr: lthr,
            algorithm_version: analysis.metadata.algorithm_version,
            power_data_quality: analysis.metadata.power_data_quality,
          })
          .select('id')
          .single()

        if (!insertError && inserted) {
          savedAnalysisId = inserted.id
        }
      }
    }

    errorLogger.logInfo('Compliance analysis completed', {
      userId: user.id,
      metadata: {
        planInstanceId,
        workoutId,
        activityId: stravaActivityId,
        workoutName: workout.name,
        overallScore: analysis.overall.score,
        overallGrade: analysis.overall.grade,
        savedAnalysisId,
      },
    })

    // Return analysis with workout context
    return NextResponse.json({
      analysis,
      context: {
        workout_name: workout.name,
        workout_type: workout.type,
        workout_tss: workout.tss,
        activity_id: stravaActivityId,
        athlete_ftp: ftp,
        athlete_lthr: lthr,
        power_stream_length: powerStream.length,
        planned_segments: analysis.overall.segments_total,
        saved_analysis_id: savedAnalysisId,
      },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/compliance/analyze',
      method: 'POST',
    })

    const message = error instanceof Error ? error.message : 'Failed to analyze compliance'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

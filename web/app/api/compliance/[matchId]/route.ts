/**
 * API Route: GET /api/compliance/[matchId]
 *
 * Get compliance analysis for a specific workout-activity match.
 * Returns cached analysis if available, otherwise computes and stores it.
 *
 * Query params:
 * - ftp: number (optional) - Override FTP value
 * - refresh: boolean (optional) - Force recomputation even if cached
 *
 * Returns: WorkoutComplianceAnalysis with context
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'
import {
  analyzeWorkoutCompliance,
  type WorkoutComplianceAnalysis,
} from '@/lib/services/compliance-analysis-service'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { parseLocalDate } from '@/lib/utils/date-utils'
import type { WorkoutSegment, TrainingPlanData, Workout } from '@/lib/types/training-plan'
import type { Json } from '@/lib/types/database'

/**
 * Downsample power data for chart display
 * Uses max-value-in-window to preserve power peaks
 */
function downsamplePowerStream(data: number[], targetLength: number): number[] {
  if (data.length === 0) return []
  if (data.length <= targetLength) return data

  const result: number[] = []
  const step = data.length / targetLength

  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * step)
    const end = Math.floor((i + 1) * step)
    // Use max value in the window to preserve peaks
    let max = data[start] ?? 0
    for (let j = start; j < end && j < data.length; j++) {
      const val = data[j]
      if (val !== undefined && val > max) max = val
    }
    result.push(max)
  }

  return result
}

interface WorkoutOverrides {
  moves?: Record<string, { original_date: string; original_index: number }>
  copies?: Record<
    string,
    {
      source_date: string
      source_index: number
      library_workout?: {
        id?: string
        name?: string
        type?: string
        tss?: number
        duration_min?: number
        description?: string
        segments?: WorkoutSegment[]
      }
    }
  >
  deleted?: string[]
}

interface PlanInstanceRow {
  id: string
  user_id: string
  plan_data: TrainingPlanData
  start_date: string
  workout_overrides?: WorkoutOverrides | null
}

interface ProfileRow {
  ftp: number | null
  lthr: number | null
}

interface StoredAnalysisRow {
  id: string
  analysis_data: Json
  athlete_ftp: number
  athlete_lthr: number | null
  analyzed_at: string
  algorithm_version: string
  power_data_quality: string
}

/**
 * Get workout from workout_overrides (for library workouts and copies)
 */
function getWorkoutFromOverrides(
  overrides: WorkoutOverrides | null | undefined,
  targetDate: string,
  workoutIndex: number
): Workout | null {
  if (!overrides?.copies) return null

  const key = `${targetDate}:${workoutIndex}`
  const copy = overrides.copies[key]

  if (!copy) return null

  // Check if this is a library workout with stored data
  if (copy.source_date.startsWith('library:') && copy.library_workout) {
    const lib = copy.library_workout
    const workout: Workout = {
      weekday: 'Monday', // Placeholder - actual date is known from context
      name: lib.name || 'Library Workout',
      source: 'library',
    }
    if (lib.id) workout.id = lib.id
    if (lib.type) workout.type = lib.type
    if (lib.tss !== undefined) workout.tss = lib.tss
    if (lib.description) workout.description = lib.description
    if (lib.segments) workout.segments = lib.segments
    return workout
  }

  return null
}

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
  if (!week) {
    return null
  }

  const dayWorkouts = week.workouts.filter(
    (w) => w.weekday?.toLowerCase() === targetWeekday?.toLowerCase()
  )

  return dayWorkouts[workoutIndex] || null
}

export async function GET(
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
    const ftpParam = url.searchParams.get('ftp')
    const ftpOverride = ftpParam ? parseInt(ftpParam, 10) : undefined
    const forceRefresh = url.searchParams.get('refresh') === 'true'

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch match record with strava activity details
    const { data: match, error: matchError } = await supabase
      .from('workout_activity_matches')
      .select(
        `
        id, plan_instance_id, workout_date, workout_index, strava_activity_id, user_id,
        strava_activities (
          strava_activity_id
        )
      `
      )
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Get the actual Strava activity ID (numeric) from the joined table
    const stravaActivityNumericId = (
      match.strava_activities as { strava_activity_id: number } | null
    )?.strava_activity_id
    if (!stravaActivityNumericId) {
      return NextResponse.json({ error: 'Strava activity not found' }, { status: 404 })
    }

    // Verify user owns this match
    if (match.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check for cached analysis (if not forcing refresh and no FTP override)
    if (!forceRefresh && !ftpOverride) {
      // Run cache and plan instance queries in parallel for faster response
      const [cachedAnalysisResult, planInstanceResult] = await Promise.all([
        supabase
          .from('workout_compliance_analyses')
          .select(
            'id, analysis_data, athlete_ftp, athlete_lthr, analyzed_at, algorithm_version, power_data_quality'
          )
          .eq('match_id', matchId)
          .single<StoredAnalysisRow>(),
        supabase
          .from('plan_instances')
          .select('plan_data, start_date, workout_overrides')
          .eq('id', match.plan_instance_id)
          .single<{ plan_data: TrainingPlanData; start_date: string; workout_overrides?: WorkoutOverrides | null }>(),
      ])

      const cachedAnalysis = cachedAnalysisResult.data
      const planInstance = planInstanceResult.data

      if (cachedAnalysis) {

        let workoutContext: {
          workout_name: string
          workout_type: string
          workout_description?: string
          workout_tss?: number
        } = {
          workout_name: 'Unknown',
          workout_type: 'Unknown',
        }

        if (planInstance) {
          // Check overrides first (for library workouts), then plan_data
          const workout =
            getWorkoutFromOverrides(
              planInstance.workout_overrides,
              match.workout_date,
              match.workout_index
            ) ||
            getWorkoutFromPlan(
              planInstance.plan_data,
              planInstance.start_date,
              match.workout_date,
              match.workout_index
            )
          if (workout) {
            workoutContext = {
              workout_name: workout.name,
              workout_type: workout.type || 'Unknown',
              ...(workout.description !== undefined && {
                workout_description: workout.description,
              }),
              ...(workout.tss !== undefined && { workout_tss: workout.tss }),
            }
          }
        }

        // Fetch power stream for chart display
        let powerStreamForChart: number[] = []
        try {
          const stravaService = await StravaService.create()
          const streams = await stravaService.getActivityStreamsWithRefresh(
            user.id,
            String(stravaActivityNumericId),
            ['watts']
          )
          if (streams.watts?.data) {
            // Downsample to 600 points for chart display
            powerStreamForChart = downsamplePowerStream(streams.watts.data, 600)
          }
        } catch (streamError) {
          // Non-fatal: chart will render without power overlay
          errorLogger.logWarning('Failed to fetch power stream for cached analysis', {
            userId: user.id,
            metadata: { matchId, error: (streamError as Error).message },
          })
        }

        errorLogger.logInfo('Compliance analysis returned from cache', {
          userId: user.id,
          metadata: {
            matchId,
            analysisId: cachedAnalysis.id,
            analyzedAt: cachedAnalysis.analyzed_at,
          },
        })

        return NextResponse.json({
          analysis: cachedAnalysis.analysis_data as unknown as WorkoutComplianceAnalysis,
          power_stream: powerStreamForChart,
          context: {
            match_id: matchId,
            ...workoutContext,
            workout_date: match.workout_date,
            activity_id: stravaActivityNumericId,
            athlete_ftp: cachedAnalysis.athlete_ftp,
            athlete_lthr: cachedAnalysis.athlete_lthr,
            cached: true,
            analyzed_at: cachedAnalysis.analyzed_at,
            analysis_id: cachedAnalysis.id,
          },
        })
      }
    }

    // No cache or refresh requested - compute fresh analysis

    // Fetch plan instance
    const { data: planInstance, error: planError } = await supabase
      .from('plan_instances')
      .select('id, user_id, plan_data, start_date, workout_overrides')
      .eq('id', match.plan_instance_id)
      .single<PlanInstanceRow>()

    if (planError || !planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Get workout - check overrides first (for library workouts), then plan_data
    const workout =
      getWorkoutFromOverrides(
        planInstance.workout_overrides,
        match.workout_date,
        match.workout_index
      ) ||
      getWorkoutFromPlan(
        planInstance.plan_data,
        planInstance.start_date,
        match.workout_date,
        match.workout_index
      )

    if (!workout) {
      return NextResponse.json(
        { error: `No workout found for date ${match.workout_date} index ${match.workout_index}` },
        { status: 404 }
      )
    }

    // Get workout segments
    const segments: WorkoutSegment[] = workout.segments || []

    if (segments.length === 0) {
      return NextResponse.json(
        {
          error: 'Workout has no segments defined for compliance analysis',
          workout_name: workout.name,
          workout_type: workout.type,
          has_library_id: !!workout.library_workout_id,
        },
        { status: 400 }
      )
    }

    // Get athlete FTP and LTHR
    let ftp = ftpOverride
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

    // Fetch power stream from Strava using the numeric Strava activity ID
    const stravaService = await StravaService.create()
    const streams = await stravaService.getActivityStreamsWithRefresh(
      user.id,
      String(stravaActivityNumericId),
      ['watts', 'time', 'heartrate']
    )

    const powerStream = streams.watts?.data

    if (!powerStream || powerStream.length === 0) {
      return NextResponse.json(
        {
          error: 'No power data available for this activity',
          activity_id: stravaActivityNumericId,
        },
        { status: 400 }
      )
    }

    // Run compliance analysis
    const analysis = analyzeWorkoutCompliance(segments, powerStream, ftp)

    // Store analysis to database
    let savedAnalysisId: string | null = null
    const { data: existingAnalysis } = await supabase
      .from('workout_compliance_analyses')
      .select('id')
      .eq('match_id', matchId)
      .single()

    if (existingAnalysis) {
      // Update existing
      const { data: updated } = await supabase
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

      savedAnalysisId = updated?.id ?? null
    } else {
      // Insert new
      const { data: inserted } = await supabase
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

      savedAnalysisId = inserted?.id ?? null
    }

    errorLogger.logInfo('Compliance analysis computed and stored', {
      userId: user.id,
      metadata: {
        matchId,
        workoutName: workout.name,
        overallScore: analysis.overall.score,
        overallGrade: analysis.overall.grade,
        savedAnalysisId,
        forceRefresh,
      },
    })

    // Return analysis with context
    // Downsample power stream for chart display
    const powerStreamForChart = downsamplePowerStream(powerStream, 600)

    return NextResponse.json({
      analysis,
      power_stream: powerStreamForChart,
      context: {
        match_id: matchId,
        workout_name: workout.name,
        workout_type: workout.type,
        workout_description: workout.description,
        workout_date: match.workout_date,
        workout_tss: workout.tss,
        activity_id: stravaActivityNumericId,
        athlete_ftp: ftp,
        athlete_lthr: lthr,
        power_stream_length: powerStream.length,
        planned_segments: segments.length,
        has_heartrate: !!streams.heartrate?.data?.length,
        cached: false,
        analysis_id: savedAnalysisId,
      },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/compliance/[matchId]',
      method: 'GET',
    })

    const message = error instanceof Error ? error.message : 'Failed to analyze compliance'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * API Route: GET /api/compliance/[matchId]
 *
 * Get compliance analysis for a specific workout-activity match.
 * This is a convenience endpoint that wraps the POST /api/compliance/analyze endpoint.
 *
 * Query params:
 * - ftp: number (optional) - Override FTP value
 *
 * Returns: WorkoutComplianceAnalysis with context
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StravaService } from '@/lib/services/strava-service'
import { analyzeWorkoutCompliance } from '@/lib/services/compliance-analysis-service'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { WorkoutSegment, TrainingPlanData, Workout } from '@/lib/types/training-plan'

interface PlanInstanceRow {
  id: string
  user_id: string
  plan_data: TrainingPlanData
  start_date: string
}

interface ProfileRow {
  ftp: number | null
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
  const start = new Date(startDate)
  const target = new Date(targetDate)
  const diffDays = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 })
    }

    // Get optional FTP override from query params
    const url = new URL(request.url)
    const ftpParam = url.searchParams.get('ftp')
    const ftpOverride = ftpParam ? parseInt(ftpParam, 10) : undefined

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch match record
    // Note: workout_activity_matches table types not yet generated, using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: match, error: matchError } = await (supabase as any)
      .from('workout_activity_matches')
      .select('id, plan_instance_id, workout_date, workout_index, strava_activity_id, user_id')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Verify user owns this match
    if (match.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch plan instance
    const { data: planInstance, error: planError } = await supabase
      .from('plan_instances')
      .select('id, user_id, plan_data, start_date')
      .eq('id', match.plan_instance_id)
      .single<PlanInstanceRow>()

    if (planError || !planInstance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    // Get workout from plan
    const workout = getWorkoutFromPlan(
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

    // Get athlete FTP
    let ftp = ftpOverride

    if (!ftp) {
      const { data: profile } = await supabase
        .from('athlete_profiles')
        .select('ftp')
        .eq('user_id', user.id)
        .single<ProfileRow>()

      ftp = profile?.ftp ?? undefined

      if (!ftp) {
        return NextResponse.json(
          { error: 'Athlete FTP not found. Please set your FTP in your profile.' },
          { status: 400 }
        )
      }
    }

    // Fetch power stream from Strava
    const stravaService = await StravaService.create()
    const streams = await stravaService.getActivityStreamsWithRefresh(
      user.id,
      match.strava_activity_id,
      ['watts', 'time', 'heartrate']
    )

    const powerStream = streams.watts?.data

    if (!powerStream || powerStream.length === 0) {
      return NextResponse.json(
        {
          error: 'No power data available for this activity',
          activity_id: match.strava_activity_id,
        },
        { status: 400 }
      )
    }

    // Run compliance analysis
    const analysis = analyzeWorkoutCompliance(segments, powerStream, ftp)

    errorLogger.logInfo('Compliance analysis fetched', {
      userId: user.id,
      metadata: {
        matchId,
        workoutName: workout.name,
        overallScore: analysis.overall.score,
        overallGrade: analysis.overall.grade,
      },
    })

    // Return analysis with context
    return NextResponse.json({
      analysis,
      context: {
        match_id: matchId,
        workout_name: workout.name,
        workout_type: workout.type,
        workout_description: workout.description,
        workout_date: match.workout_date,
        workout_tss: workout.tss,
        activity_id: match.strava_activity_id,
        athlete_ftp: ftp,
        power_stream_length: powerStream.length,
        planned_segments: segments.length,
        has_heartrate: !!streams.heartrate?.data?.length,
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

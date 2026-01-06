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
import type { WorkoutSegment, TrainingPlanData, Workout } from '@/lib/types/training-plan'

interface AnalyzeRequest {
  // Option 1: Direct specification
  plan_instance_id?: string
  workout_date?: string
  workout_index?: number
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
  // Calculate which week this date falls in
  const start = new Date(startDate)
  const target = new Date(targetDate)
  const diffDays = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1
  const dayOfWeek = target.getDay() // 0 = Sunday

  // Map day of week to weekday name
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

  // Find the week
  const week = planData.weekly_plan?.find((w) => w.week_number === weekNumber)
  if (!week) {
    return null
  }

  // Find workouts for this day
  const dayWorkouts = week.workouts.filter(
    (w) => w.weekday?.toLowerCase() === targetWeekday?.toLowerCase()
  )

  return dayWorkouts[workoutIndex] || null
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()

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
    let workoutDate: string
    let workoutIndex: number
    let stravaActivityId: string

    // Resolve inputs - either from match_id or direct parameters
    if (body.match_id) {
      // Fetch from match record
      // Note: workout_activity_matches table types not yet generated, using type assertion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: match, error: matchError } = await (supabase as any)
        .from('workout_activity_matches')
        .select('plan_instance_id, workout_date, workout_index, strava_activity_id')
        .eq('id', body.match_id)
        .single()

      if (matchError || !match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      }

      planInstanceId = match.plan_instance_id
      workoutDate = match.workout_date
      workoutIndex = match.workout_index
      stravaActivityId = match.strava_activity_id
    } else {
      // Use direct parameters
      if (!body.plan_instance_id || !body.workout_date || !body.strava_activity_id) {
        return NextResponse.json(
          {
            error:
              'Either match_id or (plan_instance_id, workout_date, strava_activity_id) required',
          },
          { status: 400 }
        )
      }

      planInstanceId = body.plan_instance_id
      workoutDate = body.workout_date
      workoutIndex = body.workout_index ?? 0
      stravaActivityId = body.strava_activity_id
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

    // Get workout from plan
    const workout = getWorkoutFromPlan(
      planInstance.plan_data,
      planInstance.start_date,
      workoutDate,
      workoutIndex
    )

    if (!workout) {
      return NextResponse.json(
        { error: `No workout found for date ${workoutDate} index ${workoutIndex}` },
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
        },
        { status: 400 }
      )
    }

    // Get athlete FTP
    let ftp = body.ftp_override

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
    const analysis = analyzeWorkoutCompliance(segments, powerStream, ftp)

    errorLogger.logInfo('Compliance analysis completed', {
      userId: user.id,
      metadata: {
        planInstanceId,
        workoutDate,
        workoutIndex,
        activityId: stravaActivityId,
        workoutName: workout.name,
        overallScore: analysis.overall.score,
        overallGrade: analysis.overall.grade,
      },
    })

    // Return analysis with workout context
    return NextResponse.json({
      analysis,
      context: {
        workout_name: workout.name,
        workout_type: workout.type,
        workout_date: workoutDate,
        workout_tss: workout.tss,
        activity_id: stravaActivityId,
        athlete_ftp: ftp,
        power_stream_length: powerStream.length,
        planned_segments: segments.length,
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

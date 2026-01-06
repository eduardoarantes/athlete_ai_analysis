/**
 * Workout Match Service
 * Handles matching Strava activities to scheduled workouts
 */

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { getLocalDateFromTimestamp, parseLocalDate, formatDateString } from '@/lib/utils/date-utils'

export interface WorkoutMatch {
  id: string
  user_id: string
  plan_instance_id: string
  workout_date: string
  workout_index: number
  strava_activity_id: string
  match_type: 'auto' | 'manual'
  match_score: number | null
  created_at: string
  updated_at: string
}

export interface MatchedActivity {
  id: string // strava_activities.id
  match_id: string // workout_activity_matches.id (for compliance analysis)
  strava_activity_id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number | null
  moving_time: number | null
  tss: number | null
  average_watts: number | null
  match_type: 'auto' | 'manual'
  match_score: number | null
}

export interface WorkoutMatchInput {
  plan_instance_id: string
  workout_date: string
  workout_index?: number
  strava_activity_id: string
  match_type: 'auto' | 'manual'
  match_score?: number
}

export interface AutoMatchResult {
  workout_date: string
  workout_index: number
  activity: {
    id: string
    name: string
    type: string
    start_date: string
    tss: number | null
  }
  score: number
}

/**
 * Calculate match score between a workout and an activity
 * Higher score = better match
 * Returns 0 for incompatible activity types (e.g., WeightTraining for a cycling workout)
 */
function calculateMatchScore(
  workout: { tss?: number; type?: string },
  activity: { tss: number | null; type: string; moving_time: number | null }
): number {
  // Type matching - only cycling activities can match cycling workouts
  const cyclingActivityTypes = ['Ride', 'VirtualRide', 'EBikeRide', 'MountainBikeRide', 'GravelRide']
  const isCyclingActivity = cyclingActivityTypes.includes(activity.type)
  const isCyclingWorkout = !workout.type || workout.type !== 'rest'

  // CRITICAL: Non-cycling activities cannot match cycling workouts
  if (isCyclingWorkout && !isCyclingActivity) {
    return 0
  }

  let score = 50 // Base score for same-day match with compatible type

  // Bonus for cycling match
  if (isCyclingActivity && isCyclingWorkout) {
    score += 20
  }

  // TSS similarity (if both have TSS)
  if (workout.tss && activity.tss) {
    const tssDiff = Math.abs(workout.tss - activity.tss)
    const tssPercent = tssDiff / workout.tss
    if (tssPercent < 0.1)
      score += 20 // Within 10%
    else if (tssPercent < 0.2)
      score += 15 // Within 20%
    else if (tssPercent < 0.3)
      score += 10 // Within 30%
    else if (tssPercent < 0.5) score += 5 // Within 50%
  }

  // Duration consideration (if no TSS but has moving time)
  if (!activity.tss && activity.moving_time && activity.moving_time > 1800) {
    // At least 30 minutes
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}

export class WorkoutMatchService {
  private supabase: SupabaseClient<Database>
  private userId: string

  private constructor(supabase: SupabaseClient<Database>, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  static async create(): Promise<WorkoutMatchService> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    return new WorkoutMatchService(supabase, user.id)
  }

  /**
   * Get all matches for a plan instance
   * Note: Uses type assertion because workout_activity_matches table types are not yet generated
   */
  async getMatchesForInstance(planInstanceId: string): Promise<Map<string, MatchedActivity>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('workout_activity_matches')
      .select(
        `
        id,
        workout_date,
        workout_index,
        match_type,
        match_score,
        strava_activities (
          id,
          strava_activity_id,
          name,
          type,
          sport_type,
          start_date,
          distance,
          moving_time,
          tss,
          average_watts
        )
      `
      )
      .eq('plan_instance_id', planInstanceId)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`Failed to get matches: ${error.message}`)
    }

    // Build map keyed by "date:index"
    const matchMap = new Map<string, MatchedActivity>()

    for (const match of (data || []) as Array<{
      id: string
      workout_date: string
      workout_index: number
      match_type: string
      match_score: number | null
      strava_activities: {
        id: string
        strava_activity_id: number
        name: string
        type: string
        sport_type: string
        start_date: string
        distance: number | null
        moving_time: number | null
        tss: number | null
        average_watts: number | null
      }
    }>) {
      const activity = match.strava_activities

      if (activity) {
        const key = `${match.workout_date}:${match.workout_index}`
        matchMap.set(key, {
          ...activity,
          match_id: match.id,
          match_type: match.match_type as 'auto' | 'manual',
          match_score: match.match_score,
        })
      }
    }

    return matchMap
  }

  /**
   * Get all matches for multiple plan instances (for calendar view)
   * Note: Uses type assertion because workout_activity_matches table types are not yet generated
   */
  async getMatchesForInstances(planInstanceIds: string[]): Promise<Map<string, MatchedActivity>> {
    if (planInstanceIds.length === 0) {
      return new Map()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('workout_activity_matches')
      .select(
        `
        id,
        plan_instance_id,
        workout_date,
        workout_index,
        match_type,
        match_score,
        strava_activities (
          id,
          strava_activity_id,
          name,
          type,
          sport_type,
          start_date,
          distance,
          moving_time,
          tss,
          average_watts
        )
      `
      )
      .in('plan_instance_id', planInstanceIds)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`Failed to get matches: ${error.message}`)
    }

    // Build map keyed by "instanceId:date:index"
    const matchMap = new Map<string, MatchedActivity>()

    for (const match of (data || []) as Array<{
      id: string
      plan_instance_id: string
      workout_date: string
      workout_index: number
      match_type: string
      match_score: number | null
      strava_activities: {
        id: string
        strava_activity_id: number
        name: string
        type: string
        sport_type: string
        start_date: string
        distance: number | null
        moving_time: number | null
        tss: number | null
        average_watts: number | null
      }
    }>) {
      const activity = match.strava_activities

      if (activity) {
        const key = `${match.plan_instance_id}:${match.workout_date}:${match.workout_index}`
        matchMap.set(key, {
          ...activity,
          match_id: match.id,
          match_type: match.match_type as 'auto' | 'manual',
          match_score: match.match_score,
        })
      }
    }

    return matchMap
  }

  /**
   * Manually match an activity to a workout
   * Note: Uses type assertion because workout_activity_matches table types are not yet generated
   */
  async matchWorkout(input: WorkoutMatchInput): Promise<WorkoutMatch> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from('workout_activity_matches')
      .upsert(
        {
          user_id: this.userId,
          plan_instance_id: input.plan_instance_id,
          workout_date: input.workout_date,
          workout_index: input.workout_index ?? 0,
          strava_activity_id: input.strava_activity_id,
          match_type: input.match_type,
          match_score: input.match_score ?? null,
        },
        {
          onConflict: 'plan_instance_id,workout_date,workout_index',
        }
      )
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to match workout: ${error.message}`)
    }

    return data as WorkoutMatch
  }

  /**
   * Remove a workout match
   * Note: Uses type assertion because workout_activity_matches table types are not yet generated
   */
  async unmatchWorkout(
    planInstanceId: string,
    workoutDate: string,
    workoutIndex = 0
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase as any)
      .from('workout_activity_matches')
      .delete()
      .eq('plan_instance_id', planInstanceId)
      .eq('workout_date', workoutDate)
      .eq('workout_index', workoutIndex)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`Failed to unmatch workout: ${error.message}`)
    }
  }

  /**
   * Get unmatched activities for a date range
   * Note: Uses type assertion because workout_activity_matches table types are not yet generated
   *
   * The date range is expanded by 1 day on each end to account for timezone differences.
   * Activities are stored with UTC timestamps, but workout dates are local dates.
   * For example, an activity done at 7am local on 2025-12-29 in UTC+11 has UTC timestamp
   * 2025-12-28T20:00:00Z. Without expansion, a query for 2025-12-29 would miss it.
   */
  async getUnmatchedActivities(
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      id: string
      strava_activity_id: number
      name: string
      type: string
      start_date: string
      tss: number | null
      moving_time: number | null
    }>
  > {
    // Expand date range by 1 day on each end to account for timezone differences
    const expandedStart = parseLocalDate(startDate)
    expandedStart.setDate(expandedStart.getDate() - 1)
    const expandedEnd = parseLocalDate(endDate)
    expandedEnd.setDate(expandedEnd.getDate() + 1)

    // Get all activities in expanded date range
    const { data: activities, error: activitiesError } = await this.supabase
      .from('strava_activities')
      .select('id, strava_activity_id, name, type, start_date, tss, moving_time')
      .eq('user_id', this.userId)
      .gte('start_date', formatDateString(expandedStart))
      .lte('start_date', formatDateString(expandedEnd) + 'T23:59:59Z')
      .order('start_date', { ascending: true })

    if (activitiesError) {
      throw new Error(`Failed to get activities: ${activitiesError.message}`)
    }

    // Get matched activity IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matches, error: matchesError } = await (this.supabase as any)
      .from('workout_activity_matches')
      .select('strava_activity_id')
      .eq('user_id', this.userId)

    if (matchesError) {
      throw new Error(`Failed to get matches: ${matchesError.message}`)
    }

    const matchedIds = new Set(
      ((matches || []) as Array<{ strava_activity_id: string }>).map((m) => m.strava_activity_id)
    )

    // Filter to unmatched only
    return (activities || []).filter((a) => !matchedIds.has(a.id))
  }

  /**
   * Auto-match activities to workouts for a plan instance
   * Returns suggested matches without saving them
   * Note: Uses type assertion because workout_activity_matches table types are not yet generated
   */
  async suggestAutoMatches(
    planInstanceId: string,
    workoutDates: Array<{ date: string; index: number; tss?: number; type?: string }>
  ): Promise<AutoMatchResult[]> {
    if (workoutDates.length === 0) {
      return []
    }

    // Get date range from workouts
    const dates = workoutDates.map((w) => w.date).sort()
    const startDate = dates[0]!
    const endDate = dates[dates.length - 1]!

    // Get unmatched activities in date range
    const activities = await this.getUnmatchedActivities(startDate, endDate)

    // Get already matched workout slots for this instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMatches } = await (this.supabase as any)
      .from('workout_activity_matches')
      .select('workout_date, workout_index')
      .eq('plan_instance_id', planInstanceId)
      .eq('user_id', this.userId)

    const matchedSlots = new Set(
      ((existingMatches || []) as Array<{ workout_date: string; workout_index: number }>).map(
        (m) => `${m.workout_date}:${m.workout_index}`
      )
    )

    const suggestions: AutoMatchResult[] = []

    // For each workout, find the best matching activity
    for (const workout of workoutDates) {
      const slotKey = `${workout.date}:${workout.index}`
      if (matchedSlots.has(slotKey)) {
        continue // Already matched
      }

      // Find activities on the same date (comparing local dates)
      const sameDay = activities.filter((a) => getLocalDateFromTimestamp(a.start_date) === workout.date)

      if (sameDay.length === 0) {
        continue
      }

      // Score each activity
      const scored = sameDay.map((activity) => ({
        activity,
        score: calculateMatchScore(workout, {
          tss: activity.tss,
          type: activity.type,
          moving_time: activity.moving_time,
        }),
      }))

      // Take the best match above threshold
      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]

      if (best && best.score >= 50) {
        suggestions.push({
          workout_date: workout.date,
          workout_index: workout.index,
          activity: {
            id: best.activity.id,
            name: best.activity.name,
            type: best.activity.type,
            start_date: best.activity.start_date,
            tss: best.activity.tss,
          },
          score: best.score,
        })

        // Remove this activity from consideration for other workouts
        const idx = activities.findIndex((a) => a.id === best.activity.id)
        if (idx !== -1) {
          activities.splice(idx, 1)
        }
      }
    }

    return suggestions
  }

  /**
   * Apply auto-match suggestions
   */
  async applyAutoMatches(planInstanceId: string, suggestions: AutoMatchResult[]): Promise<number> {
    let matchedCount = 0

    for (const suggestion of suggestions) {
      try {
        await this.matchWorkout({
          plan_instance_id: planInstanceId,
          workout_date: suggestion.workout_date,
          workout_index: suggestion.workout_index,
          strava_activity_id: suggestion.activity.id,
          match_type: 'auto',
          match_score: suggestion.score,
        })
        matchedCount++
      } catch {
        // Skip if match fails (e.g., activity already matched elsewhere)
      }
    }

    return matchedCount
  }
}

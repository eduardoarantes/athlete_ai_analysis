/**
 * Training Plan TypeScript Types
 * Defines the structure of training plan data stored in plan_data JSON
 */

export interface WorkoutSegment {
  type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'work' | 'tempo'
  duration_min: number
  power_low_pct?: number
  power_high_pct?: number
  description?: string
  sets?: number
  work?: {
    duration_min: number
    power_low_pct: number
    power_high_pct: number
  }
  recovery?: {
    duration_min: number
    power_low_pct: number
    power_high_pct: number
  }
}

export interface Workout {
  weekday: string
  name: string
  description?: string
  detailed_description?: string
  type?:
    | 'endurance'
    | 'tempo'
    | 'sweet_spot'
    | 'threshold'
    | 'vo2max'
    | 'recovery'
    | 'mixed'
    | 'rest'
    | string
  tss?: number
  segments?: WorkoutSegment[]
}

export interface WeeklyPlan {
  week_number: number
  phase: string
  phase_rationale?: string
  week_tss: number
  workouts: Workout[]
  weekly_focus?: string
  weekly_watch_points?: string
}

export interface AthleteProfile {
  name?: string
  age?: number
  ftp: number
  max_hr?: number
  weight_kg?: number
  power_to_weight?: number
  goals?: string[]
  current_training_status?: string
  available_training_days?: string[]
  weekly_training_hours?: number
}

export interface PlanMetadata {
  total_weeks: number
  current_ftp: number
  target_ftp: number
  ftp_gain_watts?: number
  ftp_gain_percent?: number
  plan_type?: string
  start_date?: string
}

export interface TrainingPlanData {
  athlete_profile: AthleteProfile
  plan_metadata: PlanMetadata
  coaching_notes?: string
  monitoring_guidance?: string
  weekly_plan: WeeklyPlan[]
}

export interface TrainingPlan {
  id: string
  user_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  plan_data: TrainingPlanData
  status: string | null
  created_at: string
  updated_at: string
}

const WORKOUT_COLORS = {
  endurance:
    'bg-green-100/80 hover:bg-green-200/80 border-green-200 dark:bg-green-900/30 dark:border-green-800',
  tempo:
    'bg-yellow-100/80 hover:bg-yellow-200/80 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800',
  sweet_spot:
    'bg-amber-100/80 hover:bg-amber-200/80 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800',
  threshold:
    'bg-orange-100/80 hover:bg-orange-200/80 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800',
  vo2max: 'bg-red-100/80 hover:bg-red-200/80 border-red-200 dark:bg-red-900/30 dark:border-red-800',
  recovery:
    'bg-blue-100/80 hover:bg-blue-200/80 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800',
  rest: 'bg-gray-100/80 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700',
  mixed:
    'bg-purple-100/80 hover:bg-purple-200/80 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800',
} as const

type WorkoutColorType = keyof typeof WORKOUT_COLORS

/**
 * Get workout color classes based on workout type
 */
export function getWorkoutColors(type: string): string {
  if (type in WORKOUT_COLORS) {
    return WORKOUT_COLORS[type as WorkoutColorType]
  }
  return WORKOUT_COLORS.mixed
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)

  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Calculate total duration of a workout from its segments
 */
export function calculateWorkoutDuration(workout: Workout): number {
  if (!workout.segments || workout.segments.length === 0) {
    return 0
  }

  return workout.segments.reduce((total, segment) => {
    let segmentDuration = segment.duration_min || 0

    // Handle interval sets
    if (segment.sets && segment.work && segment.recovery) {
      const setDuration = (segment.work.duration_min + segment.recovery.duration_min) * segment.sets
      segmentDuration += setDuration
    }

    return total + segmentDuration
  }, 0)
}

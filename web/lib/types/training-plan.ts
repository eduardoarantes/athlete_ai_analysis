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
  /** Source of the workout: 'library' for pre-defined workouts, 'llm' for AI-generated */
  source?: 'library' | 'llm'
  /** ID of the workout in the library - NanoID format (only present when source='library') */
  library_workout_id?: string
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
}

/**
 * Source metadata for tracking how the plan was generated
 */
export interface PlanSourceMetadata {
  /** Source system that generated the plan */
  source: 'cycling-ai-python-api' | 'manual' | 'imported'
  /** AI provider used (e.g., 'anthropic', 'openai', 'gemini', 'ollama') */
  ai_provider?: string | undefined
  /** Specific AI model used (e.g., 'claude-3-sonnet', 'gpt-4') */
  ai_model?: string | undefined
  /** Version of the cycling-ai library */
  library_version?: string | undefined
  /** Timestamp when the plan was generated */
  generated_at: string
  /** Job ID from the generation process */
  job_id?: string | undefined
  /** Any additional provider-specific metadata */
  provider_metadata?: Record<string, unknown> | undefined
}

export interface TrainingPlanData {
  athlete_profile: AthleteProfile
  plan_metadata: PlanMetadata
  coaching_notes?: string
  monitoring_guidance?: string
  weekly_plan: WeeklyPlan[]
}

/**
 * Training Plan Template (no dates - reusable)
 * Templates define the workout structure but are not bound to specific dates.
 * Users schedule templates by creating PlanInstance records with start dates.
 */
export interface TrainingPlan {
  id: string
  user_id: string
  name: string
  /** Training goal (added in migration, optional for backward compatibility) */
  goal?: string
  description: string | null
  /** Duration in weeks (added in migration, optional for backward compatibility) */
  weeks_total?: number | null
  plan_data: TrainingPlanData
  /** Source metadata tracking how the plan was generated */
  metadata: PlanSourceMetadata | null
  status: 'draft' | 'active' | 'completed' | 'archived' | null
  created_at: string
  updated_at: string
  /** @deprecated Will be removed after migration - use PlanInstance.start_date instead */
  start_date?: string
  /** @deprecated Will be removed after migration - use PlanInstance.end_date instead */
  end_date?: string
}

/**
 * Plan Instance (scheduled on calendar with specific dates)
 * An instance is created when a user schedules a template.
 * Contains a snapshot of the template's plan_data at creation time.
 */
export interface PlanInstance {
  id: string
  user_id: string
  /** Reference to the original template (null if template was deleted) */
  template_id: string | null
  /** Plan name (snapshot from template) */
  name: string
  /** Start date in ISO format (YYYY-MM-DD) */
  start_date: string
  /** End date in ISO format (YYYY-MM-DD), calculated from start_date + weeks */
  end_date: string
  /** Duration in weeks (snapshot from template) */
  weeks_total: number
  /** Full plan data (SNAPSHOT: copied from template at instance creation) */
  plan_data: TrainingPlanData
  /** Instance status */
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

/**
 * Helper type for creating a new plan instance
 */
export interface CreatePlanInstanceInput {
  template_id: string
  start_date: string // ISO date string (YYYY-MM-DD)
}

/**
 * Response when checking for overlapping instances
 */
export interface OverlapCheckResult {
  hasOverlap: boolean
  conflicts: PlanInstance[]
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

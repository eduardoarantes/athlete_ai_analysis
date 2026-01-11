/**
 * Workout Library TypeScript Types
 * Matches Python Pydantic models in src/cycling_ai/core/workout_library/models.py
 *
 * Part of Issue #21: Plan Builder Phase 1 - Foundation
 */

// Import shared types from training-plan.ts
import type {
  WorkoutStructure,
  StructuredWorkoutSegment,
  WorkoutStep,
  StepLength,
  StepTarget,
  SegmentLength,
} from './training-plan'
import { calculateStructureDuration } from './training-plan'

// Re-export for convenience
export type {
  WorkoutStructure,
  StructuredWorkoutSegment,
  WorkoutStep,
  StepLength,
  StepTarget,
  SegmentLength,
}

/**
 * Workout type categories
 */
export type WorkoutType =
  | 'endurance'
  | 'tempo'
  | 'sweet_spot'
  | 'threshold'
  | 'vo2max'
  | 'recovery'
  | 'mixed'

/**
 * Workout intensity levels
 */
export type WorkoutIntensity = 'easy' | 'moderate' | 'hard' | 'very_hard'

/**
 * Training phases
 */
export type TrainingPhase = 'Base' | 'Build' | 'Peak' | 'Recovery' | 'Taper' | 'Foundation'

/**
 * Days of the week
 */
export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday'

/**
 * Segment types within a workout
 */
export type SegmentType = 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'tempo'

/**
 * Work or recovery part of an interval set
 */
export interface IntervalPart {
  duration_min: number
  power_low_pct: number
  power_high_pct: number
  description: string
}

/**
 * A segment within a workout
 * Can be either:
 * - Simple segment (warmup, cooldown, steady) with direct duration/power
 * - Interval set with work/recovery parts repeated for N sets
 */
export interface LibraryWorkoutSegment {
  type: SegmentType

  // For simple segments
  duration_min?: number
  power_low_pct?: number
  power_high_pct?: number
  description?: string

  // For interval sets
  sets?: number
  work?: IntervalPart
  recovery?: IntervalPart
}

/**
 * Variable components for workout scaling
 */
export interface VariableComponents {
  adjustable_field: 'duration' | 'sets'
  min_value: number
  max_value: number

  // Additional fields for 'sets' adjustable type
  tss_per_unit?: number
  duration_per_unit_min?: number
}

/**
 * A workout from the library
 * This is the structure returned by the /api/workouts endpoint
 */
export interface WorkoutLibraryItem {
  /** Unique workout identifier (NanoID format, e.g., 'RVrReapuzt') */
  id: string

  /** Display name (e.g., 'Zone 2 Endurance - 90 min') */
  name: string

  /** Detailed workout description with instructions */
  detailed_description?: string

  /** Workout type category */
  type: WorkoutType

  /** Workout intensity level */
  intensity: WorkoutIntensity

  /** Phases where this workout is suitable */
  suitable_phases?: TrainingPhase[]

  /** Days of the week where this workout is typically scheduled */
  suitable_weekdays?: Weekday[]

  /** Full workout structure with multi-step interval support (Issue #96) */
  structure: WorkoutStructure

  /** Base duration in minutes */
  base_duration_min: number

  /** Base TSS (Training Stress Score) */
  base_tss: number

  /** Variable components for workout scaling */
  variable_components?: VariableComponents

  /** Source file (for library maintenance) */
  source_file?: string

  /** Source format (for library maintenance) */
  source_format?: string

  /** SHA-256 hash of workout structure for duplicate detection (Issue #97) */
  signature?: string
}

/**
 * Response from GET /api/workouts
 */
export interface WorkoutLibraryResponse {
  workouts: WorkoutLibraryItem[]
  total: number
  filters_applied: WorkoutFilters
}

/**
 * Query parameters for filtering workouts
 */
export interface WorkoutFilters {
  /** Filter by workout types */
  type?: WorkoutType[] | undefined

  /** Filter by intensity levels */
  intensity?: WorkoutIntensity[] | undefined

  /** Filter by suitable phases */
  phase?: TrainingPhase[] | undefined

  /** Minimum duration in minutes */
  minDuration?: number | undefined

  /** Maximum duration in minutes */
  maxDuration?: number | undefined

  /** Search term for name/description */
  search?: string | undefined
}

/**
 * Intensity level display labels
 */
export const INTENSITY_LABELS: Record<WorkoutIntensity, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  very_hard: 'Very Hard',
}

/**
 * Calculate total duration of a library workout from its structure
 */
export function calculateLibraryWorkoutDuration(workout: WorkoutLibraryItem): number {
  if (workout.structure?.structure) {
    return calculateStructureDuration(workout.structure)
  }
  // Fallback to base_duration_min if structure is somehow empty
  return workout.base_duration_min
}

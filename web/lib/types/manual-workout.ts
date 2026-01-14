/**
 * Manual Workout Types
 * Defines TypeScript types for manual workouts stored in the manual_workouts table.
 * Manual workouts are user-added workouts that exist independently of training plans.
 */

import type { Database } from './database'
import type { Workout } from './training-plan'

// =========================================================================
// Database Types (from Supabase)
// =========================================================================

/**
 * Manual workout row from the database
 * Maps directly to the manual_workouts table structure
 */
export type ManualWorkout = Database['public']['Tables']['manual_workouts']['Row'] & {
  /** Full workout object including structure, intervals, TSS, etc. */
  workout_data: Workout
}

/**
 * Input for creating a new manual workout
 * Based on the database Insert type
 */
export type CreateManualWorkoutInput = Omit<
  Database['public']['Tables']['manual_workouts']['Insert'],
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  /** Full workout object to store */
  workout_data: Workout
}

/**
 * Input for updating an existing manual workout
 * Based on the database Update type
 */
export type UpdateManualWorkoutInput = Omit<
  Database['public']['Tables']['manual_workouts']['Update'],
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  /** Partial workout object for updates */
  workout_data?: Partial<Workout>
}

// =========================================================================
// Simplified Input Types
// =========================================================================

/**
 * Simplified input for adding a workout from the library
 * Used when users add library workouts to their calendar
 */
export interface AddLibraryWorkoutInput {
  /** Date to schedule the workout (YYYY-MM-DD format) */
  scheduled_date: string
  /** ID of the workout in the library (nanoid format) */
  library_workout_id: string
  /** Optional: Reference to the plan this was extracted from */
  source_plan_instance_id?: string
}

// =========================================================================
// Display Types for Calendar Integration
// =========================================================================

/**
 * Union type representing the source of a workout
 * - 'plan': Workout comes from a training plan instance
 * - 'manual': Workout is a standalone manual workout
 */
export type WorkoutSource = 'plan' | 'manual'

/**
 * Unified workout representation for calendar display
 * Merges plan workouts and manual workouts into a single interface
 * for easier rendering in the calendar component
 */
export interface CalendarWorkout {
  /** Unique identifier (workout.id for plan workouts, manual_workout.id for manual) */
  id: string
  /** Date this workout is scheduled (YYYY-MM-DD format) */
  scheduled_date: string
  /** The full workout data */
  workout: Workout
  /** Source of this workout */
  source: WorkoutSource
  /** Plan instance ID if source is 'plan', null otherwise */
  plan_instance_id: string | null
  /** Manual workout ID if source is 'manual', null otherwise */
  manual_workout_id: string | null
  /** Optional: Reference to the plan this manual workout was extracted from */
  source_plan_instance_id?: string | null
}

// =========================================================================
// API Response Types
// =========================================================================

/**
 * API response format for manual workout operations
 * Provides consistent structure for API endpoints
 */
export interface ManualWorkoutResponse {
  /** Indicates if the operation was successful */
  success: boolean
  /** The manual workout data (if successful) */
  data?: ManualWorkout
  /** Error message (if unsuccessful) */
  error?: string
}

/**
 * API response for list operations
 */
export interface ManualWorkoutsListResponse {
  /** Indicates if the operation was successful */
  success: boolean
  /** Array of manual workouts (if successful) */
  data?: ManualWorkout[]
  /** Error message (if unsuccessful) */
  error?: string
}

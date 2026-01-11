/**
 * Workout Overrides Helpers
 *
 * Shared utility functions for working with workout overrides.
 * Used by compliance routes and schedule components.
 *
 * Part of Issue #72: Workout Library Sidebar (refactored from duplicated code)
 */

import { parseLocalDate } from '@/lib/utils/date-utils'
import type {
  TrainingPlanData,
  Workout,
  WorkoutOverrides,
  WorkoutSegment,
} from '@/lib/types/training-plan'

// =============================================================================
// Constants
// =============================================================================

/**
 * Base index for library workouts added to the schedule.
 * We use indices >= 100 to avoid conflicts with original plan workouts
 * which typically have indices 0-10.
 */
export const LIBRARY_WORKOUT_BASE_INDEX = 100

// =============================================================================
// Types (re-exported for convenience)
// =============================================================================

/**
 * Library workout data stored in workout overrides copies
 */
export interface StoredLibraryWorkout {
  id?: string
  name?: string
  type?: string
  tss?: number
  duration_min?: number
  description?: string
  segments?: WorkoutSegment[]
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Downsample power data for chart display.
 * Uses max-value-in-window to preserve power peaks.
 *
 * @param data - Raw power data array
 * @param targetLength - Desired output length
 * @returns Downsampled power data
 */
export function downsamplePowerStream(data: number[], targetLength: number): number[] {
  // Early validation
  if (!Array.isArray(data) || data.length === 0) return []
  if (targetLength <= 0) return []
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

/**
 * Get workout from workout_overrides copies (for library workouts).
 *
 * This checks if a workout at the given date/index is a library workout
 * stored in the copies with source_date starting with 'library:'.
 *
 * @param overrides - The workout overrides object
 * @param targetDate - Date in YYYY-MM-DD format
 * @param workoutIndex - Index of the workout on that date
 * @returns The workout if found, null otherwise
 */
export function getWorkoutFromOverrides(
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
    if (lib.structure) workout.structure = lib.structure
    return workout
  }

  return null
}

/**
 * Get workout from plan_data for a specific date and index.
 *
 * This finds the original workout in the training plan based on
 * the instance start date, target date, and workout index.
 *
 * @param planData - The training plan data
 * @param startDate - Instance start date in YYYY-MM-DD format
 * @param targetDate - Target date in YYYY-MM-DD format
 * @param workoutIndex - Index of the workout on that date
 * @returns The workout if found, null otherwise
 */
export function getWorkoutFromPlan(
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
  if (!week) return null

  const dayWorkouts = week.workouts.filter(
    (w) => w.weekday?.toLowerCase() === targetWeekday?.toLowerCase()
  )

  return dayWorkouts[workoutIndex] || null
}

/**
 * Calculate the next available index for a library workout on a date.
 *
 * Library workouts use indices >= LIBRARY_WORKOUT_BASE_INDEX to avoid
 * conflicts with original plan workouts.
 *
 * @param overrides - Current workout overrides
 * @param targetDate - Date to check
 * @returns Next available index for a library workout
 */
export function getNextLibraryWorkoutIndex(
  overrides: WorkoutOverrides | null | undefined,
  targetDate: string
): number {
  if (!overrides?.copies) return LIBRARY_WORKOUT_BASE_INDEX

  const libraryIndices = Object.keys(overrides.copies)
    .filter((key) => {
      const copy = overrides.copies[key]
      return copy && copy.source_date.startsWith('library:') && key.startsWith(`${targetDate}:`)
    })
    .map((key) => {
      const parts = key.split(':')
      return parseInt(parts[1] || '0', 10)
    })
    .filter((idx) => idx >= LIBRARY_WORKOUT_BASE_INDEX)

  if (libraryIndices.length === 0) return LIBRARY_WORKOUT_BASE_INDEX
  return Math.max(...libraryIndices) + 1
}

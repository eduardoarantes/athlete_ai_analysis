/**
 * Workout Helpers
 *
 * Utility functions for working with workouts in plan_data.
 * Used by compliance routes and schedule components.
 */

import type { TrainingPlanData, Workout } from '@/lib/types/training-plan'

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
 * Get a workout by its unique ID.
 *
 * This is the preferred method for finding workouts when you have the workout ID,
 * as it's more direct than using date+index lookups.
 *
 * @param planData - The training plan data
 * @param workoutId - Unique workout ID (UUID format)
 * @returns The workout if found, null otherwise
 */
export function getWorkoutById(planData: TrainingPlanData, workoutId: string): Workout | null {
  if (!planData.weekly_plan) return null

  for (const week of planData.weekly_plan) {
    for (const workout of week.workouts) {
      if (workout.id === workoutId) {
        return workout
      }
    }
  }

  return null
}

/**
 * Get workout from plan_data by scheduled_date.
 *
 * Finds a workout in the training plan based on its scheduled_date field.
 * All workouts should now have scheduled_date, including library workouts.
 *
 * @param planData - The training plan data
 * @param targetDate - Target date in YYYY-MM-DD format
 * @returns The workout if found, null otherwise
 */
export function getWorkoutByDate(planData: TrainingPlanData, targetDate: string): Workout | null {
  if (!planData.weekly_plan) return null

  for (const week of planData.weekly_plan) {
    for (const workout of week.workouts) {
      if (workout.scheduled_date === targetDate) {
        return workout
      }
    }
  }

  return null
}

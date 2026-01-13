/**
 * Workout Display Utility
 *
 * Reads workouts directly from plan_data and organizes them by date for calendar display.
 * All workouts now use scheduled_date field - no more overrides or calculations.
 */

import type { TrainingPlanData, Workout, WeeklyPlan } from '@/lib/types/training-plan'

export interface EffectiveWorkoutInfo {
  workout: Workout
  originalIndex: number
  isModified: boolean
}

/**
 * Get workouts from plan_data organized by date
 *
 * All workouts must have a scheduled_date field.
 *
 * @param planData - The plan_data from the instance
 * @returns Map of date string to array of effective workout info
 */
export function getWorkoutsByDate(planData: TrainingPlanData): Map<string, EffectiveWorkoutInfo[]> {
  const result = new Map<string, EffectiveWorkoutInfo[]>()

  if (!planData.weekly_plan) {
    return result
  }

  planData.weekly_plan.forEach((week: WeeklyPlan) => {
    week.workouts.forEach((workout: Workout, workoutIndex: number) => {
      // All workouts must have scheduled_date
      if (!workout.scheduled_date) {
        return // Skip workouts without scheduled_date
      }

      const effectiveWorkout: EffectiveWorkoutInfo = {
        workout,
        originalIndex: workoutIndex,
        isModified: false,
      }

      if (!result.has(workout.scheduled_date)) {
        result.set(workout.scheduled_date, [])
      }
      result.get(workout.scheduled_date)!.push(effectiveWorkout)
    })
  })

  // Sort workouts by index within each date
  result.forEach((workouts, date) => {
    workouts.sort((a, b) => a.originalIndex - b.originalIndex)
    result.set(date, workouts)
  })

  return result
}

// Backward compatibility alias
export const applyWorkoutOverrides = getWorkoutsByDate

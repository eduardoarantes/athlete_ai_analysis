/**
 * Workout Display Utility
 *
 * Reads workouts directly from plan_data and organizes them by date for calendar display.
 * All workouts now use scheduled_date field - no more overrides or calculations.
 */

import { addDays } from 'date-fns'
import { parseLocalDate, formatDateString } from '@/lib/utils/date-utils'
import { getDayOffsetInWeek } from '@/lib/constants/weekdays'
import type { TrainingPlanData, Workout, WeeklyPlan } from '@/lib/types/training-plan'

export interface EffectiveWorkoutInfo {
  workout: Workout
  originalIndex: number
  isModified: boolean
}

/**
 * Get workouts from plan_data organized by date
 *
 * @param planData - The plan_data from the instance
 * @param startDate - The instance start_date (YYYY-MM-DD format) - used only for legacy workouts
 * @returns Map of date string to array of effective workout info
 */
export function getWorkoutsByDate(
  planData: TrainingPlanData,
  startDate: string
): Map<string, EffectiveWorkoutInfo[]> {
  const result = new Map<string, EffectiveWorkoutInfo[]>()
  const instanceStartDate = parseLocalDate(startDate)

  if (!planData.weekly_plan) {
    return result
  }

  planData.weekly_plan.forEach((week: WeeklyPlan) => {
    const weekStartOffset = (week.week_number - 1) * 7

    week.workouts.forEach((workout: Workout, workoutIndex: number) => {
      // Use scheduled_date if available (new system), otherwise calculate from week/weekday (legacy)
      let dateKey: string
      if (workout.scheduled_date) {
        dateKey = workout.scheduled_date
      } else {
        // Legacy fallback - calculate date from week_number + weekday
        const dayOffset = getDayOffsetInWeek(workout.weekday as any, instanceStartDate.getDay())
        const workoutDate = addDays(instanceStartDate, weekStartOffset + dayOffset)
        dateKey = formatDateString(workoutDate)
      }

      const effectiveWorkout: EffectiveWorkoutInfo = {
        workout,
        originalIndex: workoutIndex,
        isModified: false,
      }

      if (!result.has(dateKey)) {
        result.set(dateKey, [])
      }
      result.get(dateKey)!.push(effectiveWorkout)
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

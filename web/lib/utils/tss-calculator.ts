/**
 * TSS Calculator
 *
 * Calculates Training Stress Score (TSS) for workouts, days, and weeks.
 *
 * TSS Formula: TSS = (seconds × NP × IF) / (FTP × 3600) × 100
 * For library workouts, we use the pre-calculated base_tss value.
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import type { WorkoutsData, WorkoutPlacement, DayOfWeek } from '@/lib/types/plan-builder'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'

/**
 * Input type for TSS calculation - can be a workout or a placement
 */
type TssInput = WorkoutLibraryItem | WorkoutPlacement

/**
 * Calculate TSS for a single workout or placement
 *
 * For library workouts, returns the base_tss value.
 * For placements, uses the cached workout.base_tss if available.
 */
export function calculateWorkoutTss(input: TssInput): number {
  // Check if it's a WorkoutLibraryItem
  if ('base_tss' in input && typeof input.base_tss === 'number') {
    return input.base_tss
  }

  // Check if it's a WorkoutPlacement with cached workout data
  if ('workout' in input && input.workout?.base_tss !== undefined) {
    return input.workout.base_tss
  }

  return 0
}

/**
 * Calculate total TSS for all workouts in a day
 */
export function calculateDailyTss(placements: WorkoutPlacement[]): number {
  return placements.reduce((total, placement) => {
    return total + calculateWorkoutTss(placement)
  }, 0)
}

/**
 * Days of the week for iteration
 */
const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/**
 * Calculate total TSS for a week
 */
export function calculateWeeklyTss(workouts: WorkoutsData): number {
  return DAYS.reduce((total, day) => {
    return total + calculateDailyTss(workouts[day])
  }, 0)
}

/**
 * Calculate estimated TSS based on duration and intensity factor
 *
 * This is useful when you don't have a pre-calculated TSS value.
 * TSS = (duration_min / 60) × IF² × 100
 *
 * @param durationMinutes - Workout duration in minutes
 * @param intensityFactor - IF (0.5 for easy, 0.65 for endurance, 0.85 for tempo, 0.95-1.05 for threshold)
 */
export function estimateTss(durationMinutes: number, intensityFactor: number): number {
  return Math.round((durationMinutes / 60) * Math.pow(intensityFactor, 2) * 100)
}

/**
 * Calculate average weekly TSS for a plan
 */
export function calculatePlanAverageWeeklyTss(weeks: WorkoutsData[]): number {
  if (weeks.length === 0) return 0

  const totalTss = weeks.reduce((sum, week) => sum + calculateWeeklyTss(week), 0)
  return Math.round(totalTss / weeks.length)
}

/**
 * Intensity factor estimates by workout type
 * These are approximate values for common workout types
 */
export const INTENSITY_FACTORS: Record<string, number> = {
  recovery: 0.55,
  endurance: 0.65,
  tempo: 0.85,
  sweet_spot: 0.90,
  threshold: 0.95,
  vo2max: 1.10,
  mixed: 0.80,
}

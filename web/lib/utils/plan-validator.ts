/**
 * Plan Validator
 *
 * Validation logic for custom training plans.
 * Checks for common issues and provides helpful warnings.
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import type {
  WeekState,
  PlanBuilderState,
  WorkoutsData,
  DayOfWeek,
} from '@/lib/types/plan-builder'
import type { TrainingPhase } from '@/lib/types/workout-library'
import { calculateWeeklyTss } from './tss-calculator'

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
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * TSS thresholds for validation
 */
const TSS_THRESHOLDS = {
  MAX_WEEKLY: 800, // Very high weekly TSS
  MAX_RECOVERY_WEEKLY: 300, // Recovery weeks should be lower
  MAX_INCREASE_PERCENT: 15, // Max % increase week over week
}

/**
 * Count rest days (days without workouts) in a week
 */
function countRestDays(workouts: WorkoutsData): number {
  return DAYS.filter((day) => workouts[day].length === 0).length
}

/**
 * Check if week has any workouts
 */
function hasWorkouts(workouts: WorkoutsData): boolean {
  return DAYS.some((day) => workouts[day].length > 0)
}

/**
 * Validate a single week
 */
export function validateWeek(week: WeekState): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if week has any workouts
  if (!hasWorkouts(week.workouts)) {
    errors.push(`Week ${week.weekNumber} has no workouts scheduled`)
  }

  // Calculate TSS if not already set
  const weeklyTss = week.weeklyTss || calculateWeeklyTss(week.workouts)

  // Check for no rest days
  const restDays = countRestDays(week.workouts)
  if (restDays === 0 && hasWorkouts(week.workouts)) {
    warnings.push(`Week ${week.weekNumber} has no rest days`)
  }

  // Check for very high weekly TSS
  if (weeklyTss > TSS_THRESHOLDS.MAX_WEEKLY) {
    warnings.push(
      `Week ${week.weekNumber} TSS (${weeklyTss}) is very high. Consider reducing training load.`
    )
  }

  // Check recovery week has appropriate TSS
  if (week.phase === 'Recovery' && weeklyTss > TSS_THRESHOLDS.MAX_RECOVERY_WEEKLY) {
    warnings.push(
      `Recovery week ${week.weekNumber} has high TSS (${weeklyTss}). Consider reducing to ${TSS_THRESHOLDS.MAX_RECOVERY_WEEKLY} or below.`
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate the entire plan
 */
export function validatePlan(state: PlanBuilderState): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check plan has a name
  if (!state.metadata.name || state.metadata.name.trim() === '') {
    errors.push('Plan name is required')
  }

  // Check plan has weeks
  if (!state.weeks || state.weeks.length === 0) {
    errors.push('Plan has no weeks')
    return { isValid: false, errors, warnings }
  }

  // Validate each week
  for (const week of state.weeks) {
    const weekResult = validateWeek(week)
    errors.push(...weekResult.errors)
    warnings.push(...weekResult.warnings)
  }

  // Validate progressive overload
  const weekData = state.weeks.map((w) => ({
    weeklyTss: w.weeklyTss || calculateWeeklyTss(w.workouts),
    phase: w.phase,
  }))
  const overloadResult = validateProgressiveOverload(weekData)
  warnings.push(...overloadResult.warnings)

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Week data for progressive overload validation
 */
interface WeekTssData {
  weeklyTss: number
  phase: TrainingPhase
}

/**
 * Validate progressive overload (week-over-week TSS changes)
 */
export function validateProgressiveOverload(weeks: WeekTssData[]): ValidationResult {
  const warnings: string[] = []

  if (weeks.length < 2) {
    return { isValid: true, errors: [], warnings }
  }

  // Phases where TSS decrease is expected
  const decreasePhases: TrainingPhase[] = ['Recovery', 'Taper']

  for (let i = 1; i < weeks.length; i++) {
    const currentWeek = weeks[i]!
    const previousWeek = weeks[i - 1]!

    // Skip if previous week has no TSS
    if (previousWeek.weeklyTss === 0) continue

    // Calculate percentage change
    const change = currentWeek.weeklyTss - previousWeek.weeklyTss
    const percentChange = (change / previousWeek.weeklyTss) * 100

    // Allow decrease for recovery/taper phases
    if (decreasePhases.includes(currentWeek.phase)) {
      continue
    }

    // Warn on too rapid increase
    if (percentChange > TSS_THRESHOLDS.MAX_INCREASE_PERCENT) {
      warnings.push(
        `Week ${i + 1} has a ${Math.round(percentChange)}% TSS increase from Week ${i}. ` +
          `Consider increasing by ${TSS_THRESHOLDS.MAX_INCREASE_PERCENT}% or less.`
      )
    }
  }

  return {
    isValid: true, // Progressive overload warnings don't make plan invalid
    errors: [],
    warnings,
  }
}

/**
 * Check if a plan is ready to publish (no errors, may have warnings)
 */
export function isPlanReadyToPublish(state: PlanBuilderState): boolean {
  const result = validatePlan(state)
  return result.isValid
}

/**
 * Type guards for runtime type validation
 * These help ensure data from external sources (Supabase, API responses)
 * matches our expected TypeScript types.
 */

import type { PlanInstance, TrainingPlan, TrainingPlanData } from './training-plan'
import type { WorkoutPlacement } from './plan-builder'
import type { WorkoutComplianceAnalysis } from '@/lib/services/compliance-analysis-service'

/**
 * Check if a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Check if value has all required properties of a PlanInstance
 */
export function isPlanInstance(value: unknown): value is PlanInstance {
  if (!isObject(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.start_date === 'string' &&
    typeof value.end_date === 'string' &&
    typeof value.weeks_total === 'number' &&
    typeof value.status === 'string' &&
    ['scheduled', 'active', 'completed', 'cancelled'].includes(value.status as string)
  )
}

/**
 * Check if value has all required properties of a TrainingPlan (template)
 */
export function isTrainingPlan(value: unknown): value is TrainingPlan {
  if (!isObject(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.name === 'string' &&
    // weeks_total can be a number, null, or undefined (fallback to plan_data.plan_metadata.total_weeks)
    (typeof value.weeks_total === 'number' ||
      value.weeks_total === null ||
      value.weeks_total === undefined)
  )
}

/**
 * Check if value has required properties of TrainingPlanData
 */
export function isTrainingPlanData(value: unknown): value is TrainingPlanData {
  if (!isObject(value)) return false

  // At minimum, we need weekly_plan to be an array
  return Array.isArray(value.weekly_plan)
}

/**
 * Safely cast Supabase response to PlanInstance with validation
 * Returns null if validation fails
 */
export function asPlanInstance(value: unknown): PlanInstance | null {
  if (isPlanInstance(value)) {
    return value
  }
  return null
}

/**
 * Safely cast Supabase response array to PlanInstance array
 * Filters out invalid entries
 */
export function asPlanInstances(values: unknown): PlanInstance[] {
  if (!Array.isArray(values)) return []
  return values.filter(isPlanInstance)
}

/**
 * Safely cast Supabase response to TrainingPlan with validation
 * Returns null if validation fails
 */
export function asTrainingPlan(value: unknown): TrainingPlan | null {
  if (isTrainingPlan(value)) {
    return value
  }
  return null
}

/**
 * Assert that a value is a PlanInstance, throwing if not
 * Use when you expect the data to always be valid
 */
export function assertPlanInstance(value: unknown, context?: string): PlanInstance {
  if (!isPlanInstance(value)) {
    throw new Error(`Invalid PlanInstance${context ? ` in ${context}` : ''}`)
  }
  return value
}

/**
 * Assert that a value is a TrainingPlan, throwing if not
 */
export function assertTrainingPlan(value: unknown, context?: string): TrainingPlan {
  if (!isTrainingPlan(value)) {
    throw new Error(`Invalid TrainingPlan${context ? ` in ${context}` : ''}`)
  }
  return value
}

/**
 * Assert that a value is TrainingPlanData, throwing if not
 */
export function assertTrainingPlanData(value: unknown, context?: string): TrainingPlanData {
  if (!isTrainingPlanData(value)) {
    throw new Error(`Invalid TrainingPlanData${context ? ` in ${context}` : ''}`)
  }
  return value
}

/**
 * Check if value has required properties of WorkoutPlacement
 */
export function isWorkoutPlacement(value: unknown): value is WorkoutPlacement {
  if (!isObject(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.workoutKey === 'string' &&
    typeof value.order === 'number'
  )
}

/**
 * Check if value is an array of WorkoutPlacement
 */
export function isWorkoutPlacementArray(value: unknown): value is WorkoutPlacement[] {
  if (!Array.isArray(value)) return false
  return value.every(isWorkoutPlacement)
}

/**
 * Check if value has required properties of WorkoutComplianceAnalysis
 */
export function isWorkoutComplianceAnalysis(value: unknown): value is WorkoutComplianceAnalysis {
  if (!isObject(value)) return false

  return (
    isObject(value.overall) &&
    Array.isArray(value.segments) &&
    isObject(value.metadata) &&
    typeof value.metadata.algorithm_version === 'string'
  )
}

/**
 * Assert that a value is WorkoutComplianceAnalysis, throwing if not
 */
export function assertWorkoutComplianceAnalysis(
  value: unknown,
  context?: string
): WorkoutComplianceAnalysis {
  if (!isWorkoutComplianceAnalysis(value)) {
    throw new Error(`Invalid WorkoutComplianceAnalysis${context ? ` in ${context}` : ''}`)
  }
  return value
}

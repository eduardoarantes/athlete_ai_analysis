/**
 * Schedule Edit Service
 *
 * Handles user modifications to scheduled workout plans including:
 * - Moving workouts to different dates (blocked if matched)
 * - Copying workouts to different dates
 * - Deleting workouts from schedule
 * - Computing effective workout schedule with overrides applied
 */

import { createClient } from '@/lib/supabase/server'
import { startOfDay, parseISO, format, addDays } from 'date-fns'
import type { TrainingPlanData, Workout, WeeklyPlan } from '@/lib/types/training-plan'
import { errorLogger } from '@/lib/monitoring/error-logger'

// Types for workout overrides
export interface WorkoutMove {
  original_date: string
  original_index: number
  moved_at: string
}

export interface WorkoutCopy {
  source_date: string
  source_index: number
  copied_at: string
}

export interface WorkoutOverrides {
  moves: Record<string, WorkoutMove> // key: "YYYY-MM-DD:index"
  copies: Record<string, WorkoutCopy> // key: "YYYY-MM-DD:index"
  deleted: string[] // array of "YYYY-MM-DD:index"
}

export interface EffectiveWorkout extends Workout {
  date: string
  index: number
  isModified: boolean
  modificationSource?: 'moved' | 'copied'
  originalDate?: string
}

export interface WorkoutLocation {
  date: string
  index: number
}

export interface EditOperationResult {
  success: boolean
  error?: string | undefined
  updatedOverrides?: WorkoutOverrides | undefined
}

export interface ValidationResult {
  valid: boolean
  error?: string | undefined
}

const EMPTY_OVERRIDES: WorkoutOverrides = {
  moves: {},
  copies: {},
  deleted: [],
}

/**
 * Create a workout key from date and index
 */
export function createWorkoutKey(date: string, index: number): string {
  return `${date}:${index}`
}

/**
 * Parse a workout key into date and index
 */
export function parseWorkoutKey(key: string): WorkoutLocation | null {
  const parts = key.split(':')
  if (parts.length !== 2) return null

  const datePart = parts[0]
  const indexPart = parts[1]
  if (datePart === undefined || indexPart === undefined) return null

  const index = parseInt(indexPart, 10)
  if (isNaN(index)) return null

  return { date: datePart, index }
}

export class ScheduleEditService {
  /**
   * Validate that the user owns this instance and operation is allowed
   */
  async validateAccess(instanceId: string, userId: string): Promise<ValidationResult> {
    const supabase = await createClient()

    const { data: instance, error } = await supabase
      .from('plan_instances')
      .select('id, user_id, status')
      .eq('id', instanceId)
      .single()

    if (error || !instance) {
      return { valid: false, error: 'Plan instance not found' }
    }

    if (instance.user_id !== userId) {
      return { valid: false, error: 'Not authorized to edit this plan' }
    }

    if (instance.status === 'cancelled' || instance.status === 'completed') {
      return { valid: false, error: 'Cannot edit a completed or cancelled plan' }
    }

    return { valid: true }
  }

  /**
   * Validate that the target date is not in the past
   */
  validateTargetDate(targetDate: string): ValidationResult {
    const target = parseISO(targetDate)
    const today = startOfDay(new Date())

    if (target < today) {
      return { valid: false, error: 'Cannot move or copy workouts to past dates' }
    }

    return { valid: true }
  }

  /**
   * Validate that the source workout is not in the past (for moves only)
   */
  validateSourceDateForMove(sourceDate: string): ValidationResult {
    const source = parseISO(sourceDate)
    const today = startOfDay(new Date())

    if (source < today) {
      return { valid: false, error: 'Cannot move workouts from past dates' }
    }

    return { valid: true }
  }

  /**
   * Check if a workout has a matched activity (blocks move, not copy)
   */
  async hasMatchedActivity(instanceId: string, date: string, index: number): Promise<boolean> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workout_activity_matches')
      .select('id')
      .eq('plan_instance_id', instanceId)
      .eq('workout_date', date)
      .eq('workout_index', index)
      .maybeSingle()

    if (error) {
      errorLogger.logWarning('Error checking workout match', {
        metadata: { instanceId, date, index, error: error.message },
      })
      return false
    }

    return !!data
  }

  /**
   * Get current overrides for an instance
   * Note: workout_overrides column must be added via migration
   */
  async getOverrides(instanceId: string): Promise<WorkoutOverrides> {
    const supabase = await createClient()

    // Using raw query since workout_overrides may not be in generated types yet
    const { data, error } = await supabase
      .from('plan_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (error || !data) {
      return { ...EMPTY_OVERRIDES }
    }

    // Access workout_overrides from the raw data
    const rawData = data as Record<string, unknown>
    const rawOverrides = rawData['workout_overrides']
    if (!rawOverrides) {
      return { ...EMPTY_OVERRIDES }
    }

    // Ensure all fields exist
    const overrides = rawOverrides as Partial<WorkoutOverrides>
    return {
      moves: overrides.moves || {},
      copies: overrides.copies || {},
      deleted: overrides.deleted || [],
    }
  }

  /**
   * Save overrides to database
   * Note: workout_overrides column must be added via migration
   */
  async saveOverrides(
    instanceId: string,
    overrides: WorkoutOverrides
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    // Using type assertion since workout_overrides may not be in generated types yet
    const { error } = await supabase
      .from('plan_instances')
      .update({ workout_overrides: overrides } as Record<string, unknown>)
      .eq('id', instanceId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Move a workout from one date to another
   * - Blocked if workout has matched activity
   * - Source must be current or future date
   * - Target must be current or future date
   */
  async moveWorkout(
    instanceId: string,
    userId: string,
    source: WorkoutLocation,
    target: WorkoutLocation
  ): Promise<EditOperationResult> {
    // Validate access
    const accessResult = await this.validateAccess(instanceId, userId)
    if (!accessResult.valid) {
      return { success: false, error: accessResult.error }
    }

    // Validate source date (must be current or future for moves)
    const sourceValidation = this.validateSourceDateForMove(source.date)
    if (!sourceValidation.valid) {
      return { success: false, error: sourceValidation.error }
    }

    // Validate target date
    const targetValidation = this.validateTargetDate(target.date)
    if (!targetValidation.valid) {
      return { success: false, error: targetValidation.error }
    }

    // Check if workout has matched activity (blocks move)
    const hasMatch = await this.hasMatchedActivity(instanceId, source.date, source.index)
    if (hasMatch) {
      return {
        success: false,
        error: 'Cannot move a workout with a matched activity. Use copy instead.',
      }
    }

    // Get current overrides
    const overrides = await this.getOverrides(instanceId)

    // Create source and target keys
    const sourceKey = createWorkoutKey(source.date, source.index)
    const targetKey = createWorkoutKey(target.date, target.index)

    // Check if there's an existing move entry that points to this source
    // (i.e., this workout was already moved to an intermediate location)
    // If so, we need to remove that old move entry
    const existingMoveToRemove = Object.entries(overrides.moves).find(
      ([, move]) => move.original_date === source.date && move.original_index === source.index
    )
    if (existingMoveToRemove) {
      const [oldTargetKey] = existingMoveToRemove
      delete overrides.moves[oldTargetKey]
    }

    // Record the new move
    overrides.moves[targetKey] = {
      original_date: source.date,
      original_index: source.index,
      moved_at: new Date().toISOString(),
    }

    // Mark source as deleted (since it's moved) - only if not already tracked
    if (!overrides.deleted.includes(sourceKey)) {
      overrides.deleted.push(sourceKey)
    }

    // Save to database
    const saveResult = await this.saveOverrides(instanceId, overrides)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, updatedOverrides: overrides }
  }

  /**
   * Copy a workout to another date
   * - Allowed even if workout has matched activity (copies workout, not match)
   * - Source can be any date (past or future)
   * - Target must be current or future date
   */
  async copyWorkout(
    instanceId: string,
    userId: string,
    source: WorkoutLocation,
    target: WorkoutLocation
  ): Promise<EditOperationResult> {
    // Validate access
    const accessResult = await this.validateAccess(instanceId, userId)
    if (!accessResult.valid) {
      return { success: false, error: accessResult.error }
    }

    // Validate target date
    const targetValidation = this.validateTargetDate(target.date)
    if (!targetValidation.valid) {
      return { success: false, error: targetValidation.error }
    }

    // Get current overrides
    const overrides = await this.getOverrides(instanceId)

    // Create target key
    const targetKey = createWorkoutKey(target.date, target.index)

    // Record the copy
    overrides.copies[targetKey] = {
      source_date: source.date,
      source_index: source.index,
      copied_at: new Date().toISOString(),
    }

    // Save to database
    const saveResult = await this.saveOverrides(instanceId, overrides)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, updatedOverrides: overrides }
  }

  /**
   * Delete a workout from schedule
   * - Only for current or future dates
   */
  async deleteWorkout(
    instanceId: string,
    userId: string,
    location: WorkoutLocation
  ): Promise<EditOperationResult> {
    // Validate access
    const accessResult = await this.validateAccess(instanceId, userId)
    if (!accessResult.valid) {
      return { success: false, error: accessResult.error }
    }

    // Validate date (must be current or future)
    const dateValidation = this.validateTargetDate(location.date)
    if (!dateValidation.valid) {
      return { success: false, error: 'Cannot delete workouts from past dates' }
    }

    // Get current overrides
    const overrides = await this.getOverrides(instanceId)

    // Create key
    const key = createWorkoutKey(location.date, location.index)

    // Add to deleted if not already there
    if (!overrides.deleted.includes(key)) {
      overrides.deleted.push(key)
    }

    // Save to database
    const saveResult = await this.saveOverrides(instanceId, overrides)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, updatedOverrides: overrides }
  }

  /**
   * Reset all modifications to the original plan
   */
  async resetToOriginal(instanceId: string, userId: string): Promise<EditOperationResult> {
    // Validate access
    const accessResult = await this.validateAccess(instanceId, userId)
    if (!accessResult.valid) {
      return { success: false, error: accessResult.error }
    }

    // Clear all overrides
    const saveResult = await this.saveOverrides(instanceId, { ...EMPTY_OVERRIDES })
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, updatedOverrides: { ...EMPTY_OVERRIDES } }
  }

  /**
   * Get the next available index for a workout on a given date
   */
  getNextAvailableIndex(workoutsByDate: Map<string, EffectiveWorkout[]>, date: string): number {
    const existingWorkouts = workoutsByDate.get(date) || []
    if (existingWorkouts.length === 0) return 0

    const maxIndex = Math.max(...existingWorkouts.map((w) => w.index))
    return maxIndex + 1
  }

  /**
   * Compute effective workouts with overrides applied
   * This merges the original plan_data with workout_overrides
   */
  computeEffectiveWorkouts(
    planData: TrainingPlanData,
    overrides: WorkoutOverrides,
    startDate: string
  ): Map<string, EffectiveWorkout[]> {
    const result = new Map<string, EffectiveWorkout[]>()
    const instanceStartDate = parseISO(startDate)

    // Day index mapping
    const dayToIndex: Record<string, number> = {
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
      Sunday: 6,
    }

    // First, build original workouts from plan_data
    if (planData.weekly_plan) {
      planData.weekly_plan.forEach((week: WeeklyPlan) => {
        const weekStartOffset = (week.week_number - 1) * 7

        week.workouts.forEach((workout: Workout, workoutIndex: number) => {
          const dayIndex = dayToIndex[workout.weekday] ?? 0
          const workoutDate = addDays(instanceStartDate, weekStartOffset + dayIndex)
          const dateKey = format(workoutDate, 'yyyy-MM-dd')
          const fullKey = createWorkoutKey(dateKey, workoutIndex)

          // Skip if deleted
          if (overrides.deleted.includes(fullKey)) {
            return
          }

          // Skip if this workout was moved elsewhere (source is deleted)
          const wasMovedFrom = Object.values(overrides.moves).some(
            (move) => move.original_date === dateKey && move.original_index === workoutIndex
          )
          if (wasMovedFrom) {
            return
          }

          const effectiveWorkout: EffectiveWorkout = {
            ...workout,
            date: dateKey,
            index: workoutIndex,
            isModified: false,
          }

          if (!result.has(dateKey)) {
            result.set(dateKey, [])
          }
          result.get(dateKey)!.push(effectiveWorkout)
        })
      })
    }

    // Apply moves - add moved workouts to their new locations
    Object.entries(overrides.moves).forEach(([targetKey, move]) => {
      const target = parseWorkoutKey(targetKey)
      if (!target) return

      // Find the original workout
      const originalWorkout = this.findOriginalWorkout(
        planData,
        startDate,
        move.original_date,
        move.original_index
      )

      if (originalWorkout) {
        const effectiveWorkout: EffectiveWorkout = {
          ...originalWorkout,
          date: target.date,
          index: target.index,
          isModified: true,
          modificationSource: 'moved',
          originalDate: move.original_date,
        }

        if (!result.has(target.date)) {
          result.set(target.date, [])
        }
        result.get(target.date)!.push(effectiveWorkout)
      }
    })

    // Apply copies - add copied workouts to their locations
    Object.entries(overrides.copies).forEach(([targetKey, copy]) => {
      const target = parseWorkoutKey(targetKey)
      if (!target) return

      // Find the source workout
      const sourceWorkout = this.findOriginalWorkout(
        planData,
        startDate,
        copy.source_date,
        copy.source_index
      )

      if (sourceWorkout) {
        const effectiveWorkout: EffectiveWorkout = {
          ...sourceWorkout,
          date: target.date,
          index: target.index,
          isModified: true,
          modificationSource: 'copied',
          originalDate: copy.source_date,
        }

        if (!result.has(target.date)) {
          result.set(target.date, [])
        }
        result.get(target.date)!.push(effectiveWorkout)
      }
    })

    // Sort workouts by index within each date
    result.forEach((workouts, date) => {
      workouts.sort((a, b) => a.index - b.index)
      result.set(date, workouts)
    })

    return result
  }

  /**
   * Find the original workout from plan_data by date and index
   */
  private findOriginalWorkout(
    planData: TrainingPlanData,
    instanceStartDate: string,
    targetDate: string,
    targetIndex: number
  ): Workout | null {
    const startDate = parseISO(instanceStartDate)

    const dayToIndex: Record<string, number> = {
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
      Sunday: 6,
    }

    if (!planData.weekly_plan) return null

    for (const week of planData.weekly_plan) {
      const weekStartOffset = (week.week_number - 1) * 7

      for (let i = 0; i < week.workouts.length; i++) {
        const workout = week.workouts[i]
        if (!workout) continue

        const dayIndex = dayToIndex[workout.weekday] ?? 0
        const workoutDate = addDays(startDate, weekStartOffset + dayIndex)
        const dateKey = format(workoutDate, 'yyyy-MM-dd')

        if (dateKey === targetDate && i === targetIndex) {
          return workout
        }
      }
    }

    return null
  }

  /**
   * Check if instance has any modifications
   */
  hasModifications(overrides: WorkoutOverrides): boolean {
    return (
      Object.keys(overrides.moves).length > 0 ||
      Object.keys(overrides.copies).length > 0 ||
      overrides.deleted.length > 0
    )
  }
}

// Export singleton instance
export const scheduleEditService = new ScheduleEditService()

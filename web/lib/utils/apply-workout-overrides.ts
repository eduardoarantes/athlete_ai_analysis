/**
 * Client-side utility to apply workout overrides
 *
 * Takes the original plan_data and workout_overrides from a plan instance
 * and returns the effective workouts with modifications applied.
 * Also handles library workout copies (source_date starts with "library:")
 */

import { addDays } from 'date-fns'
import { parseLocalDate, formatDateString } from '@/lib/utils/date-utils'
import { getDayOffsetInWeek } from '@/lib/constants/weekdays'
import type {
  TrainingPlanData,
  Workout,
  WeeklyPlan,
  WorkoutOverrides,
  WorkoutStructure,
} from '@/lib/types/training-plan'
import { createPlaceholderStructure } from '@/lib/utils/workout-structure-helpers'

// Re-export for convenience
export type { WorkoutOverrides }

export interface EffectiveWorkoutInfo {
  workout: Workout
  originalIndex: number
  isModified: boolean
  modificationSource?: 'moved' | 'copied' | 'library'
  originalDate?: string
  /** For library workouts, the library workout ID */
  libraryWorkoutId?: string
}

/**
 * Parameters for creating a schedule workout from library data
 */
export interface LibraryWorkoutParams {
  /** Library workout ID (NanoID format) - for library reference */
  id: string
  /** Unique workout instance ID (UUID format) - for matching purposes */
  workoutInstanceId?: string | undefined
  /** Display name of the workout */
  name?: string | undefined
  /** Workout type category */
  type?: string | undefined
  /** Training Stress Score */
  tss?: number | undefined
  /** Detailed description */
  description?: string | undefined
  /** Duration in minutes (used to create a placeholder structure if no structure provided) */
  durationMin?: number | undefined
  /** WorkoutStructure format (Issue #96) */
  structure?: WorkoutStructure | undefined
}

/**
 * Convert a library workout to a schedule Workout format
 *
 * This is used when rendering library workouts on the calendar.
 * When called from applyWorkoutOverrides, only the ID is available,
 * so defaults are used. For full workout data, the caller should
 * fetch the library workout details and pass them as parameters.
 *
 * @param params - Library workout parameters (at minimum, just the ID)
 * @returns A Workout object suitable for rendering on the schedule
 */
export function libraryWorkoutToScheduleWorkout(params: LibraryWorkoutParams | string): Workout {
  // Support legacy call signature (just ID string)
  const normalized: LibraryWorkoutParams = typeof params === 'string' ? { id: params } : params

  const {
    id,
    workoutInstanceId,
    name = 'Library Workout',
    type = 'mixed',
    tss = 50,
    description,
    durationMin,
    structure: providedStructure,
  } = normalized

  // Use provided structure, or create a placeholder if duration is provided
  const structure: WorkoutStructure | undefined = providedStructure
    ? providedStructure
    : durationMin
      ? createPlaceholderStructure(durationMin)
      : undefined

  const workout: Workout = {
    // Use provided instance ID, or generate a new one for legacy library workouts
    id: workoutInstanceId || crypto.randomUUID(),
    weekday: 'Monday', // Placeholder - actual date comes from the override
    name,
    type,
    tss,
    description: description || `Library workout: ${name}`,
    source: 'library',
    library_workout_id: id,
  }

  // Add structure if available
  if (structure) {
    workout.structure = structure
  }

  return workout
}

function createWorkoutKey(date: string, index: number): string {
  return `${date}:${index}`
}

function parseWorkoutKey(key: string): { date: string; index: number } | null {
  const parts = key.split(':')
  if (parts.length !== 2) return null
  const datePart = parts[0]
  const indexPart = parts[1]
  if (datePart === undefined || indexPart === undefined) return null
  const index = parseInt(indexPart, 10)
  if (isNaN(index)) return null
  return { date: datePart, index }
}

function findOriginalWorkout(
  planData: TrainingPlanData,
  instanceStartDate: string,
  targetDate: string,
  targetIndex: number
): Workout | null {
  const startDate = parseLocalDate(instanceStartDate)

  if (!planData.weekly_plan) return null

  for (const week of planData.weekly_plan) {
    const weekStartOffset = (week.week_number - 1) * 7

    for (let i = 0; i < week.workouts.length; i++) {
      const workout = week.workouts[i]
      if (!workout) continue

      const dayOffset = getDayOffsetInWeek(workout.weekday as any, startDate.getDay())
      const workoutDate = addDays(startDate, weekStartOffset + dayOffset)
      const dateKey = formatDateString(workoutDate)

      if (dateKey === targetDate && i === targetIndex) {
        return workout
      }
    }
  }

  return null
}

/**
 * Apply workout overrides to get effective workouts by date
 *
 * @param planData - The original plan_data from the instance
 * @param overrides - The workout_overrides from the instance (can be null/undefined)
 * @param startDate - The instance start_date (YYYY-MM-DD format)
 * @returns Map of date string to array of effective workout info
 */
export function applyWorkoutOverrides(
  planData: TrainingPlanData,
  overrides: WorkoutOverrides | null | undefined,
  startDate: string
): Map<string, EffectiveWorkoutInfo[]> {
  const result = new Map<string, EffectiveWorkoutInfo[]>()
  const instanceStartDate = parseLocalDate(startDate)

  // Normalize overrides
  const normalizedOverrides: WorkoutOverrides = {
    moves: overrides?.moves || {},
    copies: overrides?.copies || {},
    deleted: overrides?.deleted || [],
  }

  // First, build original workouts from plan_data
  if (planData.weekly_plan) {
    planData.weekly_plan.forEach((week: WeeklyPlan) => {
      const weekStartOffset = (week.week_number - 1) * 7

      week.workouts.forEach((workout: Workout, workoutIndex: number) => {
        const dayOffset = getDayOffsetInWeek(workout.weekday as any, instanceStartDate.getDay())
        const workoutDate = addDays(instanceStartDate, weekStartOffset + dayOffset)
        const dateKey = formatDateString(workoutDate)
        const fullKey = createWorkoutKey(dateKey, workoutIndex)

        // Skip if deleted
        if (normalizedOverrides.deleted.includes(fullKey)) {
          return
        }

        // Skip if this workout was moved elsewhere (source is deleted)
        const wasMovedFrom = Object.values(normalizedOverrides.moves).some(
          (move) => move.original_date === dateKey && move.original_index === workoutIndex
        )
        if (wasMovedFrom) {
          return
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
  }

  // Apply moves - add moved workouts to their new locations
  Object.entries(normalizedOverrides.moves).forEach(([targetKey, move]) => {
    const target = parseWorkoutKey(targetKey)
    if (!target) return

    // Build the original location key
    const originalKey = `${move.original_date}:${move.original_index}`

    // Check if this is a moved copy (library workout) first
    const copiedWorkout = normalizedOverrides.copies[originalKey]
    let workoutToMove: Workout | null = null

    if (copiedWorkout) {
      // This is a library workout that was moved
      if (copiedWorkout.source_date.startsWith('library:')) {
        const libraryWorkoutId =
          copiedWorkout.library_workout?.library_workout_id ||
          copiedWorkout.source_date.replace('library:', '')

        const workoutParams: LibraryWorkoutParams = copiedWorkout.library_workout
          ? {
              id: libraryWorkoutId,
              workoutInstanceId: copiedWorkout.library_workout.id,
              name: copiedWorkout.library_workout.name,
              type: copiedWorkout.library_workout.type,
              tss: copiedWorkout.library_workout.tss,
              durationMin: copiedWorkout.library_workout.duration_min,
              description: copiedWorkout.library_workout.description,
              structure: copiedWorkout.library_workout.structure,
            }
          : { id: libraryWorkoutId }

        workoutToMove = libraryWorkoutToScheduleWorkout(workoutParams)
      } else {
        // Regular copy from original plan
        workoutToMove = findOriginalWorkout(
          planData,
          startDate,
          copiedWorkout.source_date,
          copiedWorkout.source_index
        )
      }
    } else {
      // No copy found, must be from original plan
      workoutToMove = findOriginalWorkout(
        planData,
        startDate,
        move.original_date,
        move.original_index
      )
    }

    if (workoutToMove) {
      const effectiveWorkout: EffectiveWorkoutInfo = {
        workout: workoutToMove,
        originalIndex: target.index,
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
  Object.entries(normalizedOverrides.copies).forEach(([targetKey, copy]) => {
    const target = parseWorkoutKey(targetKey)
    if (!target) return

    // Skip if this copy was deleted
    if (normalizedOverrides.deleted.includes(targetKey)) {
      return
    }

    // Check if this is a library workout copy
    if (copy.source_date.startsWith('library:')) {
      // Extract library workout ID from source_date
      // Get library workout ID from library_workout.library_workout_id if available,
      // otherwise parse from source_date for backward compatibility
      const libraryWorkoutId =
        copy.library_workout?.library_workout_id || copy.source_date.replace('library:', '')

      // Use stored library workout data if available, otherwise create placeholder
      const workoutParams: LibraryWorkoutParams = copy.library_workout
        ? {
            id: libraryWorkoutId,
            // Use the stored workout instance ID if available
            workoutInstanceId: copy.library_workout.id,
            name: copy.library_workout.name,
            type: copy.library_workout.type,
            tss: copy.library_workout.tss,
            durationMin: copy.library_workout.duration_min,
            description: copy.library_workout.description,
            structure: copy.library_workout.structure,
          }
        : { id: libraryWorkoutId }

      const libraryWorkout = libraryWorkoutToScheduleWorkout(workoutParams)

      const effectiveWorkout: EffectiveWorkoutInfo = {
        workout: libraryWorkout,
        originalIndex: target.index,
        isModified: true,
        modificationSource: 'library',
        originalDate: copy.source_date,
        libraryWorkoutId: libraryWorkoutId,
      }

      if (!result.has(target.date)) {
        result.set(target.date, [])
      }
      result.get(target.date)!.push(effectiveWorkout)
      return
    }

    // Find the source workout for normal copies
    const sourceWorkout = findOriginalWorkout(
      planData,
      startDate,
      copy.source_date,
      copy.source_index
    )

    if (sourceWorkout) {
      // Copied workouts get a new ID to distinguish them from the original
      const copiedWorkout: Workout = {
        ...sourceWorkout,
        id: crypto.randomUUID(),
      }

      const effectiveWorkout: EffectiveWorkoutInfo = {
        workout: copiedWorkout,
        originalIndex: target.index,
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
    workouts.sort((a, b) => a.originalIndex - b.originalIndex)
    result.set(date, workouts)
  })

  return result
}

/**
 * Check if an instance has any modifications
 */
export function hasModifications(overrides: WorkoutOverrides | null | undefined): boolean {
  if (!overrides) return false
  return (
    Object.keys(overrides.moves || {}).length > 0 ||
    Object.keys(overrides.copies || {}).length > 0 ||
    (overrides.deleted || []).length > 0
  )
}

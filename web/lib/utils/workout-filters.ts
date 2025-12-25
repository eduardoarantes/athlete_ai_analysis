/**
 * Workout Filters Validation
 *
 * Validation logic for workout library query parameters.
 * Extracted for testability.
 *
 * Part of Issue #21: Plan Builder Phase 1 - Foundation
 */

import type { WorkoutFilters, WorkoutType, WorkoutIntensity, TrainingPhase } from '@/lib/types/workout-library'

// Valid values for validation
export const VALID_WORKOUT_TYPES = new Set<WorkoutType>([
  'endurance',
  'tempo',
  'sweet_spot',
  'threshold',
  'vo2max',
  'recovery',
  'mixed',
])

export const VALID_INTENSITIES = new Set<WorkoutIntensity>([
  'easy',
  'moderate',
  'hard',
  'very_hard',
])

export const VALID_PHASES = new Set<TrainingPhase>([
  'Base',
  'Build',
  'Peak',
  'Recovery',
  'Taper',
  'Foundation',
])

export interface FilterValidationResult {
  valid: boolean
  errors: string[]
  filters: WorkoutFilters
}

/**
 * Validate and sanitize workout filter query parameters
 */
export function validateWorkoutFilters(searchParams: URLSearchParams): FilterValidationResult {
  const errors: string[] = []
  const filters: WorkoutFilters = {}

  // Validate type
  const types = searchParams.getAll('type')
  if (types.length > 0) {
    const validTypes = types.filter((t): t is WorkoutType => VALID_WORKOUT_TYPES.has(t as WorkoutType))
    const invalidTypes = types.filter((t) => !VALID_WORKOUT_TYPES.has(t as WorkoutType))
    if (invalidTypes.length > 0) {
      errors.push(`Invalid type(s): ${invalidTypes.join(', ')}`)
    }
    if (validTypes.length > 0) {
      filters.type = validTypes
    }
  }

  // Validate intensity
  const intensities = searchParams.getAll('intensity')
  if (intensities.length > 0) {
    const validIntensities = intensities.filter((i): i is WorkoutIntensity =>
      VALID_INTENSITIES.has(i as WorkoutIntensity)
    )
    const invalidIntensities = intensities.filter(
      (i) => !VALID_INTENSITIES.has(i as WorkoutIntensity)
    )
    if (invalidIntensities.length > 0) {
      errors.push(`Invalid intensity(ies): ${invalidIntensities.join(', ')}`)
    }
    if (validIntensities.length > 0) {
      filters.intensity = validIntensities
    }
  }

  // Validate phase
  const phases = searchParams.getAll('phase')
  if (phases.length > 0) {
    const validPhases = phases.filter((p): p is TrainingPhase =>
      VALID_PHASES.has(p as TrainingPhase)
    )
    const invalidPhases = phases.filter((p) => !VALID_PHASES.has(p as TrainingPhase))
    if (invalidPhases.length > 0) {
      errors.push(`Invalid phase(s): ${invalidPhases.join(', ')}`)
    }
    if (validPhases.length > 0) {
      filters.phase = validPhases
    }
  }

  // Validate duration
  const minDuration = searchParams.get('minDuration')
  if (minDuration) {
    const parsed = parseInt(minDuration, 10)
    if (isNaN(parsed) || parsed < 0) {
      errors.push('minDuration must be a non-negative integer')
    } else {
      filters.minDuration = parsed
    }
  }

  const maxDuration = searchParams.get('maxDuration')
  if (maxDuration) {
    const parsed = parseInt(maxDuration, 10)
    if (isNaN(parsed) || parsed < 0) {
      errors.push('maxDuration must be a non-negative integer')
    } else {
      filters.maxDuration = parsed
    }
  }

  if (
    filters.minDuration !== undefined &&
    filters.maxDuration !== undefined &&
    filters.minDuration > filters.maxDuration
  ) {
    errors.push('minDuration cannot be greater than maxDuration')
  }

  // Validate search (just sanitize, no length validation)
  const search = searchParams.get('search')
  if (search) {
    filters.search = search.trim()
  }

  return {
    valid: errors.length === 0,
    errors,
    filters,
  }
}

/**
 * Build Python script command arguments from filters
 */
export function buildPythonArgs(filters: WorkoutFilters): string[] {
  const args: string[] = []

  if (filters.type) {
    for (const t of filters.type) {
      args.push('--type', t)
    }
  }

  if (filters.intensity) {
    for (const i of filters.intensity) {
      args.push('--intensity', i)
    }
  }

  if (filters.phase) {
    for (const p of filters.phase) {
      args.push('--phase', p)
    }
  }

  if (filters.minDuration !== undefined) {
    args.push('--min-duration', filters.minDuration.toString())
  }

  if (filters.maxDuration !== undefined) {
    args.push('--max-duration', filters.maxDuration.toString())
  }

  if (filters.search) {
    // Escape single quotes in search term
    const escapedSearch = filters.search.replace(/'/g, "'\\''")
    args.push('--search', `'${escapedSearch}'`)
  }

  return args
}

/**
 * Workout Structure Helper Functions
 *
 * Utilities for working with the WorkoutStructure format (Issue #96)
 * Used throughout the application for consistent structure handling.
 */

import type {
  WorkoutStructure,
  StructuredWorkoutSegment,
  WorkoutStep,
} from '@/lib/types/training-plan'
import {
  hasValidStructure,
  calculateStructureDuration,
  convertStepLengthToMinutes,
  extractPowerTarget,
} from '@/lib/types/training-plan'

// Re-export commonly used functions
export { hasValidStructure, calculateStructureDuration }

/**
 * Display segment type for UI rendering
 * Maps to the visual representation of workout segments
 */
export type DisplaySegmentType = 'warmup' | 'interval' | 'steady' | 'cooldown' | 'recovery'

/**
 * Display segment for UI rendering
 * Flattened structure for easy iteration in components
 */
export interface DisplaySegment {
  type: DisplaySegmentType
  /** Duration in minutes */
  duration_min: number
  /** Power low as percentage of FTP */
  power_low_pct: number
  /** Power high as percentage of FTP */
  power_high_pct: number
  /** Human-readable description */
  description: string
  /** Number of repetitions (for interval segments) */
  sets?: number
  /** Work portion of interval (if interval type) */
  work?: {
    duration_min: number
    power_low_pct: number
    power_high_pct: number
    description: string
  }
  /** Recovery portion of interval (if interval type) */
  recovery?: {
    duration_min: number
    power_low_pct: number
    power_high_pct: number
    description: string
  }
}

/**
 * Map WorkoutStep intensityClass to DisplaySegmentType
 */
function intensityClassToSegmentType(
  intensityClass: WorkoutStep['intensityClass']
): DisplaySegmentType {
  switch (intensityClass) {
    case 'warmUp':
      return 'warmup'
    case 'coolDown':
      return 'cooldown'
    case 'rest':
      return 'recovery'
    case 'active':
    default:
      return 'steady'
  }
}

/**
 * Extract power values from step targets
 */
function extractStepPower(step: WorkoutStep): { low: number; high: number } {
  const power = extractPowerTarget(step.targets)
  return { low: power.minValue, high: power.maxValue }
}

/**
 * Convert a WorkoutStructure to an array of DisplaySegments for UI rendering
 *
 * This flattens the nested structure into a format that's easy to iterate
 * and display in components like workout cards and detail modals.
 *
 * @param structure - The WorkoutStructure to convert
 * @returns Array of DisplaySegment objects
 */
export function structureToDisplaySegments(structure: WorkoutStructure): DisplaySegment[] {
  if (!hasValidStructure(structure)) {
    return []
  }

  const displaySegments: DisplaySegment[] = []

  for (const segment of structure.structure) {
    if (segment.type === 'step' && segment.steps.length === 1) {
      // Single step (warmup, cooldown, steady)
      const step = segment.steps[0]
      if (!step) continue
      const power = extractStepPower(step)
      displaySegments.push({
        type: intensityClassToSegmentType(step.intensityClass),
        duration_min: convertStepLengthToMinutes(step.length),
        power_low_pct: power.low,
        power_high_pct: power.high,
        description: step.name,
      })
    } else if (segment.type === 'repetition' || segment.steps.length > 1) {
      // Multi-step interval
      const repetitions = segment.length.value

      if (segment.steps.length === 2) {
        // Classic work/recovery interval
        const workStep = segment.steps[0]
        const recoveryStep = segment.steps[1]
        if (!workStep || !recoveryStep) continue
        const workPower = extractStepPower(workStep)
        const recoveryPower = extractStepPower(recoveryStep)

        displaySegments.push({
          type: 'interval',
          duration_min:
            (convertStepLengthToMinutes(workStep.length) +
              convertStepLengthToMinutes(recoveryStep.length)) *
            repetitions,
          power_low_pct: workPower.low,
          power_high_pct: workPower.high,
          description: `${repetitions}x ${workStep.name}`,
          sets: repetitions,
          work: {
            duration_min: convertStepLengthToMinutes(workStep.length),
            power_low_pct: workPower.low,
            power_high_pct: workPower.high,
            description: workStep.name,
          },
          recovery: {
            duration_min: convertStepLengthToMinutes(recoveryStep.length),
            power_low_pct: recoveryPower.low,
            power_high_pct: recoveryPower.high,
            description: recoveryStep.name,
          },
        })
      } else if (segment.steps.length > 2) {
        // Multi-step interval (3+ steps like Z3→Z5→Z2)
        // Calculate total duration and use the highest power step for display
        let totalDuration = 0
        let maxPowerHigh = 0
        let maxPowerLow = 0
        const stepNames: string[] = []

        for (const step of segment.steps) {
          totalDuration += convertStepLengthToMinutes(step.length)
          const power = extractStepPower(step)
          if (power.high > maxPowerHigh) {
            maxPowerHigh = power.high
            maxPowerLow = power.low
          }
          stepNames.push(step.name)
        }

        displaySegments.push({
          type: 'interval',
          duration_min: totalDuration * repetitions,
          power_low_pct: maxPowerLow,
          power_high_pct: maxPowerHigh,
          description: `${repetitions}x (${stepNames.join(' → ')})`,
          sets: repetitions,
        })
      }
    }
  }

  return displaySegments
}

/**
 * Count total number of workout steps in a structure
 * Useful for displaying segment counts in UI
 */
export function getStructureStepCount(structure: WorkoutStructure): number {
  if (!hasValidStructure(structure)) {
    return 0
  }

  return structure.structure.reduce((count, segment) => {
    return count + segment.steps.length * segment.length.value
  }, 0)
}

/**
 * Count number of top-level segments (not expanded by repetitions)
 */
export function getStructureSegmentCount(structure: WorkoutStructure): number {
  if (!hasValidStructure(structure)) {
    return 0
  }
  return structure.structure.length
}

/**
 * Get the primary intensity from a structure (for categorization)
 * Returns the highest power percentage found in "active" steps
 */
export function getStructurePrimaryIntensity(structure: WorkoutStructure): number {
  if (!hasValidStructure(structure)) {
    return 0
  }

  let maxIntensity = 0

  for (const segment of structure.structure) {
    for (const step of segment.steps) {
      if (step.intensityClass === 'active') {
        const power = extractPowerTarget(step.targets)
        if (power.maxValue > maxIntensity) {
          maxIntensity = power.maxValue
        }
      }
    }
  }

  return maxIntensity
}

/**
 * Get total work time (excluding warmup/cooldown) from structure
 */
export function getStructureWorkTime(structure: WorkoutStructure): number {
  if (!hasValidStructure(structure)) {
    return 0
  }

  let workTime = 0

  for (const segment of structure.structure) {
    const repetitions = segment.length.value
    for (const step of segment.steps) {
      if (step.intensityClass === 'active') {
        workTime += convertStepLengthToMinutes(step.length) * repetitions
      }
    }
  }

  return workTime
}

/**
 * Create a placeholder structure for workouts without detailed structure
 * Useful when creating ad-hoc workouts with just duration
 */
export function createPlaceholderStructure(durationMin: number): WorkoutStructure {
  return {
    primaryIntensityMetric: 'percentOfFtp',
    primaryLengthMetric: 'duration',
    structure: [
      {
        type: 'step',
        length: { unit: 'repetition', value: 1 },
        steps: [
          {
            name: 'Workout',
            intensityClass: 'active',
            length: { unit: 'minute', value: durationMin },
            targets: [
              {
                type: 'power',
                minValue: 50,
                maxValue: 75,
                unit: 'percentOfFtp',
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Create a warmup-only structure
 */
export function createWarmupStructure(durationMin: number = 10): WorkoutStructure {
  return {
    primaryIntensityMetric: 'percentOfFtp',
    primaryLengthMetric: 'duration',
    structure: [
      {
        type: 'step',
        length: { unit: 'repetition', value: 1 },
        steps: [
          {
            name: 'Warm up',
            intensityClass: 'warmUp',
            length: { unit: 'minute', value: durationMin },
            targets: [
              {
                type: 'power',
                minValue: 45,
                maxValue: 55,
                unit: 'percentOfFtp',
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Validate that a structure has all required fields
 * More thorough than hasValidStructure which just checks for non-empty
 */
export function isStructureComplete(structure: WorkoutStructure): boolean {
  if (!hasValidStructure(structure)) {
    return false
  }

  // Check that all segments have valid steps
  for (const segment of structure.structure) {
    if (!segment.steps || segment.steps.length === 0) {
      return false
    }

    for (const step of segment.steps) {
      // Each step must have a name and length
      if (!step.name || !step.length || !step.length.value) {
        return false
      }
      // Each step must have at least one target
      if (!step.targets || step.targets.length === 0) {
        return false
      }
    }
  }

  return true
}

/**
 * Format a structure segment for display (e.g., "3x 5min @ 100-105%")
 */
export function formatStructureSegmentSummary(segment: StructuredWorkoutSegment): string {
  const repetitions = segment.length.value
  const steps = segment.steps

  if (steps.length === 0) {
    return 'Empty segment'
  }

  if (steps.length === 1) {
    const step = steps[0]
    if (!step) return 'Empty segment'
    const duration = convertStepLengthToMinutes(step.length)
    const power = extractPowerTarget(step.targets)
    return `${formatMinutes(duration)} @ ${power.minValue}-${power.maxValue}%`
  }

  // Multi-step: show as "Nx (step1 + step2 + ...)"
  const stepSummaries = steps.map((step) => {
    const duration = convertStepLengthToMinutes(step.length)
    return formatMinutes(duration)
  })

  return `${repetitions}x (${stepSummaries.join(' + ')})`
}

/**
 * Format minutes to a short string (e.g., "5m", "1h 30m")
 */
function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

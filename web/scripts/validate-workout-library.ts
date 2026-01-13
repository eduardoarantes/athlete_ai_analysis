#!/usr/bin/env npx tsx
/**
 * Workout Library Validation Script
 *
 * Validates all workouts in the workout library against the WorkoutStructure schema.
 * Part of Issue #97: Recreate Workout Library
 *
 * Usage:
 *   npx tsx scripts/validate-workout-library.ts [library-file]
 *   npx tsx scripts/validate-workout-library.ts                                    # Uses default
 *   npx tsx scripts/validate-workout-library.ts data/workout_library.json          # Custom path
 */

import * as fs from 'fs'
import * as path from 'path'
import { convertStepLengthToMinutes } from '../lib/types/training-plan'
import type {
  WorkoutStructure,
  StructuredWorkoutSegment,
  WorkoutStep,
  StepTarget,
} from '../lib/types/training-plan'

// ============================================================================
// Types
// ============================================================================

interface ValidationError {
  path: string
  message: string
  severity: 'error' | 'warning'
}

interface WorkoutValidationResult {
  id: string
  name: string
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  summary: {
    totalSegments: number
    totalSteps: number
    totalDurationMin: number
    hasMultiStepIntervals: boolean
    hasCadenceTargets: boolean
    hasHeartRateTargets: boolean
  }
}

interface LibraryValidationResult {
  valid: boolean
  totalWorkouts: number
  validWorkouts: number
  invalidWorkouts: number
  workouts: WorkoutValidationResult[]
  statistics: {
    byType: Record<string, number>
    byIntensity: Record<string, number>
    totalDurationHours: number
    avgDurationMin: number
    avgTSS: number
    multiStepIntervalCount: number
    cadenceTargetCount: number
    uniqueSignatures: number
  }
}

interface LibraryWorkout {
  id: string
  name: string
  type: string
  intensity: string
  structure?: WorkoutStructure
  base_duration_min: number
  base_tss: number
  signature: string
}

interface WorkoutLibrary {
  version: string
  description: string
  workouts: LibraryWorkout[]
}

// ============================================================================
// Validators
// ============================================================================

const VALID_LENGTH_UNITS = ['second', 'minute', 'hour', 'meter', 'kilometer', 'mile']
const VALID_TARGET_TYPES = ['power', 'heartrate', 'cadence']
const VALID_TARGET_UNITS = ['percentOfFtp', 'watts', 'bpm', 'rpm']
const VALID_INTENSITY_CLASSES = ['warmUp', 'active', 'rest', 'coolDown']
const VALID_SEGMENT_TYPES = ['step', 'repetition']
const VALID_INTENSITY_METRICS = ['percentOfFtp', 'watts', 'heartrate']
const VALID_LENGTH_METRICS = ['duration', 'distance']

function validateStepTarget(
  target: StepTarget,
  path: string
): { valid: boolean; errors: ValidationError[]; type: string } {
  const errors: ValidationError[] = []

  if (!target.type || !VALID_TARGET_TYPES.includes(target.type)) {
    errors.push({
      path: `${path}.type`,
      message: `Invalid type. Must be one of: ${VALID_TARGET_TYPES.join(', ')}`,
      severity: 'error',
    })
  }

  if (typeof target.minValue !== 'number') {
    errors.push({
      path: `${path}.minValue`,
      message: 'minValue must be a number',
      severity: 'error',
    })
  } else if (target.minValue < 0) {
    errors.push({
      path: `${path}.minValue`,
      message: 'minValue must be non-negative',
      severity: 'error',
    })
  }

  if (typeof target.maxValue !== 'number') {
    errors.push({
      path: `${path}.maxValue`,
      message: 'maxValue must be a number',
      severity: 'error',
    })
  } else if (target.maxValue < 0) {
    errors.push({
      path: `${path}.maxValue`,
      message: 'maxValue must be non-negative',
      severity: 'error',
    })
  }

  if (
    typeof target.minValue === 'number' &&
    typeof target.maxValue === 'number' &&
    target.minValue > target.maxValue
  ) {
    errors.push({
      path,
      message: `minValue (${target.minValue}) cannot be greater than maxValue (${target.maxValue})`,
      severity: 'error',
    })
  }

  if (target.unit !== undefined && !VALID_TARGET_UNITS.includes(target.unit)) {
    errors.push({
      path: `${path}.unit`,
      message: `Invalid unit. Must be one of: ${VALID_TARGET_UNITS.join(', ')}`,
      severity: 'error',
    })
  }

  return { valid: errors.length === 0, errors, type: target.type }
}

function validateWorkoutStep(
  step: WorkoutStep,
  path: string
): {
  valid: boolean
  errors: ValidationError[]
  minutes: number
  hasCadence: boolean
  hasHR: boolean
} {
  const errors: ValidationError[] = []
  let minutes = 0
  let hasCadence = false
  let hasHR = false

  if (typeof step.name !== 'string' || step.name.trim() === '') {
    errors.push({
      path: `${path}.name`,
      message: 'name must be a non-empty string',
      severity: 'error',
    })
  }

  if (!step.intensityClass || !VALID_INTENSITY_CLASSES.includes(step.intensityClass)) {
    errors.push({
      path: `${path}.intensityClass`,
      message: `Invalid intensityClass. Must be one of: ${VALID_INTENSITY_CLASSES.join(', ')}`,
      severity: 'error',
    })
  }

  // Validate length
  if (!step.length || typeof step.length !== 'object') {
    errors.push({ path: `${path}.length`, message: 'length must be an object', severity: 'error' })
  } else {
    if (!VALID_LENGTH_UNITS.includes(step.length.unit)) {
      errors.push({
        path: `${path}.length.unit`,
        message: `Invalid unit. Must be one of: ${VALID_LENGTH_UNITS.join(', ')}`,
        severity: 'error',
      })
    }
    if (typeof step.length.value !== 'number' || step.length.value <= 0) {
      errors.push({
        path: `${path}.length.value`,
        message: 'value must be a positive number',
        severity: 'error',
      })
    } else {
      minutes = convertStepLengthToMinutes(step.length)
    }
  }

  // Validate targets
  if (!Array.isArray(step.targets)) {
    errors.push({ path: `${path}.targets`, message: 'targets must be an array', severity: 'error' })
  } else if (step.targets.length === 0) {
    errors.push({
      path: `${path}.targets`,
      message: 'targets array should not be empty (recommend at least a power target)',
      severity: 'warning',
    })
  } else {
    step.targets.forEach((target, i) => {
      const targetResult = validateStepTarget(target, `${path}.targets[${i}]`)
      errors.push(...targetResult.errors)
      if (targetResult.type === 'cadence') hasCadence = true
      if (targetResult.type === 'heartrate') hasHR = true
    })
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    minutes,
    hasCadence,
    hasHR,
  }
}

function validateStructuredWorkoutSegment(
  segment: StructuredWorkoutSegment,
  path: string
): {
  valid: boolean
  errors: ValidationError[]
  minutes: number
  stepCount: number
  isMultiStep: boolean
  hasCadence: boolean
  hasHR: boolean
} {
  const errors: ValidationError[] = []
  let minutes = 0
  let stepCount = 0
  let isMultiStep = false
  let hasCadence = false
  let hasHR = false

  if (!segment.type || !VALID_SEGMENT_TYPES.includes(segment.type)) {
    errors.push({
      path: `${path}.type`,
      message: `Invalid type. Must be one of: ${VALID_SEGMENT_TYPES.join(', ')}`,
      severity: 'error',
    })
  }

  // Validate length
  if (!segment.length || typeof segment.length !== 'object') {
    errors.push({ path: `${path}.length`, message: 'length must be an object', severity: 'error' })
  } else {
    if (segment.length.unit !== 'repetition') {
      errors.push({
        path: `${path}.length.unit`,
        message: 'Segment length unit must be "repetition"',
        severity: 'error',
      })
    }
    if (typeof segment.length.value !== 'number' || segment.length.value <= 0) {
      errors.push({
        path: `${path}.length.value`,
        message: 'length.value must be a positive number',
        severity: 'error',
      })
    }
  }

  // Validate steps
  if (!Array.isArray(segment.steps)) {
    errors.push({ path: `${path}.steps`, message: 'steps must be an array', severity: 'error' })
  } else if (segment.steps.length === 0) {
    errors.push({
      path: `${path}.steps`,
      message: 'steps array cannot be empty',
      severity: 'error',
    })
  } else {
    const repetitions = segment.length?.value || 1

    segment.steps.forEach((step, i) => {
      const stepResult = validateWorkoutStep(step, `${path}.steps[${i}]`)
      errors.push(...stepResult.errors)
      minutes += stepResult.minutes * repetitions
      stepCount += repetitions
      if (stepResult.hasCadence) hasCadence = true
      if (stepResult.hasHR) hasHR = true
    })

    // Check for multi-step intervals
    if (segment.steps.length > 2 && segment.type === 'repetition' && repetitions > 1) {
      isMultiStep = true
    }
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    minutes,
    stepCount,
    isMultiStep,
    hasCadence,
    hasHR,
  }
}

function validateWorkoutStructure(structure: WorkoutStructure): {
  valid: boolean
  errors: ValidationError[]
  summary: WorkoutValidationResult['summary']
} {
  const errors: ValidationError[] = []
  let totalSegments = 0
  let totalSteps = 0
  let totalDurationMin = 0
  let hasMultiStepIntervals = false
  let hasCadenceTargets = false
  let hasHeartRateTargets = false

  // Validate primaryIntensityMetric
  if (!structure.primaryIntensityMetric) {
    errors.push({
      path: 'primaryIntensityMetric',
      message: 'primaryIntensityMetric is required',
      severity: 'error',
    })
  } else if (!VALID_INTENSITY_METRICS.includes(structure.primaryIntensityMetric)) {
    errors.push({
      path: 'primaryIntensityMetric',
      message: `Invalid value. Must be one of: ${VALID_INTENSITY_METRICS.join(', ')}`,
      severity: 'error',
    })
  }

  // Validate primaryLengthMetric
  if (!structure.primaryLengthMetric) {
    errors.push({
      path: 'primaryLengthMetric',
      message: 'primaryLengthMetric is required',
      severity: 'error',
    })
  } else if (!VALID_LENGTH_METRICS.includes(structure.primaryLengthMetric)) {
    errors.push({
      path: 'primaryLengthMetric',
      message: `Invalid value. Must be one of: ${VALID_LENGTH_METRICS.join(', ')}`,
      severity: 'error',
    })
  }

  // Validate structure array
  if (!Array.isArray(structure.structure)) {
    errors.push({ path: 'structure', message: 'structure must be an array', severity: 'error' })
  } else if (structure.structure.length === 0) {
    errors.push({
      path: 'structure',
      message: 'structure array cannot be empty',
      severity: 'error',
    })
  } else {
    structure.structure.forEach((segment, i) => {
      const segmentResult = validateStructuredWorkoutSegment(segment, `structure[${i}]`)
      errors.push(...segmentResult.errors)
      totalSegments++
      totalSteps += segmentResult.stepCount
      totalDurationMin += segmentResult.minutes
      if (segmentResult.isMultiStep) hasMultiStepIntervals = true
      if (segmentResult.hasCadence) hasCadenceTargets = true
      if (segmentResult.hasHR) hasHeartRateTargets = true
    })
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    summary: {
      totalSegments,
      totalSteps,
      totalDurationMin: Math.round(totalDurationMin * 10) / 10,
      hasMultiStepIntervals,
      hasCadenceTargets,
      hasHeartRateTargets,
    },
  }
}

function validateWorkout(workout: LibraryWorkout): WorkoutValidationResult {
  if (!workout.structure) {
    return {
      id: workout.id,
      name: workout.name,
      valid: false,
      errors: [{ path: 'structure', message: 'Missing structure field', severity: 'error' }],
      warnings: [],
      summary: {
        totalSegments: 0,
        totalSteps: 0,
        totalDurationMin: 0,
        hasMultiStepIntervals: false,
        hasCadenceTargets: false,
        hasHeartRateTargets: false,
      },
    }
  }

  const result = validateWorkoutStructure(workout.structure)

  return {
    id: workout.id,
    name: workout.name,
    valid: result.valid,
    errors: result.errors.filter((e) => e.severity === 'error'),
    warnings: result.errors.filter((e) => e.severity === 'warning'),
    summary: result.summary,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Workout Library Validation Script

Usage:
  npx tsx scripts/validate-workout-library.ts [library-file]
  npx tsx scripts/validate-workout-library.ts                          # Uses default
  npx tsx scripts/validate-workout-library.ts data/workout_library.json # Custom path

Options:
  --help, -h      Show this help message
  --json          Output results as JSON
  --verbose       Show details for all workouts (not just invalid ones)

Defaults:
  library-file:  ../data/workout_library.json (relative to web/)
`)
    process.exit(0)
  }

  const jsonOutput = args.includes('--json')
  const verbose = args.includes('--verbose')
  const positionalArgs = args.filter((a) => !a.startsWith('--'))

  const libraryFile =
    positionalArgs[0] || path.resolve(__dirname, '..', '..', 'data', 'workout_library.json')

  if (!fs.existsSync(libraryFile)) {
    console.error(`Error: Library file not found: ${libraryFile}`)
    process.exit(1)
  }

  // Load library
  const content = fs.readFileSync(libraryFile, 'utf-8')
  const library: WorkoutLibrary = JSON.parse(content)

  console.log('Workout Library Validation')
  console.log('='.repeat(50))
  console.log(`Library: ${libraryFile}`)
  console.log(`Version: ${library.version}`)
  console.log(`Total workouts: ${library.workouts.length}`)
  console.log('')

  // Validate all workouts
  const workoutResults: WorkoutValidationResult[] = []
  let validCount = 0
  let invalidCount = 0

  const typeStats: Record<string, number> = {}
  const intensityStats: Record<string, number> = {}
  let totalDuration = 0
  let totalTSS = 0
  let multiStepCount = 0
  let cadenceCount = 0
  const signatures = new Set<string>()

  for (const workout of library.workouts) {
    const result = validateWorkout(workout)
    workoutResults.push(result)

    if (result.valid) {
      validCount++
    } else {
      invalidCount++
    }

    // Collect statistics
    typeStats[workout.type] = (typeStats[workout.type] || 0) + 1
    intensityStats[workout.intensity] = (intensityStats[workout.intensity] || 0) + 1
    totalDuration += workout.base_duration_min
    totalTSS += workout.base_tss
    if (result.summary.hasMultiStepIntervals) multiStepCount++
    if (result.summary.hasCadenceTargets) cadenceCount++
    signatures.add(workout.signature)
  }

  const libraryResult: LibraryValidationResult = {
    valid: invalidCount === 0,
    totalWorkouts: library.workouts.length,
    validWorkouts: validCount,
    invalidWorkouts: invalidCount,
    workouts: workoutResults,
    statistics: {
      byType: typeStats,
      byIntensity: intensityStats,
      totalDurationHours: Math.round((totalDuration / 60) * 10) / 10,
      avgDurationMin: Math.round((totalDuration / library.workouts.length) * 10) / 10,
      avgTSS: Math.round((totalTSS / library.workouts.length) * 10) / 10,
      multiStepIntervalCount: multiStepCount,
      cadenceTargetCount: cadenceCount,
      uniqueSignatures: signatures.size,
    },
  }

  if (jsonOutput) {
    console.log(JSON.stringify(libraryResult, null, 2))
    process.exit(libraryResult.valid ? 0 : 1)
  }

  // Print results
  console.log('Validation Results')
  console.log('-'.repeat(50))

  if (libraryResult.valid) {
    console.log('\x1b[32mAll workouts valid!\x1b[0m')
  } else {
    console.log(`\x1b[31m${invalidCount} workout(s) have validation errors\x1b[0m`)

    // Print invalid workouts
    for (const result of workoutResults) {
      if (!result.valid) {
        console.log('')
        console.log(`\x1b[31m[INVALID]\x1b[0m ${result.name} (${result.id})`)
        for (const error of result.errors) {
          console.log(`  \x1b[31m[ERROR]\x1b[0m ${error.path}: ${error.message}`)
        }
      }
    }
  }

  if (verbose) {
    console.log('')
    console.log('All Workouts:')
    for (const result of workoutResults) {
      const status = result.valid ? '\x1b[32m[VALID]\x1b[0m' : '\x1b[31m[INVALID]\x1b[0m'
      console.log(
        `  ${status} ${result.name} (${result.summary.totalDurationMin}min, ${result.summary.totalSegments} segments)`
      )
    }
  }

  // Print statistics
  console.log('')
  console.log('Statistics')
  console.log('-'.repeat(50))
  console.log(`Valid workouts:       ${validCount}/${library.workouts.length}`)
  console.log(`Unique signatures:    ${signatures.size}`)
  console.log(`Total duration:       ${libraryResult.statistics.totalDurationHours} hours`)
  console.log(`Average duration:     ${libraryResult.statistics.avgDurationMin} min`)
  console.log(`Average TSS:          ${libraryResult.statistics.avgTSS}`)
  console.log(`Multi-step intervals: ${multiStepCount} workouts`)
  console.log(`Cadence targets:      ${cadenceCount} workouts`)
  console.log('')
  console.log('By Type:')
  for (const [type, count] of Object.entries(typeStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`)
  }
  console.log('')
  console.log('By Intensity:')
  for (const [intensity, count] of Object.entries(intensityStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${intensity}: ${count}`)
  }

  process.exit(libraryResult.valid ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

#!/usr/bin/env npx tsx
/**
 * Workout Structure Validator CLI
 *
 * Validates workout JSON files against the WorkoutStructure schema (Issue #96)
 *
 * Usage:
 *   npx tsx scripts/validate-workout.ts <file.json>
 *   npx tsx scripts/validate-workout.ts --stdin
 *   echo '{"structure": {...}}' | npx tsx scripts/validate-workout.ts --stdin
 *
 * Examples:
 *   npx tsx scripts/validate-workout.ts workout.json
 *   npx tsx scripts/validate-workout.ts --stdin < workout.json
 */

import * as fs from 'fs'
import * as readline from 'readline'

// ============================================================================
// Type Definitions (duplicated to avoid build dependencies)
// ============================================================================

interface StepLength {
  unit: 'second' | 'minute' | 'hour' | 'meter' | 'kilometer' | 'mile'
  value: number
}

interface StepTarget {
  type: 'power' | 'heartrate' | 'cadence'
  minValue: number
  maxValue: number
  unit?: 'percentOfFtp' | 'watts' | 'bpm' | 'rpm'
}

interface WorkoutStep {
  name: string
  intensityClass: 'warmUp' | 'active' | 'rest' | 'coolDown'
  length: StepLength
  openDuration?: boolean
  targets: StepTarget[]
}

interface SegmentLength {
  unit: 'repetition'
  value: number
}

interface StructuredWorkoutSegment {
  type: 'step' | 'repetition'
  length: SegmentLength
  steps: WorkoutStep[]
}

interface WorkoutStructure {
  primaryIntensityMetric: 'percentOfFtp' | 'watts' | 'heartrate'
  primaryLengthMetric: 'duration' | 'distance'
  structure: StructuredWorkoutSegment[]
  polyline?: [number, number][]
}

// ============================================================================
// Validation Result Types
// ============================================================================

interface ValidationError {
  path: string
  message: string
  severity: 'error' | 'warning'
}

interface ValidationResult {
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

function validateStepLength(
  length: unknown,
  path: string
): { valid: boolean; errors: ValidationError[]; minutes: number } {
  const errors: ValidationError[] = []
  let minutes = 0

  if (!length || typeof length !== 'object') {
    errors.push({ path, message: 'StepLength must be an object', severity: 'error' })
    return { valid: false, errors, minutes }
  }

  const l = length as Record<string, unknown>

  if (!l.unit || !VALID_LENGTH_UNITS.includes(l.unit as string)) {
    errors.push({
      path: `${path}.unit`,
      message: `Invalid unit. Must be one of: ${VALID_LENGTH_UNITS.join(', ')}`,
      severity: 'error',
    })
  }

  if (typeof l.value !== 'number') {
    errors.push({ path: `${path}.value`, message: 'value must be a number', severity: 'error' })
  } else if (l.value <= 0) {
    errors.push({ path: `${path}.value`, message: 'value must be positive', severity: 'error' })
  } else {
    // Calculate minutes
    switch (l.unit) {
      case 'second':
        minutes = l.value / 60
        break
      case 'minute':
        minutes = l.value
        break
      case 'hour':
        minutes = l.value * 60
        break
      default:
        minutes = l.value / 60 // Assume distance in seconds for calculation
    }
  }

  return { valid: errors.length === 0, errors, minutes }
}

function validateStepTarget(target: unknown, path: string): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  if (!target || typeof target !== 'object') {
    errors.push({ path, message: 'StepTarget must be an object', severity: 'error' })
    return { valid: false, errors }
  }

  const t = target as Record<string, unknown>

  if (!t.type || !VALID_TARGET_TYPES.includes(t.type as string)) {
    errors.push({
      path: `${path}.type`,
      message: `Invalid type. Must be one of: ${VALID_TARGET_TYPES.join(', ')}`,
      severity: 'error',
    })
  }

  if (typeof t.minValue !== 'number') {
    errors.push({ path: `${path}.minValue`, message: 'minValue must be a number', severity: 'error' })
  } else if (t.minValue < 0) {
    errors.push({ path: `${path}.minValue`, message: 'minValue must be non-negative', severity: 'error' })
  }

  if (typeof t.maxValue !== 'number') {
    errors.push({ path: `${path}.maxValue`, message: 'maxValue must be a number', severity: 'error' })
  } else if (t.maxValue < 0) {
    errors.push({ path: `${path}.maxValue`, message: 'maxValue must be non-negative', severity: 'error' })
  }

  if (typeof t.minValue === 'number' && typeof t.maxValue === 'number' && t.minValue > t.maxValue) {
    errors.push({
      path: `${path}`,
      message: `minValue (${t.minValue}) cannot be greater than maxValue (${t.maxValue})`,
      severity: 'error',
    })
  }

  if (t.unit !== undefined && !VALID_TARGET_UNITS.includes(t.unit as string)) {
    errors.push({
      path: `${path}.unit`,
      message: `Invalid unit. Must be one of: ${VALID_TARGET_UNITS.join(', ')}`,
      severity: 'error',
    })
  }

  return { valid: errors.length === 0, errors }
}

function validateWorkoutStep(
  step: unknown,
  path: string
): { valid: boolean; errors: ValidationError[]; minutes: number; hasCadence: boolean; hasHR: boolean } {
  const errors: ValidationError[] = []
  let minutes = 0
  let hasCadence = false
  let hasHR = false

  if (!step || typeof step !== 'object') {
    errors.push({ path, message: 'WorkoutStep must be an object', severity: 'error' })
    return { valid: false, errors, minutes, hasCadence, hasHR }
  }

  const s = step as Record<string, unknown>

  if (typeof s.name !== 'string' || s.name.trim() === '') {
    errors.push({ path: `${path}.name`, message: 'name must be a non-empty string', severity: 'error' })
  }

  if (!s.intensityClass || !VALID_INTENSITY_CLASSES.includes(s.intensityClass as string)) {
    errors.push({
      path: `${path}.intensityClass`,
      message: `Invalid intensityClass. Must be one of: ${VALID_INTENSITY_CLASSES.join(', ')}`,
      severity: 'error',
    })
  }

  // Validate length
  const lengthResult = validateStepLength(s.length, `${path}.length`)
  errors.push(...lengthResult.errors)
  minutes = lengthResult.minutes

  // Validate targets
  if (!Array.isArray(s.targets)) {
    errors.push({ path: `${path}.targets`, message: 'targets must be an array', severity: 'error' })
  } else if (s.targets.length === 0) {
    errors.push({
      path: `${path}.targets`,
      message: 'targets array should not be empty (recommend at least a power target)',
      severity: 'warning',
    })
  } else {
    s.targets.forEach((target, i) => {
      const targetResult = validateStepTarget(target, `${path}.targets[${i}]`)
      errors.push(...targetResult.errors)

      const t = target as Record<string, unknown>
      if (t.type === 'cadence') hasCadence = true
      if (t.type === 'heartrate') hasHR = true
    })
  }

  return { valid: errors.filter((e) => e.severity === 'error').length === 0, errors, minutes, hasCadence, hasHR }
}

function validateStructuredWorkoutSegment(
  segment: unknown,
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

  if (!segment || typeof segment !== 'object') {
    errors.push({ path, message: 'StructuredWorkoutSegment must be an object', severity: 'error' })
    return { valid: false, errors, minutes, stepCount, isMultiStep, hasCadence, hasHR }
  }

  const s = segment as Record<string, unknown>

  if (!s.type || !VALID_SEGMENT_TYPES.includes(s.type as string)) {
    errors.push({
      path: `${path}.type`,
      message: `Invalid type. Must be one of: ${VALID_SEGMENT_TYPES.join(', ')}`,
      severity: 'error',
    })
  }

  // Validate length
  if (!s.length || typeof s.length !== 'object') {
    errors.push({ path: `${path}.length`, message: 'length must be an object', severity: 'error' })
  } else {
    const l = s.length as Record<string, unknown>
    if (l.unit !== 'repetition') {
      errors.push({
        path: `${path}.length.unit`,
        message: 'Segment length unit must be "repetition"',
        severity: 'error',
      })
    }
    if (typeof l.value !== 'number' || l.value <= 0) {
      errors.push({
        path: `${path}.length.value`,
        message: 'length.value must be a positive number',
        severity: 'error',
      })
    }
  }

  // Validate steps
  if (!Array.isArray(s.steps)) {
    errors.push({ path: `${path}.steps`, message: 'steps must be an array', severity: 'error' })
  } else if (s.steps.length === 0) {
    errors.push({ path: `${path}.steps`, message: 'steps array cannot be empty', severity: 'error' })
  } else {
    const repetitions = ((s.length as Record<string, unknown>)?.value as number) || 1

    s.steps.forEach((step, i) => {
      const stepResult = validateWorkoutStep(step, `${path}.steps[${i}]`)
      errors.push(...stepResult.errors)
      minutes += stepResult.minutes * repetitions
      stepCount += repetitions
      if (stepResult.hasCadence) hasCadence = true
      if (stepResult.hasHR) hasHR = true
    })

    // Check for multi-step intervals
    if (s.steps.length > 2 && s.type === 'repetition' && repetitions > 1) {
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

function validateWorkoutStructure(input: unknown): ValidationResult {
  const errors: ValidationError[] = []
  let totalSegments = 0
  let totalSteps = 0
  let totalDurationMin = 0
  let hasMultiStepIntervals = false
  let hasCadenceTargets = false
  let hasHeartRateTargets = false

  if (!input || typeof input !== 'object') {
    errors.push({ path: '', message: 'Input must be an object', severity: 'error' })
    return {
      valid: false,
      errors: errors.filter((e) => e.severity === 'error'),
      warnings: errors.filter((e) => e.severity === 'warning'),
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

  // Check if input is a WorkoutStructure directly or a Workout object containing a structure
  const obj = input as Record<string, unknown>

  // If input has primaryIntensityMetric at the top level, it's a WorkoutStructure directly
  // If it has a structure property that is an object with primaryIntensityMetric, extract it
  let structure: Record<string, unknown>
  if (obj.primaryIntensityMetric !== undefined) {
    // Input is a WorkoutStructure directly
    structure = obj
  } else if (obj.structure && typeof obj.structure === 'object' && !Array.isArray(obj.structure)) {
    // Input is a Workout object with a structure property
    structure = obj.structure as Record<string, unknown>
  } else {
    // Assume it's a WorkoutStructure
    structure = obj
  }

  // Validate primaryIntensityMetric
  if (!structure.primaryIntensityMetric) {
    errors.push({
      path: 'primaryIntensityMetric',
      message: 'primaryIntensityMetric is required',
      severity: 'error',
    })
  } else if (!VALID_INTENSITY_METRICS.includes(structure.primaryIntensityMetric as string)) {
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
  } else if (!VALID_LENGTH_METRICS.includes(structure.primaryLengthMetric as string)) {
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
    errors.push({ path: 'structure', message: 'structure array cannot be empty', severity: 'error' })
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

  // Validate polyline if present
  if (structure.polyline !== undefined) {
    if (!Array.isArray(structure.polyline)) {
      errors.push({ path: 'polyline', message: 'polyline must be an array', severity: 'error' })
    } else {
      structure.polyline.forEach((point, i) => {
        if (!Array.isArray(point) || point.length !== 2) {
          errors.push({
            path: `polyline[${i}]`,
            message: 'Each polyline point must be [time, intensity]',
            severity: 'error',
          })
        }
      })
    }
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors: errors.filter((e) => e.severity === 'error'),
    warnings: errors.filter((e) => e.severity === 'warning'),
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

// ============================================================================
// CLI
// ============================================================================

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function printResult(result: ValidationResult): void {
  console.log('')

  if (result.valid) {
    console.log('\x1b[32m\u2714 Valid workout structure\x1b[0m')
  } else {
    console.log('\x1b[31m\u2718 Invalid workout structure\x1b[0m')
  }

  console.log('')
  console.log('Summary:')
  console.log(`  Segments: ${result.summary.totalSegments}`)
  console.log(`  Total Steps: ${result.summary.totalSteps}`)
  console.log(`  Duration: ${formatDuration(result.summary.totalDurationMin)}`)
  console.log(`  Multi-step intervals: ${result.summary.hasMultiStepIntervals ? 'Yes' : 'No'}`)
  console.log(`  Cadence targets: ${result.summary.hasCadenceTargets ? 'Yes' : 'No'}`)
  console.log(`  Heart rate targets: ${result.summary.hasHeartRateTargets ? 'Yes' : 'No'}`)

  if (result.errors.length > 0) {
    console.log('')
    console.log('\x1b[31mErrors:\x1b[0m')
    result.errors.forEach((e) => {
      console.log(`  \x1b[31m\u2718\x1b[0m ${e.path}: ${e.message}`)
    })
  }

  if (result.warnings.length > 0) {
    console.log('')
    console.log('\x1b[33mWarnings:\x1b[0m')
    result.warnings.forEach((w) => {
      console.log(`  \x1b[33m\u26A0\x1b[0m ${w.path}: ${w.message}`)
    })
  }

  console.log('')
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    rl.on('line', (line) => {
      data += line
    })

    rl.on('close', () => {
      resolve(data)
    })
  })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Workout Structure Validator

Usage:
  npx tsx scripts/validate-workout.ts <file.json>
  npx tsx scripts/validate-workout.ts --stdin
  echo '{"structure": {...}}' | npx tsx scripts/validate-workout.ts --stdin

Options:
  --stdin    Read JSON from standard input
  --help     Show this help message

Examples:
  npx tsx scripts/validate-workout.ts workout.json
  npx tsx scripts/validate-workout.ts --stdin < workout.json
  cat workout.json | npx tsx scripts/validate-workout.ts --stdin
`)
    process.exit(0)
  }

  let jsonContent: string

  if (args.includes('--stdin')) {
    jsonContent = await readStdin()
  } else {
    const filePath = args[0]
    if (!filePath) {
      console.error('Error: Please provide a file path or use --stdin')
      process.exit(1)
    }

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`)
      process.exit(1)
    }

    jsonContent = fs.readFileSync(filePath, 'utf-8')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonContent)
  } catch {
    console.error('Error: Invalid JSON')
    process.exit(1)
  }

  const result = validateWorkoutStructure(parsed)
  printResult(result)

  process.exit(result.valid ? 0 : 1)
}

main().catch(console.error)

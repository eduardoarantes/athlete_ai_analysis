#!/usr/bin/env npx tsx
/**
 * Workout Library Conversion Script
 *
 * Converts source workout JSON files from fit-crawler to the new WorkoutStructure format.
 * Part of Issue #97: Recreate Workout Library
 *
 * Usage:
 *   npx tsx scripts/convert-workout-library.ts [source-dir] [output-file]
 *   npx tsx scripts/convert-workout-library.ts                                    # Uses defaults
 *   npx tsx scripts/convert-workout-library.ts /path/to/source data/output.json   # Custom paths
 *
 * Source files are expected to be JSON files with the following structure:
 * {
 *   "title": "Workout Name",
 *   "description": "...",
 *   "userTags": "...",
 *   "workout_structure": [...],
 *   "coachComments": null
 * }
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { nanoid } from 'nanoid'
import type {
  WorkoutStructure,
  StructuredWorkoutSegment,
  WorkoutStep,
  StepLength,
  StepTarget,
} from '../lib/types/training-plan'
import type {
  WorkoutLibraryItem,
  WorkoutType,
  WorkoutIntensity,
} from '../lib/types/workout-library'
import { convertStepLengthToMinutes, convertStepLengthToSeconds } from '../lib/types/training-plan'

// ============================================================================
// Source Format Types
// ============================================================================

export interface SourceTarget {
  minValue: number
  maxValue?: number // Some source files have missing maxValue
}

export interface SourceStep {
  name: string
  intensityClass: 'warmUp' | 'active' | 'rest' | 'coolDown'
  length: {
    unit: string
    value: number
  }
  openDuration?: boolean
  targets: SourceTarget[]
  type?: string // Some source files have type on step level
}

export interface SourceSegment {
  type: 'step' | 'repetition' | 'rampUp'
  length: {
    unit: string
    value: number
  }
  steps: SourceStep[]
  begin?: number
  end?: number
}

export interface SourceWorkout {
  title: string
  description: string | null
  userTags: string | null
  workout_structure: SourceSegment[]
  coachComments: string | null
}

// ============================================================================
// Target Format (Extended WorkoutLibraryItem)
// ============================================================================

export interface ConvertedWorkout extends WorkoutLibraryItem {
  signature: string
}

export interface DeduplicationResult {
  workouts: ConvertedWorkout[]
  duplicates: Array<{
    removed: ConvertedWorkout
    keptId: string
    reason: string
  }>
}

// ============================================================================
// Target Type Inference
// ============================================================================

/**
 * Infer target type based on position and value range.
 *
 * Rules:
 * - First target (index 0) is always power
 * - Second target (index 1) is cadence if values are in typical cadence range (60-120)
 * - Otherwise, treat as power
 */
export function inferTargetType(target: SourceTarget, index: number): 'power' | 'cadence' {
  if (index === 0) {
    return 'power'
  }

  // Second target - check if it's in cadence range
  const { minValue, maxValue } = target
  // Handle missing maxValue by using minValue
  const effectiveMax = maxValue ?? minValue
  if (minValue >= 60 && effectiveMax <= 120) {
    return 'cadence'
  }

  // High values are clearly power (> 120%)
  return 'power'
}

/**
 * Convert a source target to the new StepTarget format.
 * Handles missing maxValue by using minValue as the value for both.
 */
export function convertSourceTarget(target: SourceTarget, index: number): StepTarget {
  const type = inferTargetType(target, index)
  const unit = type === 'power' ? 'percentOfFtp' : 'rpm'

  // Handle missing maxValue - use minValue as the value
  const maxValue = target.maxValue ?? target.minValue

  return {
    type,
    minValue: target.minValue,
    maxValue,
    unit,
  }
}

// ============================================================================
// Step Conversion
// ============================================================================

/**
 * Get default step name based on intensity class.
 */
function getDefaultStepName(intensityClass: SourceStep['intensityClass']): string {
  switch (intensityClass) {
    case 'warmUp':
      return 'Warm Up'
    case 'coolDown':
      return 'Cool Down'
    case 'rest':
      return 'Recovery'
    case 'active':
      return 'Active'
    default:
      return 'Step'
  }
}

/**
 * Convert a source step to the new WorkoutStep format.
 */
export function convertSourceStep(step: SourceStep): WorkoutStep {
  const name = step.name && step.name.trim() ? step.name : getDefaultStepName(step.intensityClass)

  const result: WorkoutStep = {
    name,
    intensityClass: step.intensityClass,
    length: {
      unit: step.length.unit as StepLength['unit'],
      value: step.length.value,
    },
    targets: step.targets.map((t, i) => convertSourceTarget(t, i)),
  }

  if (step.openDuration !== undefined && step.openDuration !== false) {
    result.openDuration = step.openDuration
  }

  return result
}

// ============================================================================
// Segment Conversion
// ============================================================================

/**
 * Convert a source segment to the new StructuredWorkoutSegment format.
 */
export function convertSourceSegment(segment: SourceSegment): StructuredWorkoutSegment {
  // Convert rampUp to step (single execution with same steps)
  const segmentType = segment.type === 'rampUp' ? 'step' : segment.type

  return {
    type: segmentType,
    length: {
      unit: 'repetition',
      value: segment.length.value,
    },
    steps: segment.steps.map((s) => convertSourceStep(s)),
  }
}

// ============================================================================
// TSS Calculation
// ============================================================================

/**
 * Calculate TSS (Training Stress Score) from a WorkoutStructure.
 *
 * TSS = (sec x NP x IF) / (FTP x 3600) x 100
 * Simplified for FTP-based percentages: TSS = (sec / 3600) x IF^2 x 100
 * Where IF = Intensity Factor = NP / FTP (as percentage / 100)
 */
export function calculateTSS(structure: WorkoutStructure): number {
  let totalTSS = 0

  for (const segment of structure.structure) {
    const reps = segment.length.value

    for (const step of segment.steps) {
      const durationSeconds = convertStepLengthToSeconds(step.length) * reps
      const powerTarget = step.targets.find((t) => t.type === 'power')

      if (powerTarget) {
        // Average power percentage
        const avgPower = (powerTarget.minValue + powerTarget.maxValue) / 2
        // Intensity Factor (as decimal)
        const IF = avgPower / 100
        // TSS contribution
        const stepTSS = (durationSeconds / 3600) * IF * IF * 100
        totalTSS += stepTSS
      }
    }
  }

  return Math.round(totalTSS * 10) / 10
}

// ============================================================================
// Workout Type and Intensity Inference
// ============================================================================

/**
 * Calculate weighted average power from a WorkoutStructure.
 */
function calculateWeightedAveragePower(structure: WorkoutStructure): number {
  let totalPowerSeconds = 0
  let totalSeconds = 0

  for (const segment of structure.structure) {
    const reps = segment.length.value

    for (const step of segment.steps) {
      const seconds = convertStepLengthToSeconds(step.length) * reps
      const powerTarget = step.targets.find((t) => t.type === 'power')

      if (powerTarget) {
        const avgPower = (powerTarget.minValue + powerTarget.maxValue) / 2
        totalPowerSeconds += avgPower * seconds
        totalSeconds += seconds
      }
    }
  }

  return totalSeconds > 0 ? totalPowerSeconds / totalSeconds : 0
}

/**
 * Get maximum power target from structure.
 */
function getMaxPowerTarget(structure: WorkoutStructure): number {
  let maxPower = 0

  for (const segment of structure.structure) {
    for (const step of segment.steps) {
      const powerTarget = step.targets.find((t) => t.type === 'power')
      if (powerTarget) {
        maxPower = Math.max(maxPower, powerTarget.maxValue)
      }
    }
  }

  return maxPower
}

/**
 * Check if structure has high-intensity intervals (repetition segments with high power).
 */
function hasHighIntensityIntervals(structure: WorkoutStructure): boolean {
  for (const segment of structure.structure) {
    if (segment.type === 'repetition' && segment.length.value > 1) {
      for (const step of segment.steps) {
        const powerTarget = step.targets.find((t) => t.type === 'power')
        if (powerTarget && powerTarget.maxValue >= 105) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Infer workout type from structure and optional description.
 */
export function inferWorkoutType(structure: WorkoutStructure, description: string | null): WorkoutType {
  const desc = (description || '').toLowerCase()

  // Check description keywords first
  if (desc.includes('sweet spot')) return 'sweet_spot'
  if (desc.includes('vo2') || desc.includes('vo2max')) return 'vo2max'
  if (desc.includes('threshold') || desc.includes('ftp')) return 'threshold'
  if (desc.includes('tempo')) return 'tempo'
  if (desc.includes('recovery') || desc.includes('active recovery')) return 'recovery'
  if (desc.includes('endurance') || desc.includes('zone 2')) return 'endurance'

  // Check for VO2max intervals
  if (hasHighIntensityIntervals(structure)) {
    const maxPower = getMaxPowerTarget(structure)
    if (maxPower >= 110) return 'vo2max'
  }

  // Use weighted average power to determine type
  const avgPower = calculateWeightedAveragePower(structure)

  if (avgPower < 60) return 'recovery'
  if (avgPower < 76) return 'endurance'
  if (avgPower < 88) return 'tempo'
  if (avgPower < 95) return 'threshold'
  if (avgPower < 105) return 'sweet_spot'

  // Default to mixed for complex workouts
  return 'mixed'
}

/**
 * Infer workout intensity from structure.
 */
export function inferWorkoutIntensity(structure: WorkoutStructure): WorkoutIntensity {
  const avgPower = calculateWeightedAveragePower(structure)
  const maxPower = getMaxPowerTarget(structure)

  // Consider both average and peak power
  if (maxPower >= 110 || avgPower >= 95) return 'very_hard'
  if (maxPower >= 95 || avgPower >= 85) return 'hard'
  if (avgPower >= 65) return 'moderate'

  return 'easy'
}

// ============================================================================
// Signature Generation
// ============================================================================

/**
 * Generate a deterministic signature hash for a workout structure.
 *
 * The signature is based on:
 * - Segment types and repetition counts
 * - Step intensities, durations, and power targets
 *
 * NOT included (to allow deduplication of same-structure workouts):
 * - Workout title/name
 * - Description
 * - Step names
 */
export function generateSignature(structure: WorkoutStructure): string {
  const canonical: unknown[] = []

  for (const segment of structure.structure) {
    const segmentData: {
      type: string
      reps: number
      steps: { intensity: string; duration: number; targets: [string, number, number][] }[]
    } = {
      type: segment.type,
      reps: segment.length.value,
      steps: segment.steps.map((step) => ({
        intensity: step.intensityClass,
        duration: convertStepLengthToSeconds(step.length),
        targets: step.targets
          .map((t) => [t.type, t.minValue, t.maxValue] as [string, number, number])
          .sort((a, b) => a[0].localeCompare(b[0])),
      })),
    }
    canonical.push(segmentData)
  }

  const content = JSON.stringify(canonical, null, 0)
  const hash = crypto.createHash('sha256').update(content).digest('hex')

  return hash.substring(0, 16)
}

// ============================================================================
// Full Workout Conversion
// ============================================================================

/**
 * Convert a source workout to the new format.
 */
export function convertSourceWorkout(source: SourceWorkout, sourceFile: string): ConvertedWorkout {
  // Convert structure
  const structure: WorkoutStructure = {
    primaryIntensityMetric: 'percentOfFtp',
    primaryLengthMetric: 'duration',
    structure: source.workout_structure.map((s) => convertSourceSegment(s)),
  }

  // Generate signature
  const signature = generateSignature(structure)

  // Calculate duration and TSS
  let durationMin = 0
  for (const segment of structure.structure) {
    const reps = segment.length.value
    for (const step of segment.steps) {
      durationMin += convertStepLengthToMinutes(step.length) * reps
    }
  }

  const tss = calculateTSS(structure)
  const type = inferWorkoutType(structure, source.description)
  const intensity = inferWorkoutIntensity(structure)

  // Build workout
  const workout: ConvertedWorkout = {
    id: nanoid(10),
    name: source.title,
    type,
    intensity,
    structure,
    base_duration_min: Math.round(durationMin),
    base_tss: tss,
    source_file: sourceFile,
    source_format: 'json',
    signature,
  }

  // Add optional fields
  if (source.description) {
    workout.detailed_description = source.description
  }

  // Add suitable phases based on type
  workout.suitable_phases = inferSuitablePhases(type)

  return workout
}

/**
 * Infer suitable training phases based on workout type.
 */
function inferSuitablePhases(
  type: WorkoutType
): ('Base' | 'Build' | 'Peak' | 'Taper' | 'Foundation' | 'Recovery')[] {
  switch (type) {
    case 'recovery':
      return ['Recovery', 'Taper', 'Base']
    case 'endurance':
      return ['Base', 'Foundation', 'Build']
    case 'tempo':
      return ['Base', 'Build']
    case 'sweet_spot':
      return ['Build', 'Peak']
    case 'threshold':
      return ['Build', 'Peak']
    case 'vo2max':
      return ['Build', 'Peak']
    default:
      return ['Build', 'Peak']
  }
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Deduplicate workouts by signature, preferring workouts with:
 * 1. Longer description
 * 2. More complete metadata
 * 3. Higher workout ID (more recent)
 */
export function deduplicateWorkouts(workouts: ConvertedWorkout[]): DeduplicationResult {
  const signatureGroups = new Map<string, ConvertedWorkout[]>()

  // Group by signature
  for (const workout of workouts) {
    const group = signatureGroups.get(workout.signature) || []
    group.push(workout)
    signatureGroups.set(workout.signature, group)
  }

  const result: ConvertedWorkout[] = []
  const duplicates: DeduplicationResult['duplicates'] = []

  // Select best from each group
  for (const [, group] of signatureGroups) {
    if (group.length === 1) {
      result.push(group[0]!)
      continue
    }

    // Sort by preference: longer description, more metadata
    group.sort((a, b) => {
      // Prefer longer description
      const descLenA = a.detailed_description?.length || 0
      const descLenB = b.detailed_description?.length || 0
      if (descLenA !== descLenB) return descLenB - descLenA

      // Prefer more suitable phases
      const phasesA = a.suitable_phases?.length || 0
      const phasesB = b.suitable_phases?.length || 0
      if (phasesA !== phasesB) return phasesB - phasesA

      // Prefer higher source file number (more recent)
      const numA = extractWorkoutNumber(a.source_file || '')
      const numB = extractWorkoutNumber(b.source_file || '')
      return numB - numA
    })

    const kept = group[0]!
    result.push(kept)

    // Record duplicates
    for (let i = 1; i < group.length; i++) {
      duplicates.push({
        removed: group[i]!,
        keptId: kept.id,
        reason: 'Duplicate signature',
      })
    }
  }

  return { workouts: result, duplicates }
}

/**
 * Extract workout number from filename for sorting.
 */
function extractWorkoutNumber(filename: string): number {
  const match = filename.match(/workout_(\d+)\.json/)
  return match ? parseInt(match[1]!, 10) : 0
}

// ============================================================================
// CLI Entry Point
// ============================================================================

interface ConversionStats {
  sourceFiles: number
  convertedWorkouts: number
  duplicatesRemoved: number
  conversionErrors: string[]
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Workout Library Conversion Script

Usage:
  npx tsx scripts/convert-workout-library.ts [source-dir] [output-file]
  npx tsx scripts/convert-workout-library.ts                                    # Uses defaults
  npx tsx scripts/convert-workout-library.ts /path/to/source data/output.json   # Custom paths

Options:
  --help, -h      Show this help message
  --dry-run       Parse and convert but don't write output file
  --verbose       Show detailed conversion log

Defaults:
  source-dir:  /Users/eduardo/Documents/projects/fit-crawler/workout_library
  output-file: ../data/workout_library.json (relative to web/)
`)
    process.exit(0)
  }

  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')

  // Remove flags from args
  const positionalArgs = args.filter((a) => !a.startsWith('--'))

  const sourceDir = positionalArgs[0] || '/Users/eduardo/Documents/projects/fit-crawler/workout_library'
  const outputFile =
    positionalArgs[1] || path.resolve(__dirname, '..', '..', 'data', 'workout_library.json')

  console.log('Workout Library Conversion')
  console.log('='.repeat(50))
  console.log(`Source: ${sourceDir}`)
  console.log(`Output: ${outputFile}`)
  console.log(`Dry run: ${dryRun}`)
  console.log('')

  // Read source files
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory not found: ${sourceDir}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  console.log(`Found ${files.length} source files`)
  console.log('')

  const stats: ConversionStats = {
    sourceFiles: files.length,
    convertedWorkouts: 0,
    duplicatesRemoved: 0,
    conversionErrors: [],
  }

  // Convert all workouts
  const allWorkouts: ConvertedWorkout[] = []

  for (const file of files) {
    const filePath = path.join(sourceDir, file)

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const source: SourceWorkout = JSON.parse(content)

      const workout = convertSourceWorkout(source, file)
      allWorkouts.push(workout)

      if (verbose) {
        console.log(`  Converted: ${file} -> ${workout.name}`)
      }
    } catch (error) {
      const msg = `Failed to convert ${file}: ${error instanceof Error ? error.message : String(error)}`
      stats.conversionErrors.push(msg)
      console.error(`  Error: ${msg}`)
    }
  }

  console.log('')
  console.log(`Converted ${allWorkouts.length} workouts`)

  // Deduplicate
  console.log('')
  console.log('Deduplicating workouts...')

  const { workouts: dedupedWorkouts, duplicates } = deduplicateWorkouts(allWorkouts)
  stats.convertedWorkouts = dedupedWorkouts.length
  stats.duplicatesRemoved = duplicates.length

  console.log(`Removed ${duplicates.length} duplicates`)
  console.log(`Final count: ${dedupedWorkouts.length} unique workouts`)

  if (verbose && duplicates.length > 0) {
    console.log('')
    console.log('Duplicates removed:')
    for (const dup of duplicates) {
      console.log(`  - ${dup.removed.name} (${dup.removed.source_file}) -> kept ${dup.keptId}`)
    }
  }

  // Generate output
  const library = {
    version: '2.0.0',
    description: 'Workout library with WorkoutStructure format (Issue #96/97)',
    generated_date: new Date().toISOString().split('T')[0],
    source_files_count: stats.sourceFiles,
    deduplicated_count: stats.duplicatesRemoved,
    workouts: dedupedWorkouts,
  }

  if (dryRun) {
    console.log('')
    console.log('Dry run - not writing output file')
  } else {
    fs.writeFileSync(outputFile, JSON.stringify(library, null, 2))
    console.log('')
    console.log(`Written to: ${outputFile}`)
  }

  // Summary
  console.log('')
  console.log('Summary')
  console.log('-'.repeat(50))
  console.log(`Source files:      ${stats.sourceFiles}`)
  console.log(`Unique workouts:   ${stats.convertedWorkouts}`)
  console.log(`Duplicates:        ${stats.duplicatesRemoved}`)
  console.log(`Conversion errors: ${stats.conversionErrors.length}`)

  if (stats.conversionErrors.length > 0) {
    console.log('')
    console.log('Errors:')
    for (const error of stats.conversionErrors) {
      console.log(`  - ${error}`)
    }
    process.exit(1)
  }
}

// Only run main if executed directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

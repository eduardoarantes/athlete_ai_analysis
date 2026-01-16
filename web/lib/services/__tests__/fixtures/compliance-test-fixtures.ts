/**
 * Compliance Analysis Test Fixtures
 *
 * Real workout-activity pairs for offline testing.
 * Workout data from workout_library.json, activity streams from Strava.
 *
 * Updated for Issue #96: Supports both legacy WorkoutSegment[] and new WorkoutStructure format
 */

import type { WorkoutSegment, WorkoutStructure } from '@/lib/types/training-plan'
import {
  ACTIVITY_15664598790_POWER_STREAM,
  ACTIVITY_14698802921_POWER_STREAM,
  ACTIVITY_14677009311_POWER_STREAM,
  ACTIVITY_14429811505_POWER_STREAM,
  ACTIVITY_14256926250_POWER_STREAM,
  ACTIVITY_11205974269_POWER_STREAM,
  ACTIVITY_11145023577_POWER_STREAM,
  ACTIVITY_11123154345_POWER_STREAM,
  ACTIVITY_11010699309_POWER_STREAM,
  ACTIVITY_16983317605_POWER_STREAM,
  ACTIVITY_11241924282_POWER_STREAM,
  ACTIVITY_11249429377_POWER_STREAM,
  ACTIVITY_10953881435_POWER_STREAM,
  ACTIVITY_10906026493_POWER_STREAM,
  ACTIVITY_11739391851_POWER_STREAM,
} from './real-activity-streams'

// ============================================================================
// Types
// ============================================================================

export interface WorkoutActivityPair {
  id: string
  workoutId: string
  activityId: string
  workoutName: string
  athleteFtp: number
  segments: WorkoutSegment[]
  /** NEW: WorkoutStructure format (Issue #96) - takes precedence over segments */
  structure?: WorkoutStructure
  powerStream: number[]
  expectedGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
  description?: string
}

// ============================================================================
// Pair 1: dwJlJsPTi8 - 15664598790
// Workout: 30 s x 4m interval repeats
// ============================================================================

export const PAIR_1_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'steady',
    duration_min: 3.0,
    power_low_pct: 55,
    power_high_pct: 65,
    description: 'Progressive warmup 1',
  },
  {
    type: 'steady',
    duration_min: 3.0,
    power_low_pct: 65,
    power_high_pct: 75,
    description: 'Progressive warmup 2',
  },
  {
    type: 'steady',
    duration_min: 3.0,
    power_low_pct: 75,
    power_high_pct: 85,
    description: 'Progressive warmup 3',
  },
  {
    type: 'steady',
    duration_min: 1.0,
    power_low_pct: 85,
    power_high_pct: 95,
    description: 'Progressive warmup 4',
  },
  {
    type: 'warmup',
    duration_min: 5.0,
    power_low_pct: 40,
    power_high_pct: 50,
    description: 'Warm up',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 3,
    work: {
      duration_min: 0.5,
      power_low_pct: 120,
      power_high_pct: 150,
    },
    recovery: {
      duration_min: 4.0,
      power_low_pct: 50,
      power_high_pct: 60,
    },
  },
  {
    type: 'recovery',
    duration_min: 10.0,
    power_low_pct: 50,
    power_high_pct: 60,
    description: 'Recovery',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 4,
    work: {
      duration_min: 0.5,
      power_low_pct: 120,
      power_high_pct: 150,
    },
    recovery: {
      duration_min: 4.0,
      power_low_pct: 50,
      power_high_pct: 60,
    },
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 40,
    power_high_pct: 50,
    description: 'Cool down',
  },
]

// ============================================================================
// Pair 2: 1qNVeYOPMI - 14698802921
// Workout: M.A.P Efforts (Maximal Aerobic Power)
// ============================================================================

export const PAIR_2_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 12.0,
    power_low_pct: 56,
    power_high_pct: 75,
    description: 'Warm up 1',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 5,
    work: {
      duration_min: 0.17, // 10 seconds
      power_low_pct: 105,
      power_high_pct: 112,
    },
    recovery: {
      duration_min: 0.83, // 50 seconds
      power_low_pct: 56,
      power_high_pct: 65,
    },
  },
  {
    type: 'warmup',
    duration_min: 3.0,
    power_low_pct: 56,
    power_high_pct: 75,
    description: 'Warm up 2',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 3,
    work: {
      duration_min: 5.0,
      power_low_pct: 105,
      power_high_pct: 112,
    },
    recovery: {
      duration_min: 4.0,
      power_low_pct: 56,
      power_high_pct: 65,
    },
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 56,
    power_high_pct: 65,
    description: 'Cool Down',
  },
]

// ============================================================================
// Pair 3: kC2kEfzvxG - 14677009311
// Workout: Threshold Efforts
// ============================================================================

export const PAIR_3_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 10.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Warm up',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 5,
    work: {
      duration_min: 0.25, // 15 seconds
      power_low_pct: 91,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 0.75, // 45 seconds
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 6.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 7.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 8.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'cooldown',
    duration_min: 5.0,
    power_low_pct: 65,
    power_high_pct: 75,
    description: 'Cool Down 1',
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Cool Down 2',
  },
]

// ============================================================================
// Pair 4: h6XLqTB7j2 - 14429811505
// Workout: Sub Threshold Efforts
// ============================================================================

export const PAIR_4_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 20.0,
    power_low_pct: 56,
    power_high_pct: 75,
    description: 'Warm up',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 2,
    work: {
      duration_min: 30.0,
      power_low_pct: 84,
      power_high_pct: 90,
    },
    recovery: {
      duration_min: 10.0,
      power_low_pct: 56,
      power_high_pct: 74,
    },
  },
  {
    type: 'steady',
    duration_min: 20.0,
    power_low_pct: 84,
    power_high_pct: 90,
    description: 'Hard',
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Cool Down',
  },
]

// ============================================================================
// Pair 5: rxniUsbsBD - 14256926250
// Workout: Threshold Efforts (variant)
// ============================================================================

export const PAIR_5_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 10.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Warm up',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 5,
    work: {
      duration_min: 0.25, // 15 seconds
      power_low_pct: 91,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 0.75, // 45 seconds
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 7.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 6.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 5.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 1,
    work: {
      duration_min: 4.0,
      power_low_pct: 95,
      power_high_pct: 105,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 56,
      power_high_pct: 66,
    },
  },
  {
    type: 'cooldown',
    duration_min: 5.0,
    power_low_pct: 65,
    power_high_pct: 75,
    description: 'Cool Down 1',
  },
  {
    type: 'cooldown',
    duration_min: 5.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Cool Down 2',
  },
]

// ============================================================================
// Pair 6: 9iVUOCNy7g - 11205974269
// Workout: 5min Strength Efforts (Zone 3) 4x5min (57min)
// ============================================================================

export const PAIR_6_STRUCTURE: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    // Warmup - 15 minutes (900s)
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'active',
          length: { unit: 'second', value: 900 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
        },
      ],
    },
    // Main set: 4x (5min strength @ 85-95% / 3min rest @ 45-55%)
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 4 },
      steps: [
        {
          name: 'Strength Efforts',
          intensityClass: 'active',
          length: { unit: 'second', value: 300 },
          targets: [{ type: 'power', minValue: 85, maxValue: 95, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 180 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    // Cooldown - 10 minutes (600s)
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cool Down',
          intensityClass: 'active',
          length: { unit: 'second', value: 600 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
        },
      ],
    },
  ],
}

// Legacy segments format (for backwards compatibility)
export const PAIR_6_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'steady',
    duration_min: 15.0,
    power_low_pct: 50,
    power_high_pct: 60,
    description: 'Warmup',
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 4,
    work: {
      duration_min: 5.0,
      power_low_pct: 85,
      power_high_pct: 95,
    },
    recovery: {
      duration_min: 3.0,
      power_low_pct: 45,
      power_high_pct: 55,
    },
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 50,
    power_high_pct: 60,
    description: 'Cool Down',
  },
]

// ============================================================================
// Pair 7: SLArVTlccR - 11145023577
// Workout: Base Fitness Training (Zone Two)
// ============================================================================

export const PAIR_7_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'steady',
    duration_min: 5.0,
    power_low_pct: 45,
    power_high_pct: 55,
    description: 'Warm-up',
  },
  {
    type: 'steady',
    duration_min: 90.0,
    power_low_pct: 65,
    power_high_pct: 70,
    description: 'The Complete Session',
  },
  {
    type: 'steady',
    duration_min: 10.0,
    power_low_pct: 45,
    power_high_pct: 55,
    description: 'Cooldown',
  },
]

// ============================================================================
// Pair 8: GoneJ-oasb - 11123154345
// Workout: 4hr Base Fitness
// ============================================================================

export const PAIR_8_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 5.0,
    power_low_pct: 40,
    power_high_pct: 50,
    description: 'Warm up',
  },
  {
    type: 'steady',
    duration_min: 230.0,
    power_low_pct: 60,
    power_high_pct: 65,
    description: 'Active',
  },
  {
    type: 'cooldown',
    duration_min: 5.0,
    power_low_pct: 40,
    power_high_pct: 50,
    description: 'Cool Down',
  },
]

// ============================================================================
// Pair 9: _mGszlLEZM - 11010699309
// Workout: 1hr Base Fitness @ 60-65% (incomplete ride - ~10 min)
// ============================================================================

export const PAIR_9_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 5.0,
    power_low_pct: 40,
    power_high_pct: 50,
    description: 'Warm up',
  },
  {
    type: 'steady',
    duration_min: 60.0,
    power_low_pct: 60,
    power_high_pct: 65,
    description: 'Active',
  },
  {
    type: 'cooldown',
    duration_min: 5.0,
    power_low_pct: 40,
    power_high_pct: 50,
    description: 'Cool Down',
  },
]

// ============================================================================
// Pair 10: bxZjY8oRPV - 16983317605
// Workout: Above and Below Threshold (10x1min Z3/Z5)
// ============================================================================

export const PAIR_10_STRUCTURE: WorkoutStructure = {
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
          length: { unit: 'second', value: 900 },
          targets: [{ type: 'power', minValue: 56, maxValue: 66, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: 'Hard',
          intensityClass: 'active',
          length: { unit: 'second', value: 10 },
          targets: [{ type: 'power', minValue: 91, maxValue: 105, unit: 'percentOfFtp' }],
        },
        {
          name: 'Easy',
          intensityClass: 'rest',
          length: { unit: 'second', value: 50 },
          targets: [{ type: 'power', minValue: 56, maxValue: 66, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 10 },
      steps: [
        {
          name: 'Hard',
          intensityClass: 'active',
          length: { unit: 'second', value: 90 },
          targets: [{ type: 'power', minValue: 84, maxValue: 90, unit: 'percentOfFtp' }],
        },
        {
          name: 'Harder',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 105, maxValue: 110, unit: 'percentOfFtp' }],
        },
        {
          name: 'Easy',
          intensityClass: 'rest',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 56, maxValue: 65, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cool Down',
          intensityClass: 'coolDown',
          length: { unit: 'second', value: 600 },
          targets: [{ type: 'power', minValue: 56, maxValue: 66, unit: 'percentOfFtp' }],
        },
      ],
    },
  ],
}

// Legacy segments format (for backwards compatibility)
export const PAIR_10_WORKOUT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 15.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Warm up',
  },
  {
    type: 'interval',
    duration_min: 0,
    sets: 5,
    work: { duration_min: 10 / 60, power_low_pct: 91, power_high_pct: 105 },
    recovery: { duration_min: 50 / 60, power_low_pct: 56, power_high_pct: 66 },
  },
  {
    type: 'interval',
    duration_min: 0,
    sets: 10,
    work: { duration_min: 90 / 60, power_low_pct: 84, power_high_pct: 90 },
    recovery: { duration_min: 90 / 60, power_low_pct: 85, power_high_pct: 110 },
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 56,
    power_high_pct: 66,
    description: 'Cool Down',
  },
]

// ============================================================================
// PAIR 11 - Tempo Repeats 3x15min (YQGNEgWsTS / 11241924282)
// ============================================================================

export const PAIR_11_STRUCTURE: WorkoutStructure = {
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
          length: { unit: 'second', value: 1200 },
          targets: [{ type: 'power', minValue: 55, maxValue: 65, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 3 },
      steps: [
        {
          name: 'Steady State ',
          intensityClass: 'active',
          length: { unit: 'second', value: 900 },
          targets: [
            { type: 'power', minValue: 85, maxValue: 90, unit: 'percentOfFtp' },
            { type: 'cadence', minValue: 85, maxValue: 95, unit: 'rpm' },
          ],
        },
        {
          name: 'Easy',
          intensityClass: 'rest',
          length: { unit: 'second', value: 300 },
          targets: [{ type: 'power', minValue: 50, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cool Down',
          intensityClass: 'coolDown',
          length: { unit: 'second', value: 1200 },
          targets: [{ type: 'power', minValue: 55, maxValue: 65, unit: 'percentOfFtp' }],
        },
      ],
    },
  ],
}

// ============================================================================
// PAIR 12 - Base Fitness Training 1.8hr (Ia8x8iaLo2 / 11249429377)
// ============================================================================

export const PAIR_12_STRUCTURE: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warm-up',
          intensityClass: 'active',
          length: { unit: 'second', value: 300 },
          targets: [
            { type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' },
            { type: 'cadence', minValue: 90, maxValue: 100, unit: 'rpm' },
          ],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'The Complete Session',
          intensityClass: 'active',
          length: { unit: 'second', value: 5400 },
          targets: [
            { type: 'power', minValue: 65, maxValue: 70, unit: 'percentOfFtp' },
            { type: 'cadence', minValue: 85, maxValue: 100, unit: 'rpm' },
          ],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cooldown',
          intensityClass: 'active',
          length: { unit: 'second', value: 600 },
          targets: [
            { type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' },
            { type: 'cadence', minValue: 90, maxValue: 100, unit: 'rpm' },
          ],
        },
      ],
    },
  ],
}

// ============================================================================
// PAIR 13 - FTP Over Unders 3 sets 8x1 (BB5epMKMwL / 10953881435)
// ============================================================================

export const PAIR_13_STRUCTURE: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'active',
          length: { unit: 'second', value: 300 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Ramp 1',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 76, maxValue: 83, unit: 'percentOfFtp' }],
        },
        {
          name: 'Ramp 1 - Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 56, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Ramp 2',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 91, maxValue: 98, unit: 'percentOfFtp' }],
        },
        {
          name: 'Ramp 2 - Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 56, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Ramp 3',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 106, maxValue: 113, unit: 'percentOfFtp' }],
        },
        {
          name: 'Ramp 3 - Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 56, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recover',
          intensityClass: 'active',
          length: { unit: 'second', value: 180 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 4 },
      steps: [
        {
          name: 'Over Unders',
          intensityClass: 'active',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 102.2, maxValue: 103.6, unit: 'percentOfFtp' }],
        },
        {
          name: 'Over Unders - Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 93.8, maxValue: 93.8, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recover',
          intensityClass: 'active',
          length: { unit: 'second', value: 240 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 4 },
      steps: [
        {
          name: 'Over Unders',
          intensityClass: 'active',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 102.2, maxValue: 103.6, unit: 'percentOfFtp' }],
        },
        {
          name: 'Over Unders - Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 93.8, maxValue: 93.8, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recover',
          intensityClass: 'active',
          length: { unit: 'second', value: 240 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 4 },
      steps: [
        {
          name: 'Over Unders',
          intensityClass: 'active',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 102.2, maxValue: 103.6, unit: 'percentOfFtp' }],
        },
        {
          name: 'Over Unders - Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 93.8, maxValue: 93.8, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cool Down',
          intensityClass: 'active',
          length: { unit: 'second', value: 600 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
  ],
}

// ============================================================================
// PAIR 14 - FTP Progression 2 5x7 (74GPWrdaus / 10906026493)
// ============================================================================

export const PAIR_14_STRUCTURE: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'active',
          length: { unit: 'second', value: 1200 },
          targets: [{ type: 'power', minValue: 50, maxValue: 65, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 2 },
      steps: [
        {
          name: 'Activations',
          intensityClass: 'active',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 95, maxValue: 100, unit: 'percentOfFtp' }],
        },
        {
          name: 'Easy',
          intensityClass: 'rest',
          length: { unit: 'second', value: 180 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: 'Threshold',
          intensityClass: 'active',
          length: { unit: 'second', value: 420 },
          targets: [{ type: 'power', minValue: 95, maxValue: 100, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 180 },
          targets: [{ type: 'power', minValue: 45, maxValue: 45, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cool Down',
          intensityClass: 'active',
          length: { unit: 'second', value: 600 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 56, unit: 'percentOfFtp' }],
        },
      ],
    },
  ],
}

// ============================================================================
// PAIR 15 - 40/20s (5min) 2x1min (dQ1OauEjzF / 11739391851)
// ============================================================================

export const PAIR_15_STRUCTURE: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'active',
          length: { unit: 'second', value: 1200 },
          targets: [{ type: 'power', minValue: 50, maxValue: 65, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 2 },
      steps: [
        {
          name: 'Activations',
          intensityClass: 'active',
          length: { unit: 'second', value: 60 },
          targets: [{ type: 'power', minValue: 105, maxValue: 110, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 120 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: '40s hard ',
          intensityClass: 'active',
          length: { unit: 'second', value: 40 },
          targets: [{ type: 'power', minValue: 115, maxValue: 130, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 20 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 42.5, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recovery',
          intensityClass: 'active',
          length: { unit: 'second', value: 240 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: '40s hard ',
          intensityClass: 'active',
          length: { unit: 'second', value: 40 },
          targets: [{ type: 'power', minValue: 115, maxValue: 130, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 20 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 42.5, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recovery',
          intensityClass: 'active',
          length: { unit: 'second', value: 240 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: '40s hard ',
          intensityClass: 'active',
          length: { unit: 'second', value: 40 },
          targets: [{ type: 'power', minValue: 115, maxValue: 130, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 20 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 42.5, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recovery',
          intensityClass: 'active',
          length: { unit: 'second', value: 240 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: '40s hard ',
          intensityClass: 'active',
          length: { unit: 'second', value: 40 },
          targets: [{ type: 'power', minValue: 115, maxValue: 130, unit: 'percentOfFtp' }],
        },
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'second', value: 20 },
          targets: [{ type: 'power', minValue: 42.5, maxValue: 42.5, unit: 'percentOfFtp' }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cool Down',
          intensityClass: 'active',
          length: { unit: 'second', value: 1200 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
        },
      ],
    },
  ],
}

// ============================================================================
// Activity Power Streams
// TODO: Replace with real Strava stream data
// These are placeholder patterns that simulate realistic power data
// ============================================================================

/**
 * Generate a simulated power stream based on workout segments and FTP
 * This creates realistic power patterns for testing purposes
 */
export function generateSimulatedPowerStream(
  segments: WorkoutSegment[],
  ftp: number,
  variability: number = 0.1
): number[] {
  const stream: number[] = []

  for (const segment of segments) {
    if (segment.sets && segment.work && segment.recovery) {
      // Interval segment
      for (let set = 0; set < segment.sets; set++) {
        // Work portion
        const workDurationSec = Math.round(segment.work.duration_min * 60)
        const workPowerTarget =
          ((segment.work.power_low_pct + segment.work.power_high_pct) / 2 / 100) * ftp
        for (let i = 0; i < workDurationSec; i++) {
          const variation = (Math.random() - 0.5) * 2 * variability * workPowerTarget
          stream.push(Math.round(workPowerTarget + variation))
        }

        // Recovery portion
        const recoveryDurationSec = Math.round(segment.recovery.duration_min * 60)
        const recoveryPowerTarget =
          ((segment.recovery.power_low_pct + segment.recovery.power_high_pct) / 2 / 100) * ftp
        for (let i = 0; i < recoveryDurationSec; i++) {
          const variation = (Math.random() - 0.5) * 2 * variability * recoveryPowerTarget
          stream.push(Math.round(recoveryPowerTarget + variation))
        }
      }
    } else if (segment.duration_min && segment.duration_min > 0) {
      // Simple segment
      const durationSec = Math.round(segment.duration_min * 60)
      const powerLowPct = segment.power_low_pct ?? 50
      const powerHighPct = segment.power_high_pct ?? 60
      const powerTarget = ((powerLowPct + powerHighPct) / 2 / 100) * ftp

      for (let i = 0; i < durationSec; i++) {
        const variation = (Math.random() - 0.5) * 2 * variability * powerTarget
        stream.push(Math.round(powerTarget + variation))
      }
    }
  }

  return stream
}

// ============================================================================
// Test Fixture Collections
// ============================================================================

/**
 * Complete test fixtures for all workout-activity pairs using SIMULATED data
 * Use getTestFixturesWithRealData() for real Strava data
 */
export function getTestFixtures(): WorkoutActivityPair[] {
  const FTP = 250 // Default test FTP - adjust based on actual athlete

  return [
    {
      id: 'pair-1',
      workoutId: 'rvOE6NDHRT',
      activityId: '15664598790',
      workoutName: '30 s x 4m interval repeats',
      athleteFtp: FTP,
      segments: PAIR_1_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_1_WORKOUT_SEGMENTS, FTP),
      description: 'Short sprint intervals with 4-minute recoveries',
    },
    {
      id: 'pair-2',
      workoutId: 'cfasX3Hvdw',
      activityId: '14698802921',
      workoutName: 'M.A.P Efforts',
      athleteFtp: FTP,
      segments: PAIR_2_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_2_WORKOUT_SEGMENTS, FTP),
      description: 'Maximal Aerobic Power intervals with 5-min efforts',
    },
    {
      id: 'pair-3',
      workoutId: 'BAkWkaPHvo',
      activityId: '14677009311',
      workoutName: 'Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_3_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_3_WORKOUT_SEGMENTS, FTP),
      description: 'Progressive threshold intervals (6/7/8 min)',
    },
    {
      id: 'pair-4',
      workoutId: 'nO2p5pSQ1c',
      activityId: '14429811505',
      workoutName: 'Sub Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_4_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_4_WORKOUT_SEGMENTS, FTP),
      description: 'Long sub-threshold intervals with Z2 recoveries (~130 min)',
    },
    {
      id: 'pair-5',
      workoutId: 'wvgCzoPv3l',
      activityId: '14256926250',
      workoutName: 'Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_5_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_5_WORKOUT_SEGMENTS, FTP),
      description: 'Descending threshold intervals 7/6/5/4 min (~59 min)',
    },
    {
      id: 'pair-6',
      workoutId: '9iVUOCNy7g',
      activityId: '11205974269',
      workoutName: '5min Strength Efforts (Zone 3) 4x5min (57min)',
      athleteFtp: FTP,
      segments: PAIR_6_WORKOUT_SEGMENTS,
      structure: PAIR_6_STRUCTURE,
      powerStream: generateSimulatedPowerStream(PAIR_6_WORKOUT_SEGMENTS, FTP),
      description: '4x5min strength efforts with 3min recoveries (~57 min)',
    },
    {
      id: 'pair-7',
      workoutId: 'jVDtGT0f1h',
      activityId: '11145023577',
      workoutName: 'Base Fitness Training (Zone Two)',
      athleteFtp: FTP,
      segments: PAIR_7_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_7_WORKOUT_SEGMENTS, FTP),
      description: 'Z2 endurance ride with warmup/cooldown (~99 min)',
    },
    {
      id: 'pair-8',
      workoutId: 'kL9eUebxqf',
      activityId: '11123154345',
      workoutName: '4hr Base Fitness',
      athleteFtp: FTP,
      segments: PAIR_8_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_8_WORKOUT_SEGMENTS, FTP),
      description: '4hr Z2 endurance ride (~236 min)',
    },
    {
      id: 'pair-9',
      workoutId: 'f4SvAqNCuL',
      activityId: '11010699309',
      workoutName: '1hr Base Fitness @ 60-65%',
      athleteFtp: FTP,
      segments: PAIR_9_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_9_WORKOUT_SEGMENTS, FTP),
      description: '1hr base fitness (incomplete ride ~10 min)',
    },
  ]
}

/**
 * Test fixtures with REAL Strava activity streams
 * These are actual power data from completed rides
 */
export function getTestFixturesWithRealData(): WorkoutActivityPair[] {
  // Athlete FTP at time of these activities
  const FTP = 250

  return [
    {
      id: 'pair-1-real',
      workoutId: 'rvOE6NDHRT',
      activityId: '15664598790',
      workoutName: '30 s x 4m interval repeats',
      athleteFtp: FTP,
      segments: PAIR_1_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_15664598790_POWER_STREAM,
      description: 'Real data: Short sprint intervals with 4-minute recoveries (~62 min)',
    },
    {
      id: 'pair-2-real',
      workoutId: 'cfasX3Hvdw',
      activityId: '14698802921',
      workoutName: 'M.A.P Efforts',
      athleteFtp: FTP,
      segments: PAIR_2_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_14698802921_POWER_STREAM,
      description: 'Real data: Maximal Aerobic Power intervals (~60 min)',
    },
    {
      id: 'pair-3-real',
      workoutId: 'BAkWkaPHvo',
      activityId: '14677009311',
      workoutName: 'Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_3_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_14677009311_POWER_STREAM,
      description: 'Real data: Progressive threshold intervals (~32 min)',
    },
    {
      id: 'pair-4-real',
      workoutId: 'nO2p5pSQ1c',
      activityId: '14429811505',
      workoutName: 'Sub Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_4_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_14429811505_POWER_STREAM,
      description: 'Real data: Long sub-threshold intervals (~119 min)',
    },
    {
      id: 'pair-5-real',
      workoutId: 'wvgCzoPv3l',
      activityId: '14256926250',
      workoutName: 'Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_5_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_14256926250_POWER_STREAM,
      description: 'Real data: Descending threshold intervals (~66 min)',
    },
    {
      id: 'pair-6-real',
      workoutId: '9iVUOCNy7g',
      activityId: '11205974269',
      workoutName: '5min Strength Efforts (Zone 3) 4x5min (57min)',
      athleteFtp: FTP,
      segments: PAIR_6_WORKOUT_SEGMENTS,
      structure: PAIR_6_STRUCTURE,
      powerStream: ACTIVITY_11205974269_POWER_STREAM,
      description: 'Real data: 4x5min strength efforts at 85-95% FTP (~57 min)',
    },
    {
      id: 'pair-7-real',
      workoutId: 'jVDtGT0f1h',
      activityId: '11145023577',
      workoutName: 'Base Fitness Training (Zone Two)',
      athleteFtp: FTP,
      segments: PAIR_7_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_11145023577_POWER_STREAM,
      description: 'Real data: Z2 endurance ride (~99 min)',
    },
    {
      id: 'pair-8-real',
      workoutId: 'kL9eUebxqf',
      activityId: '11123154345',
      workoutName: '4hr Base Fitness (Zone Two)',
      athleteFtp: FTP,
      segments: PAIR_8_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_11123154345_POWER_STREAM,
      description: 'Real data: Long Z2 endurance ride (~240 min)',
    },
    {
      id: 'pair-9-real',
      workoutId: 'f4SvAqNCuL',
      activityId: '11010699309',
      workoutName: '1hr Base Fitness @ 60-65%',
      athleteFtp: FTP,
      segments: PAIR_9_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_11010699309_POWER_STREAM,
      description: 'Real data: Incomplete base fitness ride (~10 min)',
    },
    {
      id: 'pair-10-real',
      workoutId: 'bxZjY8oRPV',
      activityId: '16983317605',
      workoutName: 'Above and Below Threshold (10x1min Z3/Z5)',
      athleteFtp: FTP,
      segments: PAIR_10_WORKOUT_SEGMENTS,
      structure: PAIR_10_STRUCTURE,
      powerStream: ACTIVITY_16983317605_POWER_STREAM,
      description:
        'Real data: Mixed-duration workout with 10s sprints and long Z3/Z5 intervals (~61 min)',
    },
    {
      id: 'pair-11-real',
      workoutId: 'YQGNEgWsTS',
      activityId: '11241924282',
      workoutName: 'Tempo Repeats 3x15min (1.7hr)',
      athleteFtp: FTP,
      segments: [],
      structure: PAIR_11_STRUCTURE,
      powerStream: ACTIVITY_11241924282_POWER_STREAM,
      description: 'Real data: 3x15min tempo intervals at 85-90% FTP with 5min recovery (~85 min)',
    },
    {
      id: 'pair-12-real',
      workoutId: 'Ia8x8iaLo2',
      activityId: '11249429377',
      workoutName: 'Base Fitness Training (Zone Two) 1.8hr',
      athleteFtp: FTP,
      segments: [],
      structure: PAIR_12_STRUCTURE,
      powerStream: ACTIVITY_11249429377_POWER_STREAM,
      description: 'Real data: Long Z2 endurance ride at 65-70% FTP (~98 min)',
    },
    {
      id: 'pair-13-real',
      workoutId: 'BB5epMKMwL',
      activityId: '10953881435',
      workoutName: 'Wahoo SYSTM: FTP Over Unders: 3 sets 8x1',
      athleteFtp: FTP,
      segments: [],
      structure: PAIR_13_STRUCTURE,
      powerStream: ACTIVITY_10953881435_POWER_STREAM,
      description:
        'Real data: 3 sets of 4x (1min over/1min under) threshold intervals with progressive ramp warmup (~48 min)',
    },
    {
      id: 'pair-14-real',
      workoutId: '74GPWrdaus',
      activityId: '10906026493',
      workoutName: 'FTP Progression 2 5x7',
      athleteFtp: FTP,
      segments: [],
      structure: PAIR_14_STRUCTURE,
      powerStream: ACTIVITY_10906026493_POWER_STREAM,
      description:
        'Real data: 5x7min threshold intervals at 95-100% FTP with 3min recovery (~89 min)',
    },
    {
      id: 'pair-15-real',
      workoutId: 'dQ1OauEjzF',
      activityId: '11739391851',
      workoutName: '40/20s (5min) 2x1min (1.3hr)',
      athleteFtp: FTP,
      segments: [],
      structure: PAIR_15_STRUCTURE,
      powerStream: ACTIVITY_11739391851_POWER_STREAM,
      description: 'Real data: 4 sets of 5x (40s/20s) VO2 max intervals at 115-130% FTP (~59 min)',
    },
  ]
}

// ============================================================================
// Edge Case Fixtures
// ============================================================================

/**
 * Workout with segments skipped (shorter activity)
 */
export const EDGE_CASE_SKIPPED_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 10.0,
    power_low_pct: 50,
    power_high_pct: 60,
  },
  {
    type: 'interval',
    duration_min: 0, // Intervals use work/recovery durations instead
    sets: 4,
    work: { duration_min: 5.0, power_low_pct: 100, power_high_pct: 110 },
    recovery: { duration_min: 3.0, power_low_pct: 50, power_high_pct: 60 },
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 50,
    power_high_pct: 60,
  },
]

/**
 * Generate activity that only completes 2 of 4 intervals
 */
export function generatePartialActivityStream(ftp: number): number[] {
  const stream: number[] = []

  // Warmup (10 min)
  for (let i = 0; i < 600; i++) {
    stream.push(Math.round(ftp * 0.55 + (Math.random() - 0.5) * 20))
  }

  // Only 2 intervals instead of 4
  for (let interval = 0; interval < 2; interval++) {
    // Work (5 min)
    for (let i = 0; i < 300; i++) {
      stream.push(Math.round(ftp * 1.05 + (Math.random() - 0.5) * 30))
    }
    // Recovery (3 min)
    for (let i = 0; i < 180; i++) {
      stream.push(Math.round(ftp * 0.55 + (Math.random() - 0.5) * 15))
    }
  }

  // Abbreviated cooldown (5 min instead of 10)
  for (let i = 0; i < 300; i++) {
    stream.push(Math.round(ftp * 0.55 + (Math.random() - 0.5) * 15))
  }

  return stream
}

/**
 * Simple Sweet Spot workout for testing basic matching
 */
export const SIMPLE_SWEET_SPOT_SEGMENTS: WorkoutSegment[] = [
  {
    type: 'warmup',
    duration_min: 10.0,
    power_low_pct: 50,
    power_high_pct: 60,
  },
  {
    type: 'steady',
    duration_min: 20.0,
    power_low_pct: 88,
    power_high_pct: 93,
    description: 'Sweet Spot 1',
  },
  {
    type: 'recovery',
    duration_min: 5.0,
    power_low_pct: 50,
    power_high_pct: 55,
  },
  {
    type: 'steady',
    duration_min: 20.0,
    power_low_pct: 88,
    power_high_pct: 93,
    description: 'Sweet Spot 2',
  },
  {
    type: 'cooldown',
    duration_min: 10.0,
    power_low_pct: 50,
    power_high_pct: 60,
  },
]

/**
 * Generate a perfect execution stream (for testing 100% compliance)
 */
export function generatePerfectExecutionStream(segments: WorkoutSegment[], ftp: number): number[] {
  return generateSimulatedPowerStream(segments, ftp, 0.03) // Very low variability
}

/**
 * Generate a poor execution stream (wrong zones, wrong durations)
 */
export function generatePoorExecutionStream(ftp: number): number[] {
  // Generate mostly Z2 power regardless of workout
  const stream: number[] = []
  for (let i = 0; i < 3600; i++) {
    // 1 hour of Z2
    stream.push(Math.round(ftp * 0.65 + (Math.random() - 0.5) * 30))
  }
  return stream
}

// ============================================================================
// Multi-Step Interval Fixtures (Issue #96)
// ============================================================================

/**
 * "Above and Below Threshold" - 3-step interval workout (WorkoutStructure format)
 *
 * This workout alternates between:
 * 1. 3 min at Z5 (108-115%)
 * 2. 3 min at Z4 (95-105%)
 * 3. 2 min recovery (50-60%)
 *
 * Repeated 5 times = 40 min of intervals
 */
export const MULTI_STEP_ABOVE_BELOW_THRESHOLD: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    // Warmup - 10 minutes progressive
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'warmUp',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 50, maxValue: 70 }],
        },
      ],
    },
    // Main set: 5x (3min Z5 / 3min Z4 / 2min recovery)
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: 'Above Threshold',
          intensityClass: 'active',
          length: { unit: 'minute', value: 3 },
          targets: [{ type: 'power', minValue: 108, maxValue: 115 }],
        },
        {
          name: 'At Threshold',
          intensityClass: 'active',
          length: { unit: 'minute', value: 3 },
          targets: [{ type: 'power', minValue: 95, maxValue: 105 }],
        },
        {
          name: 'Recovery',
          intensityClass: 'rest',
          length: { unit: 'minute', value: 2 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
        },
      ],
    },
    // Cooldown - 10 minutes
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cooldown',
          intensityClass: 'coolDown',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 40, maxValue: 50 }],
        },
      ],
    },
  ],
}

/**
 * "Billat 30/30/30" - 3-step VO2max intervals (WorkoutStructure format)
 *
 * Classic VO2max workout with three intensity levels:
 * 1. 30s at 120% (anaerobic)
 * 2. 30s at 100% (threshold)
 * 3. 30s at 60% (recovery)
 *
 * Repeated 10 times = 15 min of intervals
 */
export const MULTI_STEP_BILLAT_30_30_30: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    // Warmup
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'warmUp',
          length: { unit: 'minute', value: 15 },
          targets: [{ type: 'power', minValue: 55, maxValue: 75 }],
        },
      ],
    },
    // Main set: 10x (30s at 120% / 30s at 100% / 30s at 60%)
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 10 },
      steps: [
        {
          name: 'Sprint',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 115, maxValue: 125 }],
        },
        {
          name: 'Threshold',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 95, maxValue: 105 }],
        },
        {
          name: 'Recovery',
          intensityClass: 'rest',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 55, maxValue: 65 }],
        },
      ],
    },
    // Recovery block
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Rest',
          intensityClass: 'rest',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
        },
      ],
    },
    // Second set: 10x again
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 10 },
      steps: [
        {
          name: 'Sprint',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 115, maxValue: 125 }],
        },
        {
          name: 'Threshold',
          intensityClass: 'active',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 95, maxValue: 105 }],
        },
        {
          name: 'Recovery',
          intensityClass: 'rest',
          length: { unit: 'second', value: 30 },
          targets: [{ type: 'power', minValue: 55, maxValue: 65 }],
        },
      ],
    },
    // Cooldown
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cooldown',
          intensityClass: 'coolDown',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 40, maxValue: 55 }],
        },
      ],
    },
  ],
}

/**
 * "4-Step Pyramid" - 4-step interval workout (WorkoutStructure format)
 *
 * Progressive intensity pyramid:
 * 1. 1 min at 80% (sweet spot)
 * 2. 1 min at 95% (threshold)
 * 3. 1 min at 110% (VO2max)
 * 4. 2 min recovery (50%)
 *
 * Repeated 6 times = 30 min of intervals
 */
export const MULTI_STEP_4_STEP_PYRAMID: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    // Warmup
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'warmUp',
          length: { unit: 'minute', value: 12 },
          targets: [{ type: 'power', minValue: 50, maxValue: 70 }],
        },
      ],
    },
    // Main set: 6x (1min 80% / 1min 95% / 1min 110% / 2min recovery)
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 6 },
      steps: [
        {
          name: 'Sweet Spot',
          intensityClass: 'active',
          length: { unit: 'minute', value: 1 },
          targets: [{ type: 'power', minValue: 76, maxValue: 84 }],
        },
        {
          name: 'Threshold',
          intensityClass: 'active',
          length: { unit: 'minute', value: 1 },
          targets: [{ type: 'power', minValue: 91, maxValue: 99 }],
        },
        {
          name: 'VO2max',
          intensityClass: 'active',
          length: { unit: 'minute', value: 1 },
          targets: [{ type: 'power', minValue: 106, maxValue: 114 }],
        },
        {
          name: 'Recovery',
          intensityClass: 'rest',
          length: { unit: 'minute', value: 2 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55 }],
        },
      ],
    },
    // Cooldown
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cooldown',
          intensityClass: 'coolDown',
          length: { unit: 'minute', value: 8 },
          targets: [{ type: 'power', minValue: 40, maxValue: 55 }],
        },
      ],
    },
  ],
}

/**
 * Simple Sweet Spot in WorkoutStructure format (for comparison with legacy)
 */
export const SIMPLE_SWEET_SPOT_STRUCTURE: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'warmUp',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Sweet Spot 1',
          intensityClass: 'active',
          length: { unit: 'minute', value: 20 },
          targets: [{ type: 'power', minValue: 88, maxValue: 93 }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Recovery',
          intensityClass: 'rest',
          length: { unit: 'minute', value: 5 },
          targets: [{ type: 'power', minValue: 50, maxValue: 55 }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Sweet Spot 2',
          intensityClass: 'active',
          length: { unit: 'minute', value: 20 },
          targets: [{ type: 'power', minValue: 88, maxValue: 93 }],
        },
      ],
    },
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cooldown',
          intensityClass: 'coolDown',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
        },
      ],
    },
  ],
}

/**
 * Multi-step interval with cadence targets (Issue #96 feature)
 *
 * High cadence / low cadence alternations:
 * 1. 2 min at 80% with cadence 100-110 rpm
 * 2. 2 min at 80% with cadence 60-70 rpm
 * 3. 1 min recovery at 50%
 *
 * Repeated 4 times
 */
export const MULTI_STEP_CADENCE_DRILLS: WorkoutStructure = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    // Warmup
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warmup',
          intensityClass: 'warmUp',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 50, maxValue: 65 }],
        },
      ],
    },
    // Main set with cadence targets
    {
      type: 'repetition',
      length: { unit: 'repetition', value: 4 },
      steps: [
        {
          name: 'High Cadence',
          intensityClass: 'active',
          length: { unit: 'minute', value: 2 },
          targets: [
            { type: 'power', minValue: 76, maxValue: 84 },
            { type: 'cadence', minValue: 100, maxValue: 110, unit: 'rpm' },
          ],
        },
        {
          name: 'Low Cadence',
          intensityClass: 'active',
          length: { unit: 'minute', value: 2 },
          targets: [
            { type: 'power', minValue: 76, maxValue: 84 },
            { type: 'cadence', minValue: 60, maxValue: 70, unit: 'rpm' },
          ],
        },
        {
          name: 'Recovery',
          intensityClass: 'rest',
          length: { unit: 'minute', value: 1 },
          targets: [{ type: 'power', minValue: 45, maxValue: 55 }],
        },
      ],
    },
    // Cooldown
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Cooldown',
          intensityClass: 'coolDown',
          length: { unit: 'minute', value: 10 },
          targets: [{ type: 'power', minValue: 40, maxValue: 55 }],
        },
      ],
    },
  ],
}

/**
 * Generate a simulated power stream from WorkoutStructure
 */
export function generateSimulatedPowerStreamFromStructure(
  structure: WorkoutStructure,
  ftp: number,
  variability: number = 0.1
): number[] {
  const stream: number[] = []

  for (const segment of structure.structure) {
    const repetitions = segment.length.value

    for (let rep = 0; rep < repetitions; rep++) {
      for (const step of segment.steps) {
        // Get power target from targets array
        const powerTarget = step.targets.find((t) => t.type === 'power')
        const minPct = powerTarget?.minValue ?? 50
        const maxPct = powerTarget?.maxValue ?? 60
        const avgPower = ((minPct + maxPct) / 2 / 100) * ftp

        // Calculate duration in seconds
        let durationSec: number
        switch (step.length.unit) {
          case 'second':
            durationSec = step.length.value
            break
          case 'minute':
            durationSec = step.length.value * 60
            break
          case 'hour':
            durationSec = step.length.value * 3600
            break
          default:
            durationSec = step.length.value
        }

        // Generate power values
        for (let i = 0; i < durationSec; i++) {
          const variation = (Math.random() - 0.5) * 2 * variability * avgPower
          stream.push(Math.round(avgPower + variation))
        }
      }
    }
  }

  return stream
}

/**
 * Get multi-step interval test fixtures with WorkoutStructure format
 */
export function getMultiStepTestFixtures(): WorkoutActivityPair[] {
  const FTP = 250

  return [
    {
      id: 'multi-step-1',
      workoutId: 'above-below-threshold',
      activityId: 'simulated-1',
      workoutName: 'Above and Below Threshold',
      athleteFtp: FTP,
      segments: [], // No legacy segments
      structure: MULTI_STEP_ABOVE_BELOW_THRESHOLD,
      powerStream: generateSimulatedPowerStreamFromStructure(MULTI_STEP_ABOVE_BELOW_THRESHOLD, FTP),
      description: '3-step intervals: 3min Z5 / 3min Z4 / 2min recovery x5 (~60 min)',
    },
    {
      id: 'multi-step-2',
      workoutId: 'billat-30-30-30',
      activityId: 'simulated-2',
      workoutName: 'Billat 30/30/30',
      athleteFtp: FTP,
      segments: [], // No legacy segments
      structure: MULTI_STEP_BILLAT_30_30_30,
      powerStream: generateSimulatedPowerStreamFromStructure(MULTI_STEP_BILLAT_30_30_30, FTP),
      description:
        '3-step VO2max intervals: 30s sprint / 30s threshold / 30s recovery x10 x2 (~50 min)',
    },
    {
      id: 'multi-step-3',
      workoutId: '4-step-pyramid',
      activityId: 'simulated-3',
      workoutName: '4-Step Pyramid',
      athleteFtp: FTP,
      segments: [], // No legacy segments
      structure: MULTI_STEP_4_STEP_PYRAMID,
      powerStream: generateSimulatedPowerStreamFromStructure(MULTI_STEP_4_STEP_PYRAMID, FTP),
      description: '4-step pyramid: 1min 80% / 1min 95% / 1min 110% / 2min recovery x6 (~50 min)',
    },
    {
      id: 'multi-step-cadence',
      workoutId: 'cadence-drills',
      activityId: 'simulated-4',
      workoutName: 'Cadence Drills',
      athleteFtp: FTP,
      segments: [], // No legacy segments
      structure: MULTI_STEP_CADENCE_DRILLS,
      powerStream: generateSimulatedPowerStreamFromStructure(MULTI_STEP_CADENCE_DRILLS, FTP),
      description: '3-step with cadence targets: high/low cadence alternations x4 (~40 min)',
    },
    {
      id: 'structure-sweet-spot',
      workoutId: 'sweet-spot-structure',
      activityId: 'simulated-5',
      workoutName: 'Sweet Spot (Structure Format)',
      athleteFtp: FTP,
      segments: SIMPLE_SWEET_SPOT_SEGMENTS, // Include legacy for comparison
      structure: SIMPLE_SWEET_SPOT_STRUCTURE,
      powerStream: generateSimulatedPowerStreamFromStructure(SIMPLE_SWEET_SPOT_STRUCTURE, FTP),
      description: 'Sweet spot workout in new structure format for comparison (~65 min)',
    },
  ]
}

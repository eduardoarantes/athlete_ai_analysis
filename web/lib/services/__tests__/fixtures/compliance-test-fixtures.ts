/**
 * Compliance Analysis Test Fixtures
 *
 * Real workout-activity pairs for offline testing.
 * Workout data from workout_library.json, activity streams from Strava.
 */

import type { WorkoutSegment } from '@/lib/types/training-plan'
import {
  ACTIVITY_15664598790_POWER_STREAM,
  ACTIVITY_14698802921_POWER_STREAM,
  ACTIVITY_14677009311_POWER_STREAM,
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
        const workPowerTarget = ((segment.work.power_low_pct + segment.work.power_high_pct) / 2 / 100) * ftp
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
      workoutId: 'dwJlJsPTi8',
      activityId: '15664598790',
      workoutName: '30 s x 4m interval repeats',
      athleteFtp: FTP,
      segments: PAIR_1_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_1_WORKOUT_SEGMENTS, FTP),
      description: 'Short sprint intervals with 4-minute recoveries',
    },
    {
      id: 'pair-2',
      workoutId: '1qNVeYOPMI',
      activityId: '14698802921',
      workoutName: 'M.A.P Efforts',
      athleteFtp: FTP,
      segments: PAIR_2_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_2_WORKOUT_SEGMENTS, FTP),
      description: 'Maximal Aerobic Power intervals with 5-min efforts',
    },
    {
      id: 'pair-3',
      workoutId: 'kC2kEfzvxG',
      activityId: '14677009311',
      workoutName: 'Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_3_WORKOUT_SEGMENTS,
      powerStream: generateSimulatedPowerStream(PAIR_3_WORKOUT_SEGMENTS, FTP),
      description: 'Progressive threshold intervals (6/7/8 min)',
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
      workoutId: 'dwJlJsPTi8',
      activityId: '15664598790',
      workoutName: '30 s x 4m interval repeats',
      athleteFtp: FTP,
      segments: PAIR_1_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_15664598790_POWER_STREAM,
      description: 'Real data: Short sprint intervals with 4-minute recoveries (~62 min)',
    },
    {
      id: 'pair-2-real',
      workoutId: '1qNVeYOPMI',
      activityId: '14698802921',
      workoutName: 'M.A.P Efforts',
      athleteFtp: FTP,
      segments: PAIR_2_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_14698802921_POWER_STREAM,
      description: 'Real data: Maximal Aerobic Power intervals (~60 min)',
    },
    {
      id: 'pair-3-real',
      workoutId: 'kC2kEfzvxG',
      activityId: '14677009311',
      workoutName: 'Threshold Efforts',
      athleteFtp: FTP,
      segments: PAIR_3_WORKOUT_SEGMENTS,
      powerStream: ACTIVITY_14677009311_POWER_STREAM,
      description: 'Real data: Progressive threshold intervals (~32 min)',
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

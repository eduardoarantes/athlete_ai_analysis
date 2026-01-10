/**
 * Apply Workout Overrides Tests
 *
 * Tests the library workout to schedule workout conversion flow
 * Part of Issue #72: Workout Library Sidebar
 */

import { describe, it, expect } from 'vitest'
import {
  applyWorkoutOverrides,
  libraryWorkoutToScheduleWorkout,
  type LibraryWorkoutParams,
} from '../apply-workout-overrides'
import type {
  TrainingPlanData,
  WorkoutOverrides,
  WorkoutSegment,
} from '@/lib/types/training-plan'
import type { LibraryWorkoutSegment } from '@/lib/types/workout-library'

describe('libraryWorkoutToScheduleWorkout', () => {
  it('should create a workout with basic properties', () => {
    const params: LibraryWorkoutParams = {
      id: 'test-workout-id',
      name: 'Test Workout',
      type: 'tempo',
      tss: 75,
      description: 'A test workout description',
      durationMin: 60,
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.name).toBe('Test Workout')
    expect(result.type).toBe('tempo')
    expect(result.tss).toBe(75)
    expect(result.description).toBe('A test workout description')
    expect(result.source).toBe('library')
    expect(result.library_workout_id).toBe('test-workout-id')
  })

  it('should use provided segments instead of creating placeholder', () => {
    const segments: WorkoutSegment[] = [
      { type: 'warmup', duration_min: 10, power_low_pct: 50, power_high_pct: 60 },
      { type: 'interval', duration_min: 12, power_low_pct: 85, power_high_pct: 90, sets: 3 },
      { type: 'cooldown', duration_min: 5, power_low_pct: 40, power_high_pct: 50 },
    ]

    const params: LibraryWorkoutParams = {
      id: 'interval-workout',
      name: '3x12 Tempo',
      type: 'tempo',
      tss: 80,
      durationMin: 60,
      segments,
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.segments).toEqual(segments)
    expect(result.segments?.length).toBe(3)
    expect(result.segments?.[0]?.type).toBe('warmup')
    expect(result.segments?.[1]?.type).toBe('interval')
    expect(result.segments?.[1]?.sets).toBe(3)
  })

  it('should create placeholder segment when no segments provided but duration is', () => {
    const params: LibraryWorkoutParams = {
      id: 'simple-workout',
      name: 'Endurance Ride',
      type: 'endurance',
      tss: 50,
      durationMin: 90,
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.segments?.length).toBe(1)
    expect(result.segments?.[0]?.type).toBe('steady')
    expect(result.segments?.[0]?.duration_min).toBe(90)
  })

  it('should handle minimal params (just ID)', () => {
    const result = libraryWorkoutToScheduleWorkout('just-an-id')

    expect(result.library_workout_id).toBe('just-an-id')
    expect(result.name).toBe('Library Workout')
    expect(result.type).toBe('mixed')
    expect(result.tss).toBe(50)
  })
})

describe('applyWorkoutOverrides with library workouts', () => {
  const basePlanData: TrainingPlanData = {
    athlete_profile: { ftp: 250 },
    plan_metadata: { total_weeks: 1, current_ftp: 250, target_ftp: 260 },
    weekly_plan: [
      {
        week_number: 1,
        phase: 'Base',
        week_tss: 300,
        workouts: [
          { weekday: 'Monday', name: 'Recovery Ride', type: 'recovery', tss: 30 },
          { weekday: 'Wednesday', name: 'Tempo', type: 'tempo', tss: 60 },
        ],
      },
    ],
  }

  it('should add library workout from copies with full data', () => {
    const overrides: WorkoutOverrides = {
      moves: {},
      copies: {
        '2026-01-10:100': {
          source_date: 'library:tempo-intervals-id',
          source_index: 0,
          copied_at: '2026-01-09T10:00:00Z',
          library_workout: {
            name: '3x12 Tempo Intervals',
            type: 'tempo',
            tss: 80,
            duration_min: 60,
            description: 'Tempo intervals for threshold work',
            segments: [
              { type: 'warmup', duration_min: 10, power_low_pct: 50, power_high_pct: 60 },
              {
                type: 'interval',
                duration_min: 36,
                sets: 3,
                work: { duration_min: 12, power_low_pct: 85, power_high_pct: 90 },
                recovery: { duration_min: 5, power_low_pct: 50, power_high_pct: 55 },
              },
              { type: 'cooldown', duration_min: 10, power_low_pct: 40, power_high_pct: 50 },
            ],
          },
        },
      },
      deleted: [],
    }

    const startDate = '2026-01-06' // Monday
    const result = applyWorkoutOverrides(basePlanData, overrides, startDate)

    // Check that library workout appears on the correct date
    const jan10Workouts = result.get('2026-01-10')
    expect(jan10Workouts).toBeDefined()
    expect(jan10Workouts?.length).toBe(1)

    const libraryWorkout = jan10Workouts?.[0]
    expect(libraryWorkout?.workout.name).toBe('3x12 Tempo Intervals')
    expect(libraryWorkout?.workout.type).toBe('tempo')
    expect(libraryWorkout?.workout.tss).toBe(80)
    expect(libraryWorkout?.workout.source).toBe('library')
    expect(libraryWorkout?.workout.library_workout_id).toBe('tempo-intervals-id')
    expect(libraryWorkout?.modificationSource).toBe('library')
    expect(libraryWorkout?.libraryWorkoutId).toBe('tempo-intervals-id')

    // Check segments are preserved
    expect(libraryWorkout?.workout.segments?.length).toBe(3)
    expect(libraryWorkout?.workout.segments?.[0]?.type).toBe('warmup')
    expect(libraryWorkout?.workout.segments?.[1]?.type).toBe('interval')
    expect(libraryWorkout?.workout.segments?.[1]?.sets).toBe(3)
  })

  it('should use placeholder when library_workout data is missing', () => {
    const overrides: WorkoutOverrides = {
      moves: {},
      copies: {
        '2026-01-10:100': {
          source_date: 'library:unknown-id',
          source_index: 0,
          copied_at: '2026-01-09T10:00:00Z',
          // No library_workout data
        },
      },
      deleted: [],
    }

    const startDate = '2026-01-06'
    const result = applyWorkoutOverrides(basePlanData, overrides, startDate)

    const jan10Workouts = result.get('2026-01-10')
    expect(jan10Workouts?.length).toBe(1)

    const workout = jan10Workouts?.[0]?.workout
    expect(workout?.name).toBe('Library Workout') // Default name
    expect(workout?.type).toBe('mixed') // Default type
    expect(workout?.tss).toBe(50) // Default tss
    expect(workout?.library_workout_id).toBe('unknown-id')
  })

  it('should skip deleted library workout copies', () => {
    const overrides: WorkoutOverrides = {
      moves: {},
      copies: {
        '2026-01-10:100': {
          source_date: 'library:tempo-id',
          source_index: 0,
          copied_at: '2026-01-09T10:00:00Z',
          library_workout: {
            name: 'Deleted Workout',
            type: 'tempo',
            tss: 80,
          },
        },
      },
      deleted: ['2026-01-10:100'], // This workout is deleted
    }

    const startDate = '2026-01-06'
    const result = applyWorkoutOverrides(basePlanData, overrides, startDate)

    // The library workout should not appear
    const jan10Workouts = result.get('2026-01-10')
    expect(jan10Workouts).toBeUndefined()
  })

  it('should preserve work/recovery interval structure', () => {
    const overrides: WorkoutOverrides = {
      moves: {},
      copies: {
        '2026-01-10:100': {
          source_date: 'library:vo2max-id',
          source_index: 0,
          copied_at: '2026-01-09T10:00:00Z',
          library_workout: {
            name: 'VO2max Intervals',
            type: 'vo2max',
            tss: 90,
            segments: [
              { type: 'warmup', duration_min: 15 },
              {
                type: 'interval',
                duration_min: 24,
                sets: 6,
                work: {
                  duration_min: 3,
                  power_low_pct: 110,
                  power_high_pct: 120,
                },
                recovery: {
                  duration_min: 3,
                  power_low_pct: 40,
                  power_high_pct: 50,
                },
              },
              { type: 'cooldown', duration_min: 10 },
            ],
          },
        },
      },
      deleted: [],
    }

    const startDate = '2026-01-06'
    const result = applyWorkoutOverrides(basePlanData, overrides, startDate)

    const workouts = result.get('2026-01-10')
    const intervalSegment = workouts?.[0]?.workout.segments?.[1]

    expect(intervalSegment?.sets).toBe(6)
    expect(intervalSegment?.work?.duration_min).toBe(3)
    expect(intervalSegment?.work?.power_low_pct).toBe(110)
    expect(intervalSegment?.work?.power_high_pct).toBe(120)
    expect(intervalSegment?.recovery?.duration_min).toBe(3)
    expect(intervalSegment?.recovery?.power_low_pct).toBe(40)
  })
})

describe('convertLibrarySegmentsToSchedule (via integration)', () => {
  // This tests the conversion implicitly through the full flow

  it('should correctly map library segment types', () => {
    // Mock a complete library workout with various segment types
    const librarySegments: LibraryWorkoutSegment[] = [
      { type: 'warmup', duration_min: 10, power_low_pct: 50, power_high_pct: 60 },
      { type: 'tempo', duration_min: 20, power_low_pct: 76, power_high_pct: 90 },
      { type: 'steady', duration_min: 30, power_low_pct: 65, power_high_pct: 75 },
      { type: 'interval', duration_min: 15, sets: 5 },
      { type: 'recovery', duration_min: 5, power_low_pct: 40, power_high_pct: 50 },
      { type: 'cooldown', duration_min: 10 },
    ]

    // When stored as library_workout.segments, they should maintain structure
    const params: LibraryWorkoutParams = {
      id: 'mixed-workout',
      name: 'Mixed Workout',
      type: 'mixed',
      tss: 100,
      segments: librarySegments as WorkoutSegment[],
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.segments?.length).toBe(6)
    expect(result.segments?.map((s) => s.type)).toEqual([
      'warmup',
      'tempo',
      'steady',
      'interval',
      'recovery',
      'cooldown',
    ])
  })
})

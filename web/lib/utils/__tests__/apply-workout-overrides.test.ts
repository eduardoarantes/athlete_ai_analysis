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
import type { TrainingPlanData, WorkoutOverrides, WorkoutStructure } from '@/lib/types/training-plan'

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

  it('should use provided structure instead of creating placeholder', () => {
    const structure: WorkoutStructure = {
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
              targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
            },
          ],
        },
        {
          type: 'repetition',
          length: { unit: 'repetition', value: 3 },
          steps: [
            {
              name: 'Tempo',
              intensityClass: 'active',
              length: { unit: 'minute', value: 12 },
              targets: [{ type: 'power', minValue: 85, maxValue: 90, unit: 'percentOfFtp' }],
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
              length: { unit: 'minute', value: 5 },
              targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
            },
          ],
        },
      ],
    }

    const params: LibraryWorkoutParams = {
      id: 'interval-workout',
      name: '3x12 Tempo',
      type: 'tempo',
      tss: 80,
      durationMin: 60,
      structure,
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.structure).toEqual(structure)
    expect(result.structure?.structure?.length).toBe(3)
    expect(result.structure?.structure?.[0]?.steps[0]?.intensityClass).toBe('warmUp')
    expect(result.structure?.structure?.[1]?.type).toBe('repetition')
    expect(result.structure?.structure?.[1]?.length.value).toBe(3)
  })

  it('should create placeholder structure when no structure provided but duration is', () => {
    const params: LibraryWorkoutParams = {
      id: 'simple-workout',
      name: 'Endurance Ride',
      type: 'endurance',
      tss: 50,
      durationMin: 90,
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.structure?.structure?.length).toBe(1)
    expect(result.structure?.structure?.[0]?.steps[0]?.intensityClass).toBe('active')
    expect(result.structure?.structure?.[0]?.steps[0]?.length.value).toBe(90)
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
    const structure: WorkoutStructure = {
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
              targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
            },
          ],
        },
        {
          type: 'repetition',
          length: { unit: 'repetition', value: 3 },
          steps: [
            {
              name: 'Tempo Work',
              intensityClass: 'active',
              length: { unit: 'minute', value: 12 },
              targets: [{ type: 'power', minValue: 85, maxValue: 90, unit: 'percentOfFtp' }],
            },
            {
              name: 'Recovery',
              intensityClass: 'rest',
              length: { unit: 'minute', value: 5 },
              targets: [{ type: 'power', minValue: 50, maxValue: 55, unit: 'percentOfFtp' }],
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
              targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
            },
          ],
        },
      ],
    }

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
            structure,
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

    // Check structure is preserved
    expect(libraryWorkout?.workout.structure?.structure?.length).toBe(3)
    expect(libraryWorkout?.workout.structure?.structure?.[0]?.steps[0]?.intensityClass).toBe(
      'warmUp'
    )
    expect(libraryWorkout?.workout.structure?.structure?.[1]?.type).toBe('repetition')
    expect(libraryWorkout?.workout.structure?.structure?.[1]?.length.value).toBe(3)
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
    const structure: WorkoutStructure = {
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
              length: { unit: 'minute', value: 15 },
              targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
            },
          ],
        },
        {
          type: 'repetition',
          length: { unit: 'repetition', value: 6 },
          steps: [
            {
              name: 'VO2max Work',
              intensityClass: 'active',
              length: { unit: 'minute', value: 3 },
              targets: [{ type: 'power', minValue: 110, maxValue: 120, unit: 'percentOfFtp' }],
            },
            {
              name: 'Recovery',
              intensityClass: 'rest',
              length: { unit: 'minute', value: 3 },
              targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
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
              targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
            },
          ],
        },
      ],
    }

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
            structure,
          },
        },
      },
      deleted: [],
    }

    const startDate = '2026-01-06'
    const result = applyWorkoutOverrides(basePlanData, overrides, startDate)

    const workouts = result.get('2026-01-10')
    const intervalSegment = workouts?.[0]?.workout.structure?.structure?.[1]

    expect(intervalSegment?.type).toBe('repetition')
    expect(intervalSegment?.length.value).toBe(6)
    expect(intervalSegment?.steps[0]?.length.value).toBe(3)
    expect(intervalSegment?.steps[0]?.targets[0]?.minValue).toBe(110)
    expect(intervalSegment?.steps[0]?.targets[0]?.maxValue).toBe(120)
    expect(intervalSegment?.steps[1]?.length.value).toBe(3)
    expect(intervalSegment?.steps[1]?.targets[0]?.minValue).toBe(40)
  })
})

describe('structure conversion (via integration)', () => {
  // This tests the conversion implicitly through the full flow

  it('should correctly preserve library workout structure', () => {
    // Mock a complete library workout with various intensity classes
    const structure: WorkoutStructure = {
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
              targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
            },
          ],
        },
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Tempo',
              intensityClass: 'active',
              length: { unit: 'minute', value: 20 },
              targets: [{ type: 'power', minValue: 76, maxValue: 90, unit: 'percentOfFtp' }],
            },
          ],
        },
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Steady',
              intensityClass: 'active',
              length: { unit: 'minute', value: 30 },
              targets: [{ type: 'power', minValue: 65, maxValue: 75, unit: 'percentOfFtp' }],
            },
          ],
        },
        {
          type: 'repetition',
          length: { unit: 'repetition', value: 5 },
          steps: [
            {
              name: 'Interval',
              intensityClass: 'active',
              length: { unit: 'minute', value: 3 },
              targets: [{ type: 'power', minValue: 100, maxValue: 110, unit: 'percentOfFtp' }],
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
              targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
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
              targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
            },
          ],
        },
      ],
    }

    const params: LibraryWorkoutParams = {
      id: 'mixed-workout',
      name: 'Mixed Workout',
      type: 'mixed',
      tss: 100,
      structure,
    }

    const result = libraryWorkoutToScheduleWorkout(params)

    expect(result.structure?.structure?.length).toBe(6)
    expect(result.structure?.structure?.map((s) => s.steps[0]?.intensityClass)).toEqual([
      'warmUp',
      'active',
      'active',
      'active',
      'rest',
      'coolDown',
    ])
  })
})

/**
 * TrainingPeaks Sync Service Tests
 *
 * Tests for the TrainingPeaksSyncService which handles converting
 * internal workout format to TrainingPeaks format and syncing workouts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing service
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/services/trainingpeaks-service', () => ({
  TrainingPeaksService: {
    create: vi.fn(),
  },
}))

// Import after mocks
import { TrainingPeaksSyncService } from '../trainingpeaks-sync-service'
import type { Workout } from '@/lib/types/training-plan'

// Test data factories
const createMockWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  weekday: 'Monday',
  name: 'Sweet Spot Intervals',
  type: 'sweet_spot',
  description: 'Build aerobic endurance',
  detailed_description: 'Detailed workout description',
  tss: 75,
  structure: {
    primaryIntensityMetric: 'percentOfFtp',
    primaryLengthMetric: 'duration',
    structure: [
      {
        type: 'step',
        length: { unit: 'repetition', value: 1 },
        steps: [
          {
            name: 'Easy warmup',
            intensityClass: 'warmUp',
            length: { unit: 'minute', value: 10 },
            targets: [{ type: 'power', minValue: 50, maxValue: 65, unit: 'percentOfFtp' }],
          },
        ],
      },
      {
        type: 'step',
        length: { unit: 'repetition', value: 1 },
        steps: [
          {
            name: 'Sweet spot effort',
            intensityClass: 'active',
            length: { unit: 'minute', value: 20 },
            targets: [{ type: 'power', minValue: 88, maxValue: 94, unit: 'percentOfFtp' }],
          },
        ],
      },
      {
        type: 'step',
        length: { unit: 'repetition', value: 1 },
        steps: [
          {
            name: 'Recovery spin',
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
            name: 'Easy cooldown',
            intensityClass: 'coolDown',
            length: { unit: 'minute', value: 10 },
            targets: [{ type: 'power', minValue: 40, maxValue: 55, unit: 'percentOfFtp' }],
          },
        ],
      },
    ],
  },
  ...overrides,
})

describe('TrainingPeaksSyncService', () => {
  let service: TrainingPeaksSyncService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TrainingPeaksSyncService()
  })

  describe('convertWorkoutToTPStructure', () => {
    it('converts workout segments to TrainingPeaks Structure JSON', () => {
      const workout = createMockWorkout()
      const result = service.convertWorkoutToTPStructure(workout)
      const parsed = JSON.parse(result)

      expect(parsed.Steps).toHaveLength(4)
      expect(parsed.Steps[0].Type).toBe('Step')
      expect(parsed.Steps[0].IntensityClass).toBe('WarmUp')
      expect(parsed.Steps[0].Name).toBe('Easy warmup')
      expect(parsed.Steps[0].Length).toEqual({ Unit: 'Second', Value: 600 })
    })

    it('returns empty string for workout without structure', () => {
      const { structure: _structure, ...workoutWithoutStructure } = createMockWorkout()
      const workout: Workout = workoutWithoutStructure
      const result = service.convertWorkoutToTPStructure(workout)

      expect(result).toBe('')
    })

    it('returns empty string for workout with empty structure', () => {
      const workout = createMockWorkout({
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [],
        },
      })
      const result = service.convertWorkoutToTPStructure(workout)

      expect(result).toBe('')
    })

    it('correctly maps intensity classes to TrainingPeaks IntensityClass', () => {
      const workout = createMockWorkout({
        structure: {
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
                  targets: [{ type: 'power', minValue: 50, maxValue: 65, unit: 'percentOfFtp' }],
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
                  targets: [{ type: 'power', minValue: 40, maxValue: 55, unit: 'percentOfFtp' }],
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
                  name: 'Endurance',
                  intensityClass: 'active',
                  length: { unit: 'minute', value: 30 },
                  targets: [{ type: 'power', minValue: 65, maxValue: 75, unit: 'percentOfFtp' }],
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
                  name: 'Threshold',
                  intensityClass: 'active',
                  length: { unit: 'minute', value: 20 },
                  targets: [{ type: 'power', minValue: 91, maxValue: 105, unit: 'percentOfFtp' }],
                },
              ],
            },
          ],
        },
      })

      const result = JSON.parse(service.convertWorkoutToTPStructure(workout))

      expect(result.Steps[0].IntensityClass).toBe('WarmUp')
      expect(result.Steps[1].IntensityClass).toBe('Cooldown')
      expect(result.Steps[2].IntensityClass).toBe('Active Recovery')
      expect(result.Steps[3].IntensityClass).toBe('Endurance')
      expect(result.Steps[4].IntensityClass).toBe('Tempo')
      expect(result.Steps[5].IntensityClass).toBe('Threshold')
    })

    it('maps high-intensity intervals to VO2 Max', () => {
      const workout = createMockWorkout({
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'VO2 Max Interval',
                  intensityClass: 'active',
                  length: { unit: 'minute', value: 5 },
                  targets: [{ type: 'power', minValue: 110, maxValue: 120, unit: 'percentOfFtp' }],
                },
              ],
            },
          ],
        },
      })

      const result = JSON.parse(service.convertWorkoutToTPStructure(workout))

      expect(result.Steps[0].IntensityClass).toBe('VO2 Max')
    })

    it('maps lower-intensity intervals to Threshold', () => {
      const workout = createMockWorkout({
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'Threshold',
                  intensityClass: 'active',
                  length: { unit: 'minute', value: 20 },
                  targets: [{ type: 'power', minValue: 95, maxValue: 100, unit: 'percentOfFtp' }],
                },
              ],
            },
          ],
        },
      })

      const result = JSON.parse(service.convertWorkoutToTPStructure(workout))

      expect(result.Steps[0].IntensityClass).toBe('Threshold')
    })

    it('includes intensity target when power percentages are defined', () => {
      const workout = createMockWorkout({
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'Endurance',
                  intensityClass: 'active',
                  length: { unit: 'minute', value: 30 },
                  targets: [{ type: 'power', minValue: 70, maxValue: 80, unit: 'percentOfFtp' }],
                },
              ],
            },
          ],
        },
      })

      const result = JSON.parse(service.convertWorkoutToTPStructure(workout))

      expect(result.Steps[0].IntensityTarget).toEqual({
        Unit: 'PercentOfFtp',
        MinValue: 70,
        MaxValue: 80,
        Value: 75,
      })
    })
  })

  describe('convertWorkoutToTPRequest', () => {
    it('creates a valid TrainingPeaks workout request', () => {
      const workout = createMockWorkout()
      const result = service.convertWorkoutToTPRequest(workout, '2025-01-06', 'athlete-123')

      expect(result.AthleteId).toBe('athlete-123')
      expect(result.WorkoutDay).toBe('2025-01-06')
      expect(result.WorkoutType).toBe('Bike')
      expect(result.Title).toBe('Sweet Spot Intervals')
      expect(result.Description).toBe('Detailed workout description')
      expect(result.TSSPlanned).toBe(75)
      expect(result.TotalTimePlanned).toBe(0.75) // 45 min = 0.75 hours
      expect(result.Structure).toBeDefined()
    })

    it('calculates total time from structure', () => {
      const workout = createMockWorkout({
        structure: {
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
                  targets: [{ type: 'power', minValue: 50, maxValue: 65, unit: 'percentOfFtp' }],
                },
              ],
            },
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'Main Set',
                  intensityClass: 'active',
                  length: { unit: 'minute', value: 30 },
                  targets: [{ type: 'power', minValue: 70, maxValue: 85, unit: 'percentOfFtp' }],
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
                  length: { unit: 'minute', value: 15 },
                  targets: [{ type: 'power', minValue: 40, maxValue: 55, unit: 'percentOfFtp' }],
                },
              ],
            },
          ],
        },
      })

      const result = service.convertWorkoutToTPRequest(workout, '2025-01-06', 'athlete-123')

      expect(result.TotalTimePlanned).toBe(1) // 60 min = 1 hour
    })

    it('does not include TSS when undefined', () => {
      const { tss: _tss, ...workoutWithoutTss } = createMockWorkout()
      const workout: Workout = workoutWithoutTss
      const result = service.convertWorkoutToTPRequest(workout, '2025-01-06', 'athlete-123')

      expect(result.TSSPlanned).toBeUndefined()
    })

    it('uses description fallback when detailed_description is undefined', () => {
      const { detailed_description: _dd, ...baseWorkout } = createMockWorkout()
      const workout: Workout = { ...baseWorkout, description: 'Short description' }
      const result = service.convertWorkoutToTPRequest(workout, '2025-01-06', 'athlete-123')

      expect(result.Description).toBe('Short description')
    })

    it('does not include Structure when workout has no structure', () => {
      const workout = createMockWorkout({
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [],
        },
      })
      const result = service.convertWorkoutToTPRequest(workout, '2025-01-06', 'athlete-123')

      expect(result.Structure).toBeUndefined()
    })
  })

  describe('calculateWorkoutDate', () => {
    it('calculates correct date for week 1 Monday', () => {
      // Starting on Monday 2025-01-06, week 1 Monday should be 2025-01-06
      const result = service.calculateWorkoutDate('2025-01-06', 1, 'Monday')

      expect(result).toBe('2025-01-06')
    })

    it('calculates correct date for week 1 Wednesday', () => {
      // Starting on Monday 2025-01-06, week 1 Wednesday should be 2025-01-08
      const result = service.calculateWorkoutDate('2025-01-06', 1, 'Wednesday')

      expect(result).toBe('2025-01-08')
    })

    it('calculates correct date for week 1 Sunday', () => {
      // Note: The implementation treats Sunday as day 0 (before Monday)
      // Starting on Monday 2025-01-06, week 1 Sunday is 2025-01-05 (previous Sunday)
      const result = service.calculateWorkoutDate('2025-01-06', 1, 'Sunday')

      expect(result).toBe('2025-01-05')
    })

    it('calculates correct date for week 2 Tuesday', () => {
      // Starting on Monday 2025-01-06, week 2 Tuesday should be 2025-01-14
      const result = service.calculateWorkoutDate('2025-01-06', 2, 'Tuesday')

      expect(result).toBe('2025-01-14')
    })

    it('calculates correct date for week 4 Saturday', () => {
      // Starting on Monday 2025-01-06, week 4 Saturday should be 2025-02-01
      const result = service.calculateWorkoutDate('2025-01-06', 4, 'Saturday')

      expect(result).toBe('2025-02-01')
    })

    it('handles start date on a Wednesday', () => {
      // Starting on Wednesday 2025-01-08, week 1 Monday should be 2025-01-06
      const result = service.calculateWorkoutDate('2025-01-08', 1, 'Monday')

      expect(result).toBe('2025-01-06')
    })

    it('handles start date on a Sunday', () => {
      // Starting on Sunday 2025-01-12, week 1 Monday should be 2025-01-06
      const result = service.calculateWorkoutDate('2025-01-12', 1, 'Monday')

      expect(result).toBe('2025-01-06')
    })

    it('handles start date on a Saturday', () => {
      // Starting on Saturday 2025-01-11, week 1 Monday should be 2025-01-06
      const result = service.calculateWorkoutDate('2025-01-11', 1, 'Monday')

      expect(result).toBe('2025-01-06')
    })
  })
})

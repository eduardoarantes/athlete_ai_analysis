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
import type { Workout, WorkoutSegment } from '@/lib/types/training-plan'

// Test data factories
const createMockWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  weekday: 'Monday',
  name: 'Sweet Spot Intervals',
  type: 'sweet_spot',
  description: 'Build aerobic endurance',
  detailed_description: 'Detailed workout description',
  tss: 75,
  segments: [
    {
      type: 'warmup',
      duration_min: 10,
      power_low_pct: 50,
      power_high_pct: 65,
      description: 'Easy warmup',
    },
    {
      type: 'work',
      duration_min: 20,
      power_low_pct: 88,
      power_high_pct: 94,
      description: 'Sweet spot effort',
    },
    {
      type: 'recovery',
      duration_min: 5,
      power_low_pct: 40,
      power_high_pct: 50,
      description: 'Recovery spin',
    },
    {
      type: 'cooldown',
      duration_min: 10,
      power_low_pct: 40,
      power_high_pct: 55,
      description: 'Easy cooldown',
    },
  ],
  ...overrides,
})

const createMockSegment = (overrides: Partial<WorkoutSegment> = {}): WorkoutSegment => ({
  type: 'steady',
  duration_min: 30,
  power_low_pct: 65,
  power_high_pct: 75,
  description: 'Steady endurance',
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

    it('returns empty string for workout without segments', () => {
      const { segments: _segments, ...workoutWithoutSegments } = createMockWorkout()
      const workout: Workout = workoutWithoutSegments
      const result = service.convertWorkoutToTPStructure(workout)

      expect(result).toBe('')
    })

    it('returns empty string for workout with empty segments array', () => {
      const workout = createMockWorkout({ segments: [] })
      const result = service.convertWorkoutToTPStructure(workout)

      expect(result).toBe('')
    })

    it('correctly maps segment types to IntensityClass', () => {
      const workout = createMockWorkout({
        segments: [
          createMockSegment({ type: 'warmup' }),
          createMockSegment({ type: 'cooldown' }),
          createMockSegment({ type: 'recovery' }),
          createMockSegment({ type: 'steady' }),
          createMockSegment({ type: 'tempo' }),
          createMockSegment({ type: 'work' }),
        ],
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
        segments: [
          createMockSegment({ type: 'interval', power_low_pct: 110, power_high_pct: 120 }),
        ],
      })

      const result = JSON.parse(service.convertWorkoutToTPStructure(workout))

      expect(result.Steps[0].IntensityClass).toBe('VO2 Max')
    })

    it('maps lower-intensity intervals to Threshold', () => {
      const workout = createMockWorkout({
        segments: [createMockSegment({ type: 'interval', power_low_pct: 95, power_high_pct: 100 })],
      })

      const result = JSON.parse(service.convertWorkoutToTPStructure(workout))

      expect(result.Steps[0].IntensityClass).toBe('Threshold')
    })

    it('includes intensity target when power percentages are defined', () => {
      const workout = createMockWorkout({
        segments: [createMockSegment({ power_low_pct: 70, power_high_pct: 80 })],
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

    it('calculates total time from segments', () => {
      const workout = createMockWorkout({
        segments: [
          createMockSegment({ duration_min: 15 }),
          createMockSegment({ duration_min: 30 }),
          createMockSegment({ duration_min: 15 }),
        ],
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

    it('does not include Structure when workout has no segments', () => {
      const workout = createMockWorkout({ segments: [] })
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

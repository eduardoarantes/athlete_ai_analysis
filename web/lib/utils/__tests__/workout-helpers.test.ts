/**
 * Workout Helpers Tests
 *
 * Tests for workout utility functions
 */

import { describe, it, expect } from 'vitest'
import {
  downsamplePowerStream,
  getWorkoutByDate,
  getWorkoutByDateAndIndex,
} from '../workout-helpers'
import type { TrainingPlanData, Workout } from '@/lib/types/training-plan'

describe('downsamplePowerStream', () => {
  it('returns empty array for empty input', () => {
    const result = downsamplePowerStream([], 100)
    expect(result).toEqual([])
  })

  it('returns empty array for invalid target length', () => {
    const data = [100, 200, 300]
    const result = downsamplePowerStream(data, 0)
    expect(result).toEqual([])
  })

  it('returns original array if data length is less than target', () => {
    const data = [100, 200, 300]
    const result = downsamplePowerStream(data, 10)
    expect(result).toEqual([100, 200, 300])
  })

  it('downsamples data to target length', () => {
    const data = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550]
    const result = downsamplePowerStream(data, 5)
    expect(result).toHaveLength(5)
  })

  it('preserves maximum values in each window', () => {
    // Data with peaks: [100, 300, 100, 100, 400, 100, 100, 500, 100, 100]
    // When downsampled to 2, should preserve 400 and 500 (max in each half)
    const data = [100, 300, 100, 100, 400, 100, 100, 500, 100, 100]
    const result = downsamplePowerStream(data, 2)

    expect(result).toHaveLength(2)
    expect(result[0]).toBe(400) // Max of first half
    expect(result[1]).toBe(500) // Max of second half
  })

  it('handles power data with zeros', () => {
    const data = [0, 0, 100, 200, 0, 0]
    const result = downsamplePowerStream(data, 3)

    expect(result).toHaveLength(3)
    // With 3 windows: [0,0], [100,200], [0,0]
    // Max values: 0, 200, 0
    expect(result).toEqual([0, 200, 0])
  })
})

describe('getWorkoutByDate', () => {
  const createMockPlanData = (): TrainingPlanData => ({
    athlete_profile: {
      ftp: 250,
      weight_kg: 75,
    },
    plan_metadata: {
      total_weeks: 4,
      current_ftp: 250,
      target_ftp: 260,
    },
    weekly_plan: [
      {
        week_number: 1,
        week_tss: 400,
        phase: 'base',
        workouts: [
          {
            id: 'workout-1',
            name: 'Monday Endurance',
            type: 'endurance',
            weekday: 'Monday',
            scheduled_date: '2026-01-13',
            tss: 100,
          } as Workout,
          {
            id: 'workout-2',
            name: 'Wednesday Intervals',
            type: 'threshold',
            weekday: 'Wednesday',
            scheduled_date: '2026-01-15',
            tss: 120,
          } as Workout,
        ],
      },
      {
        week_number: 2,
        week_tss: 450,
        phase: 'build',
        workouts: [
          {
            id: 'workout-3',
            name: 'Monday VO2 Max',
            type: 'vo2max',
            weekday: 'Monday',
            scheduled_date: '2026-01-20',
            tss: 150,
          } as Workout,
        ],
      },
    ],
  })

  it('returns null for plan without weekly_plan', () => {
    const planData = {
      athlete_profile: { ftp: 250, weight_kg: 75 },
      plan_metadata: { total_weeks: 4, current_ftp: 250, target_ftp: 260 },
    } as TrainingPlanData

    const result = getWorkoutByDate(planData, '2026-01-13')
    expect(result).toBeNull()
  })

  it('finds workout by scheduled_date', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDate(planData, '2026-01-13')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Monday Endurance')
    expect(result?.scheduled_date).toBe('2026-01-13')
  })

  it('returns null for non-existent date', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDate(planData, '2026-12-31')

    expect(result).toBeNull()
  })

  it('returns first workout when multiple exist on same date', () => {
    const planData = createMockPlanData()
    // Add another workout on the same date
    planData.weekly_plan[0]!.workouts.push({
      id: 'workout-4',
      name: 'Monday Recovery',
      type: 'recovery',
      weekday: 'Monday',
      scheduled_date: '2026-01-13',
      tss: 50,
    } as Workout)

    const result = getWorkoutByDate(planData, '2026-01-13')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Monday Endurance') // First one
  })

  it('searches across all weeks', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDate(planData, '2026-01-20')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Monday VO2 Max')
    expect(result?.scheduled_date).toBe('2026-01-20')
  })
})

describe('getWorkoutByDateAndIndex', () => {
  const createMockPlanData = (): TrainingPlanData => ({
    athlete_profile: {
      ftp: 250,
      weight_kg: 75,
    },
    plan_metadata: {
      total_weeks: 4,
      current_ftp: 250,
      target_ftp: 260,
    },
    weekly_plan: [
      {
        week_number: 1,
        week_tss: 400,
        phase: 'base',
        workouts: [
          {
            id: 'workout-1',
            name: 'Monday Endurance',
            type: 'endurance',
            weekday: 'Monday',
            scheduled_date: '2026-01-13',
            tss: 100,
          } as Workout,
          {
            id: 'workout-2',
            name: 'Monday Intervals',
            type: 'threshold',
            weekday: 'Monday',
            scheduled_date: '2026-01-13', // Same date as workout-1
            tss: 120,
          } as Workout,
          {
            id: 'workout-3',
            name: 'Wednesday Recovery',
            type: 'recovery',
            weekday: 'Wednesday',
            scheduled_date: '2026-01-15',
            tss: 60,
          } as Workout,
        ],
      },
    ],
  })

  it('returns null for plan without weekly_plan', () => {
    const planData = {
      athlete_profile: { ftp: 250, weight_kg: 75 },
      plan_metadata: { total_weeks: 4, current_ftp: 250, target_ftp: 260 },
    } as TrainingPlanData

    const result = getWorkoutByDateAndIndex(planData, '2026-01-13', 0)
    expect(result).toBeNull()
  })

  it('finds first workout on date with index 0', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDateAndIndex(planData, '2026-01-13', 0)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Monday Endurance')
  })

  it('finds second workout on date with index 1', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDateAndIndex(planData, '2026-01-13', 1)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Monday Intervals')
  })

  it('returns null for out-of-bounds index', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDateAndIndex(planData, '2026-01-13', 5)

    expect(result).toBeNull()
  })

  it('returns null for non-existent date', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDateAndIndex(planData, '2026-12-31', 0)

    expect(result).toBeNull()
  })

  it('handles single workout on date correctly', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDateAndIndex(planData, '2026-01-15', 0)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Wednesday Recovery')
  })

  it('returns null for negative index', () => {
    const planData = createMockPlanData()
    const result = getWorkoutByDateAndIndex(planData, '2026-01-13', -1)

    expect(result).toBeNull()
  })

  it('collects workouts across multiple weeks on same date', () => {
    const planData = createMockPlanData()
    // Add another week with same date
    planData.weekly_plan.push({
      week_number: 2,
      week_tss: 200,
      phase: 'build',
      workouts: [
        {
          id: 'workout-4',
          name: 'Week 2 Monday',
          type: 'endurance',
          weekday: 'Monday',
          scheduled_date: '2026-01-13', // Same date as week 1
          tss: 100,
        } as Workout,
      ],
    })

    // Should get all workouts on this date across weeks
    const result0 = getWorkoutByDateAndIndex(planData, '2026-01-13', 0)
    const result1 = getWorkoutByDateAndIndex(planData, '2026-01-13', 1)
    const result2 = getWorkoutByDateAndIndex(planData, '2026-01-13', 2)

    expect(result0?.name).toBe('Monday Endurance')
    expect(result1?.name).toBe('Monday Intervals')
    expect(result2?.name).toBe('Week 2 Monday')
  })
})

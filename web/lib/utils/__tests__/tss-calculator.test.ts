/**
 * TSS Calculator Tests
 *
 * Tests for Training Stress Score calculations for plan builder.
 *
 * TSS Formula: TSS = (seconds × NP × IF) / (FTP × 3600) × 100
 * Simplified for library workouts: TSS = (duration_min / 60) × IF² × 100
 * Where IF = (power_avg / FTP)
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import { describe, it, expect } from 'vitest'
import {
  calculateWorkoutTss,
  calculateDailyTss,
  calculateWeeklyTss,
} from '../tss-calculator'
import type { WorkoutsData, WorkoutPlacement } from '@/lib/types/plan-builder'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'

// Test fixtures
const createWorkout = (overrides: Partial<WorkoutLibraryItem> = {}): WorkoutLibraryItem => ({
  id: 'test-workout',
  name: 'Test Workout',
  type: 'endurance',
  intensity: 'moderate',
  base_duration_min: 60,
  base_tss: 50,
  segments: [],
  ...overrides,
})

const createPlacement = (
  workoutKey: string,
  workout: Partial<WorkoutLibraryItem> = {}
): WorkoutPlacement => ({
  id: `placement-${workoutKey}`,
  workoutKey,
  order: 0,
  workout: {
    name: workout.name || 'Test',
    type: workout.type || 'endurance',
    base_duration_min: workout.base_duration_min || 60,
    base_tss: workout.base_tss || 50,
  },
})

describe('calculateWorkoutTss', () => {
  it('returns base_tss from workout', () => {
    const workout = createWorkout({ base_tss: 67 })
    expect(calculateWorkoutTss(workout)).toBe(67)
  })

  it('handles zero TSS', () => {
    const workout = createWorkout({ base_tss: 0 })
    expect(calculateWorkoutTss(workout)).toBe(0)
  })

  it('calculates TSS for 1 hour at FTP (IF=1.0)', () => {
    // TSS = (60/60) × 1.0² × 100 = 100
    const workout = createWorkout({
      base_duration_min: 60,
      base_tss: 100, // FTP intensity for 1 hour
    })
    expect(calculateWorkoutTss(workout)).toBe(100)
  })

  it('returns TSS from placement if available', () => {
    const placement = createPlacement('test', { base_tss: 75 })
    expect(calculateWorkoutTss(placement)).toBe(75)
  })
})

describe('calculateDailyTss', () => {
  it('returns 0 for empty placements', () => {
    expect(calculateDailyTss([])).toBe(0)
  })

  it('returns TSS for single workout', () => {
    const placements = [createPlacement('w1', { base_tss: 50 })]
    expect(calculateDailyTss(placements)).toBe(50)
  })

  it('sums TSS for multiple workouts', () => {
    const placements = [
      createPlacement('w1', { base_tss: 50 }),
      createPlacement('w2', { base_tss: 30 }),
    ]
    expect(calculateDailyTss(placements)).toBe(80)
  })

  it('handles undefined workout in placement', () => {
    const placements: WorkoutPlacement[] = [
      { id: 'p1', workoutKey: 'w1', order: 0 }, // No workout data
    ]
    expect(calculateDailyTss(placements)).toBe(0)
  })
})

describe('calculateWeeklyTss', () => {
  const createEmptyWeek = (): WorkoutsData => ({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  })

  it('returns 0 for empty week', () => {
    expect(calculateWeeklyTss(createEmptyWeek())).toBe(0)
  })

  it('sums TSS across all days', () => {
    const week: WorkoutsData = {
      ...createEmptyWeek(),
      monday: [createPlacement('w1', { base_tss: 50 })],
      wednesday: [createPlacement('w2', { base_tss: 60 })],
      saturday: [createPlacement('w3', { base_tss: 100 })],
    }
    expect(calculateWeeklyTss(week)).toBe(210)
  })

  it('handles multiple workouts per day', () => {
    const week: WorkoutsData = {
      ...createEmptyWeek(),
      monday: [
        createPlacement('w1', { base_tss: 50 }),
        createPlacement('w2', { base_tss: 25 }), // Double day
      ],
    }
    expect(calculateWeeklyTss(week)).toBe(75)
  })

  it('calculates typical week TSS', () => {
    // Typical base training week
    const week: WorkoutsData = {
      monday: [createPlacement('endurance', { base_tss: 60 })],
      tuesday: [createPlacement('tempo', { base_tss: 70 })],
      wednesday: [createPlacement('recovery', { base_tss: 30 })],
      thursday: [createPlacement('threshold', { base_tss: 80 })],
      friday: [], // Rest
      saturday: [createPlacement('long-ride', { base_tss: 150 })],
      sunday: [createPlacement('endurance', { base_tss: 60 })],
    }

    expect(calculateWeeklyTss(week)).toBe(450)
  })
})

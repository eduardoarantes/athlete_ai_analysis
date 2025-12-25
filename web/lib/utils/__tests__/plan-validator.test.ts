/**
 * Plan Validator Tests
 *
 * Tests for validating custom training plans.
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import { describe, it, expect } from 'vitest'
import { validateWeek, validatePlan, validateProgressiveOverload } from '../plan-validator'
import type {
  WeekState,
  PlanBuilderState,
  WorkoutsData,
  WorkoutPlacement,
} from '@/lib/types/plan-builder'

// Test fixtures
const createEmptyWorkoutsData = (): WorkoutsData => ({
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
})

const createPlacement = (id: string, tss: number = 50): WorkoutPlacement => ({
  id,
  workoutKey: `workout-${id}`,
  order: 0,
  workout: {
    name: 'Test Workout',
    type: 'endurance',
    base_duration_min: 60,
    base_tss: tss,
  },
})

const createWeekState = (overrides: Partial<WeekState> = {}): WeekState => ({
  id: 'week-1',
  weekNumber: 1,
  phase: 'Base',
  workouts: createEmptyWorkoutsData(),
  weeklyTss: 0,
  ...overrides,
})

const createValidWeek = (): WeekState => {
  const workouts = createEmptyWorkoutsData()
  workouts.monday = [createPlacement('m1', 60)]
  workouts.wednesday = [createPlacement('w1', 70)]
  workouts.saturday = [createPlacement('s1', 120)]

  return createWeekState({
    workouts,
    weeklyTss: 250,
  })
}

describe('validateWeek', () => {
  it('returns error if week has no workouts', () => {
    const week = createWeekState()
    const result = validateWeek(week)

    expect(result.errors).toContain('Week 1 has no workouts scheduled')
    expect(result.isValid).toBe(false)
  })

  it('returns warning if no rest days', () => {
    const workouts = createEmptyWorkoutsData()
    workouts.monday = [createPlacement('m1')]
    workouts.tuesday = [createPlacement('t1')]
    workouts.wednesday = [createPlacement('w1')]
    workouts.thursday = [createPlacement('th1')]
    workouts.friday = [createPlacement('f1')]
    workouts.saturday = [createPlacement('sa1')]
    workouts.sunday = [createPlacement('su1')]

    const week = createWeekState({ workouts, weeklyTss: 350 })
    const result = validateWeek(week)

    expect(result.warnings).toContain('Week 1 has no rest days')
    expect(result.isValid).toBe(true) // Warnings don't make it invalid
  })

  it('returns warning if weekly TSS > 800', () => {
    const workouts = createEmptyWorkoutsData()
    workouts.monday = [createPlacement('m1', 200)]
    workouts.wednesday = [createPlacement('w1', 200)]
    workouts.friday = [createPlacement('f1', 200)]
    workouts.saturday = [createPlacement('sa1', 250)]

    const week = createWeekState({ workouts, weeklyTss: 850 })
    const result = validateWeek(week)

    expect(result.warnings.some((w) => w.includes('very high'))).toBe(true)
  })

  it('passes valid week with rest days', () => {
    const week = createValidWeek()
    const result = validateWeek(week)

    expect(result.errors).toHaveLength(0)
    expect(result.isValid).toBe(true)
  })

  it('validates recovery week has lower TSS', () => {
    const workouts = createEmptyWorkoutsData()
    workouts.monday = [createPlacement('m1', 150)]
    workouts.wednesday = [createPlacement('w1', 180)]
    workouts.saturday = [createPlacement('sa1', 200)]

    const week = createWeekState({
      phase: 'Recovery',
      workouts,
      weeklyTss: 530,
    })
    const result = validateWeek(week)

    expect(result.warnings.some((w) => w.includes('Recovery week'))).toBe(true)
  })
})

describe('validatePlan', () => {
  it('returns error if plan has no weeks', () => {
    const state: Partial<PlanBuilderState> = {
      metadata: { name: 'Test Plan' },
      weeks: [],
    }

    const result = validatePlan(state as PlanBuilderState)

    expect(result.errors).toContain('Plan has no weeks')
    expect(result.isValid).toBe(false)
  })

  it('returns error if plan has no name', () => {
    const state: Partial<PlanBuilderState> = {
      metadata: { name: '' },
      weeks: [createValidWeek()],
    }

    const result = validatePlan(state as PlanBuilderState)

    expect(result.errors).toContain('Plan name is required')
    expect(result.isValid).toBe(false)
  })

  it('aggregates week validation errors', () => {
    const state: Partial<PlanBuilderState> = {
      metadata: { name: 'Test Plan' },
      weeks: [createWeekState(), createWeekState({ weekNumber: 2 })],
    }

    const result = validatePlan(state as PlanBuilderState)

    // Both weeks have no workouts
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('passes valid plan', () => {
    const state: Partial<PlanBuilderState> = {
      metadata: { name: 'Test Plan' },
      weeks: [createValidWeek()],
    }

    const result = validatePlan(state as PlanBuilderState)

    expect(result.errors).toHaveLength(0)
    expect(result.isValid).toBe(true)
  })
})

describe('validateProgressiveOverload', () => {
  it('returns empty for single week', () => {
    const result = validateProgressiveOverload([{ weeklyTss: 300, phase: 'Base' }])

    expect(result.warnings).toHaveLength(0)
  })

  it('warns on > 15% TSS increase', () => {
    const weeks = [
      { weeklyTss: 300, phase: 'Build' as const },
      { weeklyTss: 360, phase: 'Build' as const }, // 20% increase
    ]

    const result = validateProgressiveOverload(weeks)

    expect(result.warnings.some((w) => w.includes('increase'))).toBe(true)
  })

  it('allows recovery week decrease', () => {
    const weeks = [
      { weeklyTss: 400, phase: 'Build' as const },
      { weeklyTss: 200, phase: 'Recovery' as const }, // 50% decrease is OK for recovery
    ]

    const result = validateProgressiveOverload(weeks)

    expect(result.warnings).toHaveLength(0)
  })

  it('allows taper week decrease', () => {
    const weeks = [
      { weeklyTss: 500, phase: 'Peak' as const },
      { weeklyTss: 250, phase: 'Taper' as const },
    ]

    const result = validateProgressiveOverload(weeks)

    expect(result.warnings).toHaveLength(0)
  })

  it('validates multiple weeks', () => {
    const weeks = [
      { weeklyTss: 300, phase: 'Base' as const },
      { weeklyTss: 320, phase: 'Base' as const }, // 7% OK
      { weeklyTss: 340, phase: 'Build' as const }, // 6% OK
      { weeklyTss: 420, phase: 'Build' as const }, // 23% TOO MUCH
    ]

    const result = validateProgressiveOverload(weeks)

    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toContain('Week 4')
  })
})

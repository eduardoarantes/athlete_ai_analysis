/**
 * Plan Builder Reducer Tests
 *
 * Tests for the plan builder state management with undo/redo support.
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { planBuilderReducer, canUndo, canRedo } from '../plan-builder-reducer'
import type {
  PlanBuilderState,
  PlanBuilderAction,
  WeekState,
  WorkoutsData,
} from '@/lib/types/plan-builder'
import { createInitialPlanBuilderState, createEmptyWorkoutsData } from '@/lib/types/plan-builder'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 9)),
})

// Test fixtures
const createMockWorkout = (overrides: Partial<WorkoutLibraryItem> = {}): WorkoutLibraryItem => ({
  id: 'workout-1',
  name: 'Test Workout',
  type: 'endurance',
  intensity: 'moderate',
  base_duration_min: 60,
  base_tss: 50,
  segments: [],
  ...overrides,
})

const createMockWeek = (weekNumber: number, overrides: Partial<WeekState> = {}): WeekState => ({
  id: `week-${weekNumber}`,
  weekNumber,
  phase: 'Base',
  workouts: createEmptyWorkoutsData(),
  weeklyTss: 0,
  ...overrides,
})

describe('planBuilderReducer', () => {
  let initialState: PlanBuilderState

  beforeEach(() => {
    initialState = createInitialPlanBuilderState()
  })

  describe('INIT_PLAN', () => {
    it('initializes plan with provided data', () => {
      const action: PlanBuilderAction = {
        type: 'INIT_PLAN',
        payload: {
          planId: 'plan-123',
          metadata: { name: 'My Plan' },
          weeks: [createMockWeek(1)],
        },
      }

      const newState = planBuilderReducer(initialState, action)

      expect(newState.planId).toBe('plan-123')
      expect(newState.metadata.name).toBe('My Plan')
      expect(newState.weeks).toHaveLength(1)
      expect(newState.isDirty).toBe(false)
    })

    it('clears history on init', () => {
      const stateWithHistory: PlanBuilderState = {
        ...initialState,
        history: [{ state: '{}', actionDescription: 'test', timestamp: 0 }],
        historyIndex: 0,
      }

      const action: PlanBuilderAction = {
        type: 'INIT_PLAN',
        payload: { metadata: { name: 'New Plan' } },
      }

      const newState = planBuilderReducer(stateWithHistory, action)

      expect(newState.history).toHaveLength(0)
      expect(newState.historyIndex).toBe(-1)
    })
  })

  describe('UPDATE_METADATA', () => {
    it('updates plan name', () => {
      const action: PlanBuilderAction = {
        type: 'UPDATE_METADATA',
        payload: { name: 'Updated Plan Name' },
      }

      const newState = planBuilderReducer(initialState, action)

      expect(newState.metadata.name).toBe('Updated Plan Name')
      expect(newState.isDirty).toBe(true)
    })

    it('preserves existing metadata fields', () => {
      const stateWithMetadata: PlanBuilderState = {
        ...initialState,
        metadata: { name: 'Original', description: 'Desc', targetFtp: 250 },
      }

      const action: PlanBuilderAction = {
        type: 'UPDATE_METADATA',
        payload: { name: 'Updated' },
      }

      const newState = planBuilderReducer(stateWithMetadata, action)

      expect(newState.metadata.name).toBe('Updated')
      expect(newState.metadata.description).toBe('Desc')
      expect(newState.metadata.targetFtp).toBe(250)
    })
  })

  describe('ADD_WEEK', () => {
    it('adds a new week to empty plan', () => {
      const action: PlanBuilderAction = {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      }

      const newState = planBuilderReducer(initialState, action)

      expect(newState.weeks).toHaveLength(1)
      expect(newState.weeks[0]!.weekNumber).toBe(1)
      expect(newState.weeks[0]!.phase).toBe('Base')
      expect(newState.isDirty).toBe(true)
    })

    it('adds week with correct week number', () => {
      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1), createMockWeek(2)],
      }

      const action: PlanBuilderAction = {
        type: 'ADD_WEEK',
        payload: { phase: 'Build' },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks).toHaveLength(3)
      expect(newState.weeks[2]!.weekNumber).toBe(3)
      expect(newState.weeks[2]!.phase).toBe('Build')
    })

    it('pushes to history', () => {
      const action: PlanBuilderAction = {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      }

      const newState = planBuilderReducer(initialState, action)

      expect(newState.history).toHaveLength(1)
      expect(newState.historyIndex).toBe(0)
    })
  })

  describe('REMOVE_WEEK', () => {
    it('removes week and renumbers remaining weeks', () => {
      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1), createMockWeek(2), createMockWeek(3)],
      }

      const action: PlanBuilderAction = {
        type: 'REMOVE_WEEK',
        payload: { weekNumber: 2 },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks).toHaveLength(2)
      expect(newState.weeks[0]!.weekNumber).toBe(1)
      expect(newState.weeks[1]!.weekNumber).toBe(2) // Renumbered from 3
    })

    it('does nothing if week not found', () => {
      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1)],
      }

      const action: PlanBuilderAction = {
        type: 'REMOVE_WEEK',
        payload: { weekNumber: 99 },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks).toHaveLength(1)
    })
  })

  describe('UPDATE_WEEK_PHASE', () => {
    it('updates week phase', () => {
      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1, { phase: 'Base' })],
      }

      const action: PlanBuilderAction = {
        type: 'UPDATE_WEEK_PHASE',
        payload: { weekNumber: 1, phase: 'Build' },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.phase).toBe('Build')
    })
  })

  describe('UPDATE_WEEK_NOTES', () => {
    it('updates week notes', () => {
      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1)],
      }

      const action: PlanBuilderAction = {
        type: 'UPDATE_WEEK_NOTES',
        payload: { weekNumber: 1, notes: 'Focus on zone 2' },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.notes).toBe('Focus on zone 2')
    })
  })

  describe('COPY_WEEK', () => {
    it('copies workouts from source to target week', () => {
      const sourceWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          {
            id: 'placement-1',
            workoutKey: 'w1',
            order: 0,
            workout: { name: 'Endurance', type: 'endurance', base_duration_min: 60, base_tss: 50 },
          },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [
          createMockWeek(1, { workouts: sourceWorkouts, weeklyTss: 50 }),
          createMockWeek(2),
        ],
      }

      const action: PlanBuilderAction = {
        type: 'COPY_WEEK',
        payload: { sourceWeekNumber: 1, targetWeekNumber: 2 },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[1]!.workouts.monday).toHaveLength(1)
      // IDs should be different (new placements)
      expect(newState.weeks[1]!.workouts.monday[0]!.id).not.toBe('placement-1')
    })
  })

  describe('ADD_WORKOUT', () => {
    it('adds workout to specified day', () => {
      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1)],
      }

      const workout = createMockWorkout({ base_tss: 60 })
      const action: PlanBuilderAction = {
        type: 'ADD_WORKOUT',
        payload: { weekNumber: 1, day: 'monday', workout },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.workouts.monday).toHaveLength(1)
      expect(newState.weeks[0]!.workouts.monday[0]!.workout?.base_tss).toBe(60)
      expect(newState.weeks[0]!.weeklyTss).toBe(60)
    })

    it('adds workout with correct order', () => {
      const existingWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          {
            id: 'existing-1',
            workoutKey: 'w1',
            order: 0,
            workout: { name: 'W1', type: 'endurance', base_duration_min: 30, base_tss: 25 },
          },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1, { workouts: existingWorkouts })],
      }

      const workout = createMockWorkout()
      const action: PlanBuilderAction = {
        type: 'ADD_WORKOUT',
        payload: { weekNumber: 1, day: 'monday', workout },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.workouts.monday).toHaveLength(2)
      expect(newState.weeks[0]!.workouts.monday[1]!.order).toBe(1)
    })
  })

  describe('REMOVE_WORKOUT', () => {
    it('removes workout from specified day', () => {
      const existingWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          {
            id: 'placement-1',
            workoutKey: 'w1',
            order: 0,
            workout: { name: 'W1', type: 'endurance', base_duration_min: 60, base_tss: 50 },
          },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1, { workouts: existingWorkouts, weeklyTss: 50 })],
      }

      const action: PlanBuilderAction = {
        type: 'REMOVE_WORKOUT',
        payload: { weekNumber: 1, day: 'monday', placementId: 'placement-1' },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.workouts.monday).toHaveLength(0)
      expect(newState.weeks[0]!.weeklyTss).toBe(0)
    })

    it('reorders remaining workouts', () => {
      const existingWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          { id: 'p1', workoutKey: 'w1', order: 0, workout: { name: 'W1', type: 'endurance', base_duration_min: 60, base_tss: 50 } },
          { id: 'p2', workoutKey: 'w2', order: 1, workout: { name: 'W2', type: 'tempo', base_duration_min: 60, base_tss: 60 } },
          { id: 'p3', workoutKey: 'w3', order: 2, workout: { name: 'W3', type: 'threshold', base_duration_min: 60, base_tss: 70 } },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1, { workouts: existingWorkouts })],
      }

      const action: PlanBuilderAction = {
        type: 'REMOVE_WORKOUT',
        payload: { weekNumber: 1, day: 'monday', placementId: 'p2' },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.workouts.monday).toHaveLength(2)
      expect(newState.weeks[0]!.workouts.monday[0]!.order).toBe(0)
      expect(newState.weeks[0]!.workouts.monday[1]!.order).toBe(1)
    })
  })

  describe('MOVE_WORKOUT', () => {
    it('moves workout between days', () => {
      const existingWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          {
            id: 'p1',
            workoutKey: 'w1',
            order: 0,
            workout: { name: 'W1', type: 'endurance', base_duration_min: 60, base_tss: 50 },
          },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1, { workouts: existingWorkouts, weeklyTss: 50 })],
      }

      const action: PlanBuilderAction = {
        type: 'MOVE_WORKOUT',
        payload: {
          sourceWeek: 1,
          sourceDay: 'monday',
          targetWeek: 1,
          targetDay: 'wednesday',
          placementId: 'p1',
          newOrder: 0,
        },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.workouts.monday).toHaveLength(0)
      expect(newState.weeks[0]!.workouts.wednesday).toHaveLength(1)
      expect(newState.weeks[0]!.workouts.wednesday[0]!.id).toBe('p1')
    })

    it('moves workout between weeks', () => {
      const existingWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          {
            id: 'p1',
            workoutKey: 'w1',
            order: 0,
            workout: { name: 'W1', type: 'endurance', base_duration_min: 60, base_tss: 50 },
          },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [
          createMockWeek(1, { workouts: existingWorkouts, weeklyTss: 50 }),
          createMockWeek(2),
        ],
      }

      const action: PlanBuilderAction = {
        type: 'MOVE_WORKOUT',
        payload: {
          sourceWeek: 1,
          sourceDay: 'monday',
          targetWeek: 2,
          targetDay: 'tuesday',
          placementId: 'p1',
          newOrder: 0,
        },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      expect(newState.weeks[0]!.workouts.monday).toHaveLength(0)
      expect(newState.weeks[0]!.weeklyTss).toBe(0)
      expect(newState.weeks[1]!.workouts.tuesday).toHaveLength(1)
      expect(newState.weeks[1]!.weeklyTss).toBe(50)
    })
  })

  describe('REORDER_WORKOUTS', () => {
    it('reorders workouts within a day', () => {
      const existingWorkouts: WorkoutsData = {
        ...createEmptyWorkoutsData(),
        monday: [
          { id: 'p1', workoutKey: 'w1', order: 0, workout: { name: 'W1', type: 'endurance', base_duration_min: 60, base_tss: 50 } },
          { id: 'p2', workoutKey: 'w2', order: 1, workout: { name: 'W2', type: 'tempo', base_duration_min: 60, base_tss: 60 } },
          { id: 'p3', workoutKey: 'w3', order: 2, workout: { name: 'W3', type: 'threshold', base_duration_min: 60, base_tss: 70 } },
        ],
      }

      const stateWithWeeks: PlanBuilderState = {
        ...initialState,
        weeks: [createMockWeek(1, { workouts: existingWorkouts })],
      }

      const action: PlanBuilderAction = {
        type: 'REORDER_WORKOUTS',
        payload: {
          weekNumber: 1,
          day: 'monday',
          placementIds: ['p3', 'p1', 'p2'], // New order
        },
      }

      const newState = planBuilderReducer(stateWithWeeks, action)

      const mondayWorkouts = newState.weeks[0]!.workouts.monday
      expect(mondayWorkouts[0]!.id).toBe('p3')
      expect(mondayWorkouts[0]!.order).toBe(0)
      expect(mondayWorkouts[1]!.id).toBe('p1')
      expect(mondayWorkouts[1]!.order).toBe(1)
      expect(mondayWorkouts[2]!.id).toBe('p2')
      expect(mondayWorkouts[2]!.order).toBe(2)
    })
  })

  describe('UNDO / REDO', () => {
    it('undoes the last action', () => {
      // Start with initial state
      let state = initialState

      // Add a week
      state = planBuilderReducer(state, {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      })

      expect(state.weeks).toHaveLength(1)

      // Undo
      state = planBuilderReducer(state, { type: 'UNDO' })

      expect(state.weeks).toHaveLength(0)
    })

    it('redoes an undone action', () => {
      let state = initialState

      // Add a week
      state = planBuilderReducer(state, {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      })

      // Undo
      state = planBuilderReducer(state, { type: 'UNDO' })
      expect(state.weeks).toHaveLength(0)

      // Redo
      state = planBuilderReducer(state, { type: 'REDO' })
      expect(state.weeks).toHaveLength(1)
    })

    it('clears redo stack on new action', () => {
      let state = initialState

      // Add week 1
      state = planBuilderReducer(state, {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      })

      // Undo
      state = planBuilderReducer(state, { type: 'UNDO' })

      // Add week 2 (should clear redo)
      state = planBuilderReducer(state, {
        type: 'ADD_WEEK',
        payload: { phase: 'Build' },
      })

      // Redo should do nothing
      const stateAfterRedo = planBuilderReducer(state, { type: 'REDO' })
      expect(stateAfterRedo.weeks).toHaveLength(1)
      expect(stateAfterRedo.weeks[0]!.phase).toBe('Build')
    })

    it('limits history size', () => {
      let state: PlanBuilderState = {
        ...initialState,
        maxHistorySize: 3,
      }

      // Add 5 actions
      for (let i = 0; i < 5; i++) {
        state = planBuilderReducer(state, {
          type: 'ADD_WEEK',
          payload: { phase: 'Base' },
        })
      }

      // Should only have 3 history entries
      expect(state.history.length).toBe(3)
    })
  })

  describe('canUndo / canRedo', () => {
    it('returns false for empty history', () => {
      expect(canUndo(initialState)).toBe(false)
      expect(canRedo(initialState)).toBe(false)
    })

    it('returns true when undo is available', () => {
      const state = planBuilderReducer(initialState, {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      })

      expect(canUndo(state)).toBe(true)
      expect(canRedo(state)).toBe(false)
    })

    it('returns true when redo is available', () => {
      let state = planBuilderReducer(initialState, {
        type: 'ADD_WEEK',
        payload: { phase: 'Base' },
      })

      state = planBuilderReducer(state, { type: 'UNDO' })

      expect(canUndo(state)).toBe(false)
      expect(canRedo(state)).toBe(true)
    })
  })

  describe('MARK_SAVING / MARK_SAVED / SAVE_ERROR', () => {
    it('sets saving state', () => {
      const state = planBuilderReducer(initialState, { type: 'MARK_SAVING' })

      expect(state.isSaving).toBe(true)
    })

    it('marks as saved with plan ID', () => {
      const savingState: PlanBuilderState = {
        ...initialState,
        isDirty: true,
        isSaving: true,
      }

      const state = planBuilderReducer(savingState, {
        type: 'MARK_SAVED',
        payload: { planId: 'plan-123' },
      })

      expect(state.isSaving).toBe(false)
      expect(state.isDirty).toBe(false)
      expect(state.planId).toBe('plan-123')
      expect(state.lastSavedAt).not.toBeNull()
      expect(state.saveError).toBeNull()
    })

    it('sets save error', () => {
      const savingState: PlanBuilderState = {
        ...initialState,
        isSaving: true,
      }

      const state = planBuilderReducer(savingState, {
        type: 'SAVE_ERROR',
        payload: { error: 'Network error' },
      })

      expect(state.isSaving).toBe(false)
      expect(state.saveError).toBe('Network error')
    })
  })

  describe('VALIDATE / CLEAR_VALIDATION', () => {
    it('sets validation results', () => {
      const state = planBuilderReducer(initialState, {
        type: 'VALIDATE',
        payload: {
          errors: ['Plan name is required'],
          warnings: ['Week 1 has no rest days'],
        },
      })

      expect(state.validationErrors).toEqual(['Plan name is required'])
      expect(state.validationWarnings).toEqual(['Week 1 has no rest days'])
    })

    it('clears validation', () => {
      const stateWithValidation: PlanBuilderState = {
        ...initialState,
        validationErrors: ['Error'],
        validationWarnings: ['Warning'],
      }

      const state = planBuilderReducer(stateWithValidation, { type: 'CLEAR_VALIDATION' })

      expect(state.validationErrors).toHaveLength(0)
      expect(state.validationWarnings).toHaveLength(0)
    })
  })
})

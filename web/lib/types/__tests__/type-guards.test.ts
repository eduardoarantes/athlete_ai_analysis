/**
 * Unit tests for type guard functions
 * Comprehensive coverage of all type guards with edge cases
 */

import { describe, test, expect } from 'vitest'
import type { Workout } from '../training-plan'
import type { ManualWorkout, CreateManualWorkoutInput } from '../manual-workout'
import {
  isWorkout,
  isManualWorkout,
  isCreateManualWorkoutInput,
  asManualWorkout,
  asManualWorkouts,
  assertManualWorkout,
} from '../type-guards'

describe('Manual Workout Type Guards', () => {
  // ========================================================================
  // isWorkout Tests
  // ========================================================================

  describe('isWorkout', () => {
    test('returns true for minimal valid workout (only required fields)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test Workout',
      }
      expect(isWorkout(workout)).toBe(true)
    })

    test('returns true for complete valid workout with all optional fields', () => {
      const workout: Workout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        weekday: 'tuesday',
        scheduled_date: '2026-01-15',
        name: 'Threshold Intervals',
        description: 'Short description',
        detailed_description: 'Detailed description',
        type: 'threshold',
        tss: 75,
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [],
        },
        source: 'library',
        library_workout_id: 'abc123',
      }
      expect(isWorkout(workout)).toBe(true)
    })

    test('returns true for workout with library source', () => {
      const workout = {
        weekday: 'wednesday',
        name: 'Library Workout',
        source: 'library',
        library_workout_id: 'lib_123',
      }
      expect(isWorkout(workout)).toBe(true)
    })

    test('returns true for workout with llm source', () => {
      const workout = {
        weekday: 'thursday',
        name: 'AI Generated',
        source: 'llm',
      }
      expect(isWorkout(workout)).toBe(true)
    })

    test('returns false for missing weekday', () => {
      const workout = {
        name: 'Test Workout',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for missing name', () => {
      const workout = {
        weekday: 'friday',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for both required fields missing', () => {
      const workout = {
        type: 'endurance',
        tss: 50,
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong weekday type (number instead of string)', () => {
      const workout = {
        weekday: 123,
        name: 'Test Workout',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong name type (number instead of string)', () => {
      const workout = {
        weekday: 'monday',
        name: 123,
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong id type (number instead of string)', () => {
      const workout = {
        id: 123,
        weekday: 'monday',
        name: 'Test',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong scheduled_date type (number instead of string)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        scheduled_date: 20260115,
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong description type (array instead of string)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        description: ['not a string'],
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong detailed_description type', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        detailed_description: { invalid: 'type' },
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong type type (number instead of string)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        type: 123,
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong tss type (string instead of number)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        tss: '75',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong structure type (string instead of object)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        structure: 'not an object',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong source type (not library or llm)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        source: 'invalid_source',
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for wrong library_workout_id type (number instead of string)', () => {
      const workout = {
        weekday: 'monday',
        name: 'Test',
        library_workout_id: 123,
      }
      expect(isWorkout(workout)).toBe(false)
    })

    test('returns false for null value', () => {
      expect(isWorkout(null)).toBe(false)
    })

    test('returns false for undefined value', () => {
      expect(isWorkout(undefined)).toBe(false)
    })

    test('returns false for array', () => {
      expect(isWorkout([])).toBe(false)
    })

    test('returns false for primitive string', () => {
      expect(isWorkout('not an object')).toBe(false)
    })

    test('returns false for primitive number', () => {
      expect(isWorkout(123)).toBe(false)
    })
  })

  // ========================================================================
  // isManualWorkout Tests
  // ========================================================================

  describe('isManualWorkout', () => {
    test('returns true for valid manual workout', () => {
      const manualWorkout: ManualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test Workout',
        },
        source_plan_instance_id: null,
        created_at: '2026-01-14T10:00:00Z',
        updated_at: '2026-01-14T10:00:00Z',
      }
      expect(isManualWorkout(manualWorkout)).toBe(true)
    })

    test('returns true for manual workout with source_plan_instance_id', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'tuesday',
          name: 'Test Workout',
        },
        source_plan_instance_id: 'plan_123',
        created_at: '2026-01-14T10:00:00Z',
        updated_at: '2026-01-14T10:00:00Z',
      }
      expect(isManualWorkout(manualWorkout)).toBe(true)
    })

    test('returns true for manual workout with null timestamps', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'wednesday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(true)
    })

    test('returns false for missing id', () => {
      const manualWorkout = {
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for missing user_id', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for missing scheduled_date', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for missing workout_data', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for invalid workout_data (not a Workout)', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          invalid: 'data',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for wrong id type (number)', () => {
      const manualWorkout = {
        id: 123,
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for wrong source_plan_instance_id type (number)', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: 123,
        created_at: null,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for wrong created_at type (number)', () => {
      const manualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: 123,
        updated_at: null,
      }
      expect(isManualWorkout(manualWorkout)).toBe(false)
    })

    test('returns false for null', () => {
      expect(isManualWorkout(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isManualWorkout(undefined)).toBe(false)
    })

    test('returns false for array', () => {
      expect(isManualWorkout([])).toBe(false)
    })
  })

  // ========================================================================
  // isCreateManualWorkoutInput Tests
  // ========================================================================

  describe('isCreateManualWorkoutInput', () => {
    test('returns true for minimal valid input', () => {
      const input: CreateManualWorkoutInput = {
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test Workout',
        },
      }
      expect(isCreateManualWorkoutInput(input)).toBe(true)
    })

    test('returns true for input with source_plan_instance_id', () => {
      const input = {
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'tuesday',
          name: 'Test',
        },
        source_plan_instance_id: 'plan_123',
      }
      expect(isCreateManualWorkoutInput(input)).toBe(true)
    })

    test('returns true for input with null source_plan_instance_id', () => {
      const input = {
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'wednesday',
          name: 'Test',
        },
        source_plan_instance_id: null,
      }
      expect(isCreateManualWorkoutInput(input)).toBe(true)
    })

    test('returns true for input with undefined source_plan_instance_id', () => {
      const input = {
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'thursday',
          name: 'Test',
        },
        source_plan_instance_id: undefined,
      }
      expect(isCreateManualWorkoutInput(input)).toBe(true)
    })

    test('returns false for missing scheduled_date', () => {
      const input = {
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
      }
      expect(isCreateManualWorkoutInput(input)).toBe(false)
    })

    test('returns false for missing workout_data', () => {
      const input = {
        scheduled_date: '2026-01-15',
      }
      expect(isCreateManualWorkoutInput(input)).toBe(false)
    })

    test('returns false for invalid workout_data', () => {
      const input = {
        scheduled_date: '2026-01-15',
        workout_data: {
          invalid: 'data',
        },
      }
      expect(isCreateManualWorkoutInput(input)).toBe(false)
    })

    test('returns false for wrong scheduled_date type', () => {
      const input = {
        scheduled_date: 20260115,
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
      }
      expect(isCreateManualWorkoutInput(input)).toBe(false)
    })

    test('returns false for wrong source_plan_instance_id type', () => {
      const input = {
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: 123,
      }
      expect(isCreateManualWorkoutInput(input)).toBe(false)
    })

    test('returns false for null', () => {
      expect(isCreateManualWorkoutInput(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isCreateManualWorkoutInput(undefined)).toBe(false)
    })
  })

  // ========================================================================
  // asManualWorkout Tests
  // ========================================================================

  describe('asManualWorkout', () => {
    test('returns ManualWorkout for valid data', () => {
      const valid: ManualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      const result = asManualWorkout(valid)
      expect(result).toEqual(valid)
    })

    test('returns null for invalid data', () => {
      const invalid = {
        id: '123',
        // missing required fields
      }
      expect(asManualWorkout(invalid)).toBeNull()
    })

    test('returns null for null', () => {
      expect(asManualWorkout(null)).toBeNull()
    })

    test('returns null for undefined', () => {
      expect(asManualWorkout(undefined)).toBeNull()
    })
  })

  // ========================================================================
  // asManualWorkouts Tests
  // ========================================================================

  describe('asManualWorkouts', () => {
    test('returns array of ManualWorkouts for valid data', () => {
      const valid: ManualWorkout[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '987e6543-e21b-12d3-a456-426614174000',
          scheduled_date: '2026-01-15',
          workout_data: {
            weekday: 'monday',
            name: 'Test 1',
          },
          source_plan_instance_id: null,
          created_at: null,
          updated_at: null,
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174000',
          user_id: '987e6543-e21b-12d3-a456-426614174000',
          scheduled_date: '2026-01-16',
          workout_data: {
            weekday: 'tuesday',
            name: 'Test 2',
          },
          source_plan_instance_id: null,
          created_at: null,
          updated_at: null,
        },
      ]
      const result = asManualWorkouts(valid)
      expect(result).toEqual(valid)
      expect(result).toHaveLength(2)
    })

    test('filters out invalid entries from array', () => {
      const mixed = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '987e6543-e21b-12d3-a456-426614174000',
          scheduled_date: '2026-01-15',
          workout_data: {
            weekday: 'monday',
            name: 'Valid',
          },
          source_plan_instance_id: null,
          created_at: null,
          updated_at: null,
        },
        {
          // Invalid - missing required fields
          id: '223',
        },
        {
          id: '323e4567-e89b-12d3-a456-426614174000',
          user_id: '987e6543-e21b-12d3-a456-426614174000',
          scheduled_date: '2026-01-17',
          workout_data: {
            weekday: 'wednesday',
            name: 'Also Valid',
          },
          source_plan_instance_id: null,
          created_at: null,
          updated_at: null,
        },
      ]
      const result = asManualWorkouts(mixed)
      expect(result).toHaveLength(2)
      expect(result[0]?.workout_data.name).toBe('Valid')
      expect(result[1]?.workout_data.name).toBe('Also Valid')
    })

    test('returns empty array for non-array input', () => {
      expect(asManualWorkouts(null)).toEqual([])
      expect(asManualWorkouts(undefined)).toEqual([])
      expect(asManualWorkouts('not an array')).toEqual([])
      expect(asManualWorkouts(123)).toEqual([])
    })

    test('returns empty array for array with all invalid entries', () => {
      const invalid = [{ invalid: 'data' }, { also: 'invalid' }]
      expect(asManualWorkouts(invalid)).toEqual([])
    })

    test('returns empty array for empty array', () => {
      expect(asManualWorkouts([])).toEqual([])
    })
  })

  // ========================================================================
  // assertManualWorkout Tests
  // ========================================================================

  describe('assertManualWorkout', () => {
    test('returns ManualWorkout for valid data', () => {
      const valid: ManualWorkout = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        scheduled_date: '2026-01-15',
        workout_data: {
          weekday: 'monday',
          name: 'Test',
        },
        source_plan_instance_id: null,
        created_at: null,
        updated_at: null,
      }
      expect(assertManualWorkout(valid)).toEqual(valid)
    })

    test('throws error for invalid data', () => {
      const invalid = {
        id: '123',
        // missing required fields
      }
      expect(() => assertManualWorkout(invalid)).toThrow('Invalid ManualWorkout')
    })

    test('throws error with context for invalid data', () => {
      const invalid = { invalid: 'data' }
      expect(() => assertManualWorkout(invalid, 'API response')).toThrow(
        'Invalid ManualWorkout in API response'
      )
    })

    test('throws error for null', () => {
      expect(() => assertManualWorkout(null)).toThrow('Invalid ManualWorkout')
    })

    test('throws error for undefined', () => {
      expect(() => assertManualWorkout(undefined)).toThrow('Invalid ManualWorkout')
    })
  })
})

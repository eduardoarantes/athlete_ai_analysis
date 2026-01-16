/**
 * Manual Workout Service Tests
 * Comprehensive test coverage for manual workout CRUD operations
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { Workout } from '@/lib/types/training-plan'
import type {
  ManualWorkout,
  CreateManualWorkoutInput,
  UpdateManualWorkoutInput,
} from '@/lib/types/manual-workout'
import {
  createManualWorkout,
  getManualWorkout,
  getManualWorkoutsByDateRange,
  getUserManualWorkouts,
  updateManualWorkout,
  deleteManualWorkout,
  addLibraryWorkout,
} from '../manual-workout-service'

// Mock the errorLogger
vi.mock('@/lib/monitoring/error-logger', () => ({
  errorLogger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}))

// Mock the lambda client for library workout fetching
vi.mock('@/lib/services/lambda-client', () => ({
  invokePythonApi: vi.fn(),
}))

/**
 * Create a mock Supabase client with chainable methods
 */
function createMockSupabaseClient() {
  const mockClient = {
    from: vi.fn(),
  } as unknown as SupabaseClient<Database>

  return mockClient
}

/**
 * Create a sample workout for testing
 */
function createSampleWorkout(): Workout {
  return {
    id: 'workout-123',
    weekday: 'monday',
    scheduled_date: '2026-01-20',
    name: 'Threshold Intervals',
    detailed_description: 'Detailed description here',
    type: 'threshold',
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
              name: 'Warmup',
              intensityClass: 'warmUp',
              length: { unit: 'second', value: 600 },
              targets: [
                {
                  type: 'power',
                  minValue: 55,
                  maxValue: 55,
                  unit: 'percentOfFtp',
                },
              ],
            },
          ],
        },
      ],
    },
    source: 'library',
    library_workout_id: 'lib-workout-123',
  }
}

/**
 * Create a sample manual workout database row
 */
function createSampleManualWorkout() {
  const workoutData = createSampleWorkout()
  return {
    id: 'manual-123',
    user_id: 'user-456',
    scheduled_date: '2026-01-20',
    source_plan_instance_id: null,
    workout_data: workoutData,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  } satisfies ManualWorkout
}

describe('Manual Workout Service', () => {
  let mockSupabase: SupabaseClient<Database>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    vi.clearAllMocks()
  })

  // =========================================================================
  // createManualWorkout
  // =========================================================================

  describe('createManualWorkout', () => {
    test('creates manual workout successfully', async () => {
      const userId = 'user-456'
      const workoutData = createSampleWorkout()
      const input = {
        scheduled_date: '2026-01-20',
        workout_data: workoutData,
      } satisfies CreateManualWorkoutInput

      const expectedResult = createSampleManualWorkout()

      // Mock Supabase chain: insert().select().single()
      const mockSingle = vi.fn().mockResolvedValue({
        data: expectedResult,
        error: null,
      })
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      })

      const result = await createManualWorkout(mockSupabase, userId, input)

      expect(mockSupabase.from).toHaveBeenCalledWith('manual_workouts')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: userId,
        scheduled_date: input.scheduled_date,
        workout_data: input.workout_data,
      })
      expect(result).toEqual(expectedResult)
    })

    test('includes source_plan_instance_id when provided', async () => {
      const userId = 'user-456'
      const workoutData = createSampleWorkout()
      const input = {
        scheduled_date: '2026-01-20',
        workout_data: workoutData,
        source_plan_instance_id: 'plan-instance-789',
      } satisfies CreateManualWorkoutInput

      const expectedResult = {
        ...createSampleManualWorkout(),
        source_plan_instance_id: 'plan-instance-789',
      }

      const mockSingle = vi.fn().mockResolvedValue({
        data: expectedResult,
        error: null,
      })
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      })

      const result = await createManualWorkout(mockSupabase, userId, input)

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: userId,
        scheduled_date: input.scheduled_date,
        workout_data: input.workout_data,
        source_plan_instance_id: 'plan-instance-789',
      })
      expect(result.source_plan_instance_id).toBe('plan-instance-789')
    })

    test('throws error when database insert fails', async () => {
      const userId = 'user-456'
      const workoutData = createSampleWorkout()
      const input = {
        scheduled_date: '2026-01-20',
        workout_data: workoutData,
      } satisfies CreateManualWorkoutInput

      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })
      const mockSingle = vi.fn().mockReturnValue({ select: mockSelect })
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      })

      await expect(createManualWorkout(mockSupabase, userId, input)).rejects.toThrow(
        'Failed to create manual workout'
      )
    })

    test('throws error when response validation fails', async () => {
      const userId = 'user-456'
      const workoutData = createSampleWorkout()
      const input = {
        scheduled_date: '2026-01-20',
        workout_data: workoutData,
      } satisfies CreateManualWorkoutInput

      // Return invalid data (missing required fields)
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'manual-123' }, // Invalid: missing required fields
        error: null,
      })
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      })

      await expect(createManualWorkout(mockSupabase, userId, input)).rejects.toThrow(
        'Invalid ManualWorkout'
      )
    })
  })

  // =========================================================================
  // getManualWorkout
  // =========================================================================

  describe('getManualWorkout', () => {
    test('returns manual workout when found', async () => {
      const workoutId = 'manual-123'
      const expectedResult = createSampleManualWorkout()

      const mockSingle = vi.fn().mockResolvedValue({
        data: expectedResult,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getManualWorkout(mockSupabase, workoutId)

      expect(mockSupabase.from).toHaveBeenCalledWith('manual_workouts')
      expect(mockEq).toHaveBeenCalledWith('id', workoutId)
      expect(result).toEqual(expectedResult)
    })

    test('returns null when workout not found', async () => {
      const workoutId = 'nonexistent'

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      })
      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getManualWorkout(mockSupabase, workoutId)

      expect(result).toBeNull()
    })

    test('throws error on database error', async () => {
      const workoutId = 'manual-123'

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })
      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      await expect(getManualWorkout(mockSupabase, workoutId)).rejects.toThrow(
        'Failed to fetch manual workout'
      )
    })
  })

  // =========================================================================
  // getManualWorkoutsByDateRange
  // =========================================================================

  describe('getManualWorkoutsByDateRange', () => {
    test('returns workouts within date range', async () => {
      const userId = 'user-456'
      const startDate = '2026-01-15'
      const endDate = '2026-01-25'

      const expectedResults = [
        createSampleManualWorkout(),
        { ...createSampleManualWorkout(), id: 'manual-124', scheduled_date: '2026-01-22' },
      ]

      const mockOrder = vi.fn().mockResolvedValue({
        data: expectedResults,
        error: null,
      })
      const mockLte = vi.fn().mockReturnValue({ order: mockOrder })
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte })
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getManualWorkoutsByDateRange(mockSupabase, userId, startDate, endDate)

      expect(mockSupabase.from).toHaveBeenCalledWith('manual_workouts')
      expect(mockEq).toHaveBeenCalledWith('user_id', userId)
      expect(mockGte).toHaveBeenCalledWith('scheduled_date', startDate)
      expect(mockLte).toHaveBeenCalledWith('scheduled_date', endDate)
      expect(mockOrder).toHaveBeenCalledWith('scheduled_date', { ascending: true })
      expect(result).toEqual(expectedResults)
    })

    test('returns empty array when no workouts in range', async () => {
      const userId = 'user-456'
      const startDate = '2026-01-15'
      const endDate = '2026-01-25'

      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const mockLte = vi.fn().mockReturnValue({ order: mockOrder })
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte })
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getManualWorkoutsByDateRange(mockSupabase, userId, startDate, endDate)

      expect(result).toEqual([])
    })

    test('throws error on database error', async () => {
      const userId = 'user-456'
      const startDate = '2026-01-15'
      const endDate = '2026-01-25'

      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })
      const mockLte = vi.fn().mockReturnValue({ order: mockOrder })
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte })
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      await expect(
        getManualWorkoutsByDateRange(mockSupabase, userId, startDate, endDate)
      ).rejects.toThrow('Failed to fetch manual workouts by date range')
    })

    test('filters out invalid workout entries', async () => {
      const userId = 'user-456'
      const startDate = '2026-01-15'
      const endDate = '2026-01-25'

      const validWorkout = createSampleManualWorkout()
      const invalidWorkout = { id: 'invalid', user_id: userId } // Missing required fields

      const mockOrder = vi.fn().mockResolvedValue({
        data: [validWorkout, invalidWorkout],
        error: null,
      })
      const mockLte = vi.fn().mockReturnValue({ order: mockOrder })
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte })
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getManualWorkoutsByDateRange(mockSupabase, userId, startDate, endDate)

      // Should only return the valid workout
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('manual-123')
    })
  })

  // =========================================================================
  // getUserManualWorkouts
  // =========================================================================

  describe('getUserManualWorkouts', () => {
    test('returns all workouts for user', async () => {
      const userId = 'user-456'

      const expectedResults = [
        createSampleManualWorkout(),
        { ...createSampleManualWorkout(), id: 'manual-124', scheduled_date: '2026-01-25' },
        { ...createSampleManualWorkout(), id: 'manual-125', scheduled_date: '2026-02-01' },
      ]

      const mockOrder = vi.fn().mockResolvedValue({
        data: expectedResults,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getUserManualWorkouts(mockSupabase, userId)

      expect(mockSupabase.from).toHaveBeenCalledWith('manual_workouts')
      expect(mockEq).toHaveBeenCalledWith('user_id', userId)
      expect(mockOrder).toHaveBeenCalledWith('scheduled_date', { ascending: true })
      expect(result).toEqual(expectedResults)
    })

    test('returns empty array when user has no workouts', async () => {
      const userId = 'user-456'

      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      const result = await getUserManualWorkouts(mockSupabase, userId)

      expect(result).toEqual([])
    })

    test('throws error on database error', async () => {
      const userId = 'user-456'

      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      })

      await expect(getUserManualWorkouts(mockSupabase, userId)).rejects.toThrow(
        'Failed to fetch user manual workouts'
      )
    })
  })

  // =========================================================================
  // updateManualWorkout
  // =========================================================================

  describe('updateManualWorkout', () => {
    test('updates workout successfully with full workout_data', async () => {
      const workoutId = 'manual-123'
      const workoutData = createSampleWorkout()
      const input = {
        scheduled_date: '2026-01-22',
        workout_data: workoutData,
      } satisfies UpdateManualWorkoutInput

      const updatedWorkout = {
        ...createSampleManualWorkout(),
        scheduled_date: '2026-01-22',
      }

      const mockSingle = vi.fn().mockResolvedValue({
        data: updatedWorkout,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      })

      const result = await updateManualWorkout(mockSupabase, workoutId, input)

      expect(mockSupabase.from).toHaveBeenCalledWith('manual_workouts')
      expect(mockUpdate).toHaveBeenCalledWith({
        scheduled_date: input.scheduled_date,
        workout_data: input.workout_data,
      })
      expect(mockEq).toHaveBeenCalledWith('id', workoutId)
      expect(result).toEqual(updatedWorkout)
    })

    test('updates only scheduled_date when partial update', async () => {
      const workoutId = 'manual-123'
      const input: UpdateManualWorkoutInput = {
        scheduled_date: '2026-01-22',
      }

      const updatedWorkout = {
        ...createSampleManualWorkout(),
        scheduled_date: '2026-01-22',
      }

      const mockSingle = vi.fn().mockResolvedValue({
        data: updatedWorkout,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      })

      const result = await updateManualWorkout(mockSupabase, workoutId, input)

      expect(mockUpdate).toHaveBeenCalledWith({
        scheduled_date: input.scheduled_date,
      })
      expect(result).toEqual(updatedWorkout)
    })

    test('throws error when workout not found', async () => {
      const workoutId = 'nonexistent'
      const input: UpdateManualWorkoutInput = {
        scheduled_date: '2026-01-22',
      }

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })
      const mockEq = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      })

      await expect(updateManualWorkout(mockSupabase, workoutId, input)).rejects.toThrow(
        'Manual workout not found'
      )
    })

    test('throws error on database error', async () => {
      const workoutId = 'manual-123'
      const input: UpdateManualWorkoutInput = {
        scheduled_date: '2026-01-22',
      }

      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })
      const mockSingle = vi.fn().mockReturnValue({ select: mockSelect })
      const mockEq = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      })

      await expect(updateManualWorkout(mockSupabase, workoutId, input)).rejects.toThrow(
        'Failed to update manual workout'
      )
    })
  })

  // =========================================================================
  // deleteManualWorkout
  // =========================================================================

  describe('deleteManualWorkout', () => {
    test('deletes workout successfully', async () => {
      const workoutId = 'manual-123'

      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: mockDelete,
      })

      await deleteManualWorkout(mockSupabase, workoutId)

      expect(mockSupabase.from).toHaveBeenCalledWith('manual_workouts')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', workoutId)
    })

    test('throws error on database error', async () => {
      const workoutId = 'manual-123'

      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: mockDelete,
      })

      await expect(deleteManualWorkout(mockSupabase, workoutId)).rejects.toThrow(
        'Failed to delete manual workout'
      )
    })

    test('deletes successfully even if workout not found', async () => {
      const workoutId = 'nonexistent'

      // Supabase delete doesn't error on not found, it just affects 0 rows
      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: mockDelete,
      })

      // Should not throw
      await expect(deleteManualWorkout(mockSupabase, workoutId)).resolves.toBeUndefined()
    })
  })

  // =========================================================================
  // addLibraryWorkout
  // =========================================================================

  describe('addLibraryWorkout', () => {
    test('fetches library workout and creates manual workout', async () => {
      const { invokePythonApi } = await import('@/lib/services/lambda-client')

      const userId = 'user-456'
      const input = {
        scheduled_date: '2026-01-22',
        library_workout_id: 'lib-workout-123',
      }

      const libraryWorkout = {
        id: 'lib-workout-123',
        name: 'Threshold Intervals',
        type: 'threshold',
        base_tss: 75,
        detailed_description: 'Detailed description',
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
                  length: { unit: 'second', value: 600 },
                  targets: [
                    {
                      type: 'power',
                      minValue: 55,
                      maxValue: 55,
                      unit: 'percentOfFtp',
                    },
                  ],
                },
              ],
            },
          ],
        },
      }

      // Mock Python API call
      ;(invokePythonApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 200,
        body: libraryWorkout,
      })

      const createdWorkout = createSampleManualWorkout()

      // Mock Supabase insert
      const mockSingle = vi.fn().mockResolvedValue({
        data: createdWorkout,
        error: null,
      })
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      })

      const result = await addLibraryWorkout(mockSupabase, userId, input)

      expect(invokePythonApi).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/workouts/lib-workout-123',
      })

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: userId,
        scheduled_date: input.scheduled_date,
        workout_data: expect.objectContaining({
          name: 'Threshold Intervals',
          type: 'threshold',
          tss: 75,
          library_workout_id: 'lib-workout-123',
          source: 'library',
        }),
      })

      expect(result).toEqual(createdWorkout)
    })

    test('includes source_plan_instance_id when provided', async () => {
      const { invokePythonApi } = await import('@/lib/services/lambda-client')

      const userId = 'user-456'
      const input = {
        scheduled_date: '2026-01-22',
        library_workout_id: 'lib-workout-123',
        source_plan_instance_id: 'plan-instance-789',
      }

      const libraryWorkout = {
        id: 'lib-workout-123',
        name: 'Threshold Intervals',
        type: 'threshold',
        base_tss: 75,
        structure: {
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
          structure: [],
        },
      }

      ;(invokePythonApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 200,
        body: libraryWorkout,
      })

      const createdWorkout = {
        ...createSampleManualWorkout(),
        source_plan_instance_id: 'plan-instance-789',
      }

      const mockSingle = vi.fn().mockResolvedValue({
        data: createdWorkout,
        error: null,
      })
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      })
      ;(mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      })

      const result = await addLibraryWorkout(mockSupabase, userId, input)

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: userId,
        scheduled_date: input.scheduled_date,
        source_plan_instance_id: 'plan-instance-789',
        workout_data: expect.any(Object),
      })

      expect(result.source_plan_instance_id).toBe('plan-instance-789')
    })

    test('throws error when library workout not found', async () => {
      const { invokePythonApi } = await import('@/lib/services/lambda-client')

      const userId = 'user-456'
      const input = {
        scheduled_date: '2026-01-22',
        library_workout_id: 'nonexistent',
      }

      ;(invokePythonApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 404,
        body: null,
      })

      await expect(addLibraryWorkout(mockSupabase, userId, input)).rejects.toThrow(
        'Library workout not found'
      )
    })

    test('throws error when Python API call fails', async () => {
      const { invokePythonApi } = await import('@/lib/services/lambda-client')

      const userId = 'user-456'
      const input = {
        scheduled_date: '2026-01-22',
        library_workout_id: 'lib-workout-123',
      }

      ;(invokePythonApi as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'))

      await expect(addLibraryWorkout(mockSupabase, userId, input)).rejects.toThrow(
        'Failed to fetch library workout'
      )
    })

    test('throws error when library workout response is invalid', async () => {
      const { invokePythonApi } = await import('@/lib/services/lambda-client')

      const userId = 'user-456'
      const input = {
        scheduled_date: '2026-01-22',
        library_workout_id: 'lib-workout-123',
      }

      ;(invokePythonApi as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 200,
        body: null, // Invalid: no body
      })

      await expect(addLibraryWorkout(mockSupabase, userId, input)).rejects.toThrow(
        'Library workout not found'
      )
    })
  })
})

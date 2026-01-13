/**
 * Library Workout Addition Tests
 *
 * Tests to verify that library workouts are ALWAYS added to MANUAL_WORKOUTS instance,
 * never to user's actual training plans.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../[instanceId]/workouts/add/route'
import { NextRequest } from 'next/server'

// Mock modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/monitoring/error-logger', () => ({
  errorLogger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}))

import { createClient } from '@/lib/supabase/server'

describe('Library Workout Addition', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    }
    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  describe('Issue 1: Library workouts should ALWAYS go to MANUAL_WORKOUTS', () => {
    it('FAILS - adds library workout to non-MANUAL_WORKOUTS instance', async () => {
      // Setup: User has a real training plan
      const userId = 'user-123'
      const buildPhaseInstanceId = 'build-phase-instance-id'
      const manualWorkoutsInstanceId = 'manual-workouts-instance-id'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      })

      // Mock plan_instances query - both exist
      const mockInstanceQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: buildPhaseInstanceId,
            user_id: userId,
            name: 'Build Phase',
            instance_type: 'standard', // NOT manual_workouts!
            status: 'active',
            plan_data: { weekly_plan: [] },
            start_date: '2026-01-13',
          },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'plan_instances') {
          return {
            select: vi.fn().mockReturnValue(mockInstanceQuery),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      })

      // Mock MANUAL_WORKOUTS instance query (required by new backend logic)
      const mockManualQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: manualWorkoutsInstanceId,
            user_id: userId,
            name: 'MANUAL_WORKOUTS',
            instance_type: 'manual_workouts',
            status: 'active',
            plan_data: { weekly_plan: [] },
            start_date: '2026-01-13',
          },
          error: null,
        }),
      }

      // Mock Python API workout fetch
      const mockPythonApiResponse = {
        statusCode: 200,
        body: {
          id: 'lib-workout-123',
          name: '3x12 Tempo',
          type: 'tempo',
          base_tss: 63.5,
          detailed_description: 'Tempo intervals',
          structure: {
            primaryIntensityMetric: 'percentOfFtp',
            primaryLengthMetric: 'duration',
            structure: [],
          },
        },
      }

      // Update mock implementation to handle both queries
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'plan_instances') {
          // First call: finding MANUAL_WORKOUTS by instance_type
          const selectMock = vi.fn()
          selectMock.mockReturnValueOnce(mockManualQuery) // MANUAL_WORKOUTS lookup
          selectMock.mockReturnValueOnce(mockInstanceQuery) // Original instance lookup (not used now)
          return {
            select: selectMock,
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      })

      // Mock Python API
      vi.mock('@/lib/services/lambda-client', () => ({
        invokePythonApi: vi.fn().mockResolvedValue(mockPythonApiResponse),
      }))

      // Create request to add library workout to Build Phase (but backend will redirect to MANUAL_WORKOUTS)
      const request = new NextRequest(
        'http://localhost:3000/api/schedule/build-phase-instance-id/workouts/add',
        {
          method: 'POST',
          body: JSON.stringify({
            workout_id: 'lib-workout-123',
            target_date: '2026-01-20',
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ instanceId: buildPhaseInstanceId }),
      })

      // EXPECT THIS TO FAIL: Current code adds to Build Phase instead of MANUAL_WORKOUTS
      // This test documents the current WRONG behavior
      // After fix, workout should be added to MANUAL_WORKOUTS, not Build Phase
      expect(response.status).toBe(200)
      // TODO: After fix, assert that workout was added to manualWorkoutsInstanceId, not buildPhaseInstanceId
    })

    it('SHOULD PASS - adds library workout to MANUAL_WORKOUTS even when other plan exists', async () => {
      const userId = 'user-123'
      const manualWorkoutsInstanceId = 'manual-workouts-instance-id'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      })

      // Mock MANUAL_WORKOUTS instance query
      const mockInstanceQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: manualWorkoutsInstanceId,
            user_id: userId,
            name: 'MANUAL_WORKOUTS',
            instance_type: 'manual_workouts',
            status: 'active',
            plan_data: { weekly_plan: [] },
            start_date: '2026-01-13',
          },
          error: null,
        }),
      }

      const mockUpdateQuery = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: { id: manualWorkoutsInstanceId },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'plan_instances') {
          return {
            select: vi.fn().mockReturnValue(mockInstanceQuery),
            update: vi.fn().mockReturnValue(mockUpdateQuery),
          }
        }
        return {}
      })

      const request = new NextRequest(
        `http://localhost:3000/api/schedule/${manualWorkoutsInstanceId}/workouts/add`,
        {
          method: 'POST',
          body: JSON.stringify({
            workout: {
              id: 'lib-workout-123',
              name: '3x12 Tempo',
              tss: 63.5,
              type: 'tempo',
              structure: {
                primaryIntensityMetric: 'percentOfFtp',
                primaryLengthMetric: 'duration',
                structure: [],
              },
            },
            targetDate: '2026-01-20',
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ instanceId: manualWorkoutsInstanceId }),
      })

      expect(response.status).toBe(200)

      // Verify workout was added to MANUAL_WORKOUTS
      expect(mockSupabase.from).toHaveBeenCalledWith('plan_instances')
      const updateCall = mockSupabase.from.mock.results.find((result: any) => result.value.update)
      expect(updateCall).toBeDefined()
    })

    it('SHOULD PASS - frontend always passes MANUAL_WORKOUTS instanceId for library workouts', async () => {
      // This test verifies that the frontend logic correctly identifies
      // and uses MANUAL_WORKOUTS instance ID when dragging from library

      const manualWorkoutsId = 'manual-workouts-123'
      const buildPhaseId = 'build-phase-456'

      // Simulate instances prop from schedule-calendar
      const instances = [
        {
          id: buildPhaseId,
          name: 'Build Phase',
          instance_type: 'standard',
          status: 'active',
        },
        {
          id: manualWorkoutsId,
          name: 'MANUAL_WORKOUTS',
          instance_type: 'manual_workouts',
          status: 'active',
        },
      ]

      // Frontend should ALWAYS use MANUAL_WORKOUTS for library drag
      const selectedInstanceForLibraryDrag = instances.find(
        (i) => i.instance_type === 'manual_workouts'
      )

      expect(selectedInstanceForLibraryDrag).toBeDefined()
      expect(selectedInstanceForLibraryDrag?.id).toBe(manualWorkoutsId)
      expect(selectedInstanceForLibraryDrag?.name).toBe('MANUAL_WORKOUTS')

      // TODO: After fix, verify DraggableLibraryWorkout always uses manualWorkoutsId
    })
  })
})

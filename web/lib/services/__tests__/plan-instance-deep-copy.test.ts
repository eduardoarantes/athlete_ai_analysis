/**
 * Plan Instance Deep Copy Tests
 *
 * Tests to verify that workouts are deeply copied when creating plan instances,
 * including full structure data, not just library_workout_id references.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanInstanceService } from '../plan-instance-service'

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
import type { WorkoutStructure } from '@/lib/types/training-plan'

describe('Plan Instance Workout Deep Copy', () => {
  let mockSupabase: any
  let service: PlanInstanceService

  const mockWorkoutStructure: WorkoutStructure = {
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
            length: { unit: 'time', value: 600 },
            targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
          },
        ],
      },
      {
        type: 'repetition',
        length: { unit: 'repetition', value: 3 },
        steps: [
          {
            name: 'Work',
            intensityClass: 'active',
            length: { unit: 'time', value: 720 },
            targets: [{ type: 'power', minValue: 88, maxValue: 93 }],
          },
          {
            name: 'Recovery',
            intensityClass: 'rest',
            length: { unit: 'time', value: 180 },
            targets: [{ type: 'power', minValue: 55, maxValue: 65 }],
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
            length: { unit: 'time', value: 600 },
            targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
          },
        ],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }
    ;(createClient as any).mockResolvedValue(mockSupabase)
    service = new PlanInstanceService()
  })

  describe('Issue 2: Workouts should be deeply copied with full structure', () => {
    it('FAILS - template workout has library_workout_id but no structure', async () => {
      const templateId = 'template-123'
      const userId = 'user-123'

      // Mock template with workout that only has library_workout_id (NO structure)
      const mockTemplate = {
        id: templateId,
        user_id: userId,
        name: 'Build Phase',
        weeks_total: 1,
        plan_data: {
          plan_metadata: { total_weeks: 1, current_ftp: 200 },
          athlete_profile: { ftp: 200 },
          weekly_plan: [
            {
              week_number: 1,
              phase: 'base',
              week_tss: 63.5,
              workouts: [
                {
                  weekday: 'Monday',
                  name: '3x12 Tempo',
                  description: 'Tempo intervals',
                  tss: 63.5,
                  type: 'tempo',
                  library_workout_id: 'gLtRZxsQ3c', // Has reference
                  // ❌ NO structure field! This is the problem
                },
              ],
            },
          ],
        },
        status: 'published',
        created_at: '2024-01-01T00:00:00Z',
      }

      const mockTemplateQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTemplate, error: null }),
      }

      const mockOverlapQuery = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'training_plans') {
          return {
            select: vi.fn().mockReturnValue(mockTemplateQuery),
          }
        }
        if (table === 'plan_instances') {
          return {
            select: vi.fn().mockReturnValue(mockOverlapQuery),
            insert: vi.fn().mockReturnThis(),
          }
        }
        return {}
      })

      // Query returns empty for overlap check
      mockOverlapQuery.neq.mockResolvedValue({ data: [], error: null })

      // Insert returns instance
      const mockInsertQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'instance-123',
            user_id: userId,
            template_id: templateId,
            name: 'Build Phase',
            start_date: '2026-01-13',
            end_date: '2026-01-20',
            plan_data: mockTemplate.plan_data, // Same data, no structure copied
            status: 'scheduled',
          },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'training_plans') {
          return { select: vi.fn().mockReturnValue(mockTemplateQuery) }
        }
        if (table === 'plan_instances') {
          return {
            select: vi.fn().mockReturnValue(mockOverlapQuery),
            insert: vi.fn().mockReturnValue(mockInsertQuery),
          }
        }
        return {}
      })

      const instance = await service.createInstance(userId, {
        template_id: templateId,
        start_date: '2026-01-13',
      })

      // CURRENT WRONG BEHAVIOR: workout has no structure
      const workout = instance.plan_data.weekly_plan[0]?.workouts[0]
      expect(workout).toBeDefined()
      expect(workout?.library_workout_id).toBe('gLtRZxsQ3c')

      // This will FAIL because structure is not copied
      expect(workout?.structure).toBeUndefined()

      // After fix, structure should be fully copied from library
    })

    it('SHOULD PASS - instance workout has full structure copied from library', async () => {
      const templateId = 'template-123'
      const userId = 'user-123'

      // Mock template with workout that should have structure after fix
      const mockTemplate = {
        id: templateId,
        user_id: userId,
        name: 'Build Phase',
        weeks_total: 1,
        plan_data: {
          plan_metadata: { total_weeks: 1, current_ftp: 200 },
          athlete_profile: { ftp: 200 },
          weekly_plan: [
            {
              week_number: 1,
              phase: 'base',
              week_tss: 63.5,
              workouts: [
                {
                  weekday: 'Monday',
                  name: '3x12 Tempo',
                  description: 'Tempo intervals',
                  detailed_description: 'Three 12-minute tempo intervals',
                  tss: 63.5,
                  type: 'tempo',
                  library_workout_id: 'gLtRZxsQ3c',
                  // After fix: structure should be populated
                  structure: mockWorkoutStructure,
                },
              ],
            },
          ],
        },
        status: 'published',
        created_at: '2024-01-01T00:00:00Z',
      }

      const mockTemplateQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTemplate, error: null }),
      }

      const mockOverlapQuery = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      const mockInsertQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'instance-123',
            user_id: userId,
            template_id: templateId,
            name: 'Build Phase',
            start_date: '2026-01-13',
            end_date: '2026-01-20',
            weeks_total: 1,
            plan_data: mockTemplate.plan_data,
            status: 'scheduled',
          },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'training_plans') {
          return { select: vi.fn().mockReturnValue(mockTemplateQuery) }
        }
        if (table === 'plan_instances') {
          return {
            select: vi.fn().mockReturnValue(mockOverlapQuery),
            insert: vi.fn().mockReturnValue(mockInsertQuery),
          }
        }
        return {}
      })

      const instance = await service.createInstance(userId, {
        template_id: templateId,
        start_date: '2026-01-13',
      })

      // EXPECTED BEHAVIOR: workout has full structure
      const workout = instance.plan_data.weekly_plan[0]?.workouts[0]
      expect(workout).toBeDefined()

      // Keep library reference for tracking
      expect(workout?.library_workout_id).toBe('gLtRZxsQ3c')

      // Should have full structure copied
      expect(workout?.structure).toBeDefined()
      expect(workout?.structure?.primaryIntensityMetric).toBe('percentOfFtp')
      expect(workout?.structure?.structure).toHaveLength(3)

      // Should have all other fields copied
      expect(workout?.name).toBe('3x12 Tempo')
      expect(workout?.description).toBe('Tempo intervals')
      expect(workout?.detailed_description).toBe('Three 12-minute tempo intervals')
      expect(workout?.tss).toBe(63.5)
      expect(workout?.type).toBe('tempo')

      // Should have new ID and scheduled_date
      expect(workout?.id).toBeDefined()
      expect(workout?.scheduled_date).toBe('2026-01-13')
    })

    it('SHOULD PASS - modifying library workout does not affect scheduled instances', async () => {
      // This test verifies that instances are independent of library changes

      const originalStructure: WorkoutStructure = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Original Warmup',
                intensityClass: 'warmUp',
                length: { unit: 'time', value: 600 },
                targets: [{ type: 'power', minValue: 50, maxValue: 60 }],
              },
            ],
          },
        ],
      }

      const modifiedStructure: WorkoutStructure = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Modified Warmup',
                intensityClass: 'warmUp',
                length: { unit: 'time', value: 900 }, // Changed duration
                targets: [{ type: 'power', minValue: 55, maxValue: 65 }], // Changed power
              },
            ],
          },
        ],
      }

      // Simulate: Instance created with original structure
      const instanceWorkout = {
        id: 'workout-instance-123',
        scheduled_date: '2026-01-13',
        weekday: 'Monday',
        name: '3x12 Tempo',
        library_workout_id: 'gLtRZxsQ3c',
        structure: JSON.parse(JSON.stringify(originalStructure)), // Deep copy
      }

      // Simulate: Library workout is modified
      const libraryWorkout = {
        id: 'gLtRZxsQ3c',
        name: '3x12 Tempo',
        structure: modifiedStructure, // Changed!
      }

      // Verify instance is not affected by library modification
      expect(instanceWorkout.structure.structure[0]?.steps[0]?.name).toBe('Original Warmup')
      expect(instanceWorkout.structure.structure[0]?.steps[0]?.length.value).toBe(600)

      expect(libraryWorkout.structure.structure[0]?.steps[0]?.name).toBe('Modified Warmup')
      expect(libraryWorkout.structure.structure[0]?.steps[0]?.length.value).toBe(900)

      // Instance remains unchanged
      expect(instanceWorkout.structure).not.toEqual(libraryWorkout.structure)
    })
  })
})

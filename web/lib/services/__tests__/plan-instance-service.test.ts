/**
 * Plan Instance Service Tests
 *
 * Tests for the PlanInstanceService which handles scheduling training plan
 * templates onto the calendar as instances with overlap prevention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing service
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

// Import after mocks
import { PlanInstanceService } from '../plan-instance-service'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

// Test data factories
const createMockTemplate = (overrides = {}) => ({
  id: 'template-123',
  user_id: 'user-123',
  name: 'Test Training Plan',
  weeks_total: 12,
  plan_data: {
    plan_metadata: {
      total_weeks: 12,
      current_ftp: 200,
      target_ftp: 220,
    },
    weekly_plan: [
      { week_number: 1, phase: 'base', week_tss: 300 },
      { week_number: 2, phase: 'base', week_tss: 320 },
    ],
    athlete_profile: { ftp: 200 },
  },
  status: 'published',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

const createMockInstance = (overrides = {}) => ({
  id: 'instance-123',
  user_id: 'user-123',
  template_id: 'template-123',
  name: 'Test Training Plan',
  start_date: '2025-01-06',
  end_date: '2025-03-31',
  weeks_total: 12,
  plan_data: createMockTemplate().plan_data,
  status: 'scheduled',
  created_at: '2024-12-19T00:00:00Z',
  updated_at: '2024-12-19T00:00:00Z',
  ...overrides,
})

/**
 * Creates a chainable mock that returns itself for any method call
 * and resolves to the specified result when awaited
 */
const createChainableMock = (result: { data: unknown; error: unknown }) => {
  const chainable: Record<string, unknown> = {}

  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, prop) => {
      if (prop === 'then') {
        // Make it thenable
        return (resolve: (value: unknown) => void) => resolve(result)
      }
      // Return self for chaining
      return () => new Proxy(chainable, handler)
    },
  }

  return new Proxy(chainable, handler)
}

/**
 * Creates a mock Supabase client for testing
 */
const createMockSupabase = (config: {
  fromResults?: Record<string, { data: unknown; error: unknown }>
}) => {
  const { fromResults = {} } = config

  return {
    from: vi.fn((table: string) => {
      const result = fromResults[table] || { data: null, error: null }
      return createChainableMock(result)
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  }
}

describe('PlanInstanceService', () => {
  let service: PlanInstanceService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PlanInstanceService()
  })

  describe('createInstance', () => {
    it('creates an instance from a valid template', async () => {
      const mockTemplate = createMockTemplate()
      const mockInstance = createMockInstance()

      // createInstance creates ONE client used for both template fetch AND insert
      // checkOverlap creates its own client
      let callCount = 0
      vi.mocked(createClient).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          // First client: used for template fetch (training_plans) AND insert (plan_instances)
          return createMockSupabase({
            fromResults: {
              training_plans: { data: mockTemplate, error: null },
              plan_instances: { data: mockInstance, error: null },
            },
          }) as never
        }
        // Second client: used for overlap check
        return createMockSupabase({
          fromResults: { plan_instances: { data: [], error: null } },
        }) as never
      })

      const result = await service.createInstance('user-123', {
        template_id: 'template-123',
        start_date: '2025-01-06',
      })

      expect(result.id).toBe('instance-123')
      expect(result.name).toBe('Test Training Plan')
      expect(result.status).toBe('scheduled')
      expect(errorLogger.logInfo).toHaveBeenCalledWith(
        'Plan instance created',
        expect.objectContaining({
          userId: 'user-123',
        })
      )
    })

    it('throws error when template not found', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: {
            training_plans: { data: null, error: { code: 'PGRST116', message: 'Not found' } },
          },
        }) as never
      )

      await expect(
        service.createInstance('user-123', {
          template_id: 'non-existent',
          start_date: '2025-01-06',
        })
      ).rejects.toThrow('Training plan template not found')
    })

    it('throws error when overlap detected', async () => {
      const mockTemplate = createMockTemplate()
      const conflictingInstance = createMockInstance({ name: 'Conflicting Plan' })

      let callCount = 0
      vi.mocked(createClient).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return createMockSupabase({
            fromResults: { training_plans: { data: mockTemplate, error: null } },
          }) as never
        }
        // Return conflicting instance for overlap check
        return createMockSupabase({
          fromResults: { plan_instances: { data: [conflictingInstance], error: null } },
        }) as never
      })

      await expect(
        service.createInstance('user-123', {
          template_id: 'template-123',
          start_date: '2025-01-06',
        })
      ).rejects.toThrow('Schedule conflict with: Conflicting Plan')
    })
  })

  describe('listInstances', () => {
    it('returns instances for user', async () => {
      const instances = [
        createMockInstance({ id: 'instance-1', status: 'scheduled' }),
        createMockInstance({ id: 'instance-2', status: 'active' }),
      ]

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: instances, error: null } },
        }) as never
      )

      const result = await service.listInstances('user-123')

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('instance-1')
      expect(result[1]!.id).toBe('instance-2')
    })

    it('returns empty array when no instances found', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: [], error: null } },
        }) as never
      )

      const result = await service.listInstances('user-123')

      expect(result).toEqual([])
    })

    it('throws error on database failure', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: new Error('Database error') } },
        }) as never
      )

      await expect(service.listInstances('user-123')).rejects.toThrow(
        'Failed to fetch plan instances'
      )
      expect(errorLogger.logError).toHaveBeenCalled()
    })
  })

  describe('getInstance', () => {
    it('returns instance when found', async () => {
      const mockInstance = createMockInstance()

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: mockInstance, error: null } },
        }) as never
      )

      const result = await service.getInstance('user-123', 'instance-123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('instance-123')
    })

    it('returns null when instance not found', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: { code: 'PGRST116' } } },
        }) as never
      )

      const result = await service.getInstance('user-123', 'non-existent')

      expect(result).toBeNull()
    })

    it('throws error on other database errors', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: new Error('Connection failed') } },
        }) as never
      )

      await expect(service.getInstance('user-123', 'instance-123')).rejects.toThrow(
        'Failed to fetch plan instance'
      )
    })
  })

  describe('cancelInstance', () => {
    it('cancels a scheduled instance', async () => {
      const mockInstance = createMockInstance({ status: 'scheduled' })
      const cancelledInstance = { ...mockInstance, status: 'cancelled' }

      // cancelInstance creates client first (for update), then getInstance creates another (for select)
      let callCount = 0
      vi.mocked(createClient).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          // First client: used by cancelInstance for update
          return createMockSupabase({
            fromResults: { plan_instances: { data: cancelledInstance, error: null } },
          }) as never
        }
        // Second client: used by getInstance to fetch current state
        return createMockSupabase({
          fromResults: { plan_instances: { data: mockInstance, error: null } },
        }) as never
      })

      const result = await service.cancelInstance('user-123', 'instance-123')

      expect(result.status).toBe('cancelled')
      expect(errorLogger.logInfo).toHaveBeenCalledWith(
        'Plan instance cancelled',
        expect.objectContaining({
          userId: 'user-123',
          metadata: { instanceId: 'instance-123' },
        })
      )
    })

    it('cancels an active instance', async () => {
      const mockInstance = createMockInstance({ status: 'active' })
      const cancelledInstance = { ...mockInstance, status: 'cancelled' }

      let callCount = 0
      vi.mocked(createClient).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          // First client: used by cancelInstance for update
          return createMockSupabase({
            fromResults: { plan_instances: { data: cancelledInstance, error: null } },
          }) as never
        }
        // Second client: used by getInstance
        return createMockSupabase({
          fromResults: { plan_instances: { data: mockInstance, error: null } },
        }) as never
      })

      const result = await service.cancelInstance('user-123', 'instance-123')

      expect(result.status).toBe('cancelled')
    })

    it('throws error when instance not found', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: { code: 'PGRST116' } } },
        }) as never
      )

      await expect(service.cancelInstance('user-123', 'non-existent')).rejects.toThrow(
        'Plan instance not found'
      )
    })

    it('throws error when trying to cancel completed instance', async () => {
      const mockInstance = createMockInstance({ status: 'completed' })

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: mockInstance, error: null } },
        }) as never
      )

      await expect(service.cancelInstance('user-123', 'instance-123')).rejects.toThrow(
        'Cannot cancel a completed plan'
      )
    })

    it('throws error when trying to cancel already cancelled instance', async () => {
      const mockInstance = createMockInstance({ status: 'cancelled' })

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: mockInstance, error: null } },
        }) as never
      )

      await expect(service.cancelInstance('user-123', 'instance-123')).rejects.toThrow(
        'Cannot cancel a cancelled plan'
      )
    })
  })

  describe('checkOverlap', () => {
    it('returns no overlap when no conflicting instances', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: [], error: null } },
        }) as never
      )

      const result = await service.checkOverlap('user-123', '2025-01-06', '2025-03-31')

      expect(result.hasOverlap).toBe(false)
      expect(result.conflicts).toEqual([])
    })

    it('returns overlap when conflicting instances exist', async () => {
      const conflictingInstance = createMockInstance()

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: [conflictingInstance], error: null } },
        }) as never
      )

      const result = await service.checkOverlap('user-123', '2025-02-01', '2025-04-30')

      expect(result.hasOverlap).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]!.id).toBe('instance-123')
    })

    it('throws error on database failure', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: new Error('Database error') } },
        }) as never
      )

      await expect(service.checkOverlap('user-123', '2025-01-06', '2025-03-31')).rejects.toThrow(
        'Failed to check for schedule conflicts'
      )
    })
  })

  describe('activateInstance', () => {
    it('activates a scheduled instance', async () => {
      const activatedInstance = createMockInstance({ status: 'active' })

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: activatedInstance, error: null } },
        }) as never
      )

      const result = await service.activateInstance('user-123', 'instance-123')

      expect(result.status).toBe('active')
    })

    it('throws error on database failure', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: new Error('Database error') } },
        }) as never
      )

      await expect(service.activateInstance('user-123', 'instance-123')).rejects.toThrow(
        'Failed to activate plan instance'
      )
    })
  })

  describe('completeInstance', () => {
    it('completes an active instance', async () => {
      const completedInstance = createMockInstance({ status: 'completed' })

      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: completedInstance, error: null } },
        }) as never
      )

      const result = await service.completeInstance('user-123', 'instance-123')

      expect(result.status).toBe('completed')
    })

    it('throws error on database failure', async () => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          fromResults: { plan_instances: { data: null, error: new Error('Database error') } },
        }) as never
      )

      await expect(service.completeInstance('user-123', 'instance-123')).rejects.toThrow(
        'Failed to complete plan instance'
      )
    })
  })

  describe('end date calculation', () => {
    it('calculates end date based on weeks_total from template', async () => {
      const mockTemplate = createMockTemplate({ weeks_total: 8 })
      const mockInstance = createMockInstance({ weeks_total: 8 })

      let callCount = 0
      vi.mocked(createClient).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          // First client: used for template fetch AND insert
          return createMockSupabase({
            fromResults: {
              training_plans: { data: mockTemplate, error: null },
              plan_instances: { data: mockInstance, error: null },
            },
          }) as never
        }
        // Second client: used for overlap check
        return createMockSupabase({
          fromResults: { plan_instances: { data: [], error: null } },
        }) as never
      })

      const result = await service.createInstance('user-123', {
        template_id: 'template-123',
        start_date: '2025-01-06',
      })

      expect(result.weeks_total).toBe(8)
    })

    it('falls back to plan_metadata.total_weeks if weeks_total not set', async () => {
      const mockTemplate = createMockTemplate({
        weeks_total: undefined,
        plan_data: {
          plan_metadata: { total_weeks: 16, current_ftp: 200, target_ftp: 220 },
          weekly_plan: [],
          athlete_profile: { ftp: 200 },
        },
      })
      const mockInstance = createMockInstance({ weeks_total: 16 })

      let callCount = 0
      vi.mocked(createClient).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          // First client: used for template fetch AND insert
          return createMockSupabase({
            fromResults: {
              training_plans: { data: mockTemplate, error: null },
              plan_instances: { data: mockInstance, error: null },
            },
          }) as never
        }
        // Second client: used for overlap check
        return createMockSupabase({
          fromResults: { plan_instances: { data: [], error: null } },
        }) as never
      })

      const result = await service.createInstance('user-123', {
        template_id: 'template-123',
        start_date: '2025-01-06',
      })

      expect(result.weeks_total).toBe(16)
    })
  })
})

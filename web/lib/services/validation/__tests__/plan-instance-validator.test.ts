/**
 * PlanInstanceValidator Tests
 *
 * Tests for PlanInstanceValidator which handles plan instance overlap detection
 * to replace PostgreSQL trigger with TypeScript validation.
 *
 * Coverage target: 90%+
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
import { PlanInstanceValidator } from '../plan-instance-validator'
import { createClient } from '@/lib/supabase/server'
import type { PlanInstance } from '@/lib/types/training-plan'

// =============================================================================
// Test Data Factories
// =============================================================================

const createMockPlanInstance = (overrides: Partial<PlanInstance> = {}): PlanInstance => ({
  id: 'instance-123',
  user_id: 'user-123',
  template_id: 'template-123',
  name: 'Test Plan',
  start_date: '2025-02-01',
  end_date: '2025-04-01',
  weeks_total: 8,
  plan_data: {
    athlete_profile: {
      ftp: 250,
    },
    plan_metadata: {
      total_weeks: 8,
      current_ftp: 250,
      target_ftp: 270,
    },
    weekly_plan: [],
  },
  workout_overrides: null,
  status: 'scheduled',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
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
        return (resolve: (value: unknown) => void) => resolve(result)
      }
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
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('PlanInstanceValidator', () => {
  let validator: PlanInstanceValidator

  beforeEach(() => {
    vi.clearAllMocks()
    validator = new PlanInstanceValidator()
  })

  // ---------------------------------------------------------------------------
  // No Overlap - Completely Separate Date Ranges
  // ---------------------------------------------------------------------------
  describe('checkOverlap - No Overlap Cases', () => {
    it('should return no overlap when date ranges are completely separate (before)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01',
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(false)
      expect(result.overlappingInstance).toBeUndefined()
    })

    it('should return no overlap when date ranges are completely separate (after)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-03-01',
        end_date: '2025-04-01',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-01-01',
        endDate: '2025-02-28',
      })

      expect(result.hasOverlap).toBe(false)
      expect(result.overlappingInstance).toBeUndefined()
    })

    it('should return no overlap when adjacent dates (end_date = start_date - 1 day)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01', // Starts day after existing ends
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(false)
      expect(result.overlappingInstance).toBeUndefined()
    })

    it('should return no overlap when no existing instances for user', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01',
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(false)
      expect(result.overlappingInstance).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Overlap Detection - Partial Overlaps
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Partial Overlap Cases', () => {
    it('should detect overlap at start (new range starts during existing)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-01-15',
        end_date: '2025-02-15',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01', // Starts during existing
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
      expect(result.overlappingInstance?.id).toBe('instance-123')
    })

    it('should detect overlap at end (new range ends during existing)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-15',
        end_date: '2025-03-15',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01',
        endDate: '2025-03-01', // Ends during existing
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
      expect(result.overlappingInstance?.id).toBe('instance-123')
    })
  })

  // ---------------------------------------------------------------------------
  // Overlap Detection - Complete Containment
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Complete Containment Cases', () => {
    it('should detect overlap when new range completely contains existing', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-10',
        end_date: '2025-02-20',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01', // Starts before existing
        endDate: '2025-03-01', // Ends after existing
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
    })

    it('should detect overlap when existing range completely contains new', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01', // Within existing
        endDate: '2025-02-28', // Within existing
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
    })

    it('should detect overlap when date ranges are identical', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-01',
        end_date: '2025-03-01',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01',
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Edge Case: Same Start or End Date (Inclusive Bounds)
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Same Start/End Date Cases', () => {
    it('should detect overlap when start dates match (inclusive)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-01',
        end_date: '2025-02-15',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01', // Same start date
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
    })

    it('should detect overlap when end dates match (inclusive)', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-15',
        end_date: '2025-03-01',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01',
        endDate: '2025-03-01', // Same end date
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Status Filtering
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Status Filtering', () => {
    it('should detect overlap with scheduled instance', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-01',
        end_date: '2025-03-01',
        status: 'scheduled',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-15',
        endDate: '2025-03-15',
      })

      expect(result.hasOverlap).toBe(true)
    })

    it('should detect overlap with active instance', async () => {
      const existingInstance = createMockPlanInstance({
        start_date: '2025-02-01',
        end_date: '2025-03-01',
        status: 'active',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [existingInstance],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-15',
        endDate: '2025-03-15',
      })

      expect(result.hasOverlap).toBe(true)
    })

    it('should NOT detect overlap with completed instance', async () => {
      // Mock returns empty array because query filters out completed instances
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [], // Query filters by status IN ('scheduled', 'active')
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-15',
        endDate: '2025-03-15',
      })

      expect(result.hasOverlap).toBe(false)
    })

    it('should NOT detect overlap with cancelled instance', async () => {
      // Mock returns empty array because query filters out cancelled instances
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [], // Query filters by status IN ('scheduled', 'active')
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-15',
        endDate: '2025-03-15',
      })

      expect(result.hasOverlap).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Update Scenario - Exclude Current Instance
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Exclude Current Instance (Update)', () => {
    it('should exclude current instance when updating (no false positive)', async () => {
      // Mock returns empty array because query excludes the current instance
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [], // Query uses .neq('id', excludeInstanceId)
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01',
        endDate: '2025-03-01',
        excludeInstanceId: 'instance-current', // Exclude self
      })

      expect(result.hasOverlap).toBe(false)
      expect(result.overlappingInstance).toBeUndefined()
    })

    it('should detect overlap with other instance when updating current', async () => {
      const otherInstance = createMockPlanInstance({
        id: 'instance-other',
        start_date: '2025-02-15',
        end_date: '2025-03-15',
        status: 'scheduled',
      })

      // Mock returns only the other instance (current is excluded by query)
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [otherInstance], // Query uses .neq('id', excludeInstanceId)
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-10',
        endDate: '2025-03-10',
        excludeInstanceId: 'instance-current', // Updating current, should find other
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance?.id).toBe('instance-other')
    })
  })

  // ---------------------------------------------------------------------------
  // Multiple Overlapping Instances
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Multiple Overlaps', () => {
    it('should return first overlapping instance when multiple overlaps exist', async () => {
      const instance1 = createMockPlanInstance({
        id: 'instance-1',
        start_date: '2025-02-01',
        end_date: '2025-02-15',
        status: 'scheduled',
      })

      const instance2 = createMockPlanInstance({
        id: 'instance-2',
        start_date: '2025-02-20',
        end_date: '2025-03-10',
        status: 'active',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [instance1, instance2],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123',
        startDate: '2025-02-01', // Overlaps both
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(true)
      expect(result.overlappingInstance).toBeDefined()
      // Should return first found overlap
      expect(['instance-1', 'instance-2']).toContain(result.overlappingInstance?.id)
    })
  })

  // ---------------------------------------------------------------------------
  // Different Users - No Conflict
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Different Users', () => {
    it('should NOT detect overlap for different users (same dates)', async () => {
      // Mock returns empty array because query filters by user_id
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: [], // Query uses .eq('user_id', userId)
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await validator.checkOverlap({
        userId: 'user-123', // Query only returns instances for this user
        startDate: '2025-02-01',
        endDate: '2025-03-01',
      })

      expect(result.hasOverlap).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------
  describe('checkOverlap - Error Handling', () => {
    it('should throw error when database query fails', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: null,
            error: { message: 'Database connection failed', code: 'PGRST301' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(
        validator.checkOverlap({
          userId: 'user-123',
          startDate: '2025-02-01',
          endDate: '2025-03-01',
        })
      ).rejects.toThrow('Failed to check plan instance overlap')
    })

    it('should throw error for invalid date format (start)', async () => {
      await expect(
        validator.checkOverlap({
          userId: 'user-123',
          startDate: 'invalid-date',
          endDate: '2025-03-01',
        })
      ).rejects.toThrow('Invalid date format')
    })

    it('should throw error for invalid date format (end)', async () => {
      await expect(
        validator.checkOverlap({
          userId: 'user-123',
          startDate: '2025-02-01',
          endDate: 'invalid-date',
        })
      ).rejects.toThrow('Invalid date format')
    })

    it('should throw error when end_date is before start_date', async () => {
      await expect(
        validator.checkOverlap({
          userId: 'user-123',
          startDate: '2025-03-01',
          endDate: '2025-02-01', // Before start
        })
      ).rejects.toThrow('End date must be after start date')
    })

    it('should throw error for empty userId', async () => {
      await expect(
        validator.checkOverlap({
          userId: '',
          startDate: '2025-02-01',
          endDate: '2025-03-01',
        })
      ).rejects.toThrow('User ID is required')
    })
  })
})

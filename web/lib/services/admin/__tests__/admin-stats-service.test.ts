/**
 * Admin Stats Service Tests
 *
 * Tests for AdminStatsService which handles platform-wide statistics queries
 * to replace PostgreSQL stored procedure with TypeScript.
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
import { AdminStatsService } from '../admin-stats-service'
import { createClient } from '@/lib/supabase/server'
import type { AdminStatsRow } from '@/lib/types/admin'

// =============================================================================
// Test Data Factories
// =============================================================================

const createMockAdminStatsRow = (overrides: Partial<AdminStatsRow> = {}): AdminStatsRow => ({
  total_users: 100,
  users_last_7_days: 10,
  users_last_30_days: 30,
  active_users_7_days: 25,
  active_users_30_days: 60,
  active_subscriptions: 50,
  suspended_subscriptions: 5,
  cancelled_subscriptions: 10,
  expired_subscriptions: 3,
  free_plan_users: 40,
  pro_plan_users: 8,
  team_plan_users: 2,
  total_strava_connections: 70,
  successful_syncs: 65,
  failed_syncs: 5,
  syncs_last_24h: 15,
  total_profiles_created: 90,
  total_activities: 500,
  activities_last_7_days: 50,
  activities_last_30_days: 200,
  total_training_plans: 30,
  active_training_plans: 20,
  total_reports: 45,
  completed_reports: 40,
  failed_reports: 5,
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

describe('AdminStatsService', () => {
  let service: AdminStatsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AdminStatsService()
  })

  // ---------------------------------------------------------------------------
  // getStats - Success Cases
  // ---------------------------------------------------------------------------
  describe('getStats', () => {
    it('should fetch stats successfully', async () => {
      const mockStats = createMockAdminStatsRow()

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      expect(result).toBeDefined()
      expect(result.users.total).toBe(100)
      expect(result.users.last_7_days).toBe(10)
      expect(result.users.last_30_days).toBe(30)
      expect(result.users.active_7_days).toBe(25)
      expect(result.users.active_30_days).toBe(60)
    })

    it('should return all user statistics fields', async () => {
      const mockStats = createMockAdminStatsRow({
        total_users: 150,
        users_last_7_days: 20,
        users_last_30_days: 45,
        active_users_7_days: 35,
        active_users_30_days: 80,
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      expect(result.users).toEqual({
        total: 150,
        last_7_days: 20,
        last_30_days: 45,
        active_7_days: 35,
        active_30_days: 80,
      })
    })

    it('should return all subscription statistics fields', async () => {
      const mockStats = createMockAdminStatsRow({
        active_subscriptions: 60,
        suspended_subscriptions: 8,
        cancelled_subscriptions: 15,
        expired_subscriptions: 7,
        free_plan_users: 50,
        pro_plan_users: 9,
        team_plan_users: 1,
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      expect(result.subscriptions).toEqual({
        active: 60,
        suspended: 8,
        cancelled: 15,
        expired: 7,
        by_plan: {
          free: 50,
          pro: 9,
          team: 1,
        },
      })
    })

    it('should return all Strava statistics fields', async () => {
      const mockStats = createMockAdminStatsRow({
        total_strava_connections: 80,
        successful_syncs: 75,
        failed_syncs: 5,
        syncs_last_24h: 20,
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      expect(result.strava).toEqual({
        total_connections: 80,
        successful_syncs: 75,
        failed_syncs: 5,
        syncs_last_24h: 20,
      })
    })

    it('should return all content statistics fields', async () => {
      const mockStats = createMockAdminStatsRow({
        total_profiles_created: 100,
        total_activities: 600,
        activities_last_7_days: 60,
        activities_last_30_days: 250,
        total_training_plans: 40,
        active_training_plans: 30,
        total_reports: 50,
        completed_reports: 45,
        failed_reports: 5,
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      expect(result.content).toEqual({
        total_profiles: 100,
        total_activities: 600,
        activities_last_7_days: 60,
        activities_last_30_days: 250,
        total_training_plans: 40,
        active_training_plans: 30,
        total_reports: 50,
        completed_reports: 45,
        failed_reports: 5,
      })
    })

    // ---------------------------------------------------------------------------
    // Type Validation
    // ---------------------------------------------------------------------------
    it('should convert all numeric fields to numbers', async () => {
      const mockStats = createMockAdminStatsRow()

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      // Verify all fields are numbers
      expect(typeof result.users.total).toBe('number')
      expect(typeof result.users.last_7_days).toBe('number')
      expect(typeof result.users.last_30_days).toBe('number')
      expect(typeof result.users.active_7_days).toBe('number')
      expect(typeof result.users.active_30_days).toBe('number')

      expect(typeof result.subscriptions.active).toBe('number')
      expect(typeof result.subscriptions.suspended).toBe('number')
      expect(typeof result.subscriptions.cancelled).toBe('number')
      expect(typeof result.subscriptions.expired).toBe('number')
      expect(typeof result.subscriptions.by_plan.free).toBe('number')
      expect(typeof result.subscriptions.by_plan.pro).toBe('number')
      expect(typeof result.subscriptions.by_plan.team).toBe('number')

      expect(typeof result.strava.total_connections).toBe('number')
      expect(typeof result.strava.successful_syncs).toBe('number')
      expect(typeof result.strava.failed_syncs).toBe('number')
      expect(typeof result.strava.syncs_last_24h).toBe('number')

      expect(typeof result.content.total_profiles).toBe('number')
      expect(typeof result.content.total_activities).toBe('number')
      expect(typeof result.content.activities_last_7_days).toBe('number')
      expect(typeof result.content.activities_last_30_days).toBe('number')
      expect(typeof result.content.total_training_plans).toBe('number')
      expect(typeof result.content.active_training_plans).toBe('number')
      expect(typeof result.content.total_reports).toBe('number')
      expect(typeof result.content.completed_reports).toBe('number')
      expect(typeof result.content.failed_reports).toBe('number')
    })

    // ---------------------------------------------------------------------------
    // Empty Database / Edge Cases
    // ---------------------------------------------------------------------------
    it('should handle empty database with all zeros', async () => {
      const mockStats = createMockAdminStatsRow({
        total_users: 0,
        users_last_7_days: 0,
        users_last_30_days: 0,
        active_users_7_days: 0,
        active_users_30_days: 0,
        active_subscriptions: 0,
        suspended_subscriptions: 0,
        cancelled_subscriptions: 0,
        expired_subscriptions: 0,
        free_plan_users: 0,
        pro_plan_users: 0,
        team_plan_users: 0,
        total_strava_connections: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        syncs_last_24h: 0,
        total_profiles_created: 0,
        total_activities: 0,
        activities_last_7_days: 0,
        activities_last_30_days: 0,
        total_training_plans: 0,
        active_training_plans: 0,
        total_reports: 0,
        completed_reports: 0,
        failed_reports: 0,
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      expect(result.users.total).toBe(0)
      expect(result.subscriptions.active).toBe(0)
      expect(result.strava.total_connections).toBe(0)
      expect(result.content.total_activities).toBe(0)
    })

    it('should handle partial data with some null values', async () => {
      const mockStats = {
        total_users: 50,
        users_last_7_days: null,
        users_last_30_days: 20,
        active_users_7_days: null,
        active_users_30_days: 15,
        active_subscriptions: 25,
        suspended_subscriptions: null,
        cancelled_subscriptions: 5,
        expired_subscriptions: null,
        free_plan_users: 20,
        pro_plan_users: null,
        team_plan_users: 5,
        total_strava_connections: 30,
        successful_syncs: null,
        failed_syncs: 2,
        syncs_last_24h: null,
        total_profiles_created: 45,
        total_activities: null,
        activities_last_7_days: 10,
        activities_last_30_days: null,
        total_training_plans: 15,
        active_training_plans: null,
        total_reports: null,
        completed_reports: 10,
        failed_reports: null,
      }

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: mockStats,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getStats()

      // Null values should be converted to 0
      expect(result.users.total).toBe(50)
      expect(result.users.last_7_days).toBe(0)
      expect(result.users.last_30_days).toBe(20)
      expect(result.users.active_7_days).toBe(0)
      expect(result.users.active_30_days).toBe(15)

      expect(result.subscriptions.active).toBe(25)
      expect(result.subscriptions.suspended).toBe(0)
      expect(result.subscriptions.cancelled).toBe(5)
      expect(result.subscriptions.expired).toBe(0)

      expect(result.strava.total_connections).toBe(30)
      expect(result.strava.successful_syncs).toBe(0)
      expect(result.strava.failed_syncs).toBe(2)

      expect(result.content.total_profiles).toBe(45)
      expect(result.content.total_activities).toBe(0)
      expect(result.content.activities_last_7_days).toBe(10)
    })

    // ---------------------------------------------------------------------------
    // Error Handling
    // ---------------------------------------------------------------------------
    it('should throw error when database query fails', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: null,
            error: { message: 'Database connection failed', code: 'PGRST301' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.getStats()).rejects.toThrow('Failed to fetch admin stats')
    })

    it('should throw error when view does not exist', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: null,
            error: { message: 'relation "admin_stats_view" does not exist', code: '42P01' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.getStats()).rejects.toThrow('Failed to fetch admin stats')
    })

    it('should throw error when no stats row is returned', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: null,
            error: { message: 'No rows returned', code: 'PGRST116' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.getStats()).rejects.toThrow('Failed to fetch admin stats')
    })

    it('should throw error when stats data is null', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_stats_view: {
            data: null,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.getStats()).rejects.toThrow('No stats data returned from view')
    })
  })
})

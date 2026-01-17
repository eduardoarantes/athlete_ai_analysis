/**
 * Admin User Service Tests
 *
 * Tests for AdminUserService which handles admin user queries
 * to replace PostgreSQL stored procedures with TypeScript.
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
import { AdminUserService } from '../admin-user-service'
import { createClient } from '@/lib/supabase/server'
import type { AdminUserRow } from '@/lib/types/admin'

// =============================================================================
// Test Data Factories
// =============================================================================

const createMockAdminUserRow = (overrides: Partial<AdminUserRow> = {}): AdminUserRow => ({
  user_id: 'user-123',
  email: 'test@example.com',
  role: 'user',
  account_created_at: '2025-01-01T00:00:00Z',
  email_confirmed_at: '2025-01-01T01:00:00Z',
  last_sign_in_at: '2025-01-15T10:00:00Z',
  subscription_plan_id: 'plan-123',
  plan_name: 'pro',
  plan_display_name: 'Pro Plan',
  subscription_status: 'active',
  subscription_started_at: '2025-01-01T00:00:00Z',
  subscription_ends_at: null,
  strava_connected: true,
  strava_last_sync_at: '2025-01-15T09:00:00Z',
  strava_sync_status: 'success',
  strava_sync_error: null,
  profile_exists: true,
  first_name: 'John',
  last_name: 'Doe',
  preferred_language: 'en',
  timezone: 'America/New_York',
  units_system: 'metric',
  total_activities: 10,
  total_training_plans: 2,
  total_reports: 5,
  ...overrides,
})

/**
 * Creates a chainable mock that returns itself for any method call
 * and resolves to the specified result when awaited
 */
const createChainableMock = (result: { data: unknown; error: unknown; count?: number | null }) => {
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
  fromResults?: Record<string, { data: unknown; error: unknown; count?: number | null }>
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

describe('AdminUserService', () => {
  let service: AdminUserService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AdminUserService()
  })

  // ---------------------------------------------------------------------------
  // queryUsers - No Filters
  // ---------------------------------------------------------------------------
  describe('queryUsers', () => {
    it('should query all users without filters', async () => {
      const mockUsers = [
        createMockAdminUserRow(),
        createMockAdminUserRow({
          user_id: 'user-456',
          email: 'jane@example.com',
          first_name: 'Jane',
        }),
      ]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({})

      expect(result).toHaveLength(2)
      expect(result[0]?.email).toBe('test@example.com')
      expect(result[1]?.email).toBe('jane@example.com')
    })

    it('should return empty array when no users found', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: [],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({})

      expect(result).toEqual([])
    })

    // ---------------------------------------------------------------------------
    // Search Filter
    // ---------------------------------------------------------------------------
    it('should filter by email search (case-insensitive)', async () => {
      const mockUsers = [createMockAdminUserRow({ email: 'test@example.com' })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ search: 'TEST' })

      expect(result).toHaveLength(1)
      expect(result[0]?.email).toBe('test@example.com')
    })

    it('should filter by first name search (case-insensitive)', async () => {
      const mockUsers = [createMockAdminUserRow({ first_name: 'John' })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ search: 'john' })

      expect(result).toHaveLength(1)
      expect(result[0]?.profile.first_name).toBe('John')
    })

    it('should filter by last name search (case-insensitive)', async () => {
      const mockUsers = [createMockAdminUserRow({ last_name: 'Doe' })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ search: 'DOE' })

      expect(result).toHaveLength(1)
      expect(result[0]?.profile.last_name).toBe('Doe')
    })

    // ---------------------------------------------------------------------------
    // Role Filter
    // ---------------------------------------------------------------------------
    it('should filter by role', async () => {
      const mockUsers = [createMockAdminUserRow({ role: 'admin' })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ role: 'admin' })

      expect(result).toHaveLength(1)
      expect(result[0]?.role).toBe('admin')
    })

    // ---------------------------------------------------------------------------
    // Subscription Filter
    // ---------------------------------------------------------------------------
    it('should filter by subscription plan', async () => {
      const mockUsers = [createMockAdminUserRow({ plan_name: 'pro' })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ subscription: 'pro' })

      expect(result).toHaveLength(1)
      expect(result[0]?.subscription.plan_name).toBe('pro')
    })

    // ---------------------------------------------------------------------------
    // Strava Filter
    // ---------------------------------------------------------------------------
    it('should filter by Strava connection status (true)', async () => {
      const mockUsers = [createMockAdminUserRow({ strava_connected: true })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ strava: true })

      expect(result).toHaveLength(1)
      expect(result[0]?.strava.connected).toBe(true)
    })

    it('should filter by Strava connection status (false)', async () => {
      const mockUsers = [createMockAdminUserRow({ strava_connected: false })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ strava: false })

      expect(result).toHaveLength(1)
      expect(result[0]?.strava.connected).toBe(false)
    })

    // ---------------------------------------------------------------------------
    // Pagination
    // ---------------------------------------------------------------------------
    it('should apply limit', async () => {
      const mockUsers = [
        createMockAdminUserRow({ user_id: 'user-1' }),
        createMockAdminUserRow({ user_id: 'user-2' }),
      ]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ limit: 2 })

      expect(result).toHaveLength(2)
    })

    it('should apply offset', async () => {
      const mockUsers = [createMockAdminUserRow({ user_id: 'user-3' })]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({ offset: 2 })

      expect(result).toHaveLength(1)
      expect(result[0]?.user_id).toBe('user-3')
    })

    it('should use default pagination (limit 50, offset 0)', async () => {
      const mockUsers = Array.from({ length: 50 }, (_, i) =>
        createMockAdminUserRow({ user_id: `user-${i}` })
      )

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({})

      expect(result).toHaveLength(50)
    })

    // ---------------------------------------------------------------------------
    // Combined Filters
    // ---------------------------------------------------------------------------
    it('should apply multiple filters together', async () => {
      const mockUsers = [
        createMockAdminUserRow({
          email: 'admin@example.com',
          role: 'admin',
          plan_name: 'pro',
          strava_connected: true,
        }),
      ]

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUsers,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.queryUsers({
        search: 'admin',
        role: 'admin',
        subscription: 'pro',
        strava: true,
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.email).toBe('admin@example.com')
      expect(result[0]?.role).toBe('admin')
      expect(result[0]?.subscription.plan_name).toBe('pro')
      expect(result[0]?.strava.connected).toBe(true)
    })

    // ---------------------------------------------------------------------------
    // Error Handling
    // ---------------------------------------------------------------------------
    it('should throw error when database query fails', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: { message: 'Database connection failed', code: 'PGRST301' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.queryUsers({})).rejects.toThrow('Failed to query admin users')
    })
  })

  // ---------------------------------------------------------------------------
  // getUserById
  // ---------------------------------------------------------------------------
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = createMockAdminUserRow({ user_id: 'user-123' })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUser,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getUserById('user-123')

      expect(result).not.toBeNull()
      expect(result?.user_id).toBe('user-123')
    })

    it('should return null when user not found', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getUserById('nonexistent-user')

      expect(result).toBeNull()
    })

    it('should throw error when database query fails', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: { message: 'Database connection failed', code: 'PGRST301' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.getUserById('user-123')).rejects.toThrow(
        'Failed to get admin user by ID'
      )
    })

    it('should return transformed AdminUser structure', async () => {
      const mockUser = createMockAdminUserRow({
        user_id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        first_name: 'John',
        last_name: 'Doe',
        plan_name: 'pro',
        subscription_status: 'active',
        strava_connected: true,
        total_activities: 15,
        total_training_plans: 3,
        total_reports: 7,
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: mockUser,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getUserById('user-123')

      expect(result).not.toBeNull()
      expect(result).toMatchObject({
        user_id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        subscription: {
          plan_name: 'pro',
          status: 'active',
        },
        strava: {
          connected: true,
        },
        profile: {
          first_name: 'John',
          last_name: 'Doe',
        },
        counts: {
          total_activities: 15,
          total_training_plans: 3,
          total_reports: 7,
        },
      })
    })
  })

  // ---------------------------------------------------------------------------
  // countUsers
  // ---------------------------------------------------------------------------
  describe('countUsers', () => {
    it('should return count of all users without filters', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 100,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({})

      expect(result).toBe(100)
    })

    it('should return 0 when no users match filters', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 0,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({ search: 'nonexistent' })

      expect(result).toBe(0)
    })

    it('should return count with search filter', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 5,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({ search: 'john' })

      expect(result).toBe(5)
    })

    it('should return count with role filter', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 3,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({ role: 'admin' })

      expect(result).toBe(3)
    })

    it('should return count with subscription filter', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 42,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({ subscription: 'pro' })

      expect(result).toBe(42)
    })

    it('should return count with Strava filter', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 75,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({ strava: true })

      expect(result).toBe(75)
    })

    it('should return count with multiple filters', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: 10,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({
        search: 'test',
        role: 'user',
        subscription: 'pro',
        strava: true,
      })

      expect(result).toBe(10)
    })

    it('should throw error when database query fails', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: { message: 'Database connection failed', code: 'PGRST301' },
            count: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      await expect(service.countUsers({})).rejects.toThrow('Failed to count admin users')
    })

    it('should return 0 when count is null', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          admin_user_view: {
            data: null,
            error: null,
            count: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.countUsers({})

      expect(result).toBe(0)
    })
  })
})

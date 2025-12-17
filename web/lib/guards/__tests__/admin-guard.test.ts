/**
 * Admin Guard Tests
 *
 * Unit tests for admin authentication guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireAdmin, checkAdmin } from '../admin-guard'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock the error logger
vi.mock('@/lib/monitoring/error-logger', () => ({
  errorLogger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}))

describe('Admin Guard', () => {
  // Helper to create mock Supabase client
  const createMockSupabase = (options: {
    user?: { id: string; email: string; user_metadata?: Record<string, unknown> } | null
    authError?: Error | null
    isAdmin?: boolean
    roleError?: Error | null
  }): SupabaseClient => {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: options.user ?? null },
          error: options.authError ?? null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: options.isAdmin ?? false,
        error: options.roleError ?? null,
      }),
    } as unknown as SupabaseClient
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireAdmin', () => {
    it('returns authorized=true for admin user', async () => {
      const mockSupabase = createMockSupabase({
        user: {
          id: 'user-123',
          email: 'admin@example.com',
          user_metadata: { role: 'admin' },
        },
        isAdmin: true,
      })

      const result = await requireAdmin(mockSupabase)

      expect(result.authorized).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.role).toBe('admin')
      expect(result.error).toBeUndefined()
    })

    it('returns authorized=false for non-admin user', async () => {
      const mockSupabase = createMockSupabase({
        user: {
          id: 'user-456',
          email: 'user@example.com',
          user_metadata: { role: 'user' },
        },
        isAdmin: false,
      })

      const result = await requireAdmin(mockSupabase)

      expect(result.authorized).toBe(false)
      expect(result.userId).toBe('user-456')
      expect(result.role).toBe('user')
      expect(result.error).toBe('Admin role required')
    })

    it('returns authorized=false for unauthenticated user', async () => {
      const mockSupabase = createMockSupabase({
        user: null,
      })

      const result = await requireAdmin(mockSupabase)

      expect(result.authorized).toBe(false)
      expect(result.userId).toBeNull()
      expect(result.role).toBeNull()
      expect(result.error).toBe('Authentication required')
    })

    it('returns authorized=false on auth error', async () => {
      const mockSupabase = createMockSupabase({
        authError: new Error('Auth service unavailable'),
      })

      const result = await requireAdmin(mockSupabase)

      expect(result.authorized).toBe(false)
      expect(result.userId).toBeNull()
      expect(result.error).toBe('Authentication required')
    })

    it('returns authorized=false on RPC error', async () => {
      const mockSupabase = createMockSupabase({
        user: {
          id: 'user-789',
          email: 'test@example.com',
          user_metadata: { role: 'admin' },
        },
        roleError: new Error('RPC function not found'),
      })

      const result = await requireAdmin(mockSupabase)

      expect(result.authorized).toBe(false)
      expect(result.userId).toBe('user-789')
      expect(result.error).toBe('Failed to check admin role')
    })

    it('defaults role to "user" when not in metadata', async () => {
      const mockSupabase = createMockSupabase({
        user: {
          id: 'user-abc',
          email: 'norole@example.com',
          user_metadata: {},
        },
        isAdmin: false,
      })

      const result = await requireAdmin(mockSupabase)

      expect(result.role).toBe('user')
    })

    it('handles unexpected errors gracefully', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      } as unknown as SupabaseClient

      const result = await requireAdmin(mockSupabase)

      expect(result.authorized).toBe(false)
      expect(result.userId).toBeNull()
      expect(result.error).toBe('Authorization check failed')
    })
  })

  describe('checkAdmin', () => {
    it('returns true for admin user', async () => {
      const mockSupabase = createMockSupabase({
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          user_metadata: { role: 'admin' },
        },
        isAdmin: true,
      })

      const result = await checkAdmin(mockSupabase)

      expect(result).toBe(true)
    })

    it('returns false for non-admin user', async () => {
      const mockSupabase = createMockSupabase({
        user: {
          id: 'user-123',
          email: 'user@example.com',
          user_metadata: { role: 'user' },
        },
        isAdmin: false,
      })

      const result = await checkAdmin(mockSupabase)

      expect(result).toBe(false)
    })

    it('returns false for unauthenticated user', async () => {
      const mockSupabase = createMockSupabase({
        user: null,
      })

      const result = await checkAdmin(mockSupabase)

      expect(result).toBe(false)
    })
  })
})

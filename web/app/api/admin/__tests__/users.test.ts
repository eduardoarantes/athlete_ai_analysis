/**
 * Admin Users List API Tests
 *
 * Tests for GET /api/admin/users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAdminUserRow, createMockAuthResult, createMockSupabaseClient } from './test-utils'

// Mock modules before importing route
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/guards/admin-guard', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/monitoring/error-logger', () => ({
  errorLogger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}))

// Import route after mocks
import { GET } from '../users/route'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin users', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(false, 'user-123', 'user'))

    const request = new NextRequest('http://localhost:3000/api/admin/users')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: false,
      userId: null,
      role: null,
      error: 'Authentication required',
    })

    const request = new NextRequest('http://localhost:3000/api/admin/users')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('returns paginated users for admin', async () => {
    const mockSupabase = createMockSupabaseClient({
      rpcResult: [mockAdminUserRow],
    })
    // Override rpc to handle different function calls
    mockSupabase.rpc = vi.fn().mockImplementation((funcName) => {
      if (funcName === 'get_admin_users') {
        return Promise.resolve({ data: [mockAdminUserRow], error: null })
      }
      if (funcName === 'get_admin_users_count') {
        return Promise.resolve({ data: 1, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest('http://localhost:3000/api/admin/users')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toBeDefined()
    expect(data.users).toHaveLength(1)
    expect(data.pagination).toBeDefined()
    expect(data.pagination.total).toBe(1)
  })

  it('applies filters from query parameters', async () => {
    const mockRpc = vi.fn().mockImplementation((funcName, params) => {
      if (funcName === 'get_admin_users') {
        return Promise.resolve({ data: [], error: null })
      }
      if (funcName === 'get_admin_users_count') {
        return Promise.resolve({ data: 0, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const mockSupabase = { rpc: mockRpc }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(
      'http://localhost:3000/api/admin/users?search=test&role=admin&subscription=pro&strava=true&limit=10&offset=5'
    )
    await GET(request)

    // Verify the RPC was called with correct parameters
    expect(mockRpc).toHaveBeenCalledWith(
      'get_admin_users',
      expect.objectContaining({
        search_query: 'test',
        role_filter: 'admin',
        subscription_filter: 'pro',
        strava_filter: true,
        limit_count: 10,
        offset_count: 5,
      })
    )
  })

  it('returns 400 for invalid query parameters', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(
      'http://localhost:3000/api/admin/users?limit=200' // exceeds max
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 500 on database error', async () => {
    const mockSupabase = createMockSupabaseClient({
      rpcError: new Error('Database connection failed'),
    })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest('http://localhost:3000/api/admin/users')
    const response = await GET(request)

    expect(response.status).toBe(500)
  })

  it('transforms database rows to AdminUser structure', async () => {
    const mockSupabase = createMockSupabaseClient({})
    mockSupabase.rpc = vi.fn().mockImplementation((funcName) => {
      if (funcName === 'get_admin_users') {
        return Promise.resolve({ data: [mockAdminUserRow], error: null })
      }
      if (funcName === 'get_admin_users_count') {
        return Promise.resolve({ data: 1, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest('http://localhost:3000/api/admin/users')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)

    const user = data.users[0]
    // Check nested structure was created
    expect(user.user_id).toBe(mockAdminUserRow.user_id)
    expect(user.subscription).toBeDefined()
    expect(user.subscription.plan_name).toBe('pro')
    expect(user.strava).toBeDefined()
    expect(user.strava.connected).toBe(true)
    expect(user.profile).toBeDefined()
    expect(user.profile.first_name).toBe('Test')
    expect(user.counts).toBeDefined()
    expect(user.counts.total_activities).toBe(100)
  })
})

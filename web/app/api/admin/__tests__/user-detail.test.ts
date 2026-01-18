/**
 * Admin User Detail API Tests
 *
 * Tests for GET/PATCH /api/admin/users/[id]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAdminUserRow, createMockAuthResult } from './test-utils'

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

vi.mock('@/lib/services/admin', () => ({
  adminUserService: {
    getUserById: vi.fn(),
  },
}))

// Import route after mocks
import { GET, PATCH } from '../users/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'
import { adminUserService } from '@/lib/services/admin'
import { transformAdminUserRow } from '@/lib/types/admin'

const validUserId = '123e4567-e89b-12d3-a456-426614174000'

describe('GET /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin users', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(false, 'user-123', 'user'))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`)
    const response = await GET(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest('http://localhost:3000/api/admin/users/invalid-id')
    const response = await GET(request, { params: Promise.resolve({ id: 'invalid-id' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid user ID')
  })

  it('returns user details for valid request', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    const mockUser = transformAdminUserRow(mockAdminUserRow)
    vi.mocked(adminUserService.getUserById).mockResolvedValue(mockUser)

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`)
    const response = await GET(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user_id).toBe(mockAdminUserRow.user_id)
    expect(data.email).toBe(mockAdminUserRow.email)
    expect(data.subscription).toBeDefined()
    expect(data.strava).toBeDefined()
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    vi.mocked(adminUserService.getUserById).mockResolvedValue(null)

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`)
    const response = await GET(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('returns 500 on database error', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    vi.mocked(adminUserService.getUserById).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`)
    const response = await GET(request, { params: Promise.resolve({ id: validUserId }) })

    expect(response.status).toBe(500)
  })
})

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin users', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(false, 'user-123', 'user'))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`, {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({ subscriptionStatus: 'active' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: validUserId }) })

    expect(response.status).toBe(403)
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest('http://localhost:3000/api/admin/users/invalid-id', {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({ subscriptionStatus: 'active' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'invalid-id' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid user ID')
  })

  it('returns 400 for empty update body', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`, {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({}),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 400 for invalid subscription status', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`, {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({ subscriptionStatus: 'invalid' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('updates subscription status successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'plan-123' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    })

    const mockSupabase = {
      from: mockFrom,
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`, {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({ subscriptionStatus: 'suspended' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('validates plan exists before update', async () => {
    const planId = '123e4567-e89b-12d3-a456-426614174001'
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Plan not found' },
          }),
        }),
      }),
    })

    const mockSupabase = {
      from: mockFrom,
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`, {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({ planId }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('plan not found')
  })

  it('returns 404 when user subscription not found', async () => {
    const mockFrom = vi.fn().mockImplementation((table) => {
      if (table === 'subscription_plans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'plan-123' },
                error: null,
              }),
            }),
          }),
        }
      }
      // user_subscriptions - first check returns not found
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }
    })

    const mockSupabase = {
      from: mockFrom,
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${validUserId}`, {
      method: 'PATCH',
    })
    Object.defineProperty(request, 'json', {
      value: () => Promise.resolve({ subscriptionStatus: 'active' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: validUserId }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('subscription not found')
  })
})

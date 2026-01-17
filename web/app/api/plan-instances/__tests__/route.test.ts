/**
 * Plan Instances API Tests
 *
 * Tests for POST /api/plan-instances
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock modules before importing route
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

vi.mock('@/lib/services/plan-instance-service', () => ({
  planInstanceService: {
    createInstance: vi.fn(),
    listInstances: vi.fn(),
  },
}))

vi.mock('@/lib/services/validation/plan-instance-validator', () => ({
  planInstanceValidator: {
    checkOverlap: vi.fn(),
  },
}))

// Import route and mocks after module mocks
import { POST, GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { planInstanceService } from '@/lib/services/plan-instance-service'
import { planInstanceValidator } from '@/lib/services/validation/plan-instance-validator'

// Test data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

const mockTemplate = {
  id: 'template-123',
  weeks_total: 12,
  plan_data: {
    plan_metadata: {
      total_weeks: 12,
    },
  },
}

const mockPlanInstance = {
  id: 'instance-123',
  user_id: 'user-123',
  template_id: 'template-123',
  name: 'Test Plan',
  start_date: '2026-01-20',
  end_date: '2026-04-13',
  weeks_total: 12,
  status: 'scheduled',
  plan_data: {},
  created_at: '2026-01-17T00:00:00Z',
  updated_at: '2026-01-17T00:00:00Z',
}

const mockOverlappingInstance = {
  id: 'overlapping-123',
  user_id: 'user-123',
  name: 'Existing Plan',
  start_date: '2026-01-15',
  end_date: '2026-04-08',
  status: 'active',
}

describe('POST /api/plan-instances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'template-123',
        start_date: '2026-01-20',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 when template_id is missing', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        start_date: '2026-01-20',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('template_id is required')
  })

  it('returns 400 when start_date is missing', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'template-123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('start_date is required')
  })

  it('returns 400 when start_date format is invalid', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'template-123',
        start_date: '01/20/2026', // Invalid format
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('start_date must be in YYYY-MM-DD format')
  })

  it('returns 404 when template not found', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
              }),
            })),
          })),
        })),
      })),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'nonexistent-template',
        start_date: '2026-01-20',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Training plan template not found')
  })

  it('returns 409 when plan instance overlaps with existing plan', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockTemplate,
                error: null,
              }),
            })),
          })),
        })),
      })),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    // Mock overlap detection
    vi.mocked(planInstanceValidator.checkOverlap).mockResolvedValue({
      hasOverlap: true,
      overlappingInstance: mockOverlappingInstance as never,
    })

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'template-123',
        start_date: '2026-01-20',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Plan instance overlaps with existing plan')
    expect(data.overlappingInstance).toEqual(mockOverlappingInstance)

    // Verify validator was called with correct parameters
    expect(planInstanceValidator.checkOverlap).toHaveBeenCalledWith({
      userId: 'user-123',
      startDate: '2026-01-20',
      endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // Should be calculated end date
    })
  })

  it('creates plan instance successfully when no overlap exists', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockTemplate,
                error: null,
              }),
            })),
          })),
        })),
      })),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    // Mock no overlap
    vi.mocked(planInstanceValidator.checkOverlap).mockResolvedValue({
      hasOverlap: false,
    })

    // Mock successful creation
    vi.mocked(planInstanceService.createInstance).mockResolvedValue(mockPlanInstance as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'template-123',
        start_date: '2026-01-20',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.instance).toEqual(mockPlanInstance)

    // Verify validator was called
    expect(planInstanceValidator.checkOverlap).toHaveBeenCalled()

    // Verify service was called after validation passed
    expect(planInstanceService.createInstance).toHaveBeenCalledWith('user-123', {
      template_id: 'template-123',
      start_date: '2026-01-20',
    })
  })

  it('calculates end date correctly based on template weeks_total', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { ...mockTemplate, weeks_total: 8 }, // 8 weeks
                error: null,
              }),
            })),
          })),
        })),
      })),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    vi.mocked(planInstanceValidator.checkOverlap).mockResolvedValue({
      hasOverlap: false,
    })

    vi.mocked(planInstanceService.createInstance).mockResolvedValue(mockPlanInstance as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances', {
      method: 'POST',
      body: JSON.stringify({
        template_id: 'template-123',
        start_date: '2026-01-20',
      }),
    })

    await POST(request)

    // Verify validator was called with correct end date (8 weeks = 56 days from start)
    expect(planInstanceValidator.checkOverlap).toHaveBeenCalledWith({
      userId: 'user-123',
      startDate: '2026-01-20',
      endDate: '2026-03-17', // 8 weeks from 2026-01-20
    })
  })
})

describe('GET /api/plan-instances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns plan instances for authenticated user', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    vi.mocked(planInstanceService.listInstances).mockResolvedValue([mockPlanInstance] as never)

    const request = new NextRequest('http://localhost:3000/api/plan-instances')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.instances).toEqual([mockPlanInstance])
    expect(planInstanceService.listInstances).toHaveBeenCalledWith('user-123', {
      includeCompleted: false,
    })
  })

  it('respects includeCompleted query parameter', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    vi.mocked(planInstanceService.listInstances).mockResolvedValue([mockPlanInstance] as never)

    const request = new NextRequest(
      'http://localhost:3000/api/plan-instances?includeCompleted=true'
    )
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(planInstanceService.listInstances).toHaveBeenCalledWith('user-123', {
      includeCompleted: true,
    })
  })

  it('filters by status query parameter', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    vi.mocked(planInstanceService.listInstances).mockResolvedValue([mockPlanInstance] as never)

    const request = new NextRequest(
      'http://localhost:3000/api/plan-instances?status=active,scheduled'
    )
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(planInstanceService.listInstances).toHaveBeenCalledWith('user-123', {
      status: ['active', 'scheduled'],
      includeCompleted: false,
    })
  })
})

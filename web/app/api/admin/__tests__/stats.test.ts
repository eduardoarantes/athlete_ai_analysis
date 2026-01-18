/**
 * Admin Stats API Tests
 *
 * Tests for GET /api/admin/stats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAdminStatsRow, createMockAuthResult } from './test-utils'

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
  adminStatsService: {
    getStats: vi.fn(),
  },
}))

// Import route after mocks
import { GET } from '../stats/route'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'
import { adminStatsService } from '@/lib/services/admin'
import { transformAdminStatsRow } from '@/lib/types/admin'

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin users', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(false, 'user-123', 'user'))

    const response = await GET()
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

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns platform statistics for admin', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    const mockStats = transformAdminStatsRow(mockAdminStatsRow)
    vi.mocked(adminStatsService.getStats).mockResolvedValue(mockStats)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toBeDefined()
    expect(data.subscriptions).toBeDefined()
    expect(data.strava).toBeDefined()
    expect(data.content).toBeDefined()
  })

  it('returns 500 on database error', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    vi.mocked(adminStatsService.getStats).mockRejectedValue(new Error('Database connection failed'))

    const response = await GET()

    expect(response.status).toBe(500)
  })

  it('returns 500 when stats data is empty', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    vi.mocked(adminStatsService.getStats).mockRejectedValue(new Error('No stats data returned from view'))

    const response = await GET()

    expect(response.status).toBe(500)
  })

  it('transforms database row to nested AdminStats structure', async () => {
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))
    const mockStats = transformAdminStatsRow(mockAdminStatsRow)
    vi.mocked(adminStatsService.getStats).mockResolvedValue(mockStats)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)

    // Check user stats
    expect(data.users.total).toBe(mockAdminStatsRow.total_users)
    expect(data.users.last_7_days).toBe(mockAdminStatsRow.users_last_7_days)
    expect(data.users.active_7_days).toBe(mockAdminStatsRow.active_users_7_days)

    // Check subscription stats
    expect(data.subscriptions.active).toBe(mockAdminStatsRow.active_subscriptions)
    expect(data.subscriptions.by_plan.free).toBe(mockAdminStatsRow.free_plan_users)
    expect(data.subscriptions.by_plan.pro).toBe(mockAdminStatsRow.pro_plan_users)
    expect(data.subscriptions.by_plan.team).toBe(mockAdminStatsRow.team_plan_users)

    // Check Strava stats
    expect(data.strava.total_connections).toBe(mockAdminStatsRow.total_strava_connections)
    expect(data.strava.successful_syncs).toBe(mockAdminStatsRow.successful_syncs)

    // Check content stats
    expect(data.content.total_activities).toBe(mockAdminStatsRow.total_activities)
    expect(data.content.total_training_plans).toBe(mockAdminStatsRow.total_training_plans)
    expect(data.content.completed_reports).toBe(mockAdminStatsRow.completed_reports)
  })

  it('handles unexpected errors gracefully', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Unexpected error'))
    vi.mocked(requireAdmin).mockResolvedValue(createMockAuthResult(true))

    const response = await GET()

    expect(response.status).toBe(500)
  })
})

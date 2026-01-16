/**
 * Library Workout Addition Tests (Deprecated Endpoint)
 *
 * Tests for the deprecated POST /api/schedule/workouts/add endpoint.
 * This endpoint now returns HTTP 410 (Gone) with deprecation information.
 *
 * New endpoint: POST /api/manual-workouts
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { POST } from '../workouts/add/route'

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

describe('POST /api/schedule/workouts/add (Deprecated)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  test('returns 410 Gone with deprecation message', async () => {
    const response = await POST()
    const json = await response.json()

    expect(response.status).toBe(410)
    expect(json.error).toBe('This endpoint is deprecated. Use POST /api/manual-workouts instead.')
    expect(json.new_endpoint).toBe('/api/manual-workouts')
    expect(json.migration_status).toBe('This endpoint will be removed in a future version.')
  })

  test('includes correct migration information in response', async () => {
    const response = await POST()
    const json = await response.json()

    expect(response.status).toBe(410)
    expect(json.error).toBe('This endpoint is deprecated. Use POST /api/manual-workouts instead.')
    expect(json.new_endpoint).toBe('/api/manual-workouts')
    expect(json.migration_status).toBe('This endpoint will be removed in a future version.')
  })
})

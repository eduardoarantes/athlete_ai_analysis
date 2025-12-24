/**
 * OAuth Callback Handler Tests
 *
 * Tests for GET /auth/callback
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

// Import route after mocks
import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login with error parameter when error in query string', async () => {
    const request = new NextRequest(
      'http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access'
    )
    const response = await GET(request)

    expect(response.status).toBe(307) // temporary redirect
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=User%20denied%20access'
    )
    expect(errorLogger.logWarning).toHaveBeenCalledWith(
      expect.stringContaining('OAuth error'),
      expect.objectContaining({
        metadata: expect.objectContaining({
          error: 'access_denied',
          errorDescription: 'User denied access',
        }),
      })
    )
  })

  it('redirects to login with generic error when no error_description provided', async () => {
    const request = new NextRequest('http://localhost:3000/auth/callback?error=server_error')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=Authentication%20failed'
    )
    expect(errorLogger.logWarning).toHaveBeenCalled()
  })

  it('redirects to login when code is missing', async () => {
    const request = new NextRequest('http://localhost:3000/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=Invalid+callback+request'
    )
    expect(errorLogger.logWarning).toHaveBeenCalledWith(
      expect.stringContaining('No code parameter'),
      expect.anything()
    )
  })

  it('successfully exchanges code for session and redirects to dashboard', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/auth/callback?code=auth-code-123')
    const response = await GET(request)

    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    expect(errorLogger.logInfo).toHaveBeenCalledWith(
      expect.stringContaining('OAuth authentication successful'),
      expect.anything()
    )
  })

  it('redirects to custom next parameter after successful authentication', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest(
      'http://localhost:3000/auth/callback?code=auth-code-123&next=/reports'
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/reports')
  })

  it('sanitizes next parameter to prevent open redirects', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest(
      'http://localhost:3000/auth/callback?code=auth-code-123&next=https://evil.com'
    )
    const response = await GET(request)

    // Should redirect to dashboard, not external URL
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('redirects to login when exchangeCodeForSession fails', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'Invalid authorization code' },
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/auth/callback?code=invalid-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=Invalid%20authorization%20code'
    )
    expect(errorLogger.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        path: '/auth/callback',
        metadata: expect.objectContaining({
          error: 'Invalid authorization code',
        }),
      })
    )
  })

  it('handles exceptions during code exchange', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockRejectedValue(new Error('Network error')),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/auth/callback?code=auth-code-123')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=Authentication+failed'
    )
    expect(errorLogger.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        path: '/auth/callback',
        metadata: expect.objectContaining({
          phase: 'code_exchange',
        }),
      })
    )
  })

  it('logs successful authentication with user ID', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-456' } } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest('http://localhost:3000/auth/callback?code=auth-code-123')
    await GET(request)

    expect(errorLogger.logInfo).toHaveBeenCalledWith(
      expect.stringContaining('OAuth authentication successful'),
      expect.objectContaining({
        userId: 'user-456',
      })
    )
  })

  it('handles multiple query parameters correctly', async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const request = new NextRequest(
      'http://localhost:3000/auth/callback?code=auth-code-123&next=/dashboard&extra=value'
    )
    const response = await GET(request)

    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123')
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })
})

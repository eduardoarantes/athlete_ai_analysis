/**
 * Google Login Button Tests
 *
 * Tests for the GoogleLoginButton component that handles Google OAuth via Supabase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock modules before importing component
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/monitoring/error-logger', () => ({
  errorLogger: {
    logError: vi.fn(),
    logInfo: vi.fn(),
  },
}))

// Import after mocks
import { GoogleLoginButton } from '../google-login-button'
import { createClient } from '@/lib/supabase/client'
import { errorLogger } from '@/lib/monitoring/error-logger'

describe('GoogleLoginButton', () => {
  const mockSignInWithOAuth = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default successful OAuth mock
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/oauth/authorize' },
      error: null,
    })

    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    } as never)

    // Mock window.location.origin for redirect URL construction
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    })
  })

  describe('Rendering', () => {
    it('renders with login mode by default', () => {
      render(<GoogleLoginButton />)

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    })

    it('renders with signup mode when mode="signup"', () => {
      render(<GoogleLoginButton mode="signup" />)

      expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument()
    })

    it('renders Google logo SVG', () => {
      const { container } = render(<GoogleLoginButton />)

      // Check for SVG element with Google colors
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<GoogleLoginButton className="custom-class" />)

      const button = container.querySelector('button')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('OAuth Flow', () => {
    it('initiates Google OAuth when button is clicked', async () => {
      const user = userEvent.setup()
      render(<GoogleLoginButton />)

      const button = screen.getByRole('button', { name: /sign in with google/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard',
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        })
      })
    })

    it('uses custom redirectTo when provided', async () => {
      const user = userEvent.setup()
      render(<GoogleLoginButton redirectTo="/custom-page" />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: 'http://localhost:3000/auth/callback?next=%2Fcustom-page',
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        })
      })
    })

    it('shows loading state while OAuth is processing', async () => {
      const user = userEvent.setup()

      // Make OAuth call take some time
      mockSignInWithOAuth.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: { url: 'https://accounts.google.com' },
                  error: null,
                }),
              100
            )
          })
      )

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button', { name: /sign in with google/i })
      await user.click(button)

      // Check for loading state
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()

      // Note: In real usage, browser would redirect before loading state clears
      // For successful OAuth, loading state persists until redirect happens
    })

    it('disables button while loading', async () => {
      const user = userEvent.setup()

      mockSignInWithOAuth.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: { url: 'https://accounts.google.com' },
                  error: null,
                }),
              100
            )
          })
      )

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(button).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('displays error message when OAuth fails', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Failed to connect to Google'

      mockSignInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: errorMessage },
      })

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('logs errors to errorLogger', async () => {
      const user = userEvent.setup()
      const errorMessage = 'OAuth error'

      mockSignInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: errorMessage },
      })

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(errorLogger.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: errorMessage,
          }),
          expect.objectContaining({
            metadata: expect.objectContaining({
              provider: 'google',
            }),
          })
        )
      })
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()

      mockSignInWithOAuth.mockRejectedValue(new Error('Network error'))

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('clears error when retrying', async () => {
      const user = userEvent.setup()

      // First call fails
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { url: null },
        error: { message: 'OAuth error' },
      })

      // Second call succeeds
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { url: 'https://accounts.google.com' },
        error: null,
      })

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')

      // First click - error
      await user.click(button)
      await waitFor(() => {
        expect(screen.getByText('OAuth error')).toBeInTheDocument()
      })

      // Second click - success
      await user.click(button)
      await waitFor(() => {
        expect(screen.queryByText('OAuth error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper button role', () => {
      render(<GoogleLoginButton />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has descriptive text for screen readers', () => {
      render(<GoogleLoginButton />)

      const button = screen.getByRole('button', { name: /sign in with google/i })
      expect(button).toBeInTheDocument()
    })

    it('disabled state is properly conveyed to assistive technologies', async () => {
      const user = userEvent.setup()

      mockSignInWithOAuth.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: { url: 'https://accounts.google.com' },
                  error: null,
                }),
              100
            )
          })
      )

      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(button).toHaveAttribute('disabled')
    })
  })

  describe('Integration with Supabase', () => {
    it('creates Supabase client on mount', () => {
      render(<GoogleLoginButton />)

      expect(createClient).toHaveBeenCalled()
    })

    it('uses correct OAuth provider', async () => {
      const user = userEvent.setup()
      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'google',
          })
        )
      })
    })

    it('includes required OAuth options', async () => {
      const user = userEvent.setup()
      render(<GoogleLoginButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              queryParams: expect.objectContaining({
                access_type: 'offline',
                prompt: 'consent',
              }),
            }),
          })
        )
      })
    })
  })
})

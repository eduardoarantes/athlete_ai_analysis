import { describe, it, expect } from 'vitest'
import { extractGoogleMetadata } from '../google-metadata'
import type { User } from '@supabase/supabase-js'

/**
 * Helper to create a mock Supabase User object
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'test@example.com',
    ...overrides,
  } as User
}

describe('extractGoogleMetadata', () => {
  describe('full name extraction', () => {
    it('should extract full_name when present', () => {
      const user = createMockUser({
        user_metadata: {
          full_name: 'John Doe',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.fullName).toBe('John Doe')
    })

    it('should extract name when full_name is not present', () => {
      const user = createMockUser({
        user_metadata: {
          name: 'Jane Smith',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.fullName).toBe('Jane Smith')
    })

    it('should prefer full_name over name when both are present', () => {
      const user = createMockUser({
        user_metadata: {
          full_name: 'John Doe',
          name: 'Jane Smith',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.fullName).toBe('John Doe')
    })

    it('should return null when both full_name and name are missing', () => {
      const user = createMockUser({
        user_metadata: {},
      })

      const result = extractGoogleMetadata(user)

      expect(result.fullName).toBeNull()
    })

    it('should return null when full_name is empty string', () => {
      const user = createMockUser({
        user_metadata: {
          full_name: '   ',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.fullName).toBeNull()
    })

    it('should return null when full_name is not a string', () => {
      const user = createMockUser({
        user_metadata: {
          full_name: 123, // Invalid type
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.fullName).toBeNull()
    })
  })

  describe('avatar URL extraction', () => {
    it('should extract avatar_url when present', () => {
      const user = createMockUser({
        user_metadata: {
          avatar_url: 'https://example.com/avatar.jpg',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('should extract picture when avatar_url is not present', () => {
      const user = createMockUser({
        user_metadata: {
          picture: 'https://example.com/picture.jpg',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.avatarUrl).toBe('https://example.com/picture.jpg')
    })

    it('should prefer avatar_url over picture when both are present', () => {
      const user = createMockUser({
        user_metadata: {
          avatar_url: 'https://example.com/avatar.jpg',
          picture: 'https://example.com/picture.jpg',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('should return null when both avatar_url and picture are missing', () => {
      const user = createMockUser({
        user_metadata: {},
      })

      const result = extractGoogleMetadata(user)

      expect(result.avatarUrl).toBeNull()
    })

    it('should return null when avatar_url is empty string', () => {
      const user = createMockUser({
        user_metadata: {
          avatar_url: '   ',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.avatarUrl).toBeNull()
    })

    it('should return null when avatar_url is not a string', () => {
      const user = createMockUser({
        user_metadata: {
          avatar_url: 123, // Invalid type
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result.avatarUrl).toBeNull()
    })
  })

  describe('email extraction', () => {
    it('should extract email from user.email', () => {
      const user = createMockUser({
        email: 'test@example.com',
      })

      const result = extractGoogleMetadata(user)

      expect(result.email).toBe('test@example.com')
    })

    it('should return null when email is missing', () => {
      const user = {
        ...createMockUser(),
        email: '' as string, // Cast to avoid TS strict optional error
      }

      const result = extractGoogleMetadata(user)

      expect(result.email).toBeNull()
    })

    it('should return null when email is empty string', () => {
      const user = createMockUser({
        email: '   ',
      })

      const result = extractGoogleMetadata(user)

      expect(result.email).toBeNull()
    })
  })

  describe('complete metadata extraction', () => {
    it('should extract all fields when all are present', () => {
      const user = createMockUser({
        email: 'john@example.com',
        user_metadata: {
          full_name: 'John Doe',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      })

      const result = extractGoogleMetadata(user)

      expect(result).toEqual({
        fullName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
      })
    })

    it('should handle missing user_metadata gracefully', () => {
      const user = {
        ...createMockUser({
          email: 'test@example.com',
        }),
        user_metadata: {} as Record<string, unknown>, // Use empty object instead of undefined
      }

      const result = extractGoogleMetadata(user)

      expect(result).toEqual({
        fullName: null,
        avatarUrl: null,
        email: 'test@example.com',
      })
    })

    it('should handle completely empty user metadata', () => {
      const user = {
        ...createMockUser(),
        email: '' as string,
        user_metadata: {},
      }

      const result = extractGoogleMetadata(user)

      expect(result).toEqual({
        fullName: null,
        avatarUrl: null,
        email: null,
      })
    })
  })
})

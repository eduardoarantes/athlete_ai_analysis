/**
 * Admin Validation Tests
 *
 * Unit tests for admin API validation schemas and helper functions.
 */

import { describe, it, expect } from 'vitest'
import {
  uuidSchema,
  userRoleSchema,
  subscriptionStatusSchema,
  adminUsersQuerySchema,
  updateUserSubscriptionSchema,
  validateAdminUsersQuery,
  validateUuid,
  validateUpdateSubscription,
} from '../admin'

describe('Admin Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('accepts valid UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000'
      expect(uuidSchema.parse(validUuid)).toBe(validUuid)
    })

    it('rejects invalid UUID format', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow()
      expect(() => uuidSchema.parse('123')).toThrow()
      expect(() => uuidSchema.parse('')).toThrow()
    })

    it('rejects UUID with wrong characters', () => {
      expect(() => uuidSchema.parse('123e4567-e89b-12d3-a456-42661417400z')).toThrow()
    })
  })

  describe('userRoleSchema', () => {
    it('accepts valid roles', () => {
      expect(userRoleSchema.parse('user')).toBe('user')
      expect(userRoleSchema.parse('admin')).toBe('admin')
    })

    it('rejects invalid roles', () => {
      expect(() => userRoleSchema.parse('superadmin')).toThrow()
      expect(() => userRoleSchema.parse('moderator')).toThrow()
      expect(() => userRoleSchema.parse('')).toThrow()
    })
  })

  describe('subscriptionStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(subscriptionStatusSchema.parse('active')).toBe('active')
      expect(subscriptionStatusSchema.parse('suspended')).toBe('suspended')
      expect(subscriptionStatusSchema.parse('cancelled')).toBe('cancelled')
      expect(subscriptionStatusSchema.parse('expired')).toBe('expired')
    })

    it('rejects invalid statuses', () => {
      expect(() => subscriptionStatusSchema.parse('pending')).toThrow()
      expect(() => subscriptionStatusSchema.parse('inactive')).toThrow()
      expect(() => subscriptionStatusSchema.parse('')).toThrow()
    })
  })

  describe('adminUsersQuerySchema', () => {
    it('accepts empty query (uses defaults)', () => {
      const result = adminUsersQuerySchema.parse({})
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
      expect(result.search).toBeUndefined()
      expect(result.role).toBeUndefined()
      expect(result.subscription).toBeUndefined()
      expect(result.strava).toBeUndefined()
    })

    it('accepts valid query with all filters', () => {
      const result = adminUsersQuerySchema.parse({
        search: 'test@example.com',
        role: 'admin',
        subscription: 'pro',
        strava: 'true',
        limit: '50',
        offset: '10',
      })
      expect(result.search).toBe('test@example.com')
      expect(result.role).toBe('admin')
      expect(result.subscription).toBe('pro')
      expect(result.strava).toBe(true)
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(10)
    })

    it('transforms strava string to boolean', () => {
      expect(adminUsersQuerySchema.parse({ strava: 'true' }).strava).toBe(true)
      expect(adminUsersQuerySchema.parse({ strava: 'false' }).strava).toBe(false)
      expect(adminUsersQuerySchema.parse({ strava: '' }).strava).toBeUndefined()
      expect(adminUsersQuerySchema.parse({ strava: 'invalid' }).strava).toBeUndefined()
    })

    it('enforces limit constraints', () => {
      expect(adminUsersQuerySchema.parse({ limit: '1' }).limit).toBe(1)
      expect(adminUsersQuerySchema.parse({ limit: '100' }).limit).toBe(100)
      expect(() => adminUsersQuerySchema.parse({ limit: '0' })).toThrow()
      expect(() => adminUsersQuerySchema.parse({ limit: '101' })).toThrow()
      expect(() => adminUsersQuerySchema.parse({ limit: '-1' })).toThrow()
    })

    it('enforces offset constraints', () => {
      expect(adminUsersQuerySchema.parse({ offset: '0' }).offset).toBe(0)
      expect(adminUsersQuerySchema.parse({ offset: '1000' }).offset).toBe(1000)
      expect(() => adminUsersQuerySchema.parse({ offset: '-1' })).toThrow()
    })

    it('rejects invalid role filter', () => {
      expect(() => adminUsersQuerySchema.parse({ role: 'invalid' })).toThrow()
    })
  })

  describe('updateUserSubscriptionSchema', () => {
    it('accepts valid subscription status update', () => {
      const result = updateUserSubscriptionSchema.parse({
        subscriptionStatus: 'suspended',
      })
      expect(result.subscriptionStatus).toBe('suspended')
      expect(result.planId).toBeUndefined()
    })

    it('accepts valid plan ID update', () => {
      const planId = '123e4567-e89b-12d3-a456-426614174000'
      const result = updateUserSubscriptionSchema.parse({
        planId,
      })
      expect(result.planId).toBe(planId)
      expect(result.subscriptionStatus).toBeUndefined()
    })

    it('accepts both status and plan ID', () => {
      const planId = '123e4567-e89b-12d3-a456-426614174000'
      const result = updateUserSubscriptionSchema.parse({
        subscriptionStatus: 'active',
        planId,
      })
      expect(result.subscriptionStatus).toBe('active')
      expect(result.planId).toBe(planId)
    })

    it('rejects empty update (at least one field required)', () => {
      expect(() => updateUserSubscriptionSchema.parse({})).toThrow(/At least one field/)
    })

    it('rejects invalid subscription status', () => {
      expect(() =>
        updateUserSubscriptionSchema.parse({
          subscriptionStatus: 'invalid',
        })
      ).toThrow()
    })

    it('rejects invalid plan ID format', () => {
      expect(() =>
        updateUserSubscriptionSchema.parse({
          planId: 'not-a-uuid',
        })
      ).toThrow()
    })
  })
})

describe('Admin Validation Helper Functions', () => {
  describe('validateAdminUsersQuery', () => {
    it('parses valid URLSearchParams', () => {
      const searchParams = new URLSearchParams({
        search: 'john',
        role: 'user',
        limit: '25',
        offset: '50',
      })

      const result = validateAdminUsersQuery(searchParams)
      expect(result.search).toBe('john')
      expect(result.role).toBe('user')
      expect(result.limit).toBe(25)
      expect(result.offset).toBe(50)
    })

    it('handles empty URLSearchParams with defaults', () => {
      const searchParams = new URLSearchParams()

      const result = validateAdminUsersQuery(searchParams)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
      expect(result.search).toBeUndefined()
    })

    it('throws on invalid parameters', () => {
      const searchParams = new URLSearchParams({
        limit: '200', // exceeds max
      })

      expect(() => validateAdminUsersQuery(searchParams)).toThrow()
    })
  })

  describe('validateUuid', () => {
    it('returns valid UUID unchanged', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000'
      expect(validateUuid(uuid)).toBe(uuid)
    })

    it('throws on invalid UUID', () => {
      expect(() => validateUuid('invalid')).toThrow()
      expect(() => validateUuid('')).toThrow()
    })
  })

  describe('validateUpdateSubscription', () => {
    it('parses valid request body', async () => {
      const mockRequest = {
        json: async () => ({
          subscriptionStatus: 'active',
          planId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      } as Request

      const result = await validateUpdateSubscription(mockRequest)
      expect(result.subscriptionStatus).toBe('active')
      expect(result.planId).toBe('123e4567-e89b-12d3-a456-426614174000')
    })

    it('throws on empty body', async () => {
      const mockRequest = {
        json: async () => ({}),
      } as Request

      await expect(validateUpdateSubscription(mockRequest)).rejects.toThrow()
    })

    it('throws on invalid body', async () => {
      const mockRequest = {
        json: async () => ({
          subscriptionStatus: 'invalid-status',
        }),
      } as Request

      await expect(validateUpdateSubscription(mockRequest)).rejects.toThrow()
    })
  })
})

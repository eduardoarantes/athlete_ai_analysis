/**
 * Admin API Validation Schemas
 *
 * Zod schemas for validating admin API route inputs.
 * These schemas ensure type safety and provide clear validation errors.
 */

import { z } from 'zod'

/**
 * UUID validation schema
 * Used for validating user IDs and plan IDs
 */
export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format',
})

/**
 * User role schema
 * Validates role filter parameter
 */
export const userRoleSchema = z.enum(['user', 'admin'])

/**
 * Subscription status schema
 * Validates subscription status values
 */
export const subscriptionStatusSchema = z.enum(['active', 'suspended', 'cancelled', 'expired'])

/**
 * Query parameters schema for GET /api/admin/users
 */
export const adminUsersQuerySchema = z.object({
  // Search filter
  search: z.string().optional(),

  // Role filter
  role: userRoleSchema.optional(),

  // Subscription plan filter
  subscription: z.string().optional(),

  // Strava connection filter
  strava: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return undefined
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    }),

  // Pagination
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),

  offset: z
    .string()
    .optional()
    .default('0')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0, 'Offset must be non-negative')),
})

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>

/**
 * Path parameters schema for GET/PATCH /api/admin/users/[id]
 */
export const adminUserIdParamsSchema = z.object({
  id: uuidSchema,
})

export type AdminUserIdParams = z.infer<typeof adminUserIdParamsSchema>

/**
 * Request body schema for PATCH /api/admin/users/[id]
 */
export const updateUserSubscriptionSchema = z
  .object({
    // Update subscription status
    subscriptionStatus: subscriptionStatusSchema.optional(),

    // Update subscription plan
    planId: uuidSchema.optional(),
  })
  .refine((data) => data.subscriptionStatus !== undefined || data.planId !== undefined, {
    message: 'At least one field (subscriptionStatus or planId) must be provided',
  })

export type UpdateUserSubscription = z.infer<typeof updateUserSubscriptionSchema>

/**
 * Helper function to validate query parameters
 * Returns parsed data or throws validation error
 */
export function validateAdminUsersQuery(searchParams: URLSearchParams) {
  const params = {
    search: searchParams.get('search') || undefined,
    role: searchParams.get('role') || undefined,
    subscription: searchParams.get('subscription') || undefined,
    strava: searchParams.get('strava') || undefined,
    limit: searchParams.get('limit') || '20',
    offset: searchParams.get('offset') || '0',
  }

  return adminUsersQuerySchema.parse(params)
}

/**
 * Helper function to validate UUID path parameter
 * Returns parsed UUID or throws validation error
 */
export function validateUuid(id: string) {
  return uuidSchema.parse(id)
}

/**
 * Helper function to validate update subscription request body
 * Returns parsed data or throws validation error
 */
export async function validateUpdateSubscription(request: Request) {
  const body = await request.json()
  return updateUserSubscriptionSchema.parse(body)
}

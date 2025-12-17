/**
 * Admin Single User Detail API
 *
 * GET /api/admin/users/[id]
 * PATCH /api/admin/users/[id]
 *
 * Returns detailed information for a single user or updates user subscription.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { validateUuid, validateUpdateSubscription } from '@/lib/validations/admin'
import { transformAdminUserRow } from '@/lib/types/admin'
import type { AdminUserRow } from '@/lib/types/admin'
import { HTTP_STATUS, MESSAGES } from '@/lib/constants'

/**
 * GET /api/admin/users/[id]
 *
 * Path parameters:
 * - id: UUID - User ID
 *
 * Response:
 * AdminUser object with full details
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Check admin authentication
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)

    if (!auth.authorized) {
      errorLogger.logWarning('Admin user detail access denied', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]',
        method: 'GET',
        metadata: { reason: auth.error },
      })

      return NextResponse.json(
        { error: auth.error || MESSAGES.UNAUTHORIZED },
        { status: auth.userId ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // 2. Await params (Next.js 15+ requirement)
    const { id } = await params

    // 3. Validate UUID parameter
    let userId: string
    try {
      userId = validateUuid(id)
    } catch (error) {
      errorLogger.logWarning('Invalid user ID format', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]',
        metadata: {
          providedId: id,
          error: (error as Error).message,
        },
      })

      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // 4. Call database function to get user
    const { data: userData, error: userError } = await supabase.rpc(
      'get_admin_user_by_id' as never,
      {
        target_user_id: userId,
      } as never
    )

    if (userError) {
      errorLogger.logError(new Error(`get_admin_user_by_id failed: ${userError.message}`), {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]',
        method: 'GET',
        metadata: {
          targetUserId: userId,
          dbError: userError,
        },
      })

      return NextResponse.json(
        { error: MESSAGES.ADMIN_USERS_FETCH_FAILED },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // 5. Check if user exists
    const dataArray = userData as AdminUserRow[] | null
    if (!dataArray || dataArray.length === 0) {
      errorLogger.logInfo('Admin user detail: user not found', {
        ...(auth.userId && { userId: auth.userId }),
        metadata: { targetUserId: userId },
      })

      return NextResponse.json(
        { error: MESSAGES.ADMIN_USER_NOT_FOUND },
        { status: HTTP_STATUS.NOT_FOUND }
      )
    }

    // 6. Transform database row to AdminUser object
    const user = transformAdminUserRow(dataArray[0]!)

    // 7. Log successful access
    errorLogger.logInfo('Admin user detail accessed', {
      ...(auth.userId && { userId: auth.userId }),
      metadata: {
        targetUserId: userId,
        targetEmail: user.email,
        targetRole: user.role,
      },
    })

    // 8. Return user data
    return NextResponse.json(user)
  } catch (error) {
    // Catch-all error handler
    errorLogger.logError(error as Error, {
      path: '/api/admin/users/[id]',
      method: 'GET',
      metadata: { phase: 'unexpected' },
    })

    return NextResponse.json(
      { error: MESSAGES.INTERNAL_SERVER_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * PATCH /api/admin/users/[id]
 *
 * Update user subscription (admin only)
 *
 * Path parameters:
 * - id: UUID - User ID
 *
 * Request body:
 * {
 *   subscriptionStatus?: 'active' | 'suspended' | 'cancelled' | 'expired',
 *   planId?: UUID
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: 'User subscription updated successfully'
 * }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Check admin authentication
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)

    if (!auth.authorized) {
      errorLogger.logWarning('Admin user update access denied', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]',
        method: 'PATCH',
        metadata: { reason: auth.error },
      })

      return NextResponse.json(
        { error: auth.error || MESSAGES.UNAUTHORIZED },
        { status: auth.userId ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // 2. Await params
    const { id } = await params

    // 3. Validate UUID parameter
    let userId: string
    try {
      userId = validateUuid(id)
    } catch (error) {
      errorLogger.logWarning('Invalid user ID format for update', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]',
        metadata: {
          providedId: id,
          error: (error as Error).message,
        },
      })

      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // 4. Validate request body
    let updateData
    try {
      updateData = await validateUpdateSubscription(request)
    } catch (error) {
      errorLogger.logWarning('Invalid update subscription request', {
        ...(auth.userId && { userId: auth.userId }),
        path: '/api/admin/users/[id]',
        metadata: {
          targetUserId: userId,
          error: (error as Error).message,
        },
      })

      return NextResponse.json(
        {
          error: MESSAGES.VALIDATION_FAILED,
          details: error instanceof Error ? error.message : 'Invalid request body',
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // 5. If planId provided, verify it exists
    if (updateData.planId) {
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans' as never)
        .select('id')
        .eq('id', updateData.planId)
        .single()

      if (planError || !plan) {
        errorLogger.logWarning('Subscription plan not found', {
          ...(auth.userId && { userId: auth.userId }),
          metadata: {
            targetUserId: userId,
            planId: updateData.planId,
          },
        })

        return NextResponse.json(
          { error: 'Subscription plan not found' },
          { status: HTTP_STATUS.NOT_FOUND }
        )
      }
    }

    // 6. Check if user has a subscription
    const { data: existingSubscription, error: checkError } = await supabase
      .from('user_subscriptions' as never)
      .select('id')
      .eq('user_id', userId)
      .single()

    if (checkError || !existingSubscription) {
      errorLogger.logWarning('User subscription not found', {
        ...(auth.userId && { userId: auth.userId }),
        metadata: {
          targetUserId: userId,
          dbError: checkError,
        },
      })

      return NextResponse.json(
        { error: 'User subscription not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      )
    }

    // 7. Build update object (filter out undefined values for exactOptionalPropertyTypes)
    const subscriptionUpdate: { status?: string; plan_id?: string } = {}

    if (updateData.subscriptionStatus !== undefined) {
      subscriptionUpdate.status = updateData.subscriptionStatus
    }

    if (updateData.planId !== undefined) {
      subscriptionUpdate.plan_id = updateData.planId
    }

    // 8. Update user subscription
    const { error: updateError } = await supabase
      .from('user_subscriptions' as never)
      .update(subscriptionUpdate as never)
      .eq('user_id', userId)

    if (updateError) {
      errorLogger.logError(
        new Error(`Failed to update user subscription: ${updateError.message}`),
        {
          ...(auth.userId && { userId: auth.userId }),
          path: '/api/admin/users/[id]',
          method: 'PATCH',
          metadata: {
            targetUserId: userId,
            updateData: subscriptionUpdate,
            dbError: updateError,
          },
        }
      )

      return NextResponse.json(
        { error: MESSAGES.ADMIN_UPDATE_FAILED },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // 9. Log successful update
    errorLogger.logInfo('Admin updated user subscription', {
      ...(auth.userId && { userId: auth.userId }),
      metadata: {
        action: 'update_user_subscription',
        targetUserId: userId,
        changes: subscriptionUpdate,
      },
    })

    // 10. Return success response
    return NextResponse.json({
      success: true,
      message: 'User subscription updated successfully',
    })
  } catch (error) {
    // Catch-all error handler
    errorLogger.logError(error as Error, {
      path: '/api/admin/users/[id]',
      method: 'PATCH',
      metadata: { phase: 'unexpected' },
    })

    return NextResponse.json(
      { error: MESSAGES.INTERNAL_SERVER_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

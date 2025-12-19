import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { planInstanceService } from '@/lib/services/plan-instance-service'

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

/**
 * Get a specific plan instance by ID
 * GET /api/plan-instances/[instanceId]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params

  // Validate instanceId format
  if (!isValidUUID(instanceId)) {
    return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const instance = await planInstanceService.getInstance(user.id, instanceId)

    if (!instance) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 })
    }

    return NextResponse.json({ instance })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/plan-instances/${instanceId}`,
      method: 'GET',
    })
    return NextResponse.json({ error: 'Failed to fetch plan instance' }, { status: 500 })
  }
}

/**
 * Cancel a plan instance
 * DELETE /api/plan-instances/[instanceId]
 *
 * This marks the instance as 'cancelled' rather than deleting it,
 * preserving history. Cancelled instances don't block scheduling new plans.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params

  // Validate instanceId format
  if (!isValidUUID(instanceId)) {
    return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const instance = await planInstanceService.cancelInstance(user.id, instanceId)
      return NextResponse.json({ instance, message: 'Plan instance cancelled' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      if (message.includes('not found')) {
        return NextResponse.json({ error: message }, { status: 404 })
      }

      if (message.includes('Cannot cancel')) {
        return NextResponse.json({ error: message }, { status: 400 })
      }

      throw error
    }
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: `/api/plan-instances/${instanceId}`,
      method: 'DELETE',
    })
    return NextResponse.json({ error: 'Failed to cancel plan instance' }, { status: 500 })
  }
}

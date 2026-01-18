/**
 * Plan Instance Validator
 *
 * Replaces PostgreSQL trigger with TypeScript validation:
 * - check_plan_instance_overlap() → checkOverlap()
 *
 * Validates that plan instances don't overlap for the same user.
 * Only checks against 'scheduled' and 'active' instances (not 'completed' or 'cancelled').
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { PlanInstance } from '@/lib/types/training-plan'

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for overlap check
 */
export interface CheckOverlapParams {
  /** User ID to check for overlaps */
  userId: string
  /** Start date in ISO format (YYYY-MM-DD) */
  startDate: string
  /** End date in ISO format (YYYY-MM-DD) */
  endDate: string
  /** Optional: exclude this instance ID (for updates) */
  excludeInstanceId?: string
}

/**
 * Result of overlap check
 */
export interface CheckOverlapResult {
  /** Whether an overlap was detected */
  hasOverlap: boolean
  /** The overlapping instance (if any) */
  overlappingInstance?: PlanInstance
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate ISO date format (YYYY-MM-DD)
 */
function isValidISODate(dateString: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!isoDateRegex.test(dateString)) {
    return false
  }

  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Check if two date ranges overlap (inclusive bounds)
 *
 * Date ranges overlap if:
 * - newStart <= existingEnd AND newEnd >= existingStart
 *
 * This implements the same logic as PostgreSQL's daterange overlap operator (&&)
 * with inclusive bounds '[start, end]'
 */
function dateRangesOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string
): boolean {
  const newStartDate = new Date(newStart)
  const newEndDate = new Date(newEnd)
  const existingStartDate = new Date(existingStart)
  const existingEndDate = new Date(existingEnd)

  // Overlap check: newStart <= existingEnd AND newEnd >= existingStart
  return newStartDate <= existingEndDate && newEndDate >= existingStartDate
}

// =============================================================================
// Plan Instance Validator
// =============================================================================

export class PlanInstanceValidator {
  /**
   * Check if a plan instance would overlap with existing instances
   *
   * Replaces: check_plan_instance_overlap() PostgreSQL trigger
   *
   * @param params Overlap check parameters (userId, startDate, endDate, excludeInstanceId)
   * @returns Result with hasOverlap flag and overlappingInstance (if any)
   * @throws Error if validation fails or database query fails
   */
  async checkOverlap(params: CheckOverlapParams): Promise<CheckOverlapResult> {
    const { userId, startDate, endDate, excludeInstanceId } = params

    // Validate input
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    if (!isValidISODate(startDate)) {
      throw new Error('Invalid date format for start_date (expected YYYY-MM-DD)')
    }

    if (!isValidISODate(endDate)) {
      throw new Error('Invalid date format for end_date (expected YYYY-MM-DD)')
    }

    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    if (endDateObj <= startDateObj) {
      throw new Error('End date must be after start date')
    }

    try {
      const supabase = await createClient()

      // Query plan_instances for the user
      let query = supabase
        .from('plan_instances')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['scheduled', 'active']) // Only check active/scheduled instances

      // Exclude current instance if updating
      if (excludeInstanceId) {
        query = query.neq('id', excludeInstanceId)
      }

      const { data, error } = await query

      if (error) {
        errorLogger.logError(error as Error, {
          path: 'PlanInstanceValidator.checkOverlap',
          metadata: { params },
        })
        throw new Error('Failed to check plan instance overlap')
      }

      // Check for overlap using JavaScript
      const instances = data || []

      const overlappingInstance = instances.find((instance) => {
        return dateRangesOverlap(startDate, endDate, instance.start_date, instance.end_date)
      })

      if (overlappingInstance) {
        return {
          hasOverlap: true,
          overlappingInstance: overlappingInstance as unknown as PlanInstance,
        }
      }

      return {
        hasOverlap: false,
      }
    } catch (error) {
      // Re-throw validation errors
      if (
        error instanceof Error &&
        (error.message.includes('Invalid date') ||
          error.message.includes('End date must') ||
          error.message.includes('User ID'))
      ) {
        throw error
      }

      // Log and throw database errors
      errorLogger.logError(error as Error, {
        path: 'PlanInstanceValidator.checkOverlap',
        metadata: { params },
      })
      throw error
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Singleton instance of PlanInstanceValidator
 * Use this for all plan instance overlap checks
 */
export const planInstanceValidator = new PlanInstanceValidator()

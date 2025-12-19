/**
 * Plan Instance Service
 * Handles scheduling training plan templates onto the calendar as instances.
 * Includes overlap prevention and instance lifecycle management.
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { Json } from '@/lib/types/database'
import type {
  PlanInstance,
  TrainingPlan,
  CreatePlanInstanceInput,
  OverlapCheckResult,
} from '@/lib/types/training-plan'

/**
 * Calculate end date from start date and weeks
 */
function calculateEndDate(startDate: string, weeks: number): string {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  return end.toISOString().split('T')[0]!
}

export class PlanInstanceService {
  /**
   * Create a new plan instance from a template
   * @throws Error if template not found or overlap detected
   */
  async createInstance(
    userId: string,
    input: CreatePlanInstanceInput
  ): Promise<PlanInstance> {
    const supabase = await createClient()

    // 1. Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', input.template_id)
      .eq('user_id', userId)
      .single()

    if (templateError || !template) {
      throw new Error('Training plan template not found')
    }

    const typedTemplate = template as unknown as TrainingPlan

    // 2. Calculate end date
    const weeksTotal = typedTemplate.weeks_total || typedTemplate.plan_data?.plan_metadata?.total_weeks || 12
    const endDate = calculateEndDate(input.start_date, weeksTotal)

    // 3. Check for overlaps (before attempting insert)
    const overlapCheck = await this.checkOverlap(userId, input.start_date, endDate)
    if (overlapCheck.hasOverlap) {
      const conflictNames = overlapCheck.conflicts.map((c) => c.name).join(', ')
      throw new Error(`Schedule conflict with: ${conflictNames}`)
    }

    // 4. Create the instance with snapshot of template data
    const { data: instance, error: insertError } = await supabase
      .from('plan_instances')
      .insert({
        user_id: userId,
        template_id: input.template_id,
        name: typedTemplate.name,
        start_date: input.start_date,
        end_date: endDate,
        weeks_total: weeksTotal,
        plan_data: typedTemplate.plan_data as unknown as Json,
        status: 'scheduled',
      })
      .select()
      .single()

    if (insertError) {
      // Handle overlap error from database trigger
      if (insertError.code === '23505' || insertError.message?.includes('overlap')) {
        throw new Error('This schedule overlaps with an existing plan')
      }
      errorLogger.logError(insertError as Error, {
        userId,
        path: '/services/plan-instance/createInstance',
        metadata: { templateId: input.template_id, startDate: input.start_date },
      })
      throw new Error('Failed to create plan instance')
    }

    const createdInstance = instance as unknown as PlanInstance

    errorLogger.logInfo('Plan instance created', {
      userId,
      metadata: {
        instanceId: createdInstance.id,
        templateId: input.template_id,
        startDate: input.start_date,
        endDate,
      },
    })

    return createdInstance
  }

  /**
   * Get all instances for a user
   */
  async listInstances(
    userId: string,
    options?: {
      status?: PlanInstance['status'][]
      includeCompleted?: boolean
    }
  ): Promise<PlanInstance[]> {
    const supabase = await createClient()

    let query = supabase
      .from('plan_instances')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: true })

    // Filter by status if provided
    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status)
    } else if (!options?.includeCompleted) {
      // By default, exclude completed and cancelled
      query = query.in('status', ['scheduled', 'active'])
    }

    const { data: instances, error } = await query

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/plan-instance/listInstances',
      })
      throw new Error('Failed to fetch plan instances')
    }

    return (instances || []) as unknown as PlanInstance[]
  }

  /**
   * Get a single instance by ID
   */
  async getInstance(userId: string, instanceId: string): Promise<PlanInstance | null> {
    const supabase = await createClient()

    const { data: instance, error } = await supabase
      .from('plan_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/plan-instance/getInstance',
        metadata: { instanceId },
      })
      throw new Error('Failed to fetch plan instance')
    }

    return instance as unknown as PlanInstance
  }

  /**
   * Cancel a plan instance
   */
  async cancelInstance(userId: string, instanceId: string): Promise<PlanInstance> {
    const supabase = await createClient()

    // First check if instance exists and is cancellable
    const existing = await this.getInstance(userId, instanceId)
    if (!existing) {
      throw new Error('Plan instance not found')
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error(`Cannot cancel a ${existing.status} plan`)
    }

    const { data: instance, error } = await supabase
      .from('plan_instances')
      .update({ status: 'cancelled' })
      .eq('id', instanceId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/plan-instance/cancelInstance',
        metadata: { instanceId },
      })
      throw new Error('Failed to cancel plan instance')
    }

    errorLogger.logInfo('Plan instance cancelled', {
      userId,
      metadata: { instanceId },
    })

    return instance as unknown as PlanInstance
  }

  /**
   * Check for overlapping instances
   */
  async checkOverlap(
    userId: string,
    startDate: string,
    endDate: string,
    excludeInstanceId?: string
  ): Promise<OverlapCheckResult> {
    const supabase = await createClient()

    // Find any scheduled or active instances that overlap with the given date range
    let query = supabase
      .from('plan_instances')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'active'])
      // Check for overlap: instance starts before our end AND instance ends after our start
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    if (excludeInstanceId) {
      query = query.neq('id', excludeInstanceId)
    }

    const { data: conflicts, error } = await query

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/plan-instance/checkOverlap',
        metadata: { startDate, endDate },
      })
      throw new Error('Failed to check for schedule conflicts')
    }

    return {
      hasOverlap: (conflicts || []).length > 0,
      conflicts: (conflicts || []) as unknown as PlanInstance[],
    }
  }

  /**
   * Mark an instance as active (when the start date arrives)
   * This could be called by a cron job or when viewing the schedule
   */
  async activateInstance(userId: string, instanceId: string): Promise<PlanInstance> {
    const supabase = await createClient()

    const { data: instance, error } = await supabase
      .from('plan_instances')
      .update({ status: 'active' })
      .eq('id', instanceId)
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .select()
      .single()

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/plan-instance/activateInstance',
        metadata: { instanceId },
      })
      throw new Error('Failed to activate plan instance')
    }

    return instance as unknown as PlanInstance
  }

  /**
   * Mark an instance as completed
   */
  async completeInstance(userId: string, instanceId: string): Promise<PlanInstance> {
    const supabase = await createClient()

    const { data: instance, error } = await supabase
      .from('plan_instances')
      .update({ status: 'completed' })
      .eq('id', instanceId)
      .eq('user_id', userId)
      .in('status', ['scheduled', 'active'])
      .select()
      .single()

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/plan-instance/completeInstance',
        metadata: { instanceId },
      })
      throw new Error('Failed to complete plan instance')
    }

    return instance as unknown as PlanInstance
  }
}

// Export singleton instance
export const planInstanceService = new PlanInstanceService()

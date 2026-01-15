/**
 * Plan Instance Service
 * Handles scheduling training plan templates onto the calendar as instances.
 * Includes overlap prevention and instance lifecycle management.
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { invokePythonApi } from '@/lib/services/lambda-client'
import type { Json } from '@/lib/types/database'
import type {
  PlanInstance,
  CreatePlanInstanceInput,
  OverlapCheckResult,
  TrainingPlanData,
} from '@/lib/types/training-plan'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import {
  assertPlanInstance,
  assertTrainingPlan,
  asPlanInstance,
  asPlanInstances,
} from '@/lib/types/type-guards'
import { calculateEndDate, parseLocalDate } from '@/lib/utils/date-utils'
import { getWeekdayIndex, type Weekday } from '@/lib/constants/weekdays'

/**
 * Calculate the scheduled date for a workout based on instance start date,
 * week number, and weekday name
 */
function calculateScheduledDate(
  startDate: string,
  weekNumber: number,
  weekdayName: string
): string {
  const start = parseLocalDate(startDate)
  const weekdayIndex = getWeekdayIndex(weekdayName as Weekday)

  // Calculate the target date:
  // 1. Add (weekNumber - 1) * 7 days to get to the start of the target week
  // 2. Then adjust to the correct weekday
  const daysToAdd = (weekNumber - 1) * 7
  const weekStart = new Date(start)
  weekStart.setDate(start.getDate() + daysToAdd)

  // Find the first Monday of the target week
  const weekStartDay = weekStart.getDay()
  const daysToMonday = weekStartDay === 0 ? -6 : 1 - weekStartDay
  const monday = new Date(weekStart)
  monday.setDate(weekStart.getDate() + daysToMonday)

  // Add days to reach the target weekday (0 = Monday, 6 = Sunday)
  const targetDate = new Date(monday)
  targetDate.setDate(monday.getDate() + weekdayIndex)

  // Format as YYYY-MM-DD
  return targetDate.toISOString().split('T')[0]!
}

/**
 * Add unique IDs and scheduled dates to all workouts in a training plan.
 * For workouts with library_workout_id, deep copy all fields from the library.
 * This ensures each workout is a complete standalone copy with full structure.
 */
async function prepareWorkoutsForInstance(
  planData: TrainingPlanData,
  startDate: string
): Promise<TrainingPlanData> {
  // Process each week's workouts
  const processedWeeklyPlan = await Promise.all(
    planData.weekly_plan.map(async (week) => {
      const processedWorkouts = await Promise.all(
        week.workouts.map(async (workout) => {
          let enrichedWorkout = { ...workout }

          // If workout has library_workout_id, fetch and deep copy from library via Python API
          if (workout.library_workout_id) {
            try {
              const workoutResponse = await invokePythonApi<WorkoutLibraryItem>({
                method: 'GET',
                path: `/api/v1/workouts/${workout.library_workout_id}`,
              })

              if (workoutResponse.statusCode === 200 && workoutResponse.body) {
                const libraryWorkout = workoutResponse.body
                // Deep copy all fields from library workout
                enrichedWorkout = {
                  ...workout, // Keep any template-specific overrides
                  name: libraryWorkout.name,
                  type: libraryWorkout.type,
                  tss: libraryWorkout.base_tss,
                  structure: libraryWorkout.structure,
                  description: libraryWorkout.description || undefined,
                  detailed_description: libraryWorkout.detailed_description || undefined,
                  library_workout_id: workout.library_workout_id, // Keep for reference
                }
              } else {
                errorLogger.logWarning('Failed to fetch library workout from Python API', {
                  metadata: {
                    library_workout_id: workout.library_workout_id,
                    statusCode: workoutResponse.statusCode,
                  },
                })
              }
            } catch (error) {
              errorLogger.logError(error as Error, {
                path: '/services/plan-instance/prepareWorkoutsForInstance',
                metadata: {
                  library_workout_id: workout.library_workout_id,
                },
              })
            }
          }

          return {
            ...enrichedWorkout,
            // Preserve existing ID or generate a new UUID
            id: enrichedWorkout.id || crypto.randomUUID(),
            // Calculate and set scheduled_date
            scheduled_date: calculateScheduledDate(
              startDate,
              week.week_number,
              enrichedWorkout.weekday
            ),
          }
        })
      )

      return {
        ...week,
        workouts: processedWorkouts,
      }
    })
  )

  return {
    ...planData,
    weekly_plan: processedWeeklyPlan,
  }
}

export class PlanInstanceService {
  /**
   * Create a new plan instance from a template
   * @throws Error if template not found or overlap detected
   */
  async createInstance(userId: string, input: CreatePlanInstanceInput): Promise<PlanInstance> {
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

    const typedTemplate = assertTrainingPlan(template, 'createInstance')

    // 2. Calculate end date
    const weeksTotal =
      typedTemplate.weeks_total || typedTemplate.plan_data?.plan_metadata?.total_weeks || 12
    const endDate = calculateEndDate(input.start_date, weeksTotal)

    // 3. Check for overlaps (before attempting insert)
    const overlapCheck = await this.checkOverlap(userId, input.start_date, endDate)
    if (overlapCheck.hasOverlap) {
      const conflictNames = overlapCheck.conflicts.map((c) => c.name).join(', ')
      throw new Error(`Schedule conflict with: ${conflictNames}`)
    }

    // 4. Prepare plan data: add unique IDs, scheduled_date, and deep copy from library
    const preparedPlanData = await prepareWorkoutsForInstance(
      typedTemplate.plan_data,
      input.start_date
    )

    const { data: instance, error: insertError } = await supabase
      .from('plan_instances')
      .insert({
        user_id: userId,
        template_id: input.template_id,
        name: typedTemplate.name,
        start_date: input.start_date,
        end_date: endDate,
        weeks_total: weeksTotal,
        plan_data: preparedPlanData as unknown as Json,
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

    const createdInstance = assertPlanInstance(instance, 'createInstance')

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

    return asPlanInstances(instances || [])
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

    return asPlanInstance(instance)
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

    return assertPlanInstance(instance, 'cancelInstance')
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

    const validConflicts = asPlanInstances(conflicts || [])
    return {
      hasOverlap: validConflicts.length > 0,
      conflicts: validConflicts,
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

    return assertPlanInstance(instance, 'activateInstance')
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

    return assertPlanInstance(instance, 'completeInstance')
  }
}

// Export singleton instance
export const planInstanceService = new PlanInstanceService()

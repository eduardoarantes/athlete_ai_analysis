/**
 * Manual Workout Service
 * Business logic for manual workout CRUD operations
 *
 * Manual workouts are user-added workouts that exist independently of training plans.
 * They can be standalone workouts or extracted from plan instances.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { Json } from '@/lib/types/database'
import type {
  ManualWorkout,
  CreateManualWorkoutInput,
  UpdateManualWorkoutInput,
  AddLibraryWorkoutInput,
} from '@/lib/types/manual-workout'
import type { Workout } from '@/lib/types/training-plan'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import { assertManualWorkout, asManualWorkout, asManualWorkouts } from '@/lib/types/type-guards'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { invokePythonApi } from '@/lib/services/lambda-client'

/**
 * Create a new manual workout
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param userId - User ID (for logging and validation)
 * @param input - Workout data to create
 * @returns Created manual workout
 * @throws Error if creation fails or response is invalid
 */
export async function createManualWorkout(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateManualWorkoutInput
): Promise<ManualWorkout> {
  try {
    const { data, error } = await supabase
      .from('manual_workouts')
      .insert({
        user_id: userId,
        scheduled_date: input.scheduled_date,
        workout_data: input.workout_data as unknown as Json,
        ...(input.source_plan_instance_id && {
          source_plan_instance_id: input.source_plan_instance_id,
        }),
      })
      .select()
      .single()

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/manual-workout/createManualWorkout',
        metadata: {
          scheduled_date: input.scheduled_date,
        },
      })
      throw new Error('Failed to create manual workout')
    }

    if (!data) {
      throw new Error('No data returned from manual workout creation')
    }

    const manualWorkout = assertManualWorkout(data, 'createManualWorkout')

    errorLogger.logInfo('Manual workout created', {
      userId,
      metadata: {
        workout_id: manualWorkout.id,
        scheduled_date: input.scheduled_date,
      },
    })

    return manualWorkout
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid ManualWorkout')) {
      throw error
    }
    errorLogger.logError(error as Error, {
      userId,
      path: '/services/manual-workout/createManualWorkout',
    })
    throw new Error('Failed to create manual workout')
  }
}

/**
 * Get a single manual workout by ID
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param workoutId - Manual workout ID
 * @returns Manual workout or null if not found
 * @throws Error if database query fails (not including "not found")
 */
export async function getManualWorkout(
  supabase: SupabaseClient<Database>,
  workoutId: string
): Promise<ManualWorkout | null> {
  try {
    const { data, error } = await supabase
      .from('manual_workouts')
      .select('*')
      .eq('id', workoutId)
      .single()

    if (error) {
      // Not found is not an error, return null
      if (error.code === 'PGRST116') {
        return null
      }

      errorLogger.logError(error as Error, {
        path: '/services/manual-workout/getManualWorkout',
        metadata: { workoutId },
      })
      throw new Error('Failed to fetch manual workout')
    }

    return asManualWorkout(data)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      throw error
    }
    errorLogger.logError(error as Error, {
      path: '/services/manual-workout/getManualWorkout',
      metadata: { workoutId },
    })
    throw new Error('Failed to fetch manual workout')
  }
}

/**
 * Get manual workouts for a date range
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param userId - User ID (for logging)
 * @param startDate - Start date (YYYY-MM-DD format)
 * @param endDate - End date (YYYY-MM-DD format)
 * @returns Array of manual workouts (empty if none found)
 * @throws Error if database query fails
 */
export async function getManualWorkoutsByDateRange(
  supabase: SupabaseClient<Database>,
  userId: string,
  startDate: string,
  endDate: string
): Promise<ManualWorkout[]> {
  try {
    const { data, error } = await supabase
      .from('manual_workouts')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/manual-workout/getManualWorkoutsByDateRange',
        metadata: { startDate, endDate },
      })
      throw new Error('Failed to fetch manual workouts by date range')
    }

    // Filter out invalid entries using type guard
    return asManualWorkouts(data || [])
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      throw error
    }
    errorLogger.logError(error as Error, {
      userId,
      path: '/services/manual-workout/getManualWorkoutsByDateRange',
      metadata: { startDate, endDate },
    })
    throw new Error('Failed to fetch manual workouts by date range')
  }
}

/**
 * Get all manual workouts for a user
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param userId - User ID
 * @returns Array of manual workouts (empty if none found)
 * @throws Error if database query fails
 */
export async function getUserManualWorkouts(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ManualWorkout[]> {
  try {
    const { data, error } = await supabase
      .from('manual_workouts')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true })

    if (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: '/services/manual-workout/getUserManualWorkouts',
      })
      throw new Error('Failed to fetch user manual workouts')
    }

    return asManualWorkouts(data || [])
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      throw error
    }
    errorLogger.logError(error as Error, {
      userId,
      path: '/services/manual-workout/getUserManualWorkouts',
    })
    throw new Error('Failed to fetch user manual workouts')
  }
}

/**
 * Update a manual workout
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param workoutId - Manual workout ID
 * @param input - Fields to update
 * @returns Updated manual workout
 * @throws Error if workout not found or update fails
 */
export async function updateManualWorkout(
  supabase: SupabaseClient<Database>,
  workoutId: string,
  input: UpdateManualWorkoutInput
): Promise<ManualWorkout> {
  try {
    const updateData: Record<string, unknown> = {}

    if (input.scheduled_date !== undefined) {
      updateData.scheduled_date = input.scheduled_date
    }

    if (input.workout_data !== undefined) {
      updateData.workout_data = input.workout_data as unknown as Json
    }

    if (input.source_plan_instance_id !== undefined) {
      updateData.source_plan_instance_id = input.source_plan_instance_id
    }

    const { data, error } = await supabase
      .from('manual_workouts')
      .update(updateData)
      .eq('id', workoutId)
      .select()
      .single()

    if (error) {
      // Not found error
      if (error.code === 'PGRST116') {
        throw new Error('Manual workout not found')
      }

      errorLogger.logError(error as Error, {
        path: '/services/manual-workout/updateManualWorkout',
        metadata: { workoutId, updateData },
      })
      throw new Error('Failed to update manual workout')
    }

    if (!data) {
      throw new Error('No data returned from manual workout update')
    }

    const updatedWorkout = assertManualWorkout(data, 'updateManualWorkout')

    errorLogger.logInfo('Manual workout updated', {
      metadata: {
        workout_id: workoutId,
        updated_fields: Object.keys(updateData),
      },
    })

    return updatedWorkout
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Failed to update') ||
        error.message.includes('not found') ||
        error.message.includes('Invalid ManualWorkout'))
    ) {
      throw error
    }
    errorLogger.logError(error as Error, {
      path: '/services/manual-workout/updateManualWorkout',
      metadata: { workoutId },
    })
    throw new Error('Failed to update manual workout')
  }
}

/**
 * Delete a manual workout
 * Note: Cascade delete will remove associated workout_matches via ON DELETE CASCADE
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param workoutId - Manual workout ID
 * @throws Error if delete fails
 */
export async function deleteManualWorkout(
  supabase: SupabaseClient<Database>,
  workoutId: string
): Promise<void> {
  try {
    const { error } = await supabase.from('manual_workouts').delete().eq('id', workoutId)

    if (error) {
      errorLogger.logError(error as Error, {
        path: '/services/manual-workout/deleteManualWorkout',
        metadata: { workoutId },
      })
      throw new Error('Failed to delete manual workout')
    }

    errorLogger.logInfo('Manual workout deleted', {
      metadata: { workout_id: workoutId },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to delete')) {
      throw error
    }
    errorLogger.logError(error as Error, {
      path: '/services/manual-workout/deleteManualWorkout',
      metadata: { workoutId },
    })
    throw new Error('Failed to delete manual workout')
  }
}

/**
 * Add a library workout as a manual workout
 * This is a convenience wrapper that fetches from the library API
 * and creates a manual workout
 *
 * @param supabase - Supabase client (with user context for RLS)
 * @param userId - User ID
 * @param input - Library workout ID and scheduled date
 * @returns Created manual workout
 * @throws Error if library workout not found or creation fails
 */
export async function addLibraryWorkout(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: AddLibraryWorkoutInput
): Promise<ManualWorkout> {
  try {
    // Fetch library workout from Python API (BFF pattern)
    const response = await invokePythonApi<WorkoutLibraryItem>({
      method: 'GET',
      path: `/api/v1/workouts/${input.library_workout_id}`,
    })

    if (response.statusCode !== 200 || !response.body) {
      throw new Error('Library workout not found')
    }

    const libraryWorkout = response.body

    // Convert library workout to Workout format
    const workoutData: Workout = {
      // Generate a unique ID for this instance
      id: crypto.randomUUID(),
      // Weekday will be calculated from scheduled_date by the calendar display logic
      weekday: 'monday', // Placeholder, actual weekday doesn't matter for manual workouts
      scheduled_date: input.scheduled_date,
      name: libraryWorkout.name,
      type: libraryWorkout.type,
      tss: libraryWorkout.base_tss,
      structure: libraryWorkout.structure,
      ...(libraryWorkout.detailed_description && {
        detailed_description: libraryWorkout.detailed_description,
      }),
      source: 'library',
      library_workout_id: input.library_workout_id,
    }

    // Create manual workout
    const createInput = {
      scheduled_date: input.scheduled_date,
      workout_data: workoutData,
      ...(input.source_plan_instance_id && {
        source_plan_instance_id: input.source_plan_instance_id,
      }),
    } as CreateManualWorkoutInput

    const manualWorkout = await createManualWorkout(supabase, userId, createInput)

    errorLogger.logInfo('Library workout added as manual workout', {
      userId,
      metadata: {
        library_workout_id: input.library_workout_id,
        manual_workout_id: manualWorkout.id,
        scheduled_date: input.scheduled_date,
      },
    })

    return manualWorkout
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('not found') || error.message.includes('Failed to create'))
    ) {
      throw error
    }
    errorLogger.logError(error as Error, {
      userId,
      path: '/services/manual-workout/addLibraryWorkout',
      metadata: {
        library_workout_id: input.library_workout_id,
        scheduled_date: input.scheduled_date,
      },
    })
    throw new Error('Failed to fetch library workout')
  }
}

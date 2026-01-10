/**
 * TrainingPeaks Sync Service
 * Converts internal training plan format to TrainingPeaks format
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
 */

import type {
  PlanInstance,
  Workout,
  WorkoutSegment,
  WorkoutStructure,
  StepTarget,
} from '@/lib/types/training-plan'
import { convertStepLengthToSeconds, calculateStructureDuration } from '@/lib/types/training-plan'
import type { TPWorkoutCreateRequest, TPWorkoutResponse } from './trainingpeaks-service'
import { TrainingPeaksService } from './trainingpeaks-service'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

export interface SyncResult {
  success: boolean
  totalWorkouts: number
  syncedWorkouts: number
  failedWorkouts: number
  errors: { workout: string; error: string }[]
}

export interface WorkoutSyncRecord {
  id?: string
  user_id: string
  plan_instance_id: string
  week_number: number
  workout_index: number
  workout_date: string
  tp_workout_id: string | null
  sync_status: 'pending' | 'synced' | 'failed' | 'deleted'
  sync_error: string | null
  last_sync_at: string | null
}

export class TrainingPeaksSyncService {
  /**
   * Map internal segment type to TrainingPeaks IntensityClass
   */
  private mapSegmentTypeToIntensityClass(type: string, powerPct?: number): string {
    const mapping: Record<string, string> = {
      warmup: 'WarmUp',
      warmUp: 'WarmUp',
      cooldown: 'Cooldown',
      coolDown: 'Cooldown',
      recovery: 'Active Recovery',
      rest: 'Active Recovery',
      steady: 'Endurance',
      tempo: 'Tempo',
      work: 'Threshold',
      active: 'Threshold',
    }

    // For intervals, check power to determine VO2 Max vs Threshold
    if (type === 'interval' || type === 'active') {
      return powerPct && powerPct > 105 ? 'VO2 Max' : 'Threshold'
    }

    return mapping[type] || 'Active Recovery'
  }

  /**
   * Extract power target values from step targets array
   */
  private extractPowerTarget(
    targets: StepTarget[]
  ): { minValue: number; maxValue: number } | undefined {
    const powerTarget = targets.find((t) => t.type === 'power')
    if (powerTarget) {
      return { minValue: powerTarget.minValue, maxValue: powerTarget.maxValue }
    }
    return undefined
  }

  /**
   * Convert WorkoutStructure to TrainingPeaks Structure JSON (Issue #96)
   */
  private convertStructureToTPSteps(structure: WorkoutStructure): Record<string, unknown>[] {
    const steps: Record<string, unknown>[] = []

    for (const segment of structure.structure) {
      const repetitions = segment.length.value

      // Build the step block for this segment
      if (segment.type === 'repetition' && repetitions > 1) {
        // For repetitions, create a Repeat block
        const repeatSteps: Record<string, unknown>[] = []

        for (const step of segment.steps) {
          const powerTarget = this.extractPowerTarget(step.targets)
          const avgPower = powerTarget
            ? (powerTarget.minValue + powerTarget.maxValue) / 2
            : undefined

          const tpStep: Record<string, unknown> = {
            Type: 'Step',
            IntensityClass: this.mapSegmentTypeToIntensityClass(step.intensityClass, avgPower),
            Name: step.name,
            Length: {
              Unit: 'Second',
              Value: Math.round(convertStepLengthToSeconds(step.length)),
            },
          }

          if (powerTarget) {
            tpStep.IntensityTarget = {
              Unit: 'PercentOfFtp',
              MinValue: powerTarget.minValue,
              MaxValue: powerTarget.maxValue,
              Value: Math.round(avgPower ?? powerTarget.minValue),
            }
          }

          repeatSteps.push(tpStep)
        }

        // Wrap in Repeat block
        steps.push({
          Type: 'Repeat',
          Steps: repeatSteps,
          RepeatCount: repetitions,
        })
      } else {
        // Single step or single repetition - flatten into individual steps
        for (let rep = 0; rep < repetitions; rep++) {
          for (const step of segment.steps) {
            const powerTarget = this.extractPowerTarget(step.targets)
            const avgPower = powerTarget
              ? (powerTarget.minValue + powerTarget.maxValue) / 2
              : undefined

            const tpStep: Record<string, unknown> = {
              Type: 'Step',
              IntensityClass: this.mapSegmentTypeToIntensityClass(step.intensityClass, avgPower),
              Name: step.name,
              Length: {
                Unit: 'Second',
                Value: Math.round(convertStepLengthToSeconds(step.length)),
              },
            }

            if (powerTarget) {
              tpStep.IntensityTarget = {
                Unit: 'PercentOfFtp',
                MinValue: powerTarget.minValue,
                MaxValue: powerTarget.maxValue,
                Value: Math.round(avgPower ?? powerTarget.minValue),
              }
            }

            steps.push(tpStep)
          }
        }
      }
    }

    return steps
  }

  /**
   * Convert internal workout to TrainingPeaks Structure JSON
   * Supports both legacy segments and new WorkoutStructure format (Issue #96)
   */
  convertWorkoutToTPStructure(workout: Workout): string {
    // NEW: Handle WorkoutStructure format (takes precedence)
    if (workout.structure?.structure && workout.structure.structure.length > 0) {
      const steps = this.convertStructureToTPSteps(workout.structure)
      return JSON.stringify({ Steps: steps })
    }

    // Legacy format handling
    if (!workout.segments || workout.segments.length === 0) {
      return ''
    }

    const steps = workout.segments.map((segment: WorkoutSegment) => {
      const avgPower = segment.power_high_pct
        ? ((segment.power_low_pct || 0) + segment.power_high_pct) / 2
        : segment.power_low_pct

      const step: Record<string, unknown> = {
        Type: 'Step',
        IntensityClass: this.mapSegmentTypeToIntensityClass(segment.type, avgPower),
        Name: segment.description || segment.type,
        Length: {
          Unit: 'Second',
          Value: Math.round(segment.duration_min * 60),
        },
      }

      if (segment.power_low_pct !== undefined) {
        step.IntensityTarget = {
          Unit: 'PercentOfFtp',
          MinValue: segment.power_low_pct,
          MaxValue: segment.power_high_pct ?? segment.power_low_pct,
          Value: Math.round(avgPower ?? segment.power_low_pct),
        }
      }

      return step
    })

    return JSON.stringify({ Steps: steps })
  }

  /**
   * Convert workout to TrainingPeaks API request format
   * Supports both legacy segments and new WorkoutStructure format (Issue #96)
   */
  convertWorkoutToTPRequest(
    workout: Workout,
    workoutDate: string,
    athleteId: string
  ): TPWorkoutCreateRequest {
    const structure = this.convertWorkoutToTPStructure(workout)

    // NEW: Calculate duration from WorkoutStructure if available
    let totalMinutes = 0
    if (workout.structure?.structure && workout.structure.structure.length > 0) {
      totalMinutes = calculateStructureDuration(workout.structure)
    } else {
      totalMinutes =
        workout.segments?.reduce((sum, seg) => sum + (seg.duration_min || 0), 0) ?? 0
    }

    const request: TPWorkoutCreateRequest = {
      AthleteId: athleteId,
      WorkoutDay: workoutDate,
      WorkoutType: 'Bike',
      Title: workout.name,
      Description: workout.detailed_description || workout.description || '',
      TotalTimePlanned: totalMinutes / 60,
    }

    if (workout.tss !== undefined) {
      request.TSSPlanned = workout.tss
    }

    if (structure) {
      request.Structure = structure
    }

    return request
  }

  /**
   * Calculate actual date for a workout based on plan start date
   */
  calculateWorkoutDate(planStartDate: string, weekNumber: number, weekday: string): string {
    const dayMap: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 0,
    }

    const startDate = new Date(planStartDate)
    const startDay = startDate.getDay()

    // Find the Monday of the start week
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay
    const firstMonday = new Date(startDate)
    firstMonday.setDate(firstMonday.getDate() + mondayOffset)

    // Calculate target date
    const weeksToAdd = weekNumber - 1
    const targetDay = dayMap[weekday] ?? 1
    const targetDate = new Date(firstMonday)
    targetDate.setDate(targetDate.getDate() + weeksToAdd * 7 + (targetDay - 1))

    return targetDate.toISOString().split('T')[0] ?? ''
  }

  /**
   * Sync a complete plan instance to TrainingPeaks
   */
  async syncPlanInstance(
    userId: string,
    planInstance: PlanInstance,
    tpAthleteId: string
  ): Promise<SyncResult> {
    const tpService = await TrainingPeaksService.create()
    const accessToken = await tpService.getValidAccessToken(userId)
    const supabase: UntypedSupabaseClient = await createClient()

    const result: SyncResult = {
      success: true,
      totalWorkouts: 0,
      syncedWorkouts: 0,
      failedWorkouts: 0,
      errors: [],
    }

    for (const week of planInstance.plan_data.weekly_plan) {
      for (let i = 0; i < week.workouts.length; i++) {
        const workout = week.workouts[i]
        if (!workout) continue
        result.totalWorkouts++

        // Skip rest days
        if (workout.type === 'rest' || workout.name.toLowerCase().includes('rest')) {
          continue
        }

        try {
          const workoutDate = this.calculateWorkoutDate(
            planInstance.start_date,
            week.week_number,
            workout.weekday
          )

          const tpRequest = this.convertWorkoutToTPRequest(workout, workoutDate, tpAthleteId)

          // Call TP API to create workout
          const tpWorkout: TPWorkoutResponse = await tpService.createPlannedWorkout(
            accessToken,
            tpRequest
          )

          // Record sync in database
          const syncRecord: Omit<WorkoutSyncRecord, 'id'> = {
            user_id: userId,
            plan_instance_id: planInstance.id,
            week_number: week.week_number,
            workout_index: i,
            workout_date: workoutDate,
            tp_workout_id: tpWorkout.Id,
            sync_status: 'synced',
            sync_error: null,
            last_sync_at: new Date().toISOString(),
          }

          await supabase.from('trainingpeaks_workout_syncs').upsert(syncRecord, {
            onConflict: 'plan_instance_id,week_number,workout_index',
          })

          result.syncedWorkouts++
        } catch (error) {
          result.failedWorkouts++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push({
            workout: `Week ${week.week_number} - ${workout.name}`,
            error: errorMessage,
          })

          // Record failed sync in database
          const syncRecord: Omit<WorkoutSyncRecord, 'id'> = {
            user_id: userId,
            plan_instance_id: planInstance.id,
            week_number: week.week_number,
            workout_index: i,
            workout_date: this.calculateWorkoutDate(
              planInstance.start_date,
              week.week_number,
              workout.weekday
            ),
            tp_workout_id: null,
            sync_status: 'failed',
            sync_error: errorMessage,
            last_sync_at: new Date().toISOString(),
          }

          await supabase.from('trainingpeaks_workout_syncs').upsert(syncRecord, {
            onConflict: 'plan_instance_id,week_number,workout_index',
          })
        }
      }
    }

    result.success = result.failedWorkouts === 0
    return result
  }

  /**
   * Delete all synced workouts for a plan instance from TrainingPeaks
   */
  async deleteSyncedWorkouts(userId: string, planInstanceId: string): Promise<SyncResult> {
    const tpService = await TrainingPeaksService.create()
    const accessToken = await tpService.getValidAccessToken(userId)
    const supabase: UntypedSupabaseClient = await createClient()

    const result: SyncResult = {
      success: true,
      totalWorkouts: 0,
      syncedWorkouts: 0,
      failedWorkouts: 0,
      errors: [],
    }

    // Get all synced workouts for this instance
    const { data: syncedWorkouts, error } = await supabase
      .from('trainingpeaks_workout_syncs')
      .select('*')
      .eq('plan_instance_id', planInstanceId)
      .eq('sync_status', 'synced')

    if (error || !syncedWorkouts) {
      return result
    }

    result.totalWorkouts = syncedWorkouts.length

    for (const syncRecord of syncedWorkouts) {
      if (!syncRecord.tp_workout_id) continue

      try {
        await tpService.deletePlannedWorkout(accessToken, syncRecord.tp_workout_id)

        // Update sync record
        await supabase
          .from('trainingpeaks_workout_syncs')
          .update({
            sync_status: 'deleted',
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', syncRecord.id)

        result.syncedWorkouts++
      } catch (error) {
        result.failedWorkouts++
        result.errors.push({
          workout: `Week ${syncRecord.week_number} - Workout ${syncRecord.workout_index}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    result.success = result.failedWorkouts === 0
    return result
  }

  /**
   * Get sync status for a plan instance
   */
  async getSyncStatus(
    planInstanceId: string
  ): Promise<{ total: number; synced: number; failed: number; pending: number }> {
    const supabase: UntypedSupabaseClient = await createClient()

    const { data: syncRecords } = await supabase
      .from('trainingpeaks_workout_syncs')
      .select('sync_status')
      .eq('plan_instance_id', planInstanceId)

    if (!syncRecords) {
      return { total: 0, synced: 0, failed: 0, pending: 0 }
    }

    return {
      total: syncRecords.length,
      synced: syncRecords.filter((r: { sync_status: string }) => r.sync_status === 'synced').length,
      failed: syncRecords.filter((r: { sync_status: string }) => r.sync_status === 'failed').length,
      pending: syncRecords.filter((r: { sync_status: string }) => r.sync_status === 'pending')
        .length,
    }
  }
}

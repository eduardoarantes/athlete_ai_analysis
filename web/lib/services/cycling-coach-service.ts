/**
 * Cycling Coach Service
 * Integrates Next.js web API with Python cycling-ai FastAPI backend
 * Uses AWS Lambda SDK in production, HTTP in development
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { invokePythonApi } from '@/lib/services/lambda-client'
import type { PlanSourceMetadata } from '@/lib/types/training-plan'
import { errorLogger } from '@/lib/monitoring/error-logger'

// Configuration
const TEMP_DATA_DIR = process.env.TEMP_DATA_DIR || '/tmp/cycling-ai-jobs'

export interface TrainingPlanParams {
  goal: string
  customGoal?: string
  timeline: {
    hasEvent: boolean
    eventDate?: string
    eventType?: string
    weeks?: number
  }
  profile: {
    ftp: number
    weight: number
    maxHR: number
    age: number
    weeklyHours: string
    experienceLevel: string
    trainingDays: string[]
  }
}

export interface JobStatus {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: {
    phase: string
    percentage: number
  }
  result?: any
  error?: string
}

export class CyclingCoachService {
  /**
   * Generate a training plan using the Python backend
   */
  async generateTrainingPlan(userId: string, params: TrainingPlanParams): Promise<JobStatus> {
    try {
      // 1. Create job directory
      const jobId = `plan_${Date.now()}_${userId.slice(0, 8)}`
      const jobDir = join(TEMP_DATA_DIR, jobId)
      await mkdir(jobDir, { recursive: true })

      // 2. Export user data
      const csvPath = await this.exportActivitiesToCSV(userId, jobDir)
      const profilePath = await this.exportUserProfile(userId, params, jobDir)

      // 3. Create job record in database
      const supabase = await createClient()
      const { error } = await supabase
        .from('plan_generation_jobs')
        .insert({
          id: jobId,
          user_id: userId,
          status: 'queued',
          params: params as never,
        } as never)
        .select()
        .single()

      if (error) throw error

      // 4. Execute Python CLI in background
      this.executePlanGeneration(jobId, jobDir, csvPath, profilePath, params)

      return {
        id: jobId,
        status: 'queued',
      }
    } catch (error) {
      throw new Error(`Failed to generate training plan: ${error}`)
    }
  }

  /**
   * Execute plan generation via FastAPI (background process)
   */
  private async executePlanGeneration(
    dbJobId: string,
    _jobDir: string,
    _csvPath: string,
    _profilePath: string,
    params: TrainingPlanParams
  ): Promise<void> {
    const supabase = await createClient()

    try {
      // Calculate weeks
      const weeks = params.timeline.hasEvent
        ? this.calculateWeeksUntilEvent(params.timeline.eventDate!)
        : params.timeline.weeks || 12

      // Convert training days to the format expected by the API
      // e.g., ['monday', 'wednesday', 'friday'] -> "Monday, Wednesday, Friday"
      const trainingDaysFormatted = (params.profile.trainingDays || [])
        .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(', ')

      // Call Python API to generate plan (via Lambda in production, HTTP in dev)
      const response = await invokePythonApi<{ job_id: string }>({
        method: 'POST',
        path: '/api/v1/plan/generate',
        body: {
          athlete_profile: {
            ftp: params.profile.ftp,
            weight_kg: params.profile.weight,
            max_hr: params.profile.maxHR || null,
            age: params.profile.age || null,
            goals: params.customGoal ? [params.goal, params.customGoal] : [params.goal],
            experience_level: params.profile.experienceLevel,
            weekly_hours_available: parseFloat(params.profile.weeklyHours) || 7,
            training_availability: {
              hours_per_week: parseFloat(params.profile.weeklyHours) || 7,
              week_days: trainingDaysFormatted,
            },
          },
          weeks,
          target_ftp: params.profile.ftp * 1.05, // 5% improvement target
        },
      })

      if (response.statusCode >= 400) {
        throw new Error(
          `Python API returned ${response.statusCode}: ${JSON.stringify(response.body)}`
        )
      }

      const { job_id: apiJobId } = response.body

      errorLogger.logInfo('Plan generation started via FastAPI', {
        metadata: {
          dbJobId,
          apiJobId,
          weeks,
        },
      })

      // Poll FastAPI for job completion
      await this.pollForCompletion(dbJobId, apiJobId, params, weeks)
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: '/services/cycling-coach/executePlanGeneration',
        metadata: { jobId: dbJobId },
      })

      // Update job as failed
      await supabase
        .from('plan_generation_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', dbJobId)
    }
  }

  /**
   * Poll FastAPI for job completion
   */
  private async pollForCompletion(
    dbJobId: string,
    apiJobId: string,
    params: TrainingPlanParams,
    weeks: number
  ): Promise<void> {
    const supabase = await createClient()
    const maxAttempts = 60 // 5 minutes max (5s intervals)
    let attempts = 0

    const poll = async (): Promise<void> => {
      try {
        const response = await invokePythonApi<{
          status: string
          progress?: { phase: string; percentage: number }
          result?: { training_plan: unknown }
          error?: string
        }>({
          method: 'GET',
          path: `/api/v1/plan/status/${apiJobId}`,
        })

        if (response.statusCode >= 400) {
          throw new Error(`Failed to get job status: ${response.statusCode}`)
        }

        const jobStatus = response.body

        // Update progress in database
        if (jobStatus.progress) {
          await supabase
            .from('plan_generation_jobs')
            .update({
              status: jobStatus.status === 'running' ? 'running' : jobStatus.status,
              progress: jobStatus.progress as never,
            } as never)
            .eq('id', dbJobId)
        }

        if (jobStatus.status === 'completed') {
          // Extract plan data
          const planData = jobStatus.result?.training_plan

          if (!planData) {
            throw new Error('No plan data in completed job')
          }

          // Get the full user_id from the job record
          const { data: jobRecord } = await supabase
            .from('plan_generation_jobs')
            .select('user_id')
            .eq('id', dbJobId)
            .single()

          const userId = jobRecord?.user_id
          if (!userId) {
            throw new Error('Could not find user_id for job')
          }

          // Extract AI metadata from job result
          const aiMetadata = (jobStatus.result as Record<string, unknown>)?.ai_metadata as
            | Record<string, unknown>
            | undefined

          // Build source metadata for tracking plan generation
          const sourceMetadata: PlanSourceMetadata = {
            source: 'cycling-ai-python-api',
            generated_at: new Date().toISOString(),
            job_id: apiJobId,
            // AI provider info from Python API response
            ai_provider: (aiMetadata?.ai_provider as string | undefined) || undefined,
            ai_model: (aiMetadata?.ai_model as string | undefined) || undefined,
            library_version: (aiMetadata?.library_version as string | undefined) || undefined,
          }

          // Store plan as template in database (no dates - templates are date-agnostic)
          const { data: plan, error: planError } = await supabase
            .from('training_plans')
            .insert({
              user_id: userId,
              name: `${params.goal} - ${weeks} weeks`,
              goal: params.goal,
              description: `Training plan for ${params.goal}`,
              weeks_total: weeks,
              plan_data: planData as never,
              metadata: sourceMetadata as never,
              status: 'draft', // Templates start as draft until scheduled
            } as never)
            .select('id')
            .single()

          if (planError || !plan?.id) {
            throw new Error(
              `Failed to save training plan: ${planError?.message || 'No plan ID returned'}`
            )
          }

          // Update job status with plan_id
          await supabase
            .from('plan_generation_jobs')
            .update({
              status: 'completed',
              result: { plan_id: plan.id, plan_data: planData } as unknown as Record<
                string,
                unknown
              >,
            } as never)
            .eq('id', dbJobId)

          errorLogger.logInfo('Plan generation completed', {
            metadata: {
              dbJobId,
              apiJobId,
              planId: plan?.id,
            },
          })

          return
        }

        if (jobStatus.status === 'failed') {
          throw new Error(jobStatus.error || 'Plan generation failed')
        }

        // Continue polling
        attempts++
        if (attempts >= maxAttempts) {
          throw new Error('Plan generation timed out')
        }

        setTimeout(poll, 5000) // Poll every 5 seconds
      } catch (error) {
        errorLogger.logError(error as Error, {
          path: '/services/cycling-coach/pollForCompletion',
          metadata: { dbJobId, apiJobId, attempts },
        })

        await supabase
          .from('plan_generation_jobs')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', dbJobId)
      }
    }

    // Start polling
    setTimeout(poll, 2000) // Start after 2 seconds
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const supabase = await createClient()

    const { data: job, error } = await supabase
      .from('plan_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) return null

    const result: JobStatus = {
      id: job.id,
      status: job.status as JobStatus['status'],
      result: job.result,
    }

    // Only add optional properties if they have values
    if (job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)) {
      const prog = job.progress as { phase?: string; percentage?: number }
      if (prog.phase && typeof prog.percentage === 'number') {
        result.progress = { phase: prog.phase, percentage: prog.percentage }
      }
    }
    if (job.error) {
      result.error = job.error
    }

    return result
  }

  /**
   * Export user activities to CSV format for Python CLI
   */
  async exportActivitiesToCSV(userId: string, outputDir: string): Promise<string> {
    const supabase = await createClient()

    // Fetch user activities
    const { data: activities, error } = await supabase
      .from('strava_activities')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(500)

    if (error) throw error

    // Convert to CSV format expected by Python CLI
    const csvHeader =
      'Activity Date,Activity Name,Activity Type,Distance,Moving Time,Elapsed Time,Elevation Gain,Average Watts,Weighted Average Watts,Max Watts,Average HR,Max HR\n'

    const csvRows = activities?.map((activity) => {
      return [
        activity.start_date,
        `"${activity.name || 'Ride'}"`,
        activity.sport_type || 'Ride',
        activity.distance || 0,
        activity.moving_time || 0,
        activity.elapsed_time || 0,
        activity.total_elevation_gain || 0,
        activity.average_watts || '',
        activity.weighted_average_watts || '',
        activity.max_watts || '',
        activity.average_heartrate || '',
        activity.max_heartrate || '',
      ].join(',')
    })

    const csvContent = csvHeader + (csvRows?.join('\n') || '')
    const csvPath = join(outputDir, 'activities.csv')

    await writeFile(csvPath, csvContent, 'utf-8')
    return csvPath
  }

  /**
   * Export user profile to JSON format for Python CLI
   */
  async exportUserProfile(
    userId: string,
    params: TrainingPlanParams,
    outputDir: string
  ): Promise<string> {
    const supabase = await createClient()

    // Fetch user profile
    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Create athlete profile JSON
    // Convert training days to comma-separated format
    const trainingDaysFormatted = (params.profile.trainingDays || [])
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ')

    const athleteProfile = {
      ftp: params.profile.ftp,
      weight_kg: params.profile.weight,
      max_hr: params.profile.maxHR,
      age: profile?.age || 35,
      goals: params.customGoal ? [params.goal, params.customGoal] : [params.goal],
      experience_level: params.profile.experienceLevel,
      weekly_hours_available: params.profile.weeklyHours,
      training_days_per_week: (params.profile.trainingDays || []).length,
      training_days: trainingDaysFormatted,
    }

    const profilePath = join(outputDir, 'athlete_profile.json')
    await writeFile(profilePath, JSON.stringify(athleteProfile, null, 2), 'utf-8')

    return profilePath
  }

  // Helper methods

  private calculateWeeksUntilEvent(eventDate: string): number {
    const event = new Date(eventDate)
    const now = new Date()
    const diffTime = Math.abs(event.getTime() - now.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
  }
}

// Export singleton instance
export const cyclingCoachService = new CyclingCoachService()

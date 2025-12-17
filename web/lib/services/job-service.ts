/**
 * Job Service - Manages background job lifecycle
 * Used with Vercel waitUntil() for async Strava sync operations
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type {
  CreateJobParams,
  UpdateJobParams,
  SyncJob,
  JobStatus,
} from '@/lib/types/jobs'

export class JobService {
  /**
   * Create a new background job
   */
  async createJob(params: CreateJobParams): Promise<string> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: params.userId,
        type: params.type,
        status: 'pending' as JobStatus,
        payload: params.payload as never, // Cast to never to bypass Json type mismatch
        max_attempts: params.maxAttempts || 3,
        attempts: 0,
      })
      .select('id')
      .single<{ id: string }>()

    if (error) {
      errorLogger.logError(new Error(`Failed to create job: ${error.message}`), {
        userId: params.userId,
        metadata: { type: params.type },
      })
      throw new Error(`Failed to create job: ${error.message}`)
    }

    if (!data) {
      throw new Error('No job ID returned from database')
    }

    errorLogger.logInfo(`Created job ${data.id}`, {
      userId: params.userId,
      metadata: { jobId: data.id, type: params.type },
    })
    return data.id
  }

  /**
   * Update job status and metadata
   */
  async updateJob(params: UpdateJobParams): Promise<void> {
    const supabase = await createClient()

    const updateData: Partial<SyncJob> = {}

    if (params.status) updateData.status = params.status
    if (params.result !== undefined) updateData.result = params.result
    if (params.error !== undefined) updateData.error = params.error
    if (params.startedAt) updateData.started_at = params.startedAt
    if (params.completedAt) updateData.completed_at = params.completedAt
    if (params.attempts !== undefined) updateData.attempts = params.attempts

    const { error } = await supabase
      .from('sync_jobs')
      .update(updateData as never)
      .eq('id', params.id)

    if (error) {
      errorLogger.logError(new Error(`Failed to update job: ${error.message}`), {
        metadata: { jobId: params.id },
      })
      throw new Error(`Failed to update job: ${error.message}`)
    }

    errorLogger.logInfo(`Updated job ${params.id}`, {
      metadata: { jobId: params.id, status: params.status, hasError: !!params.error },
    })
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<SyncJob | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single<SyncJob>()

    if (error) {
      if (error.code === 'PGRST116') {
        // Job not found
        return null
      }
      errorLogger.logError(new Error(`Failed to get job: ${error.message}`), {
        metadata: { jobId },
      })
      throw new Error(`Failed to get job: ${error.message}`)
    }

    return data
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(
    userId: string,
    options?: {
      limit?: number
      status?: JobStatus
    }
  ): Promise<SyncJob[]> {
    const supabase = await createClient()

    let query = supabase
      .from('sync_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    } else {
      query = query.limit(50)
    }

    const { data, error } = await query

    if (error) {
      console.error(`[JobService] Failed to get jobs for user ${userId}:`, error)
      throw new Error(`Failed to get user jobs: ${error.message}`)
    }

    return data as SyncJob[]
  }

  /**
   * Mark job as started
   */
  async markJobAsStarted(jobId: string): Promise<void> {
    await this.updateJob({
      id: jobId,
      status: 'running',
      startedAt: new Date().toISOString(),
    })
  }

  /**
   * Mark job as completed
   */
  async markJobAsCompleted(
    jobId: string,
    result: Record<string, unknown>
  ): Promise<void> {
    await this.updateJob({
      id: jobId,
      status: 'completed',
      result,
      completedAt: new Date().toISOString(),
    })
  }

  /**
   * Mark job as failed
   */
  async markJobAsFailed(jobId: string, error: string): Promise<void> {
    await this.updateJob({
      id: jobId,
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    })
  }

  /**
   * Increment job attempt count
   */
  async incrementAttempts(jobId: string): Promise<number> {
    const job = await this.getJob(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    const newAttempts = job.attempts + 1

    await this.updateJob({
      id: jobId,
      attempts: newAttempts,
    })

    return newAttempts
  }

  /**
   * Check if job should be retried
   */
  async shouldRetry(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId)
    if (!job) {
      return false
    }

    return job.attempts < job.max_attempts
  }
}

// Export singleton instance
export const jobService = new JobService()

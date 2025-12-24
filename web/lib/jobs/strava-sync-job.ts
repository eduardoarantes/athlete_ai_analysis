/**
 * Strava Sync Background Job
 * Executes Strava activity sync in background using Vercel waitUntil()
 */

import { StravaSyncService } from '@/lib/services/strava-sync-service'
import { jobService } from '@/lib/services/job-service'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { StravaSyncJobPayload, StravaSyncJobResult } from '@/lib/types/jobs'

/**
 * Execute Strava sync job in background
 * This function runs asynchronously via Vercel waitUntil()
 *
 * @param jobId - UUID of the job record
 * @param payload - Sync parameters
 * @returns Result of the sync operation
 */
export async function executeStravaSyncJob(
  jobId: string,
  payload: StravaSyncJobPayload
): Promise<StravaSyncJobResult> {
  const startTime = new Date().toISOString()
  const syncService = await StravaSyncService.create()

  errorLogger.logInfo(`Starting Strava sync job ${jobId}`, {
    userId: payload.userId,
    metadata: { jobId },
  })

  try {
    // Mark job as running
    await jobService.markJobAsStarted(jobId)

    // Execute Strava activity sync
    const result = await syncService.syncActivities(payload.userId, payload.syncOptions)

    const endTime = new Date().toISOString()

    // Check if sync was successful
    if (!result.success) {
      throw new Error(result.error || 'Sync failed for unknown reason')
    }

    // Prepare result
    const jobResult: StravaSyncJobResult = {
      activitiesSynced: result.activitiesSynced,
      errors: [], // No errors on success
      startTime,
      endTime,
    }

    // Mark job as completed
    await jobService.markJobAsCompleted(jobId, jobResult as unknown as Record<string, unknown>)

    errorLogger.logInfo(`Strava sync job ${jobId} completed`, {
      userId: payload.userId,
      metadata: { jobId, activitiesSynced: result.activitiesSynced },
    })

    return jobResult
  } catch (error) {
    const endTime = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    errorLogger.logError(new Error(`Strava sync job ${jobId} failed: ${errorMessage}`), {
      userId: payload.userId,
      metadata: { jobId },
    })

    // Check if we should retry
    const shouldRetry = await jobService.shouldRetry(jobId)

    if (shouldRetry) {
      const attempts = await jobService.incrementAttempts(jobId)
      errorLogger.logInfo(`Will retry Strava sync job ${jobId} (attempt ${attempts})`, {
        userId: payload.userId,
        metadata: { jobId, attempts },
      })

      // Update job as pending for retry
      await jobService.updateJob({
        id: jobId,
        status: 'pending',
        error: `Attempt ${attempts} failed: ${errorMessage}`,
      })

      // TODO: Implement retry logic
      // For now, we just mark it as failed after incrementing attempts
    }

    // Mark job as failed
    await jobService.markJobAsFailed(jobId, errorMessage)

    // Create error result
    const jobResult: StravaSyncJobResult = {
      activitiesSynced: 0,
      errors: [errorMessage],
      startTime,
      endTime,
    }

    return jobResult
  }
}

/**
 * Helper to determine sync progress (for future use)
 * Not currently used but reserved for progress tracking
 */
export function calculateSyncProgress(currentPage: number, totalPages: number | undefined): number {
  if (!totalPages) {
    // Unknown total pages - show indeterminate progress
    return 0
  }

  return Math.round((currentPage / totalPages) * 100)
}

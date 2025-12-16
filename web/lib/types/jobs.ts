/**
 * Type definitions for background job system
 * Used with Vercel waitUntil() for async operations
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'
export type JobType = 'strava_sync'

/**
 * Payload for Strava sync job
 * Index signature allows compatibility with Record<string, unknown> for job storage
 */
export interface StravaSyncJobPayload {
  userId: string
  syncOptions: {
    after?: number // Unix timestamp - only sync activities after this date
    perPage?: number // Activities per page (default: 30, max: 200)
    maxPages?: number // Maximum pages to fetch (default: unlimited)
  }
  [key: string]: unknown // Index signature for Record<string, unknown> compatibility
}

/**
 * Result from Strava sync job
 * Index signature allows compatibility with Record<string, unknown> for job storage
 */
export interface StravaSyncJobResult {
  activitiesSynced: number
  errors: string[]
  startTime: string
  endTime: string
  [key: string]: unknown // Index signature for Record<string, unknown> compatibility
}

/**
 * Generic job database record
 */
export interface SyncJob {
  id: string
  user_id: string
  type: JobType
  status: JobStatus
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  attempts: number
  max_attempts: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

/**
 * Job creation parameters
 */
export interface CreateJobParams {
  userId: string
  type: JobType
  payload: Record<string, unknown>
  maxAttempts?: number
}

/**
 * Job update parameters
 */
export interface UpdateJobParams {
  id: string
  status?: JobStatus
  result?: Record<string, unknown>
  error?: string | null
  startedAt?: string
  completedAt?: string
  attempts?: number
}

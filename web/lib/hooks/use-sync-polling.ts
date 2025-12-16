/**
 * Custom hook for polling Strava sync job status
 * Automatically polls the job status endpoint until completion/failure
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SyncJobStatus {
  jobId: string
  status: SyncStatus
  result: {
    activitiesSynced: number
    errors: string[]
    startTime: string
    endTime: string
  } | null
  error: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}

interface UseSyncPollingOptions {
  interval?: number // Polling interval in milliseconds (default: 2000)
  enabled?: boolean // Whether polling is enabled (default: true)
  onComplete?: (status: SyncJobStatus) => void // Callback on job completion
  onError?: (error: string) => void // Callback on error
}

/**
 * Hook to poll sync job status
 *
 * @param jobId - The job ID to poll (null to disable polling)
 * @param options - Polling options
 * @returns Job status, loading state, and control functions
 */
export function useSyncPolling(
  jobId: string | null,
  options: UseSyncPollingOptions = {}
) {
  const {
    interval = 2000,
    enabled = true,
    onComplete,
    onError,
  } = options

  const [status, setStatus] = useState<SyncJobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use ref to track if callbacks have been called
  const completedRef = useRef(false)

  /**
   * Fetch job status from API
   */
  const pollStatus = useCallback(async () => {
    if (!jobId) return

    try {
      const response = await fetch(`/api/strava/sync/status/${jobId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Job not found')
        }
        if (response.status === 403) {
          throw new Error('Access denied to this job')
        }
        throw new Error(`Failed to fetch job status: ${response.statusText}`)
      }

      const data = await response.json()
      setStatus(data)
      setError(null)

      // Check if job is finished (completed or failed)
      if (data.status === 'completed' || data.status === 'failed') {
        setIsPolling(false)

        // Call completion callback only once
        if (!completedRef.current) {
          completedRef.current = true
          if (onComplete) {
            onComplete(data)
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useSyncPolling] Failed to poll sync status:', errorMessage)
      setError(errorMessage)
      setIsPolling(false)

      if (onError) {
        onError(errorMessage)
      }
    }
  }, [jobId, onComplete, onError])

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    if (!jobId) {
      console.warn('[useSyncPolling] Cannot start polling without job ID')
      return
    }

    completedRef.current = false
    setIsPolling(true)
    setError(null)

    // Poll immediately
    pollStatus()
  }, [jobId, pollStatus])

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false)
  }, [])

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setStatus(null)
    setError(null)
    setIsPolling(false)
    completedRef.current = false
  }, [])

  /**
   * Effect to handle polling interval
   */
  useEffect(() => {
    if (!jobId || !isPolling || !enabled) {
      return
    }

    const intervalId = setInterval(pollStatus, interval)

    // Cleanup on unmount or when polling stops
    return () => {
      clearInterval(intervalId)
    }
  }, [jobId, isPolling, enabled, interval, pollStatus])

  return {
    status,
    isPolling,
    error,
    startPolling,
    stopPolling,
    reset,
  }
}

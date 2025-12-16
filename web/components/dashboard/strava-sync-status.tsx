'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useSyncPolling } from '@/lib/hooks/use-sync-polling'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Activity } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface SyncStatus {
  syncStatus: string
  syncError: string | null
  lastSyncAt: string | null
  activityCount: number
}

export function StravaSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use polling hook for background job status
  const { status: jobStatus, isPolling, startPolling, reset: resetPolling } = useSyncPolling(
    currentJobId,
    {
      onComplete: (completedJob) => {
        if (completedJob.status === 'completed' && completedJob.result) {
          const message = `Synced ${completedJob.result.activitiesSynced} activities`
          toast.success(message, {
            duration: 5000,
            icon: '✅',
          })
          loadStatus() // Reload status to get updated counts
        } else if (completedJob.status === 'failed') {
          const errorMsg = completedJob.error || 'Sync failed'
          setError(errorMsg)
          toast.error(errorMsg)
        }
        setCurrentJobId(null)
      },
      onError: (errorMsg) => {
        setError(errorMsg)
        toast.error(errorMsg)
        setCurrentJobId(null)
      },
    }
  )

  useEffect(() => {
    loadStatus()
    // Reload status every 30 seconds if not actively polling
    const interval = setInterval(() => {
      if (!isPolling) {
        loadStatus()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [isPolling])

  const loadStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/strava/sync')
      if (res.ok) {
        const data = await res.json()
        setSyncStatus(data)
      } else if (res.status === 400) {
        // Strava not connected - this is okay, just don't show the card
        setSyncStatus(null)
      }
    } catch (err) {
      console.error('Failed to load sync status:', err)
      // Don't set error for initial load failures - card just won't show
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setError(null)
      resetPolling()

      const res = await fetch('/api/strava/sync', {
        method: 'POST',
      })

      if (res.status === 202) {
        // Background job started successfully
        const data = await res.json()
        setCurrentJobId(data.jobId)
        startPolling()
        toast.loading('Sync started in background...', {
          duration: 3000,
        })
      } else if (!res.ok) {
        const errorData = await res.json()
        const error = errorData.error || 'Failed to start sync'
        setError(error)
        toast.error(error)
      }
    } catch (err) {
      const error = 'Failed to start sync'
      setError(error)
      toast.error(error)
    }
  }

  // Don't show card if loading initially or if Strava not connected
  if (loading && !syncStatus) {
    return null
  }

  if (!syncStatus) {
    return null
  }

  // Use correct status value: 'syncing' per database constraint
  const isSyncing = isPolling || syncStatus.syncStatus === 'syncing'
  const hasError = syncStatus.syncStatus === 'error'
  const hasSyncedBefore = syncStatus.lastSyncAt !== null

  // Hide the panel when sync completed successfully and not currently syncing
  // Only show when: never synced, currently syncing, or has error
  if (!isSyncing && !hasError && hasSyncedBefore) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Strava Sync
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            {syncStatus.lastSyncAt
              ? `Last synced: ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
              : 'Never synced'}
          </CardDescription>
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing}
          size="sm"
          variant="outline"
          className="h-8"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync'}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Sync Progress */}
        {isSyncing && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-muted-foreground">
                {jobStatus?.status === 'pending' && 'Sync pending...'}
                {jobStatus?.status === 'running' && 'Sync in progress...'}
                {!jobStatus && 'Starting sync...'}
              </span>
            </div>
            <Progress value={undefined} className="h-1" />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Sync Error from Status */}
        {hasError && syncStatus.syncError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{syncStatus.syncError}</AlertDescription>
          </Alert>
        )}

        {/* Activity Count */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Activities Synced</p>
            <p className="text-2xl font-bold">{syncStatus.activityCount}</p>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {isSyncing && (
              <div className="flex items-center gap-1 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">Syncing</span>
              </div>
            )}
            {!isSyncing && !hasError && syncStatus.syncStatus === 'success' && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Up to date</span>
              </div>
            )}
            {hasError && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Error</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

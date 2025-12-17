'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSyncPolling } from '@/lib/hooks/use-sync-polling'

interface StravaStatus {
  connected: boolean
  athlete_id?: number
  token_expired?: boolean
  sync_status?: string
  last_sync_at?: string | null
}

interface SyncStatus {
  syncStatus: string
  syncError: string | null
  lastSyncAt: string | null
  activityCount: number
}

interface FTPEstimate {
  estimatedFTP: number
  method: string
  confidence: 'high' | 'medium' | 'low'
  dataPoints: number
  reasoning: string
}

export function StravaConnection() {
  const t = useTranslations('strava')
  const [status, setStatus] = useState<StravaStatus | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [ftpEstimate, setFtpEstimate] = useState<FTPEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [detectingFTP, setDetectingFTP] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Use polling hook for background job status
  const {
    status: jobStatus,
    isPolling,
    startPolling,
    reset: resetPolling,
  } = useSyncPolling(currentJobId, {
    onComplete: (completedJob) => {
      if (completedJob.status === 'completed' && completedJob.result) {
        const message = t('syncedActivities', { count: completedJob.result.activitiesSynced })
        setSuccessMessage(message)
        toast.success(message, {
          duration: 5000,
          icon: '✅',
        })
        loadStatus() // Reload status to get updated counts
      } else if (completedJob.status === 'failed') {
        const errorMsg = completedJob.error || t('failedToSync')
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
  })

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load connection status
      const statusRes = await fetch('/api/auth/strava/status')
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData)

        // If connected, load sync status
        if (statusData.connected) {
          const syncRes = await fetch('/api/strava/sync')
          if (syncRes.ok) {
            const syncData = await syncRes.json()
            setSyncStatus(syncData)
          }
        }
      }
    } catch {
      setError(t('failedToLoadStatus'))
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    window.location.href = '/api/auth/strava/connect'
  }

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/auth/strava/disconnect', {
        method: 'POST',
      })

      if (res.ok) {
        setSuccessMessage(t('disconnectedSuccess'))
        setStatus(null)
        setSyncStatus(null)
        setFtpEstimate(null)
      } else {
        setError(t('failedToDisconnect'))
      }
    } catch {
      setError(t('failedToDisconnect'))
    }
  }

  const handleSync = async () => {
    try {
      setError(null)
      setSuccessMessage(null)
      resetPolling()

      const res = await fetch('/api/strava/sync', {
        method: 'POST',
      })

      if (res.status === 202) {
        // Background job started successfully
        const data = await res.json()
        setCurrentJobId(data.jobId)
        startPolling()
        toast.loading(t('syncStarted') || 'Sync started in background...', {
          duration: 3000,
        })
      } else if (!res.ok) {
        const errorData = await res.json()
        const error = errorData.error || t('failedToSync')
        setError(error)
        toast.error(error)
      }
    } catch {
      const error = t('failedToSync')
      setError(error)
      toast.error(error)
    }
  }

  const handleDetectFTP = async (updateProfile: boolean = false) => {
    try {
      setDetectingFTP(true)
      setError(null)
      setSuccessMessage(null)

      const res = await fetch(`/api/profile/ftp/detect?updateProfile=${updateProfile}`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setFtpEstimate(data.estimate)

        if (data.updated) {
          setSuccessMessage(t('ftpDetected', { ftp: data.estimate.estimatedFTP }))
        } else if (data.estimate.estimatedFTP > 0) {
          setSuccessMessage(
            t('ftpDetectedConfidence', {
              ftp: data.estimate.estimatedFTP,
              confidence: data.estimate.confidence,
            })
          )
        }
      } else {
        setError(t('failedToDetectFtp'))
      }
    } catch {
      setError(t('failedToDetectFtp'))
    } finally {
      setDetectingFTP(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{t('loading')}</p>
        </CardContent>
      </Card>
    )
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('connectTitle')}</CardTitle>
          <CardDescription>{t('connectDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleConnect} className="w-full">
            {t('connectButton')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t('connectionTitle')}</CardTitle>
          <CardDescription>
            {t('athleteId')}: {status.athlete_id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <Alert>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={isPolling || status.token_expired}
              variant="default"
            >
              {isPolling ? t('syncing') : t('syncActivities')}
            </Button>
            <Button onClick={handleDisconnect} variant="outline">
              {t('disconnect')}
            </Button>
          </div>

          {/* Show sync progress if polling */}
          {isPolling && jobStatus && (
            <Alert>
              <AlertDescription>
                {jobStatus.status === 'pending' && (t('syncPending') || 'Sync pending...')}
                {jobStatus.status === 'running' && (t('syncRunning') || 'Sync in progress...')}
              </AlertDescription>
            </Alert>
          )}

          {status.token_expired && (
            <Alert variant="destructive">
              <AlertDescription>{t('tokenExpired')}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle>{t('activitySync')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('totalActivities')}</p>
                <p className="text-2xl font-bold">{syncStatus.activityCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('syncStatus')}</p>
                <p className="text-lg font-semibold capitalize">{syncStatus.syncStatus}</p>
              </div>
            </div>
            {syncStatus.lastSyncAt && (
              <p className="text-sm text-muted-foreground">
                {t('lastSynced')}: {new Date(syncStatus.lastSyncAt).toLocaleString()}
              </p>
            )}
            {syncStatus.syncError && (
              <Alert variant="destructive">
                <AlertDescription>{syncStatus.syncError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* FTP Detection */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ftpDetection')}</CardTitle>
          <CardDescription>{t('ftpDetectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => handleDetectFTP(false)}
              disabled={detectingFTP}
              variant="outline"
            >
              {detectingFTP ? t('detecting') : t('detectFtp')}
            </Button>
            {ftpEstimate && ftpEstimate.estimatedFTP > 0 && (
              <Button onClick={() => handleDetectFTP(true)} disabled={detectingFTP}>
                {t('detectAndUpdate')}
              </Button>
            )}
          </div>

          {ftpEstimate && (
            <div className="rounded-lg border p-4 space-y-2">
              {ftpEstimate.estimatedFTP > 0 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{ftpEstimate.estimatedFTP}</span>
                    <span className="text-muted-foreground">{t('watts')}</span>
                    <span
                      className={`ml-auto text-sm px-2 py-1 rounded ${
                        ftpEstimate.confidence === 'high'
                          ? 'bg-green-100 text-green-800'
                          : ftpEstimate.confidence === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ftpEstimate.confidence} {t('confidence')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('basedOnActivities', { count: ftpEstimate.dataPoints })}
                  </p>
                  <p className="text-sm">{ftpEstimate.reasoning}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{ftpEstimate.reasoning}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
  const [status, setStatus] = useState<StravaStatus | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [ftpEstimate, setFtpEstimate] = useState<FTPEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [detectingFTP, setDetectingFTP] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
    } catch (err) {
      setError('Failed to load Strava status')
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
        setSuccessMessage('Strava disconnected successfully')
        setStatus(null)
        setSyncStatus(null)
        setFtpEstimate(null)
      } else {
        setError('Failed to disconnect from Strava')
      }
    } catch (err) {
      setError('Failed to disconnect from Strava')
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)
      setSuccessMessage(null)

      const res = await fetch('/api/strava/sync', {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setSuccessMessage(`Synced ${data.activitiesSynced} activities successfully`)
        loadStatus() // Reload status to get updated counts
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to sync activities')
      }
    } catch (err) {
      setError('Failed to sync activities')
    } finally {
      setSyncing(false)
    }
  }

  const handleDetectFTP = async (updateProfile: boolean = false) => {
    try {
      setDetectingFTP(true)
      setError(null)
      setSuccessMessage(null)

      const res = await fetch(
        `/api/profile/ftp/detect?updateProfile=${updateProfile}`,
        {
          method: 'POST',
        }
      )

      if (res.ok) {
        const data = await res.json()
        setFtpEstimate(data.estimate)

        if (data.updated) {
          setSuccessMessage(
            `FTP detected: ${data.estimate.estimatedFTP}W and updated in profile`
          )
        } else if (data.estimate.estimatedFTP > 0) {
          setSuccessMessage(
            `FTP detected: ${data.estimate.estimatedFTP}W (${data.estimate.confidence} confidence)`
          )
        }
      } else {
        setError('Failed to detect FTP')
      }
    } catch (err) {
      setError('Failed to detect FTP')
    } finally {
      setDetectingFTP(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading Strava connection...</p>
        </CardContent>
      </Card>
    )
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect to Strava</CardTitle>
          <CardDescription>
            Connect your Strava account to sync activities and analyze your
            performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleConnect} className="w-full">
            Connect with Strava
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
          <CardTitle>Strava Connection</CardTitle>
          <CardDescription>
            Athlete ID: {status.athlete_id}
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
              disabled={syncing || status.token_expired}
              variant="default"
            >
              {syncing ? 'Syncing...' : 'Sync Activities'}
            </Button>
            <Button onClick={handleDisconnect} variant="outline">
              Disconnect
            </Button>
          </div>

          {status.token_expired && (
            <Alert variant="destructive">
              <AlertDescription>
                Token expired. Please disconnect and reconnect.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold">{syncStatus.activityCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sync Status</p>
                <p className="text-lg font-semibold capitalize">
                  {syncStatus.syncStatus}
                </p>
              </div>
            </div>
            {syncStatus.lastSyncAt && (
              <p className="text-sm text-muted-foreground">
                Last synced:{' '}
                {new Date(syncStatus.lastSyncAt).toLocaleString()}
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
          <CardTitle>FTP Auto-Detection</CardTitle>
          <CardDescription>
            Analyze your power data to estimate FTP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => handleDetectFTP(false)}
              disabled={detectingFTP}
              variant="outline"
            >
              {detectingFTP ? 'Detecting...' : 'Detect FTP'}
            </Button>
            {ftpEstimate && ftpEstimate.estimatedFTP > 0 && (
              <Button
                onClick={() => handleDetectFTP(true)}
                disabled={detectingFTP}
              >
                Detect & Update Profile
              </Button>
            )}
          </div>

          {ftpEstimate && (
            <div className="rounded-lg border p-4 space-y-2">
              {ftpEstimate.estimatedFTP > 0 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {ftpEstimate.estimatedFTP}
                    </span>
                    <span className="text-muted-foreground">watts</span>
                    <span
                      className={`ml-auto text-sm px-2 py-1 rounded ${
                        ftpEstimate.confidence === 'high'
                          ? 'bg-green-100 text-green-800'
                          : ftpEstimate.confidence === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ftpEstimate.confidence} confidence
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on {ftpEstimate.dataPoints} activities
                  </p>
                  <p className="text-sm">{ftpEstimate.reasoning}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {ftpEstimate.reasoning}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

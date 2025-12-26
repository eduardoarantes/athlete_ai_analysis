'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Crown } from 'lucide-react'

interface TPStatus {
  connected: boolean
  athlete_id?: string
  token_expired?: boolean
  is_premium?: boolean
}

export function TrainingPeaksConnection() {
  const t = useTranslations('trainingPeaks')
  const [status, setStatus] = useState<TPStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const statusRes = await fetch('/api/auth/trainingpeaks/status')
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData)
      }
    } catch {
      setError(t('failedToLoadStatus'))
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    window.location.href = '/api/auth/trainingpeaks/connect'
  }

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/auth/trainingpeaks/disconnect', {
        method: 'POST',
      })

      if (res.ok) {
        setSuccessMessage(t('disconnectedSuccess'))
        toast.success(t('disconnectedSuccess'))
        setStatus(null)
      } else {
        setError(t('failedToDisconnect'))
        toast.error(t('failedToDisconnect'))
      }
    } catch {
      setError(t('failedToDisconnect'))
      toast.error(t('failedToDisconnect'))
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
          <div className="space-y-2">
            <Button onClick={handleConnect} className="w-full">
              {t('connectButton')}
            </Button>
            <p className="text-xs text-muted-foreground text-center">{t('premiumRequired')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('connectionTitle')}
            {status.is_premium && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
          </CardTitle>
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

          {status.token_expired && (
            <Alert variant="destructive">
              <AlertDescription>{t('tokenExpired')}</AlertDescription>
            </Alert>
          )}

          {!status.is_premium && (
            <Alert>
              <AlertDescription>{t('premiumRequiredForSync')}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleDisconnect} variant="outline">
              {t('disconnect')}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">{t('syncInstructions')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

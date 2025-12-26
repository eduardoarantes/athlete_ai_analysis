'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react'

interface SyncResult {
  success: boolean
  totalWorkouts: number
  syncedWorkouts: number
  failedWorkouts: number
  errors: { workout: string; error: string }[]
}

interface SyncToTrainingPeaksButtonProps {
  planInstanceId: string
  disabled?: boolean
  onSyncComplete?: (result: SyncResult) => void
}

type SyncState = 'idle' | 'checking' | 'syncing' | 'success' | 'error' | 'not-connected'

export function SyncToTrainingPeaksButton({
  planInstanceId,
  disabled,
  onSyncComplete,
}: SyncToTrainingPeaksButtonProps) {
  const t = useTranslations('trainingPeaks')
  const [state, setState] = useState<SyncState>('idle')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const handleSync = async () => {
    setState('checking')

    try {
      // Check TrainingPeaks connection status
      const statusRes = await fetch('/api/auth/trainingpeaks/status')
      const statusData = await statusRes.json()

      if (!statusData.connected) {
        setState('not-connected')
        setShowDialog(true)
        return
      }

      if (!statusData.is_premium) {
        toast.error(t('premiumRequiredForSync'))
        setState('idle')
        return
      }

      // Start sync
      setState('syncing')
      const syncRes = await fetch('/api/trainingpeaks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planInstanceId }),
      })

      const syncResult: SyncResult = await syncRes.json()
      setResult(syncResult)

      if (syncResult.success) {
        setState('success')
        toast.success(t('syncComplete', { count: syncResult.syncedWorkouts }))
      } else {
        setState('error')
        toast.error(t('syncPartialFailed', { failed: syncResult.failedWorkouts }))
      }

      setShowDialog(true)
      onSyncComplete?.(syncResult)
    } catch (error) {
      setState('error')
      toast.error(t('syncFailed'))
      console.error('Sync error:', error)
    }
  }

  const handleConnectRedirect = () => {
    window.location.href = '/api/auth/trainingpeaks/connect'
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setState('idle')
  }

  const getButtonContent = () => {
    switch (state) {
      case 'checking':
      case 'syncing':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {state === 'checking' ? t('checking') : t('syncing')}
          </>
        )
      case 'success':
        return (
          <>
            <Check className="h-4 w-4 mr-2" />
            {t('synced')}
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('syncError')}
          </>
        )
      default:
        return (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {t('syncToTrainingPeaks')}
          </>
        )
    }
  }

  return (
    <>
      <Button
        onClick={handleSync}
        disabled={disabled || state === 'checking' || state === 'syncing'}
        variant={state === 'success' ? 'default' : state === 'error' ? 'destructive' : 'outline'}
        size="sm"
      >
        {getButtonContent()}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {state === 'not-connected' ? t('connectionRequired') : t('syncResults')}
            </DialogTitle>
            <DialogDescription>
              {state === 'not-connected'
                ? t('connectFirst')
                : result?.success
                  ? t('syncSuccessDescription')
                  : t('syncPartialDescription')}
            </DialogDescription>
          </DialogHeader>

          {state === 'not-connected' ? (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">{t('connectInstructions')}</p>
            </div>
          ) : result ? (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{result.totalWorkouts}</p>
                  <p className="text-sm text-muted-foreground">{t('total')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{result.syncedWorkouts}</p>
                  <p className="text-sm text-muted-foreground">{t('synced')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.failedWorkouts}</p>
                  <p className="text-sm text-muted-foreground">{t('failed')}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="text-sm">
                          <strong>{err.workout}:</strong> {err.error}
                        </li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-sm">...and {result.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}

          <DialogFooter>
            {state === 'not-connected' ? (
              <>
                <Button variant="outline" onClick={handleCloseDialog}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleConnectRedirect}>{t('connectNow')}</Button>
              </>
            ) : (
              <Button onClick={handleCloseDialog}>{t('close')}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

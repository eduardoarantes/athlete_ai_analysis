'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, AlertCircle, Clock, CloudOff } from 'lucide-react'

interface SyncStatusBadgeProps {
  instanceId: string
  size?: 'sm' | 'md'
}

interface SyncStatus {
  total: number
  synced: number
  failed: number
  pending: number
}

export function SyncStatusBadge({ instanceId, size = 'sm' }: SyncStatusBadgeProps) {
  const t = useTranslations('trainingPeaks')
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/trainingpeaks/sync/${instanceId}`)
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // Silently fail - badge will show as not synced
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  if (loading) {
    return null
  }

  if (!status || status.total === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-muted-foreground`}
            >
              <CloudOff className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
              {t('notSynced')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('notSyncedTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Determine badge state
  const isFullySynced = status.synced === status.total && status.failed === 0
  const hasErrors = status.failed > 0
  const hasPending = status.pending > 0

  let variant: 'default' | 'destructive' | 'secondary' = 'default'
  let Icon = Check
  let label = t('synced')
  let tooltipText = t('allWorkoutsSynced', { count: status.synced })

  if (hasErrors) {
    variant = 'destructive'
    Icon = AlertCircle
    label = t('partialSync')
    tooltipText = t('syncErrors', { synced: status.synced, failed: status.failed })
  } else if (hasPending) {
    variant = 'secondary'
    Icon = Clock
    label = t('pending')
    tooltipText = t('pendingSync', { pending: status.pending })
  } else if (!isFullySynced) {
    variant = 'secondary'
    Icon = Clock
    label = t('partialSync')
    tooltipText = t('partialSyncTooltip', { synced: status.synced, total: status.total })
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={`${size === 'sm' ? 'text-xs' : 'text-sm'} ${isFullySynced ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}`}
          >
            <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

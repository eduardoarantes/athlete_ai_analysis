'use client'

import { useMemo } from 'react'
import {
  calculateZonesForMaxHr,
  calculateZonesWithHrReserve,
  type HeartZoneWithBpm,
} from '@/lib/types/heart-zones'
import { cn } from '@/lib/utils'

interface HeartZonesTableProps {
  maxHr: number
  restingHr?: number | null | undefined
  compact?: boolean
  className?: string
}

/**
 * Displays heart rate zones with calculated BPM ranges based on Max HR.
 * Optionally uses Karvonen formula when resting HR is provided.
 */
export function HeartZonesTable({
  maxHr,
  restingHr,
  compact = false,
  className,
}: HeartZonesTableProps) {
  const zones = useMemo(() => {
    // Use Karvonen formula if resting HR is available
    if (restingHr && restingHr > 0) {
      return calculateZonesWithHrReserve(maxHr, restingHr)
    }
    return calculateZonesForMaxHr(maxHr)
  }, [maxHr, restingHr])

  if (compact) {
    return (
      <div className={cn('space-y-1', className)}>
        {zones.map((zone) => (
          <HeartZoneRow key={zone.zone} zone={zone} compact />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Zone</th>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-right font-medium">BPM Range</th>
            <th className="px-3 py-2 text-right font-medium">% Max HR</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.zone} className="border-b last:border-0">
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold',
                    zone.bgClass,
                    zone.textClass
                  )}
                >
                  {zone.zone}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{zone.name}</td>
              <td className="px-3 py-2 text-right font-mono">
                {zone.minBpm}-{zone.maxBpm} bpm
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                {zone.minPct}-{zone.maxPct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface HeartZoneRowProps {
  zone: HeartZoneWithBpm
  compact?: boolean
}

function HeartZoneRow({ zone, compact }: HeartZoneRowProps) {
  return (
    <div className={cn('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded font-bold',
          compact ? 'w-6 h-5 text-[10px]' : 'w-8 h-6 text-xs',
          zone.bgClass,
          zone.textClass
        )}
      >
        {zone.zone}
      </span>
      <span className="flex-1 text-muted-foreground truncate">{zone.name}</span>
      <span className="font-mono tabular-nums">
        {zone.minBpm}-{zone.maxBpm}
      </span>
    </div>
  )
}

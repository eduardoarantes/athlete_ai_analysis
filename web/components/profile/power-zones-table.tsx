'use client'

import { useMemo } from 'react'
import { calculateZonesForFtp, type ZoneWithWattage } from '@/lib/types/power-zones'
import { cn } from '@/lib/utils'

interface PowerZonesTableProps {
  ftp: number
  compact?: boolean
  className?: string
}

/**
 * Displays power zones with calculated wattage ranges based on FTP.
 * Can be used in hover cards, tooltips, or full page displays.
 */
export function PowerZonesTable({ ftp, compact = false, className }: PowerZonesTableProps) {
  const zones = useMemo(() => calculateZonesForFtp(ftp), [ftp])

  if (compact) {
    return (
      <div className={cn('space-y-1', className)}>
        {zones.map((zone) => (
          <PowerZoneRow key={zone.zone} zone={zone} compact />
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
            <th className="px-3 py-2 text-right font-medium">Power Range</th>
            <th className="px-3 py-2 text-right font-medium">% FTP</th>
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
              <td className="px-3 py-2 text-right font-mono">{formatWattageRange(zone)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                {formatPercentRange(zone)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface PowerZoneRowProps {
  zone: ZoneWithWattage
  compact?: boolean
}

function PowerZoneRow({ zone, compact }: PowerZoneRowProps) {
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
      <span className="font-mono tabular-nums">{formatWattageRange(zone)}</span>
    </div>
  )
}

function formatWattageRange(zone: ZoneWithWattage): string {
  if (zone.maxWatts === null) {
    return `${zone.minWatts}W+`
  }
  return `${zone.minWatts}-${zone.maxWatts}W`
}

function formatPercentRange(zone: ZoneWithWattage): string {
  if (zone.maxPct === null) {
    return `${zone.minPct}%+`
  }
  return `${zone.minPct}-${zone.maxPct}%`
}

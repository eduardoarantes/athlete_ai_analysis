'use client'

import { ReactNode } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { HeartZonesTable } from './heart-zones-table'
import { Heart } from 'lucide-react'

interface HeartZonesHoverCardProps {
  maxHr: number
  restingHr?: number | null
  children: ReactNode
}

/**
 * Wraps any element with a hover card that displays heart rate zones.
 * Used on the dashboard to show zones when hovering over Max HR.
 */
export function HeartZonesHoverCard({ maxHr, restingHr, children }: HeartZonesHoverCardProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="cursor-help">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="bottom" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Heart className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Heart Rate Zones</p>
              <p className="text-xs text-muted-foreground">
                Max HR: {maxHr} bpm
                {restingHr ? ` | Resting: ${restingHr} bpm` : ''}
              </p>
            </div>
          </div>
          <HeartZonesTable maxHr={maxHr} restingHr={restingHr} compact />
          {restingHr && (
            <p className="text-[10px] text-muted-foreground">
              Using Karvonen formula (heart rate reserve)
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

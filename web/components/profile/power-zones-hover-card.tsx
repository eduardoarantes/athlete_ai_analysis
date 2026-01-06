'use client'

import { ReactNode } from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { PowerZonesTable } from './power-zones-table'
import { Zap } from 'lucide-react'

interface PowerZonesHoverCardProps {
  ftp: number
  children: ReactNode
}

/**
 * Wraps any element with a hover card that displays power zones.
 * Used on the dashboard to show zones when hovering over FTP.
 */
export function PowerZonesHoverCard({ ftp, children }: PowerZonesHoverCardProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="cursor-help">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="bottom" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Power Zones</p>
              <p className="text-xs text-muted-foreground">Based on FTP: {ftp}W</p>
            </div>
          </div>
          <PowerZonesTable ftp={ftp} compact />
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

'use client'

/**
 * Collapsible Sidebar Component
 *
 * A reusable collapsible sidebar with animated transitions.
 * Used for the workout library sidebar in the schedule view.
 *
 * Part of Issue #72: Workout Library Sidebar
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PanelLeftClose, Dumbbell } from 'lucide-react'

interface CollapsibleSidebarProps {
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean
  /** Callback when collapse state changes */
  onCollapsedChange: (collapsed: boolean) => void
  /** Sidebar content */
  children: ReactNode
  /** Width when expanded (default: 280px) */
  expandedWidth?: number
  /** Optional className */
  className?: string
}

export function CollapsibleSidebar({
  isCollapsed,
  onCollapsedChange,
  children,
  expandedWidth = 280,
  className,
}: CollapsibleSidebarProps) {
  return (
    <div
      className={cn(
        'relative flex-shrink-0 border-r bg-background transition-all duration-300 ease-in-out',
        className
      )}
      style={{ width: isCollapsed ? 40 : expandedWidth }}
      data-testid="schedule-sidebar"
      data-collapsed={isCollapsed}
    >
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'absolute z-10 h-8 w-8 rounded-full border bg-background shadow-sm',
          'top-4 transition-all duration-300',
          isCollapsed ? 'left-1' : 'right-[-16px]'
        )}
        onClick={() => onCollapsedChange(!isCollapsed)}
        aria-label={isCollapsed ? 'Open workout library' : 'Close workout library'}
        title={isCollapsed ? 'Open workout library' : 'Close workout library'}
        data-testid="sidebar-toggle"
      >
        {isCollapsed ? <Dumbbell className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      {/* Content - hidden when collapsed */}
      <div
        className={cn(
          'h-full overflow-hidden transition-opacity duration-200',
          isCollapsed ? 'opacity-0 invisible' : 'opacity-100 visible'
        )}
      >
        <div className="h-full p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

'use client'

/**
 * Droppable Day Component
 *
 * A drop zone for workouts in the calendar.
 *
 * Part of Issue #23: Plan Builder Phase 3 - Drag-and-Drop
 */

import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { DayOfWeek } from '@/lib/types/plan-builder'
import { createDayDroppableId, type DayDropData } from './types'
import { cn } from '@/lib/utils'

/**
 * Props for DroppableDay
 */
interface DroppableDayProps {
  weekNumber: number
  day: DayOfWeek
  children: ReactNode
  className?: string | undefined
}

/**
 * Droppable Day Component
 *
 * Wraps a day's content to make it a valid drop target.
 */
export function DroppableDay({
  weekNumber,
  day,
  children,
  className,
}: DroppableDayProps) {
  const dropData: DayDropData = { weekNumber, day }

  const { isOver, setNodeRef, active } = useDroppable({
    id: createDayDroppableId(weekNumber, day),
    data: dropData,
  })

  // Check if something is being dragged
  const isDragging = active !== null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-colors duration-200',
        // Highlight when dragging over
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset rounded-lg',
        // Show subtle highlight when dragging but not over this target
        isDragging && !isOver && 'bg-muted/30',
        className
      )}
    >
      {children}
    </div>
  )
}

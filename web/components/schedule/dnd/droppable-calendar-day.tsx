'use client'

/**
 * Droppable Calendar Day
 *
 * Makes a calendar day cell a valid drop target for workouts.
 * - Disabled for past dates
 * - Shows visual feedback when dragging over
 * - Different visual feedback for library vs scheduled workout drops
 */

import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { startOfDay, parseISO } from 'date-fns'
import { createCalendarDayDroppableId, CalendarDayDropData, type ScheduleDragData } from './types'

interface DroppableCalendarDayProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  date: string // YYYY-MM-DD
  isEditMode: boolean
  allowLibraryDrops?: boolean // Allow drops even when not in full edit mode (for library workouts)
}

export function DroppableCalendarDay({
  children,
  date,
  isEditMode,
  allowLibraryDrops = false,
  className = '',
  ...props
}: DroppableCalendarDayProps) {
  // Check if date is in the past
  const dayDate = parseISO(date)
  const today = startOfDay(new Date())
  const isPast = dayDate < today

  const dropData: CalendarDayDropData = {
    date,
    isPast,
  }

  const droppableId = createCalendarDayDroppableId(date)
  const { isOver, setNodeRef, active } = useDroppable({
    id: droppableId,
    data: dropData,
    // Enable drops if in edit mode OR if library drops are allowed (for creating plans)
    disabled: (!isEditMode && !allowLibraryDrops) || isPast,
  })

  // Determine visual state
  const isDragging = !!active
  const isDropEnabled = isEditMode || allowLibraryDrops
  const isValidDrop = isOver && !isPast && isDropEnabled
  const isInvalidDrop = isOver && isPast

  // Check if this is a library workout being dragged
  const activeData = active?.data.current as ScheduleDragData | undefined
  const isLibraryDrag = activeData?.type === 'library-workout'

  // Build class names for visual feedback
  const dropClasses = [
    className,
    // Base transition
    'transition-all duration-150',
    // Valid drop target - blue for library, primary for move
    isValidDrop &&
      (isLibraryDrag
        ? 'ring-2 ring-blue-500 ring-inset bg-blue-50 dark:bg-blue-900/20'
        : 'ring-2 ring-primary ring-inset bg-primary/10'),
    // Invalid drop target (hovering over past date)
    isInvalidDrop && 'ring-2 ring-destructive ring-inset bg-destructive/10',
    // Potential drop zone (dragging but not over)
    isDragging &&
      !isOver &&
      !isPast &&
      isDropEnabled &&
      'ring-1 ring-dashed ring-muted-foreground/30',
  ]
    .filter(Boolean)
    .join(' ')

  // If not in edit mode and library drops not allowed, just render children without drop functionality
  if (!isEditMode && !allowLibraryDrops) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }

  return (
    <div
      {...props}
      ref={setNodeRef}
      className={dropClasses}
      data-droppable-id={droppableId}
      data-date={date}
    >
      {children}
    </div>
  )
}

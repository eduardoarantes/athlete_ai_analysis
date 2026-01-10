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
}

export function DroppableCalendarDay({
  children,
  date,
  isEditMode,
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
    disabled: !isEditMode || isPast,
  })

  // Determine visual state
  const isDragging = !!active
  const isValidDrop = isOver && !isPast && isEditMode
  const isInvalidDrop = isOver && isPast && isEditMode

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
    isDragging && !isOver && !isPast && isEditMode && 'ring-1 ring-dashed ring-muted-foreground/30',
  ]
    .filter(Boolean)
    .join(' ')

  // If not in edit mode, just render children without drop functionality
  if (!isEditMode) {
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

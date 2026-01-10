'use client'

/**
 * Draggable Library Workout Component
 *
 * Wrapper that makes library workout cards draggable within the schedule DnD context.
 * This is different from the plan-builder's DraggableLibraryWorkout - it uses schedule-specific drag data.
 *
 * Part of Issue #72: Workout Library Sidebar
 */

import { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import { type LibraryWorkoutDragData, createLibraryWorkoutDraggableId } from './types'

interface DraggableLibraryWorkoutProps {
  /** The library workout data */
  workout: WorkoutLibraryItem
  /** Instance ID for the target schedule */
  instanceId: string
  /** Child content (the workout card) */
  children: ReactNode
  /** Optional className */
  className?: string
}

export function DraggableLibraryWorkout({
  workout,
  instanceId,
  children,
  className,
}: DraggableLibraryWorkoutProps) {
  const dragData: LibraryWorkoutDragData = {
    type: 'library-workout',
    workout,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: createLibraryWorkoutDraggableId(workout.id),
    data: dragData,
  })

  // Mark instanceId as used (for future enhancements like multi-instance support)
  void instanceId

  // Note: We don't apply transform here because we use DragOverlay to show the dragged item.
  // The original element stays in place and becomes semi-transparent during drag.
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'touch-none cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        className
      )}
      data-testid="library-workout"
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}

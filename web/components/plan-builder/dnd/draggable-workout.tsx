'use client'

/**
 * Draggable Workout Components
 *
 * Wrapper components that make workout cards draggable.
 *
 * Part of Issue #23: Plan Builder Phase 3 - Drag-and-Drop
 */

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import type { DayOfWeek, WorkoutPlacement } from '@/lib/types/plan-builder'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import {
  type LibraryWorkoutDragData,
  type PlacedWorkoutDragData,
  createLibraryWorkoutDraggableId,
  createPlacedWorkoutDraggableId,
} from './types'
import { cn } from '@/lib/utils'

/**
 * Props for DraggableLibraryWorkout
 */
interface DraggableLibraryWorkoutProps {
  workout: WorkoutLibraryItem
  children: ReactNode
  className?: string | undefined
}

/**
 * Makes a library workout card draggable
 */
export function DraggableLibraryWorkout({
  workout,
  children,
  className,
}: DraggableLibraryWorkoutProps) {
  const dragData: LibraryWorkoutDragData = {
    type: 'library-workout',
    workout,
  }

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: createLibraryWorkoutDraggableId(workout.id),
    data: dragData,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-none',
        isDragging && 'opacity-50',
        className
      )}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}

/**
 * Props for DraggablePlacedWorkout
 */
interface DraggablePlacedWorkoutProps {
  placement: WorkoutPlacement
  weekNumber: number
  day: DayOfWeek
  children: ReactNode
  className?: string | undefined
}

/**
 * Makes a placed workout card draggable
 */
export function DraggablePlacedWorkout({
  placement,
  weekNumber,
  day,
  children,
  className,
}: DraggablePlacedWorkoutProps) {
  const dragData: PlacedWorkoutDragData = {
    type: 'placed-workout',
    placementId: placement.id,
    weekNumber,
    day,
    workoutName: placement.workout?.name ?? 'Workout',
  }

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: createPlacedWorkoutDraggableId(weekNumber, day, placement.id),
    data: dragData,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-none',
        isDragging && 'opacity-50',
        className
      )}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}

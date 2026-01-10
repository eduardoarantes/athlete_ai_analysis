'use client'

/**
 * Draggable Scheduled Workout
 *
 * Makes a scheduled workout card draggable for moving to different dates.
 * - Disabled for workouts with matched activities
 * - Disabled for past dates
 * - Shows visual feedback for drag state
 */

import { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { startOfDay, parseISO } from 'date-fns'
import { Lock } from 'lucide-react'
import { ScheduledWorkoutDragData, createScheduledWorkoutDraggableId } from './types'
import type { Workout } from '@/lib/types/training-plan'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DraggableScheduledWorkoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  instanceId: string
  date: string
  index: number
  workout: Workout
  hasMatch: boolean
  isEditMode: boolean
}

export function DraggableScheduledWorkout({
  children,
  instanceId,
  date,
  index,
  workout,
  hasMatch,
  isEditMode,
  className,
  ...props
}: DraggableScheduledWorkoutProps) {
  // Check if workout is in the past
  const workoutDate = parseISO(date)
  const today = startOfDay(new Date())
  const isPast = workoutDate < today

  // Determine if dragging should be disabled
  const isDragDisabled = !isEditMode || isPast || hasMatch

  const dragData: ScheduledWorkoutDragData = {
    type: 'scheduled-workout',
    instanceId,
    date,
    index,
    workout,
    hasMatch,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: createScheduledWorkoutDraggableId(instanceId, date, index),
    data: dragData,
    disabled: isDragDisabled,
  })

  // Note: We don't apply transform here because we use DragOverlay to show the dragged item.
  // The original element stays in place and becomes semi-transparent during drag.

  // If not in edit mode, just render children
  if (!isEditMode) {
    return <>{children}</>
  }

  // Determine the reason for being disabled
  const getDisabledReason = (): string | null => {
    if (isPast) return 'Cannot move past workouts'
    if (hasMatch) return 'Cannot move workouts with matched activities'
    return null
  }

  const disabledReason = getDisabledReason()

  return (
    <div
      ref={setNodeRef}
      className={`relative group ${isDragging ? 'opacity-50' : ''} ${className || ''}`}
      {...props}
    >
      {/* Lock icon for matched workouts */}
      {hasMatch && isEditMode && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -right-1 -top-1 z-10 bg-background rounded-full p-0.5 shadow-sm border">
                <Lock className="h-3 w-3 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{disabledReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Workout content - draggable from anywhere on the card */}
      <div
        {...(!isDragDisabled ? attributes : {})}
        {...(!isDragDisabled ? listeners : {})}
        className={
          isDragDisabled && isEditMode
            ? 'opacity-75 cursor-not-allowed'
            : 'cursor-grab active:cursor-grabbing'
        }
      >
        {children}
      </div>
    </div>
  )
}

'use client'

/**
 * Schedule DnD Context
 *
 * Provides drag and drop functionality for scheduled workouts.
 * Handles move operations and validates drop targets.
 */

import { ReactNode, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core'
import { startOfDay, parseISO } from 'date-fns'
import { ScheduledWorkoutDragData, parseCalendarDayDroppableId } from './types'
import { WorkoutCard } from '@/components/training/workout-card'

interface ScheduleDndContextProps {
  children: ReactNode
  onMoveWorkout: (
    instanceId: string,
    source: { date: string; index: number },
    target: { date: string; index: number }
  ) => Promise<void>
  isEditMode: boolean
}

export function ScheduleDndContext({
  children,
  onMoveWorkout,
  isEditMode,
}: ScheduleDndContextProps) {
  const [activeWorkout, setActiveWorkout] = useState<ScheduledWorkoutDragData | null>(null)
  // Track current hover target for visual feedback (could be used for drop preview)
  const [, setOverId] = useState<string | null>(null)

  // Configure sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current as ScheduledWorkoutDragData | undefined

    if (data?.type === 'scheduled-workout') {
      setActiveWorkout(data)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    setOverId(over?.id as string | null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveWorkout(null)
    setOverId(null)

    if (!over) {
      return
    }

    const sourceData = active.data.current as ScheduledWorkoutDragData | undefined
    if (!sourceData || sourceData.type !== 'scheduled-workout') {
      return
    }

    // Parse drop target
    const dropTarget = parseCalendarDayDroppableId(over.id as string)
    if (!dropTarget) {
      return
    }

    // Validate not dropping on past date
    const targetDate = parseISO(dropTarget.date)
    const today = startOfDay(new Date())
    if (targetDate < today) {
      return
    }

    // Validate not dropping on same date (no-op)
    if (dropTarget.date === sourceData.date) {
      return
    }

    // Validate workout doesn't have a match (blocked for move)
    if (sourceData.hasMatch) {
      return
    }

    // Calculate target index (append to end of day)
    const targetIndex = 0

    try {
      await onMoveWorkout(
        sourceData.instanceId,
        { date: sourceData.date, index: sourceData.index },
        { date: dropTarget.date, index: targetIndex }
      )
    } catch (error) {
      console.error('Failed to move workout:', error)
    }
  }

  const handleDragCancel = () => {
    setActiveWorkout(null)
    setOverId(null)
  }

  // Don't enable DnD if not in edit mode
  if (!isEditMode) {
    return <>{children}</>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      <DragOverlay dropAnimation={null}>
        {activeWorkout && (
          <div className="opacity-80 rotate-3 scale-105">
            <WorkoutCard workout={activeWorkout.workout} className="w-48" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Hook to check if currently over a valid drop target
export function useScheduleDragState() {
  // This could be extended to provide more drag state info
  return {
    isDragging: false,
  }
}

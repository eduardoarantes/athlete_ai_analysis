'use client'

/**
 * Schedule DnD Context
 *
 * Provides drag and drop functionality for scheduled workouts.
 * Handles move operations for existing workouts and add operations for library workouts.
 */

import { ReactNode, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core'
import { startOfDay, parseISO } from 'date-fns'
import { type ScheduleDragData, parseCalendarDayDroppableId } from './types'
import { WorkoutCard } from '@/components/training/workout-card'
import { WorkoutLibraryCard } from '@/components/plan-builder/workout-library-card'
import { errorLogger } from '@/lib/monitoring/error-logger'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'

interface ScheduleDndContextProps {
  children: ReactNode
  onMoveWorkout: (
    instanceId: string,
    source: { date: string; index: number },
    target: { date: string; index: number }
  ) => Promise<void>
  onAddLibraryWorkout?: (workout: WorkoutLibraryItem, targetDate: string) => Promise<void>
  onError?: (message: string) => void
  isEditMode: boolean
}

export function ScheduleDndContext({
  children,
  onMoveWorkout,
  onAddLibraryWorkout,
  onError,
  isEditMode,
}: ScheduleDndContextProps) {
  // Track active drag item - can be either scheduled workout or library workout
  const [activeItem, setActiveItem] = useState<ScheduleDragData | null>(null)
  // Track current hover target for visual feedback (could be used for drop preview)
  const [, setOverId] = useState<string | null>(null)

  // Configure sensors with activation constraints
  // Include both MouseSensor and PointerSensor for broader compatibility
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current as ScheduleDragData | undefined

    if (data) {
      setActiveItem(data)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    setOverId(over?.id as string | null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveItem(null)
    setOverId(null)

    if (!over) {
      return
    }

    const sourceData = active.data.current as ScheduleDragData | undefined
    if (!sourceData) {
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

    // Handle based on drag type
    if (sourceData.type === 'library-workout') {
      // Adding library workout to schedule
      if (!onAddLibraryWorkout) {
        return
      }

      try {
        await onAddLibraryWorkout(sourceData.workout, dropTarget.date)
      } catch (error) {
        errorLogger.logError(error as Error, {
          path: 'schedule-dnd-context',
          metadata: {
            action: 'add-library',
            targetDate: dropTarget.date,
            workoutId: sourceData.workout.id,
          },
        })
        onError?.('Failed to add workout. Please try again.')
      }
    } else if (sourceData.type === 'scheduled-workout') {
      // Moving existing workout

      // Validate not dropping on same date (no-op)
      if (dropTarget.date === sourceData.date) {
        return
      }

      // Validate workout doesn't have a match (blocked for move)
      if (sourceData.hasMatch) {
        return
      }

      // Target index is a placeholder - server appends to end of day's workouts
      const targetIndex = 0

      try {
        await onMoveWorkout(
          sourceData.instanceId,
          { date: sourceData.date, index: sourceData.index },
          { date: dropTarget.date, index: targetIndex }
        )
      } catch (error) {
        errorLogger.logError(error as Error, {
          path: 'schedule-dnd-context',
          metadata: {
            action: 'move',
            source: { date: sourceData.date, index: sourceData.index },
            target: { date: dropTarget.date, index: targetIndex },
          },
        })
        onError?.('Failed to move workout. Please try again.')
      }
    }
  }

  const handleDragCancel = () => {
    setActiveItem(null)
    setOverId(null)
  }

  // Don't enable DnD if not in edit mode
  if (!isEditMode) {
    return <>{children}</>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
        {activeItem && activeItem.type === 'scheduled-workout' && (
          <div className="opacity-80 rotate-3 scale-105 pointer-events-none">
            <WorkoutCard workout={activeItem.workout} className="w-48" />
          </div>
        )}
        {activeItem && activeItem.type === 'library-workout' && (
          <div className="opacity-80 rotate-3 scale-105 ring-2 ring-blue-500 rounded-lg pointer-events-none">
            <WorkoutLibraryCard workout={activeItem.workout} compact className="w-48" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

'use client'

/**
 * Plan Builder DnD Context
 *
 * Provides drag-and-drop functionality for the plan builder.
 * Wraps @dnd-kit/core with plan-builder-specific logic.
 *
 * Part of Issue #23: Plan Builder Phase 3 - Drag-and-Drop
 */

import { type ReactNode, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { DayOfWeek } from '@/lib/types/plan-builder'
import { usePlanBuilder } from '@/lib/contexts/plan-builder-context'
import {
  type DragData,
  type LibraryWorkoutDragData,
  type PlacedWorkoutDragData,
  parseDayDroppableId,
} from './types'
import { DragOverlayContent } from './drag-overlay'

/**
 * Props for the PlanBuilderDndContext
 */
interface PlanBuilderDndContextProps {
  children: ReactNode
}

/**
 * Active drag state
 */
interface ActiveDragState {
  id: string
  data: DragData
}

/**
 * Plan Builder DnD Context Provider
 *
 * Handles all drag-and-drop operations for the plan builder.
 */
export function PlanBuilderDndContext({ children }: PlanBuilderDndContextProps) {
  const { addWorkout, moveWorkout } = usePlanBuilder()
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null)

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current as DragData | undefined

    if (data) {
      setActiveDrag({
        id: String(active.id),
        data,
      })
    }
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveDrag(null)

      // No valid drop target
      if (!over) return

      const activeData = active.data.current as DragData | undefined
      if (!activeData) return

      // Parse the drop target
      const dropData = parseDayDroppableId(String(over.id))
      if (!dropData) return

      const { weekNumber: targetWeek, day: targetDay } = dropData

      if (activeData.type === 'library-workout') {
        // Dragging from library to calendar
        const libraryData = activeData as LibraryWorkoutDragData
        addWorkout(targetWeek, targetDay, libraryData.workout)
      } else if (activeData.type === 'placed-workout') {
        // Moving a placed workout
        const placedData = activeData as PlacedWorkoutDragData

        // Don't do anything if dropped on same spot
        if (placedData.weekNumber === targetWeek && placedData.day === targetDay) {
          return
        }

        moveWorkout(
          placedData.weekNumber,
          placedData.day,
          targetWeek,
          targetDay,
          placedData.placementId,
          0 // Insert at beginning of day
        )
      }
    },
    [addWorkout, moveWorkout]
  )

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveDrag(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      {/* Drag overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && <DragOverlayContent dragData={activeDrag.data} />}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * Hook to check if a specific day is being hovered during drag
 * Note: Currently unused - visual feedback is handled directly in DroppableDay component
 */
export function useIsDropTarget(_weekNumber: number, _day: DayOfWeek): boolean {
  // Visual feedback is handled in the droppable component via useDroppable's isOver
  return false
}

'use client'

/**
 * Schedule With Sidebar Layout Component
 *
 * Layout wrapper that combines the workout library sidebar with the schedule calendar.
 * Handles sidebar state persistence and custom DnD rendering.
 *
 * Part of Issue #72: Workout Library Sidebar
 */

import { ReactNode, useCallback } from 'react'
import { CollapsibleSidebar } from './collapsible-sidebar'
import { WorkoutBrowser } from '@/components/plan-builder/workout-browser'
import { DraggableLibraryWorkout } from './dnd/draggable-library-workout'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import { WorkoutLibraryCard } from '@/components/plan-builder/workout-library-card'

const SIDEBAR_STORAGE_KEY = 'schedule-sidebar-collapsed'

interface ScheduleWithSidebarProps {
  /** The schedule calendar component */
  children: ReactNode
  /** Instance ID for the schedule being edited */
  instanceId: string
  /** Whether editing is enabled */
  isEditMode: boolean
  /** Callback when a library workout is selected (for detail popup) */
  onWorkoutSelect?: (workout: WorkoutLibraryItem) => void
}

export function ScheduleWithSidebar({
  children,
  instanceId,
  isEditMode,
  onWorkoutSelect,
}: ScheduleWithSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorage(SIDEBAR_STORAGE_KEY, false)

  // Custom render for workout cards - wrap with schedule DnD
  const renderWorkoutCard = useCallback(
    (workout: WorkoutLibraryItem) => {
      return (
        <DraggableLibraryWorkout key={workout.id} workout={workout} instanceId={instanceId}>
          <WorkoutLibraryCard
            workout={workout}
            onClick={onWorkoutSelect ? () => onWorkoutSelect(workout) : undefined}
            isDraggable
            compact
          />
        </DraggableLibraryWorkout>
      )
    },
    [instanceId, onWorkoutSelect]
  )

  // Only show sidebar in edit mode
  if (!isEditMode) {
    return <>{children}</>
  }

  return (
    <div className="flex h-full">
      <CollapsibleSidebar
        isCollapsed={isCollapsed}
        onCollapsedChange={setIsCollapsed}
        expandedWidth={300}
      >
        <WorkoutBrowser
          compact
          isDragEnabled={false} // We handle DnD ourselves with custom render
          onSelectWorkout={onWorkoutSelect}
          renderWorkoutCard={renderWorkoutCard}
          className="h-full"
        />
      </CollapsibleSidebar>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}

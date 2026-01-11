'use client'

/**
 * Drag Overlay Component
 *
 * Renders the visual representation of the item being dragged.
 *
 * Part of Issue #23: Plan Builder Phase 3 - Drag-and-Drop
 */

import { Clock, Zap } from 'lucide-react'
import type { DragData, LibraryWorkoutDragData, PlacedWorkoutDragData } from './types'
import { cn } from '@/lib/utils'
import { getWorkoutIntensityColors } from '@/lib/constants/activity-styles'

/**
 * Format duration in minutes to human-readable format
 */
function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`
  }
  if (minutes < 60) {
    const rounded = Math.round(minutes * 10) / 10
    return Number.isInteger(rounded) ? `${rounded}m` : `${rounded.toFixed(1)}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Props for DragOverlayContent
 */
interface DragOverlayContentProps {
  dragData: DragData
}

/**
 * Drag Overlay Content
 *
 * Renders different content based on what's being dragged.
 */
export function DragOverlayContent({ dragData }: DragOverlayContentProps) {
  if (dragData.type === 'library-workout') {
    return <LibraryWorkoutOverlay data={dragData} />
  }

  if (dragData.type === 'placed-workout') {
    return <PlacedWorkoutOverlay data={dragData} />
  }

  return null
}

/**
 * Overlay for library workout being dragged
 */
function LibraryWorkoutOverlay({ data }: { data: LibraryWorkoutDragData }) {
  const { workout } = data
  const colorClass = getWorkoutIntensityColors(workout.type || 'mixed')

  return (
    <div
      className={cn(
        'flex flex-col p-3 rounded-lg border shadow-lg cursor-grabbing',
        'min-w-[200px] max-w-[280px]',
        colorClass
      )}
    >
      <h4 className="font-medium text-sm">{workout.name}</h4>
      <div className="flex items-center gap-3 mt-1 text-xs opacity-75">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(workout.base_duration_min)}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {workout.base_tss} TSS
        </span>
      </div>
    </div>
  )
}

/**
 * Overlay for placed workout being moved
 */
function PlacedWorkoutOverlay({ data }: { data: PlacedWorkoutDragData }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg cursor-grabbing',
        'bg-primary/10 border-primary/30 text-primary',
        'min-w-[150px]'
      )}
    >
      <span className="font-medium text-sm truncate">{data.workoutName}</span>
    </div>
  )
}

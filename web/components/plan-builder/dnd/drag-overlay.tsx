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

/**
 * Color mapping for workout types
 */
const WORKOUT_TYPE_COLORS: Record<string, string> = {
  endurance: 'bg-blue-100 border-blue-300 text-blue-800',
  tempo: 'bg-green-100 border-green-300 text-green-800',
  sweet_spot: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  threshold: 'bg-orange-100 border-orange-300 text-orange-800',
  vo2max: 'bg-red-100 border-red-300 text-red-800',
  recovery: 'bg-purple-100 border-purple-300 text-purple-800',
  mixed: 'bg-gray-100 border-gray-300 text-gray-800',
}

/**
 * Format duration in minutes
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
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
  const colorClass = WORKOUT_TYPE_COLORS[workout.type] ?? WORKOUT_TYPE_COLORS.mixed

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

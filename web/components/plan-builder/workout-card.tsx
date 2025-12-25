'use client'

/**
 * Workout Card Component
 *
 * Displays a single workout placement in the calendar.
 * Supports drag-and-drop when enabled.
 *
 * Part of Issue #22: Plan Builder Phase 2 - Core UI
 */

import { X, GripVertical, Clock, Zap } from 'lucide-react'
import type { WorkoutPlacement } from '@/lib/types/plan-builder'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Color mapping for workout types
 */
const WORKOUT_TYPE_COLORS: Record<string, string> = {
  endurance: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  tempo: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
  sweet_spot: 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
  threshold: 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-200',
  vo2max: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
  recovery: 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-200',
  mixed: 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200',
}

/**
 * Get workout type display name
 */
function getWorkoutTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    endurance: 'Endurance',
    tempo: 'Tempo',
    sweet_spot: 'Sweet Spot',
    threshold: 'Threshold',
    vo2max: 'VO2max',
    recovery: 'Recovery',
    mixed: 'Mixed',
  }
  return labels[type] ?? type
}

/**
 * Format duration in minutes to human-readable format
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
 * Props for the WorkoutCard component
 */
interface WorkoutCardProps {
  /** The workout placement data */
  placement: WorkoutPlacement
  /** Callback when remove button is clicked */
  onRemove?: (() => void) | undefined
  /** Whether the card is draggable */
  isDraggable?: boolean | undefined
  /** Whether to show compact version */
  isCompact?: boolean | undefined
  /** Additional className */
  className?: string | undefined
}

/**
 * Workout Card Component
 *
 * Displays workout info in a card format.
 */
export function WorkoutCard({
  placement,
  onRemove,
  isDraggable = false,
  isCompact = false,
  className,
}: WorkoutCardProps) {
  const workout = placement.workout
  if (!workout) {
    return null
  }

  const colorClass = WORKOUT_TYPE_COLORS[workout.type] ?? WORKOUT_TYPE_COLORS.mixed

  if (isCompact) {
    return (
      <div
        className={cn(
          'group relative flex items-center gap-1 p-1.5 rounded border text-xs',
          colorClass,
          isDraggable && 'cursor-grab active:cursor-grabbing',
          className
        )}
        data-placement-id={placement.id}
        data-draggable={isDraggable}
      >
        {isDraggable && (
          <GripVertical className="h-3 w-3 opacity-50 group-hover:opacity-100 shrink-0" />
        )}

        <span className="font-medium truncate flex-1" title={workout.name}>
          {workout.name}
        </span>

        <span className="text-[10px] opacity-75 shrink-0">{workout.base_tss}</span>

        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            aria-label="Remove workout"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  // Full-size card (for workout browser)
  return (
    <div
      className={cn(
        'group relative flex flex-col p-3 rounded-lg border',
        colorClass,
        isDraggable && 'cursor-grab active:cursor-grabbing',
        className
      )}
      data-placement-id={placement.id}
      data-draggable={isDraggable}
    >
      {isDraggable && (
        <GripVertical className="absolute top-2 left-2 h-4 w-4 opacity-50 group-hover:opacity-100" />
      )}

      <div className={cn('flex items-start justify-between', isDraggable && 'ml-5')}>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{workout.name}</h4>
          <p className="text-xs opacity-75 mt-0.5">{getWorkoutTypeLabel(workout.type)}</p>
        </div>

        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            aria-label="Remove workout"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs opacity-75">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(workout.base_duration_min)}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {workout.base_tss} TSS
        </span>
      </div>

      {placement.notes && (
        <p className="mt-2 text-xs italic opacity-75">{placement.notes}</p>
      )}
    </div>
  )
}

/**
 * Workout Card Skeleton for loading states
 */
export function WorkoutCardSkeleton({ isCompact = false }: { isCompact?: boolean }) {
  if (isCompact) {
    return (
      <div className="flex items-center gap-1 p-1.5 rounded border bg-muted animate-pulse">
        <div className="h-3 w-16 bg-muted-foreground/20 rounded" />
        <div className="h-3 w-6 bg-muted-foreground/20 rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col p-3 rounded-lg border bg-muted animate-pulse">
      <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
      <div className="h-3 w-20 bg-muted-foreground/20 rounded mt-1" />
      <div className="flex gap-3 mt-2">
        <div className="h-3 w-12 bg-muted-foreground/20 rounded" />
        <div className="h-3 w-16 bg-muted-foreground/20 rounded" />
      </div>
    </div>
  )
}

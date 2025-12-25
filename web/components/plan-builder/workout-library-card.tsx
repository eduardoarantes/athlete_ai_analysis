'use client'

/**
 * Workout Library Card Component
 *
 * Displays a workout from the library with full details.
 * Used in the workout browser sidebar.
 *
 * Part of Issue #22: Plan Builder Phase 2 - Core UI
 */

import { Clock, Zap, GripVertical, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { WorkoutLibraryItem, LibraryWorkoutSegment } from '@/lib/types/workout-library'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Color mapping for workout types
 */
const WORKOUT_TYPE_COLORS: Record<string, string> = {
  endurance: 'border-l-blue-500',
  tempo: 'border-l-green-500',
  sweet_spot: 'border-l-yellow-500',
  threshold: 'border-l-orange-500',
  vo2max: 'border-l-red-500',
  recovery: 'border-l-purple-500',
  mixed: 'border-l-gray-500',
}

/**
 * Intensity badge colors
 */
const INTENSITY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  very_hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

/**
 * Format workout type for display
 */
function formatType(type: string): string {
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
 * Format intensity for display
 */
function formatIntensity(intensity: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    moderate: 'Moderate',
    hard: 'Hard',
    very_hard: 'Very Hard',
  }
  return labels[intensity] ?? intensity
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
 * Format zone for segment display
 */
function formatZone(segment: LibraryWorkoutSegment): string {
  if (segment.power_low_pct && segment.power_high_pct) {
    if (segment.power_low_pct === segment.power_high_pct) {
      return `${segment.power_low_pct}%`
    }
    return `${segment.power_low_pct}-${segment.power_high_pct}%`
  }
  return ''
}

/**
 * Props for WorkoutLibraryCard
 */
interface WorkoutLibraryCardProps {
  /** The workout data */
  workout: WorkoutLibraryItem
  /** Callback when clicked (to add to calendar) */
  onClick?: (() => void) | undefined
  /** Whether draggable */
  isDraggable?: boolean | undefined
  /** Additional className */
  className?: string | undefined
}

/**
 * Workout Library Card Component
 */
export function WorkoutLibraryCard({
  workout,
  onClick,
  isDraggable = false,
  className,
}: WorkoutLibraryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const borderColor = WORKOUT_TYPE_COLORS[workout.type] ?? WORKOUT_TYPE_COLORS.mixed
  const intensityColor = INTENSITY_COLORS[workout.intensity] ?? INTENSITY_COLORS.moderate

  const hasSegments = workout.segments && workout.segments.length > 0
  const hasDescription = workout.detailed_description && workout.detailed_description.trim() !== ''

  return (
    <div
      className={cn(
        'group relative flex flex-col p-3 rounded-lg border border-l-4 bg-card',
        borderColor,
        isDraggable && 'cursor-grab active:cursor-grabbing',
        onClick && 'hover:bg-accent/50 cursor-pointer transition-colors',
        className
      )}
      onClick={onClick}
      data-workout-id={workout.id}
      data-draggable={isDraggable}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        {isDraggable && (
          <GripVertical className="h-4 w-4 mt-0.5 opacity-50 group-hover:opacity-100 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm leading-tight">{workout.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatType(workout.type)}
            </span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded', intensityColor)}>
              {formatIntensity(workout.intensity)}
            </span>
          </div>
        </div>

        {onClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            aria-label="Add workout"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(workout.base_duration_min)}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {workout.base_tss} TSS
        </span>
        {workout.suitable_phases && workout.suitable_phases.length > 0 && (
          <span className="text-muted-foreground/75">
            {workout.suitable_phases.slice(0, 2).join(', ')}
            {workout.suitable_phases.length > 2 && '...'}
          </span>
        )}
      </div>

      {/* Expandable details */}
      {(hasDescription || hasSegments) && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 px-2 self-start text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show details
              </>
            )}
          </Button>

          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
              {hasDescription && (
                <p className="text-xs text-muted-foreground">{workout.detailed_description}</p>
              )}

              {hasSegments && (
                <div className="space-y-1">
                  <span className="text-xs font-medium">Segments:</span>
                  <div className="grid gap-1">
                    {workout.segments!.map((segment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{formatDuration(segment.duration_min ?? 0)}</span>
                          <span className="text-muted-foreground">
                            {segment.description || segment.type}
                          </span>
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {formatZone(segment)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Skeleton loading state
 */
export function WorkoutLibraryCardSkeleton() {
  return (
    <div className="flex flex-col p-3 rounded-lg border border-l-4 border-l-muted bg-card animate-pulse">
      <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
      <div className="flex gap-2 mt-1">
        <div className="h-3 w-16 bg-muted-foreground/20 rounded" />
        <div className="h-3 w-12 bg-muted-foreground/20 rounded" />
      </div>
      <div className="flex gap-4 mt-2">
        <div className="h-3 w-10 bg-muted-foreground/20 rounded" />
        <div className="h-3 w-14 bg-muted-foreground/20 rounded" />
      </div>
    </div>
  )
}

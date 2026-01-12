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
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getWorkoutBorderColor, getIntensityBadgeColors } from '@/lib/constants/activity-styles'
import { formatDuration } from '@/lib/types/training-plan'
import { WorkoutStructureDisplay } from '@/components/workout/workout-structure-display'

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
 * Props for WorkoutLibraryCard
 */
interface WorkoutLibraryCardProps {
  /** The workout data */
  workout: WorkoutLibraryItem
  /** Callback when clicked (to add to calendar) */
  onClick?: (() => void) | undefined
  /** Whether draggable */
  isDraggable?: boolean | undefined
  /** Compact mode for sidebar usage */
  compact?: boolean | undefined
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
  compact = false,
  className,
}: WorkoutLibraryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const borderColor = getWorkoutBorderColor(workout.type)
  const intensityColor = getIntensityBadgeColors(workout.intensity)

  const hasStructure = workout.structure?.structure && workout.structure.structure.length > 0
  const hasDescription = workout.detailed_description && workout.detailed_description.trim() !== ''

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border border-l-4 bg-card',
        compact ? 'p-2' : 'p-3',
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
          <GripVertical
            className={cn(
              'opacity-50 group-hover:opacity-100 shrink-0',
              compact ? 'h-3 w-3 mt-0.5' : 'h-4 w-4 mt-0.5'
            )}
          />
        )}

        <div className="flex-1 min-w-0">
          <h4 className={cn('font-medium leading-tight', compact ? 'text-xs' : 'text-sm')}>
            {workout.name}
          </h4>
          <div className={cn('flex items-center gap-2', compact ? 'mt-0.5' : 'mt-1')}>
            <span className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
              {formatType(workout.type)}
            </span>
            <span
              className={cn(
                'rounded',
                compact ? 'text-[10px] px-1 py-0' : 'text-xs px-1.5 py-0.5',
                intensityColor
              )}
            >
              {formatIntensity(workout.intensity)}
            </span>
          </div>
        </div>

        {onClick && !compact && (
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
      <div
        className={cn(
          'flex items-center gap-4 text-muted-foreground',
          compact ? 'mt-1 text-[10px]' : 'mt-2 text-xs'
        )}
      >
        <span className="flex items-center gap-1">
          <Clock className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          {formatDuration(workout.base_duration_min)}
        </span>
        <span className="flex items-center gap-1">
          <Zap className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          {workout.base_tss} TSS
        </span>
        {!compact && workout.suitable_phases && workout.suitable_phases.length > 0 && (
          <span className="text-muted-foreground/75">
            {workout.suitable_phases.slice(0, 2).join(', ')}
            {workout.suitable_phases.length > 2 && '...'}
          </span>
        )}
      </div>

      {/* Expandable details - hidden in compact mode */}
      {!compact && (hasDescription || hasStructure) && (
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

              {hasStructure && (
                <div className="space-y-1">
                  <span className="text-xs font-medium">Structure:</span>
                  <WorkoutStructureDisplay structure={workout.structure} />
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

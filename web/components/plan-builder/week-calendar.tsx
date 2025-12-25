'use client'

/**
 * Week Calendar Component
 *
 * Displays a 7-day calendar grid for a single week in the plan builder.
 * Shows workout placements and allows drag-and-drop interactions.
 *
 * Part of Issue #22: Plan Builder Phase 2 - Core UI
 */

import { type DayOfWeek, DAYS_OF_WEEK, DAY_LABELS } from '@/lib/types/plan-builder'
import type { WeekState, WorkoutPlacement } from '@/lib/types/plan-builder'
import { cn } from '@/lib/utils'
import { WorkoutCard } from './workout-card'

/**
 * Props for the WeekCalendar component
 */
interface WeekCalendarProps {
  /** Week data */
  week: WeekState
  /** Callback when a workout is removed */
  onRemoveWorkout?: ((day: DayOfWeek, placementId: string) => void) | undefined
  /** Callback when workouts are dropped (for drag-and-drop) */
  onDropWorkout?: ((day: DayOfWeek, placement: WorkoutPlacement) => void) | undefined
  /** Whether drag-and-drop is enabled */
  isDragEnabled?: boolean | undefined
  /** Optional className for styling */
  className?: string | undefined
}

/**
 * Day column component
 */
interface DayColumnProps {
  day: DayOfWeek
  placements: WorkoutPlacement[]
  onRemove?: ((placementId: string) => void) | undefined
  isDragEnabled?: boolean | undefined
}

function DayColumn({ day, placements, onRemove, isDragEnabled }: DayColumnProps) {
  const dayLabel = DAY_LABELS[day]
  const hasWorkouts = placements.length > 0

  return (
    <div
      className={cn(
        'flex flex-col border border-border rounded-lg min-h-[120px]',
        'transition-colors duration-200'
      )}
    >
      {/* Day header */}
      <div className="px-2 py-1 border-b border-border bg-muted/50 rounded-t-lg">
        <span className="text-xs font-medium text-muted-foreground">{dayLabel}</span>
      </div>

      {/* Workout slots */}
      <div
        className={cn(
          'flex-1 p-1 space-y-1',
          !hasWorkouts && 'flex items-center justify-center',
          isDragEnabled && 'min-h-[80px]'
        )}
        data-day={day}
        data-droppable="true"
      >
        {hasWorkouts ? (
          placements.map((placement) => (
            <WorkoutCard
              key={placement.id}
              placement={placement}
              onRemove={onRemove ? () => onRemove(placement.id) : undefined}
              isDraggable={isDragEnabled}
              isCompact
            />
          ))
        ) : (
          <span className="text-xs text-muted-foreground/50">Rest day</span>
        )}
      </div>
    </div>
  )
}

/**
 * Week Calendar Component
 *
 * Displays a 7-day grid for scheduling workouts.
 */
export function WeekCalendar({
  week,
  onRemoveWorkout,
  isDragEnabled = false,
  className,
}: WeekCalendarProps) {
  const handleRemove = (day: DayOfWeek) => (placementId: string) => {
    onRemoveWorkout?.(day, placementId)
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Week header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Week {week.weekNumber}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {week.phase}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{week.weeklyTss}</span> TSS
        </div>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((day) => (
          <DayColumn
            key={day}
            day={day}
            placements={week.workouts[day]}
            onRemove={onRemoveWorkout ? handleRemove(day) : undefined}
            isDragEnabled={isDragEnabled}
          />
        ))}
      </div>

      {/* Week notes (if any) */}
      {week.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic">{week.notes}</p>
      )}
    </div>
  )
}

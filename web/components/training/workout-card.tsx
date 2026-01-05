'use client'

import { Clock, Zap, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  type Workout,
  getWorkoutColors,
  formatDuration,
  calculateWorkoutDuration,
} from '@/lib/types/training-plan'

export interface MatchedActivityInfo {
  name: string
  tss: number | null
  type: string
  match_type: 'auto' | 'manual'
}

interface WorkoutCardProps {
  workout: Workout
  matchedActivity?: MatchedActivityInfo | null | undefined
  className?: string
  onClick?: () => void
}

export function WorkoutCard({ workout, matchedActivity, className, onClick }: WorkoutCardProps) {
  const duration = calculateWorkoutDuration(workout)
  const colorClasses = getWorkoutColors(workout.type || 'mixed')
  const isMatched = !!matchedActivity

  return (
    <div
      className={cn(
        'rounded-lg border p-2 text-xs relative',
        colorClasses,
        isMatched && 'ring-2 ring-green-500/50',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Matched indicator */}
      {isMatched && (
        <div className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-0.5">
          <CheckCircle2 className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="font-medium truncate" title={workout.name}>
        {workout.name}
      </div>

      {workout.type && (
        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
            {workout.type.replace('_', ' ')}
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-3 mt-1.5 text-muted-foreground">
        {duration > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(duration)}
          </span>
        )}
        {workout.tss != null && workout.tss > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {Math.round(workout.tss)} TSS
          </span>
        )}
      </div>

      {/* Matched activity name */}
      {isMatched && (
        <div className="mt-1.5 pt-1.5 border-t border-green-300 dark:border-green-700">
          <div className="flex items-center gap-1 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate text-[10px]" title={matchedActivity.name}>
              {matchedActivity.name}
            </span>
          </div>
          {matchedActivity.tss != null && (
            <div className="text-[10px] text-green-600 dark:text-green-500 mt-0.5">
              Actual: {Math.round(matchedActivity.tss)} TSS
            </div>
          )}
        </div>
      )}
    </div>
  )
}

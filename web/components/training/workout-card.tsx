'use client'

import { Clock, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  type Workout,
  getWorkoutColors,
  formatDuration,
  calculateWorkoutDuration,
} from '@/lib/types/training-plan'

interface WorkoutCardProps {
  workout: Workout
  className?: string
}

export function WorkoutCard({ workout, className }: WorkoutCardProps) {
  const duration = calculateWorkoutDuration(workout)
  const colorClasses = getWorkoutColors(workout.type || 'mixed')

  return (
    <div className={cn('rounded-lg border p-2 text-xs', colorClasses, className)}>
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
        {(workout.tss ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {workout.tss} TSS
          </span>
        )}
      </div>
    </div>
  )
}

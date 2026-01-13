'use client'

/**
 * Workout Detail Modal Component
 *
 * Shows scheduled workout details with activity matching capabilities.
 * Uses WorkoutDetailPopup as the base and adds activity tracking features.
 */

import { Code } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type Workout } from '@/lib/types/training-plan'
import { WorkoutDetailPopup } from '@/components/workout/workout-detail-popup'
import { ActivityMatchingSection, type MatchedActivityData } from './activity-matching-section'

export interface WorkoutDetailModalProps {
  workout: Workout | null
  weekNumber: number
  ftp: number
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin?: boolean
  planInstanceId?: string | undefined
  workoutDate?: string | undefined
  workoutIndex?: number | undefined
  matchedActivity?: MatchedActivityData | null | undefined
  onMatchChange?: () => void
}

// Re-export MatchedActivityData for backwards compatibility
export type { MatchedActivityData }

export function WorkoutDetailModal({
  workout,
  weekNumber,
  ftp,
  open,
  onOpenChange,
  isAdmin = false,
  planInstanceId,
  workoutDate,
  workoutIndex = 0,
  matchedActivity,
  onMatchChange,
}: WorkoutDetailModalProps) {
  const handleViewJson = () => {
    if (!workout) return
    const jsonString = JSON.stringify(workout, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Revoke URL after window has time to load to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Admin badges (source: library vs LLM)
  const adminBadges = isAdmin && workout?.source && (
    <Badge variant={workout.source === 'library' ? 'secondary' : 'outline'} className="text-xs">
      {workout.source === 'library' ? `📚 ${workout.library_workout_id}` : '🤖 LLM'}
    </Badge>
  )

  // Admin action buttons (view JSON)
  const adminActions = isAdmin && (
    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleViewJson}>
      <Code className="h-3 w-3" />
    </Button>
  )

  return (
    <WorkoutDetailPopup
      workout={workout}
      weekNumber={weekNumber}
      ftp={ftp}
      open={open}
      onOpenChange={onOpenChange}
      sections={{
        showBadges: true,
        showStats: true,
        showDescription: false,
        showPowerProfile: true,
        showStructure: true,
        showWeekInfo: true,
        showSuitablePhases: false,
      }}
      additionalBadges={adminBadges}
      headerActions={adminActions}
    >
      {/* Activity matching section */}
      {planInstanceId && workoutDate && (
        <ActivityMatchingSection
          planInstanceId={planInstanceId}
          workoutDate={workoutDate}
          workoutId={workout?.id}
          workoutIndex={workoutIndex}
          matchedActivity={matchedActivity}
          onMatchChange={onMatchChange}
        />
      )}
    </WorkoutDetailPopup>
  )
}

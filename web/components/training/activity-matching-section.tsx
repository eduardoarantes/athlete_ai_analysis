'use client'

/**
 * Activity Matching Section Component
 *
 * Handles linking Strava activities to scheduled workouts for compliance tracking.
 * Extracted from WorkoutDetailModal to be reusable.
 */

import { useState, useEffect } from 'react'
import { Activity, CheckCircle2, Link2, Unlink, Loader2, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface MatchedActivityData {
  id: string // strava_activities.id
  match_id: string // workout_activity_matches.id (for compliance link)
  strava_activity_id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number | null
  moving_time: number | null
  tss: number | null
  average_watts: number | null
  match_type: 'auto' | 'manual'
  match_score: number | null
}

interface UnmatchedActivity {
  id: string
  strava_activity_id: number
  name: string
  type: string
  start_date: string
  tss: number | null
  moving_time: number | null
}

interface ActivityMatchingSectionProps {
  /** Plan instance ID for the workout */
  planInstanceId: string
  /** Workout date (YYYY-MM-DD) */
  workoutDate: string
  /** Workout ID (optional, used if available) */
  workoutId?: string | undefined
  /** Workout index in day (for multiple workouts on same day) */
  workoutIndex?: number | undefined
  /** Currently matched activity data */
  matchedActivity?: MatchedActivityData | null | undefined
  /** Callback when match state changes */
  onMatchChange?: (() => void) | undefined
}

export function ActivityMatchingSection({
  planInstanceId,
  workoutDate,
  workoutId,
  workoutIndex = 0,
  matchedActivity,
  onMatchChange,
}: ActivityMatchingSectionProps) {
  const [isMatching, setIsMatching] = useState(false)
  const [isUnmatching, setIsUnmatching] = useState(false)
  const [showActivitySelector, setShowActivitySelector] = useState(false)
  const [availableActivities, setAvailableActivities] = useState<UnmatchedActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string>('')

  // Fetch available activities when showing selector
  useEffect(() => {
    if (!showActivitySelector) return

    const fetchActivities = async () => {
      setLoadingActivities(true)
      try {
        // Get activities within +/- 3 days of the workout date
        const date = new Date(workoutDate)
        const startDate = new Date(date)
        startDate.setDate(date.getDate() - 3)
        const endDate = new Date(date)
        endDate.setDate(date.getDate() + 3)

        // Build query params - show all activities, user chooses which to match
        const startDateStr = startDate.toISOString().split('T')[0] ?? ''
        const endDateStr = endDate.toISOString().split('T')[0] ?? ''

        const response = await fetch(
          `/api/schedule/matches/activities?start_date=${startDateStr}&end_date=${endDateStr}`
        )
        if (response.ok) {
          const data = await response.json()
          setAvailableActivities(data.activities || [])
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error)
      } finally {
        setLoadingActivities(false)
      }
    }

    fetchActivities()
  }, [showActivitySelector, workoutDate])

  const handleMatch = async () => {
    if (!selectedActivityId) return

    setIsMatching(true)
    try {
      const response = await fetch('/api/schedule/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_instance_id: planInstanceId,
          workout_id: workoutId,
          workout_date: workoutDate,
          workout_index: workoutIndex,
          strava_activity_id: selectedActivityId,
          match_type: 'manual',
        }),
      })

      if (response.ok) {
        setShowActivitySelector(false)
        setSelectedActivityId('')
        onMatchChange?.()
      }
    } catch (error) {
      console.error('Failed to match activity:', error)
    } finally {
      setIsMatching(false)
    }
  }

  const handleUnmatch = async () => {
    setIsUnmatching(true)
    try {
      // Build query params - prefer workout_id if available
      const params = new URLSearchParams({ plan_instance_id: planInstanceId })
      if (workoutId) {
        params.set('workout_id', workoutId)
      } else {
        params.set('workout_date', workoutDate)
        params.set('workout_index', workoutIndex.toString())
      }

      const response = await fetch(`/api/schedule/matches?${params.toString()}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onMatchChange?.()
      }
    } catch (error) {
      console.error('Failed to unmatch activity:', error)
    } finally {
      setIsUnmatching(false)
    }
  }

  return (
    <Card className="gap-1 py-3">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Completed Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {matchedActivity ? (
          <div className="space-y-3">
            {/* Matched Activity Info */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-green-900 dark:text-green-100">
                  {matchedActivity.name}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                  <span className="capitalize">
                    {(matchedActivity.sport_type || 'Unknown').replace('_', ' ')}
                  </span>
                  {matchedActivity.tss != null && (
                    <span className="ml-2">• {Math.round(matchedActivity.tss)} TSS</span>
                  )}
                  {matchedActivity.average_watts != null && (
                    <span className="ml-2">• {Math.round(matchedActivity.average_watts)}W avg</span>
                  )}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {new Date(matchedActivity.start_date).toLocaleDateString()} •{' '}
                  <span className="capitalize">{matchedActivity.match_type} match</span>
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="default" size="sm" asChild className="flex-1">
                <Link href={`/compliance/${matchedActivity.match_id}`}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Compliance
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleUnmatch} disabled={isUnmatching}>
                {isUnmatching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : showActivitySelector ? (
          <div className="space-y-3">
            {loadingActivities ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading activities...</span>
              </div>
            ) : availableActivities.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No unmatched activities found within ±3 days of this workout
              </div>
            ) : (
              <>
                <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an activity to match" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableActivities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{activity.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.start_date).toLocaleDateString()} •{' '}
                            {(activity.type || 'Unknown').replace('_', ' ')}
                            {activity.tss != null && ` • ${Math.round(activity.tss)} TSS`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowActivitySelector(false)
                      setSelectedActivityId('')
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleMatch}
                    disabled={!selectedActivityId || isMatching}
                    className="flex-1"
                  >
                    {isMatching ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Match
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-center py-2">
              No activity matched to this workout yet
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActivitySelector(true)}
              className="w-full"
            >
              <Link2 className="h-4 w-4 mr-2" />
              Match Activity
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

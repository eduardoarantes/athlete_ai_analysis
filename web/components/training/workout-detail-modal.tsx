'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Clock,
  Zap,
  Activity,
  Code,
  CheckCircle2,
  Link2,
  Unlink,
  Loader2,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type Workout,
  formatDuration,
  calculateWorkoutDuration,
  hasValidStructure,
} from '@/lib/types/training-plan'
import { getStructureWorkTime } from '@/lib/utils/workout-structure-helpers'
import { PowerProfileSVG } from './power-profile-svg'
import { WorkoutStructureDisplay } from '@/components/workout/workout-structure-display'

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

interface WorkoutDetailModalProps {
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
  const t = useTranslations('trainingPlan')
  const [isMatching, setIsMatching] = useState(false)
  const [isUnmatching, setIsUnmatching] = useState(false)
  const [showActivitySelector, setShowActivitySelector] = useState(false)
  const [availableActivities, setAvailableActivities] = useState<UnmatchedActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string>('')

  // Fetch available activities when showing selector
  useEffect(() => {
    if (!showActivitySelector || !workoutDate) return

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
    if (!planInstanceId || !selectedActivityId) return
    // Require either workout_id or workoutDate for identification
    if (!workout?.id && !workoutDate) return

    setIsMatching(true)
    try {
      const response = await fetch('/api/schedule/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_instance_id: planInstanceId,
          workout_id: workout?.id,
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
    if (!planInstanceId) return
    // Require either workout_id or workoutDate for identification
    if (!workout?.id && !workoutDate) return

    setIsUnmatching(true)
    try {
      // Build query params - prefer workout_id if available
      const params = new URLSearchParams({ plan_instance_id: planInstanceId })
      if (workout?.id) {
        params.set('workout_id', workout.id)
      } else if (workoutDate) {
        params.set('workout_date', workoutDate)
        params.set('workout_index', workoutIndex.toString())
      }

      const response = await fetch(`/api/schedule/matches?${params.toString()}`, { method: 'DELETE' })

      if (response.ok) {
        onMatchChange?.()
      }
    } catch (error) {
      console.error('Failed to unmatch activity:', error)
    } finally {
      setIsUnmatching(false)
    }
  }

  const handleViewJson = () => {
    if (!workout) return
    const jsonString = JSON.stringify(workout, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Revoke URL after window has time to load to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (!workout) return null

  const totalDuration = calculateWorkoutDuration(workout)
  const workTime = workout.structure ? getStructureWorkTime(workout.structure) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <DialogTitle className="text-lg">{workout.name}</DialogTitle>
            {workout.type && (
              <Badge variant="outline" className="capitalize text-xs">
                {workout.type.replace('_', ' ')}
              </Badge>
            )}
            {isAdmin && workout.source && (
              <Badge
                variant={workout.source === 'library' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {workout.source === 'library' ? `📚 ${workout.library_workout_id}` : '🤖 LLM'}
              </Badge>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleViewJson}>
                <Code className="h-3 w-3" />
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs">
            {t('week')} {weekNumber} &bull; {workout.weekday}
          </DialogDescription>
          {/* Inline Metrics */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm pt-2 border-t mt-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{formatDuration(totalDuration)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Work:</span>
              <span className="font-medium">{workTime > 0 ? formatDuration(workTime) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {workout.tss != null ? Math.round(workout.tss) : 'N/A'} TSS
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Workout Description */}
          {(workout.detailed_description || workout.description) && (
            <Card className="gap-1 py-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium">{t('workoutDescription')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {workout.detailed_description || workout.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Power Profile Visualization */}
          {workout.structure?.structure?.length && (
            <Card className="gap-1 py-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium">{t('powerProfile')}</CardTitle>
              </CardHeader>
              <CardContent>
                <PowerProfileSVG structure={workout.structure} ftp={ftp} />
              </CardContent>
            </Card>
          )}

          {/* Matched Activity Section - moved to top for visibility */}
          {planInstanceId && workoutDate && (
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
                            <span className="ml-2">
                              • {Math.round(matchedActivity.average_watts)}W avg
                            </span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnmatch}
                        disabled={isUnmatching}
                      >
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
                        <span className="ml-2 text-sm text-muted-foreground">
                          Loading activities...
                        </span>
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
          )}

          {/* Workout Structure */}
          {hasValidStructure(workout.structure) && (
            <Card className="gap-1 py-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium">{t('workoutStructure')}</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkoutStructureDisplay structure={workout.structure} />
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

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
} from 'lucide-react'
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
  type WorkoutSegment,
  formatDuration,
  calculateWorkoutDuration,
} from '@/lib/types/training-plan'
import { PowerProfileSVG } from './power-profile-svg'
import { getPowerRangeColor } from '@/lib/types/power-zones'

export interface MatchedActivityData {
  id: string
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

interface ExpandedSegment {
  type: string
  duration_min: number
  power_low_pct: number
  power_high_pct: number
  description?: string | undefined
}

interface GroupedSegment {
  type: 'repeat' | 'single'
  repeat_count?: number
  segments?: ExpandedSegment[]
  segment?: ExpandedSegment
}

function groupSegments(segments: WorkoutSegment[]): GroupedSegment[] {
  const grouped: GroupedSegment[] = []

  segments.forEach((segment) => {
    if (segment.sets != null && segment.work && segment.recovery) {
      const workSeg: ExpandedSegment = {
        type: 'work',
        duration_min: segment.work.duration_min,
        power_low_pct: segment.work.power_low_pct,
        power_high_pct: segment.work.power_high_pct,
        description: segment.description,
      }
      const recoverySeg: ExpandedSegment = {
        type: 'recovery',
        duration_min: segment.recovery.duration_min,
        power_low_pct: segment.recovery.power_low_pct,
        power_high_pct: segment.recovery.power_high_pct,
      }
      grouped.push({
        type: 'repeat',
        repeat_count: segment.sets,
        segments: [workSeg, recoverySeg],
      })
    } else {
      grouped.push({
        type: 'single',
        segment: {
          type: segment.type,
          duration_min: segment.duration_min,
          power_low_pct: segment.power_low_pct ?? 50,
          power_high_pct: segment.power_high_pct ?? 60,
          description: segment.description,
        },
      })
    }
  })

  return grouped
}

function formatPowerRange(ftp: number, lowPct: number, highPct: number): string {
  const lowWatts = Math.round((lowPct / 100) * ftp)
  const highWatts = Math.round((highPct / 100) * ftp)

  if (lowPct === highPct) {
    return `${lowWatts}W (${lowPct}%)`
  }
  return `${lowWatts}-${highWatts}W (${lowPct}-${highPct}%)`
}

function formatSegmentDuration(durationMin: number): string {
  if (durationMin >= 60) {
    const hours = Math.floor(durationMin / 60)
    const mins = durationMin % 60
    return `${hours}h${mins > 0 ? mins + 'm' : ''}`
  } else if (durationMin < 1) {
    return `${Math.round(durationMin * 60)}s`
  }
  return `${durationMin} min`
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

        const response = await fetch(
          `/api/schedule/matches/activities?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
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
    if (!planInstanceId || !workoutDate || !selectedActivityId) return

    setIsMatching(true)
    try {
      const response = await fetch('/api/schedule/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_instance_id: planInstanceId,
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
    if (!planInstanceId || !workoutDate) return

    setIsUnmatching(true)
    try {
      const response = await fetch(
        `/api/schedule/matches?plan_instance_id=${planInstanceId}&workout_date=${workoutDate}&workout_index=${workoutIndex}`,
        { method: 'DELETE' }
      )

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
  const workTime =
    workout.segments?.reduce((sum, seg) => {
      if (seg.type !== 'warmup' && seg.type !== 'cooldown' && seg.type !== 'recovery') {
        let duration = seg.duration_min || 0
        if (seg.sets && seg.work) {
          duration = seg.work.duration_min * seg.sets
        }
        return sum + duration
      }
      return sum
    }, 0) || 0

  const groupedSegments = workout.segments ? groupSegments(workout.segments) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {workout.detailed_description || workout.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Power Profile Visualization */}
          {workout.segments && workout.segments.length > 0 && (
            <Card className="gap-1 py-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium">{t('powerProfile')}</CardTitle>
              </CardHeader>
              <CardContent>
                <PowerProfileSVG segments={workout.segments} ftp={ftp} />
              </CardContent>
            </Card>
          )}

          {/* Workout Structure */}
          {groupedSegments.length > 0 && (
            <Card className="gap-1 py-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium">{t('workoutStructure')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedSegments.map((group, index) => {
                  if (group.type === 'repeat' && group.segments) {
                    // Repeat group with dashed amber border
                    return (
                      <div
                        key={index}
                        className="bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-lg p-4"
                      >
                        {/* Repeat header */}
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold px-2.5 py-0.5">
                            {group.repeat_count}x
                          </Badge>
                          <span className="text-sm text-amber-700 dark:text-amber-400">
                            {t('repeatSet', { count: group.repeat_count ?? 0 })}
                          </span>
                        </div>
                        {/* Segments within repeat */}
                        <div className="space-y-2">
                          {group.segments.map((seg, segIndex) => (
                            <div
                              key={segIndex}
                              className="bg-background rounded-lg overflow-hidden"
                            >
                              <div
                                className="flex items-center gap-4 p-3 border-l-4"
                                style={{
                                  borderLeftColor: getPowerRangeColor(
                                    seg.power_low_pct ?? 50,
                                    seg.power_high_pct ?? 60
                                  ),
                                }}
                              >
                                <div className="font-semibold min-w-[70px]">
                                  {formatSegmentDuration(seg.duration_min)}
                                </div>
                                <div
                                  className="font-medium"
                                  style={{
                                    color: getPowerRangeColor(
                                      seg.power_low_pct ?? 50,
                                      seg.power_high_pct ?? 60
                                    ),
                                  }}
                                >
                                  {formatPowerRange(ftp, seg.power_low_pct, seg.power_high_pct)}
                                </div>
                                <div className="text-sm text-muted-foreground capitalize">
                                  {seg.description || seg.type}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  // Single segment row
                  const seg = group.segment!
                  return (
                    <div key={index} className="bg-muted/30 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-4 p-3 border-l-4"
                        style={{
                          borderLeftColor: getPowerRangeColor(
                            seg.power_low_pct ?? 50,
                            seg.power_high_pct ?? 60
                          ),
                        }}
                      >
                        <div className="font-semibold min-w-[70px]">
                          {formatSegmentDuration(seg.duration_min)}
                        </div>
                        <div
                          className="font-medium"
                          style={{
                            color: getPowerRangeColor(
                              seg.power_low_pct ?? 50,
                              seg.power_high_pct ?? 60
                            ),
                          }}
                        >
                          {formatPowerRange(ftp, seg.power_low_pct, seg.power_high_pct)}
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {seg.description || seg.type}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Matched Activity Section */}
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
                        <div className="font-medium text-green-900 dark:text-green-100 truncate">
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
                    {/* Unmatch Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnmatch}
                      disabled={isUnmatching}
                      className="w-full"
                    >
                      {isUnmatching ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4 mr-2" />
                      )}
                      Remove Match
                    </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

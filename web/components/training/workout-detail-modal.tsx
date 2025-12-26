'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, Zap, Activity, Repeat, Code } from 'lucide-react'
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
  type Workout,
  type WorkoutSegment,
  formatDuration,
  calculateWorkoutDuration,
} from '@/lib/types/training-plan'

interface WorkoutDetailModalProps {
  workout: Workout | null
  weekNumber: number
  ftp: number
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin?: boolean
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

function expandSegments(segments: WorkoutSegment[]): ExpandedSegment[] {
  const expanded: ExpandedSegment[] = []

  segments.forEach((segment) => {
    if (segment.sets != null && segment.work && segment.recovery) {
      for (let i = 0; i < segment.sets; i++) {
        expanded.push({
          type: segment.work.duration_min ? 'work' : 'interval',
          duration_min: segment.work.duration_min,
          power_low_pct: segment.work.power_low_pct,
          power_high_pct: segment.work.power_high_pct,
          description: segment.description,
        })
        expanded.push({
          type: 'recovery',
          duration_min: segment.recovery.duration_min,
          power_low_pct: segment.recovery.power_low_pct,
          power_high_pct: segment.recovery.power_high_pct,
        })
      }
    } else {
      expanded.push({
        type: segment.type,
        duration_min: segment.duration_min,
        power_low_pct: segment.power_low_pct ?? 50,
        power_high_pct: segment.power_high_pct ?? 60,
        description: segment.description,
      })
    }
  })

  return expanded
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

function getPowerZone(powerPct: number): string {
  if (powerPct < 56) return 'Z1'
  if (powerPct < 76) return 'Z2'
  if (powerPct < 90) return 'Z3'
  if (powerPct < 105) return 'Z4'
  if (powerPct < 120) return 'Z5'
  return 'Z6'
}

function getSegmentColor(type: string): string {
  const colors: Record<string, string> = {
    warmup: '#94A3B8',
    cooldown: '#94A3B8',
    recovery: '#10B981',
    interval: '#EF4444',
    work: '#EF4444',
    steady: '#10B981',
    tempo: '#F59E0B',
    threshold: '#EF4444',
    vo2max: '#8B5CF6',
  }
  return colors[type] || '#3B82F6'
}

function PowerProfileSVG({ segments, ftp }: { segments: WorkoutSegment[]; ftp: number }) {
  const expanded = useMemo(() => expandSegments(segments), [segments])

  if (expanded.length === 0) return null

  const width = 600
  const chartHeight = 170
  const graphHeight = 140
  const topMargin = 20

  const totalDuration = expanded.reduce((sum, seg) => sum + seg.duration_min, 0)

  const getBarHeight = (powerLowPct: number, powerHighPct: number) => {
    const avgPercent = (powerLowPct + powerHighPct) / 2
    const heightPercent = Math.min(200, Math.max(20, avgPercent))
    return (heightPercent / 200) * graphHeight
  }

  // Calculate cumulative offsets for positioning
  const cumulativeOffsets = expanded.reduce<number[]>((acc, _segment, index) => {
    if (index === 0) {
      acc.push(0)
    } else {
      const prevOffset = acc[index - 1] ?? 0
      const prevSegment = expanded[index - 1]
      const prevWidth = prevSegment ? (prevSegment.duration_min / totalDuration) * width : 0
      acc.push(prevOffset + prevWidth)
    }
    return acc
  }, [])

  const bars = expanded.map((segment, index) => {
    const xOffset = cumulativeOffsets[index] ?? 0
    const segmentWidth = (segment.duration_min / totalDuration) * width
    const barHeight = getBarHeight(segment.power_low_pct, segment.power_high_pct)
    const y = topMargin + graphHeight - barHeight
    const color = getSegmentColor(segment.type)
    const avgPowerPct = (segment.power_low_pct + segment.power_high_pct) / 2
    const zone = getPowerZone(avgPowerPct)

    return (
      <g key={index}>
        <rect
          x={xOffset}
          y={y}
          width={segmentWidth}
          height={barHeight}
          fill={color}
          stroke="#fff"
          strokeWidth="1"
        />
        {barHeight > 25 && segmentWidth > 30 && (
          <text
            x={xOffset + segmentWidth / 2}
            y={y + barHeight / 2 + 5}
            fontSize="14"
            fontWeight="bold"
            fill="#fff"
            textAnchor="middle"
          >
            {zone}
          </text>
        )}
      </g>
    )
  })

  const ftpY = topMargin + graphHeight * 0.5
  const gridY1 = topMargin + graphHeight * 0.25
  const gridY2 = topMargin + graphHeight * 0.5
  const gridY3 = topMargin + graphHeight * 0.75

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1="0"
        y1={gridY1}
        x2={width}
        y2={gridY1}
        stroke="#e4e6e8"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1="0"
        y1={gridY2}
        x2={width}
        y2={gridY2}
        stroke="#e4e6e8"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1="0"
        y1={gridY3}
        x2={width}
        y2={gridY3}
        stroke="#e4e6e8"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1="0"
        y1={ftpY}
        x2={width}
        y2={ftpY}
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <text x="5" y={ftpY - 5} fontSize="12" fontWeight="bold" fill="hsl(var(--primary))">
        FTP ({ftp}W)
      </text>
      {bars}
    </svg>
  )
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
}: WorkoutDetailModalProps) {
  const t = useTranslations('trainingPlan')

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
                    return (
                      <div key={index} className="bg-muted/50 border border-dashed rounded-lg p-3">
                        {(group.repeat_count ?? 0) > 1 && (
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                            <Badge variant="secondary" className="font-bold">
                              <Repeat className="h-3 w-3 mr-1" />
                              {group.repeat_count}x
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {t('repeatSet', { count: group.repeat_count ?? 0 })}
                            </span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {group.segments.map((seg, segIndex) => (
                            <div
                              key={segIndex}
                              className="bg-background p-2 rounded border-l-4 grid grid-cols-3 gap-2 items-center text-sm"
                              style={{ borderLeftColor: getSegmentColor(seg.type) }}
                            >
                              <div className="font-medium">
                                {formatSegmentDuration(seg.duration_min)}
                              </div>
                              <div className="text-muted-foreground">
                                {formatPowerRange(ftp, seg.power_low_pct, seg.power_high_pct)}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {seg.description || seg.type}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  const seg = group.segment!
                  return (
                    <div
                      key={index}
                      className="bg-muted/30 p-2 rounded border-l-4 grid grid-cols-3 gap-2 items-center text-sm"
                      style={{ borderLeftColor: getSegmentColor(seg.type) }}
                    >
                      <div className="font-medium">{formatSegmentDuration(seg.duration_min)}</div>
                      <div className="text-muted-foreground">
                        {formatPowerRange(ftp, seg.power_low_pct, seg.power_high_pct)}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {seg.description || seg.type}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

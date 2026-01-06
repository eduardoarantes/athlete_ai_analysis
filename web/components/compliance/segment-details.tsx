'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock, Target, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SegmentAnalysis, ZoneDistribution } from '@/lib/services/compliance-analysis-service'

// ============================================================================
// Types
// ============================================================================

interface SegmentDetailsCardProps {
  segments: SegmentAnalysis[]
  ftp?: number
  className?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

const matchQualityColors: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  good: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  fair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  poor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  skipped: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
}

const segmentTypeColors: Record<string, string> = {
  warmup: 'bg-blue-500',
  work: 'bg-red-500',
  interval: 'bg-red-500',
  recovery: 'bg-green-500',
  cooldown: 'bg-blue-500',
  steady: 'bg-yellow-500',
  tempo: 'bg-orange-500',
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600 dark:text-green-400'
  if (score >= 80) return 'text-blue-600 dark:text-blue-400'
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 60) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

// ============================================================================
// Zone Distribution Bar
// ============================================================================

interface ZoneDistributionBarProps {
  distribution: ZoneDistribution
  targetZone: number
}

function ZoneDistributionBar({ distribution, targetZone }: ZoneDistributionBarProps) {
  const zones = [
    { key: 'z1', label: 'Z1', color: 'bg-blue-400', value: distribution.z1 },
    { key: 'z2', label: 'Z2', color: 'bg-green-400', value: distribution.z2 },
    { key: 'z3', label: 'Z3', color: 'bg-yellow-400', value: distribution.z3 },
    { key: 'z4', label: 'Z4', color: 'bg-orange-400', value: distribution.z4 },
    { key: 'z5', label: 'Z5', color: 'bg-red-400', value: distribution.z5 },
  ]

  return (
    <div className="space-y-1">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {zones.map((zone, idx) => (
          <div
            key={zone.key}
            className={cn(
              zone.color,
              idx + 1 === targetZone && 'ring-2 ring-primary ring-offset-1'
            )}
            style={{ width: `${zone.value * 100}%` }}
            title={`${zone.label}: ${(zone.value * 100).toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {zones.map((zone, idx) => (
          <span
            key={zone.key}
            className={cn(idx + 1 === targetZone && 'font-bold text-primary')}
          >
            {zone.label}: {(zone.value * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Segment Row
// ============================================================================

interface SegmentRowProps {
  segment: SegmentAnalysis
  isOpen: boolean
  onToggle: () => void
}

function SegmentRow({ segment, isOpen, onToggle }: SegmentRowProps) {
  const isSkipped = segment.match_quality === 'skipped'

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between p-4 text-left transition-colors',
          'hover:bg-muted/50',
          isOpen && 'bg-muted/50'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-1 h-10 rounded-full',
              segmentTypeColors[segment.segment_type] || 'bg-gray-400'
            )}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{segment.segment_name}</span>
              <Badge variant="outline" className="text-xs capitalize">
                {segment.segment_type}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Target: Z{segment.planned_zone} • {formatDuration(segment.planned_duration_sec)} •{' '}
              {segment.planned_power_low}-{segment.planned_power_high}W
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={matchQualityColors[segment.match_quality]}>
            {segment.match_quality}
          </Badge>
          <span className={cn('font-bold text-lg', getScoreColor(segment.scores.overall_segment_score))}>
            {segment.scores.overall_segment_score.toFixed(0)}
          </span>
          <div className="p-1">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {isSkipped ? (
            <div className="p-4 mt-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-muted-foreground">
              This segment was skipped or not detected in the activity.
            </div>
          ) : (
            <>
              {/* Actual vs Planned Comparison */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">PLANNED</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{formatDuration(segment.planned_duration_sec)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Power Range</span>
                      <span>
                        {segment.planned_power_low}-{segment.planned_power_high}W
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Zone</span>
                      <span>Zone {segment.planned_zone}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">ACTUAL</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span>
                        {segment.actual_duration_sec
                          ? formatDuration(segment.actual_duration_sec)
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Power</span>
                      <span>{segment.actual_avg_power?.toFixed(0) ?? '—'}W</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Power Range</span>
                      <span>
                        {segment.actual_min_power?.toFixed(0) ?? '—'}-
                        {segment.actual_max_power?.toFixed(0) ?? '—'}W
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dominant Zone</span>
                      <span>Zone {segment.actual_dominant_zone ?? '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Zone Distribution */}
              {segment.time_in_zone && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    TIME IN ZONE (Target: Z{segment.planned_zone})
                  </h4>
                  <ZoneDistributionBar
                    distribution={segment.time_in_zone}
                    targetZone={segment.planned_zone}
                  />
                </div>
              )}

              {/* Score Breakdown */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">SCORE BREAKDOWN</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className={cn('font-bold', getScoreColor(segment.scores.power_compliance))}>
                      {segment.scores.power_compliance.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Power</div>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Target className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className={cn('font-bold', getScoreColor(segment.scores.zone_compliance))}>
                      {segment.scores.zone_compliance.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Zone</div>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className={cn('font-bold', getScoreColor(segment.scores.duration_compliance))}>
                      {segment.scores.duration_compliance.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Duration</div>
                  </div>
                </div>
              </div>

              {/* Assessment */}
              <div className="p-3 bg-primary/5 rounded-lg text-sm">
                {segment.assessment}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SegmentDetailsCard({ segments, className }: SegmentDetailsCardProps) {
  const [openSegments, setOpenSegments] = useState<Set<number>>(new Set())

  const toggleSegment = (index: number) => {
    setOpenSegments((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const expandAll = () => {
    setOpenSegments(new Set(segments.map((_, i) => i)))
  }

  const collapseAll = () => {
    setOpenSegments(new Set())
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Segment Analysis</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {segments.map((segment, index) => (
          <SegmentRow
            key={index}
            segment={segment}
            isOpen={openSegments.has(index)}
            onToggle={() => toggleSegment(index)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

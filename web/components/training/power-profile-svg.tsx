'use client'

import { useMemo } from 'react'
import { getPowerZoneLabel, getPowerRangeColor, type PowerZone } from '@/lib/types/power-zones'
import type { WorkoutStructure } from '@/lib/types/training-plan'
import {
  convertStepLengthToMinutes,
  extractPowerTarget,
  hasValidStructure,
} from '@/lib/types/training-plan'

/**
 * Shared Power Profile SVG Component
 *
 * Used by:
 * - workout-detail-modal.tsx (training plans)
 * - admin/workouts/page.tsx (workout library)
 *
 * Colors are based on power zones (Z1-Z6), not segment types.
 * See lib/types/power-zones.ts for zone definitions and colors.
 */

export interface PowerSegment {
  type: string
  duration_min: number
  power_low_pct: number
  power_high_pct: number
  description?: string | undefined
}

export interface WorkoutSegmentInput {
  type: string
  duration_min?: number | undefined
  power_low_pct?: number | undefined
  power_high_pct?: number | undefined
  description?: string | undefined
  sets?: number | null | undefined
  work?:
    | {
        duration_min: number
        power_low_pct: number
        power_high_pct: number
      }
    | null
    | undefined
  recovery?:
    | {
        duration_min: number
        power_low_pct: number
        power_high_pct: number
      }
    | null
    | undefined
}

/**
 * Input type for new WorkoutStructure format (Issue #96)
 */
export type StructuredWorkoutInput = WorkoutStructure

/**
 * Expand WorkoutStructure into PowerSegments for visualization
 */
function expandStructuredWorkout(structure: WorkoutStructure): PowerSegment[] {
  const expanded: PowerSegment[] = []

  for (const segment of structure.structure) {
    const repetitions = segment.length.value

    for (let rep = 0; rep < repetitions; rep++) {
      for (const step of segment.steps) {
        const powerTarget = extractPowerTarget(step.targets)
        expanded.push({
          type: step.intensityClass,
          duration_min: convertStepLengthToMinutes(step.length),
          power_low_pct: powerTarget.minValue,
          power_high_pct: powerTarget.maxValue,
          description: step.name,
        })
      }
    }
  }

  return expanded
}

/**
 * Expand interval sets into individual segments for visualization
 * Supports both legacy WorkoutSegmentInput[] and new WorkoutStructure format
 *
 * @param segments - Legacy segment format (optional)
 * @param structure - New WorkoutStructure format (optional, takes precedence)
 */
export function expandSegments(
  segments?: WorkoutSegmentInput[],
  structure?: StructuredWorkoutInput
): PowerSegment[] {
  // NEW: Handle WorkoutStructure format (takes precedence)
  if (hasValidStructure(structure)) {
    return expandStructuredWorkout(structure)
  }

  // Legacy format handling
  if (!segments || segments.length === 0) {
    return []
  }

  const expanded: PowerSegment[] = []

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
        duration_min: segment.duration_min ?? 0,
        power_low_pct: segment.power_low_pct ?? 50,
        power_high_pct: segment.power_high_pct ?? 60,
        description: segment.description,
      })
    }
  })

  return expanded
}

/**
 * Get power zone label from power percentage
 * @deprecated Use getPowerZoneLabel from '@/lib/types/power-zones' instead
 */
export function getPowerZone(powerPct: number): PowerZone {
  return getPowerZoneLabel(powerPct)
}

interface PowerProfileSVGProps {
  /** Legacy segment format */
  segments?: WorkoutSegmentInput[] | undefined
  /** NEW: WorkoutStructure format (Issue #96) - takes precedence over segments */
  structure?: StructuredWorkoutInput | undefined
  /** FTP value to display on chart. Pass 0 or undefined to hide FTP label */
  ftp?: number | undefined
  /** Mini mode: just bars, no labels, grid lines, or FTP reference */
  mini?: boolean | undefined
}

/**
 * SVG visualization of workout power profile
 * Supports both legacy segments and new WorkoutStructure format
 */
export function PowerProfileSVG({ segments, structure, ftp, mini = false }: PowerProfileSVGProps) {
  const expanded = useMemo(() => expandSegments(segments, structure), [segments, structure])

  if (expanded.length === 0) return null

  const width = mini ? 200 : 600
  const graphHeight = mini ? 40 : 140
  const topMargin = mini ? 2 : 20
  const chartHeight = mini ? 44 : 170

  const totalDuration = expanded.reduce((sum, seg) => sum + seg.duration_min, 0)

  if (totalDuration === 0) return null

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
    // Color based on power zone, not segment type
    const color = getPowerRangeColor(segment.power_low_pct, segment.power_high_pct)
    const zone = getPowerZone((segment.power_low_pct + segment.power_high_pct) / 2)

    return (
      <g key={index}>
        <rect
          x={xOffset}
          y={y}
          width={segmentWidth}
          height={barHeight}
          fill={color}
          stroke={mini ? 'transparent' : '#fff'}
          strokeWidth={mini ? 0 : 1}
        />
        {!mini && barHeight > 25 && segmentWidth > 30 && (
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

  // Mini mode: just the bars
  if (mini) {
    return (
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {bars}
      </svg>
    )
  }

  const ftpY = topMargin + graphHeight * 0.5
  const gridY1 = topMargin + graphHeight * 0.25
  const gridY2 = topMargin + graphHeight * 0.5
  const gridY3 = topMargin + graphHeight * 0.75

  // FTP label shows watts if provided, otherwise just "FTP (100%)"
  const ftpLabel = ftp && ftp > 0 ? `FTP (${ftp}W)` : 'FTP (100%)'

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
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
      {/* FTP line */}
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
        {ftpLabel}
      </text>
      {/* Segment bars */}
      {bars}
    </svg>
  )
}

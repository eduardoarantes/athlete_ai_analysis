'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
import type { SegmentAnalysis } from '@/lib/services/compliance-analysis-service'

// ============================================================================
// Types
// ============================================================================

interface PowerProfileChartProps {
  segments: SegmentAnalysis[]
  ftp: number
  powerStream?: number[] | undefined
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const SVG_WIDTH = 600
const SVG_HEIGHT = 170

// Zone colors matching the compliance report exactly
const ZONE_COLORS: Record<number, string> = {
  1: '#94A3B8', // Gray - Recovery
  2: '#3B82F6', // Blue - Endurance
  3: '#10B981', // Green - Tempo
  4: '#F59E0B', // Amber - Threshold
  5: '#EF4444', // Red - VO2max
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert power value to Y coordinate in the SVG
 * Using the same scale as the HTML report: 0W at y=160, ~500W at y=20
 */
function powerToY(power: number, ftp: number): number {
  // The report uses FTP at y=90, with y=160 as bottom (0W) and y=20 as top (~500W)
  // Scale: (160 - 90) = 70 pixels for FTP watts
  // So 1W = 70/ftp pixels
  const pixelsPerWatt = 70 / ftp
  const ftpY = 90
  return ftpY - (power - ftp) * pixelsPerWatt
}

/**
 * Get zone color for a power zone
 */
function getZoneColor(zone: number): string {
  return ZONE_COLORS[zone] ?? ZONE_COLORS[1] ?? '#94A3B8'
}

/**
 * Downsample an array to a target length
 */
function downsample(data: number[], targetLength: number): number[] {
  if (data.length === 0) return []
  if (data.length <= targetLength) return data

  const result: number[] = []
  const step = data.length / targetLength

  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * step)
    const end = Math.floor((i + 1) * step)
    // Use max value in the window to preserve peaks
    let max = data[start] ?? 0
    for (let j = start; j < end && j < data.length; j++) {
      const val = data[j]
      if (val !== undefined && val > max) max = val
    }
    result.push(max)
  }

  return result
}

// ============================================================================
// Component
// ============================================================================

export function PowerProfileChart({
  segments,
  ftp,
  powerStream,
  className,
}: PowerProfileChartProps) {
  // Tracker state
  const svgRef = useRef<SVGSVGElement>(null)
  const [trackerX, setTrackerX] = useState<number | null>(null)
  const [isHovering, setIsHovering] = useState(false)

  // Calculate chart data
  const { segmentBars, powerPolyline, totalDuration } = useMemo(() => {
    // Calculate total planned duration
    const totalDur = segments.reduce((sum, seg) => sum + seg.planned_duration_sec, 0)

    // Calculate segment bars
    const bars: Array<{
      x: number
      y: number
      width: number
      height: number
      color: string
      zone: number
      name: string
      showLabel: boolean
      labelX: number
      labelY: number
    }> = []

    // Baseline is at y=160 (bottom of chart area)
    const BASELINE_Y = 160

    let xPos = 0
    for (const seg of segments) {
      const width = (seg.planned_duration_sec / totalDur) * SVG_WIDTH
      const yTop = powerToY(seg.planned_power_high, ftp)
      // Bars extend from the top (high power) down to baseline (y=160)
      const height = BASELINE_Y - yTop

      // Show zone label for segments wide enough (like in the HTML report)
      const showLabel = width > 30 && height > 25

      bars.push({
        x: xPos,
        y: yTop,
        width,
        height,
        color: getZoneColor(seg.planned_zone),
        zone: seg.planned_zone,
        name: seg.segment_name,
        showLabel,
        labelX: xPos + width / 2,
        labelY: yTop + height / 2 + 5,
      })

      xPos += width
    }

    // Calculate power polyline points
    let polyline = ''
    if (powerStream && powerStream.length > 0) {
      // Downsample to SVG width
      const sampled = downsample(powerStream, SVG_WIDTH)
      const points: string[] = []

      for (let i = 0; i < sampled.length; i++) {
        const x = (i / sampled.length) * SVG_WIDTH
        const power = sampled[i] ?? 0
        let y = powerToY(power, ftp)
        // Clamp Y to chart bounds (20 to 160)
        y = Math.max(20, Math.min(160, y))
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
      }

      polyline = points.join(' ')
    }

    return {
      segmentBars: bars,
      powerPolyline: polyline,
      totalDuration: totalDur,
    }
  }, [segments, ftp, powerStream])

  // Get power value at a given X position (0-1 normalized)
  const getPowerAtPosition = useCallback(
    (normalizedX: number): number | null => {
      if (!powerStream || powerStream.length === 0) return null
      const index = Math.floor(normalizedX * powerStream.length)
      return powerStream[Math.min(index, powerStream.length - 1)] ?? null
    },
    [powerStream]
  )

  // Format time from seconds
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Mouse event handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const normalizedX = x / rect.width
      setTrackerX(normalizedX * SVG_WIDTH)
    },
    []
  )

  const handleMouseEnter = useCallback(() => setIsHovering(true), [])
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    setTrackerX(null)
  }, [])

  // Calculate tracker info
  const trackerInfo = useMemo(() => {
    if (trackerX === null || !isHovering) return null
    const normalizedX = trackerX / SVG_WIDTH
    const power = getPowerAtPosition(normalizedX)
    const time = normalizedX * totalDuration
    return { power, time }
  }, [trackerX, isHovering, getPowerAtPosition, totalDuration])

  return (
    <div
      className={className}
      style={{
        marginBottom: '1.5rem',
        background: '#f8fafc',
        borderRadius: '8px',
        padding: '1rem',
      }}
    >
      {/* Header - exactly matching HTML report */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#475569',
            margin: 0,
          }}
        >
          Power Profile
        </h3>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <span style={{ color: '#94a3b8' }}>■ Planned</span>
          <span style={{ color: '#1e293b', fontWeight: 600 }}>— Actual</span>
        </div>
      </div>

      {/* Chart - exactly matching HTML report */}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '6px',
            background: 'white',
            cursor: 'crosshair',
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines - matching HTML report positions */}
          <line
            x1={0}
            y1={55}
            x2={SVG_WIDTH}
            y2={55}
            stroke="#e4e6e8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <line
            x1={0}
            y1={90}
            x2={SVG_WIDTH}
            y2={90}
            stroke="#e4e6e8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <line
            x1={0}
            y1={125}
            x2={SVG_WIDTH}
            y2={125}
            stroke="#e4e6e8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* FTP reference line - matching HTML report exactly */}
          <line
            x1={0}
            y1={90}
            x2={SVG_WIDTH}
            y2={90}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <text x={5} y={85} fontSize={12} fontWeight="bold" fill="#3b82f6">
            FTP ({ftp}W)
          </text>

          {/* Segment bars - matching HTML report exactly */}
          {segmentBars.map((bar, i) => (
            <g key={i}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={bar.color}
                stroke="#fff"
                strokeWidth={1}
                opacity={0.7}
              />
              {/* Zone label - matching HTML report */}
              {bar.showLabel && (
                <text
                  x={bar.labelX}
                  y={bar.labelY}
                  fontSize={14}
                  fontWeight="bold"
                  fill="#fff"
                  textAnchor="middle"
                >
                  Z{bar.zone}
                </text>
              )}
            </g>
          ))}

          {/* Actual power polyline - thinner for better visibility of planned bars */}
          {powerPolyline && (
            <polyline
              points={powerPolyline}
              fill="none"
              stroke="#1e293b"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          )}

          {/* Vertical tracker line */}
          {isHovering && trackerX !== null && (
            <g>
              {/* Tracker line */}
              <line
                x1={trackerX}
                y1={20}
                x2={trackerX}
                y2={160}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="4 2"
                opacity={0.8}
              />
              {/* Tracker dot on power line */}
              {trackerInfo?.power !== null && (
                <circle
                  cx={trackerX}
                  cy={Math.max(20, Math.min(160, powerToY(trackerInfo?.power ?? 0, ftp)))}
                  r={4}
                  fill="#1e293b"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </g>
          )}
        </svg>

        {/* Tracker tooltip */}
        {isHovering && trackerX !== null && trackerInfo && (
          <div
            style={{
              position: 'absolute',
              left: `${(trackerX / SVG_WIDTH) * 100}%`,
              top: '-8px',
              transform: 'translateX(-50%)',
              background: '#1e293b',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {trackerInfo.power !== null ? `${Math.round(trackerInfo.power)}W` : '—'} •{' '}
            {formatTime(trackerInfo.time)}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Compliance Analysis Report Generator
 *
 * Generates visual HTML reports from compliance analysis results.
 * Designed to run as part of the test suite and scale with additional activities.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { WorkoutComplianceAnalysis } from '../../compliance-analysis-service'
import { flattenWorkoutSegments } from '../../compliance-analysis-service'
import type { WorkoutActivityPair } from '../fixtures/compliance-test-fixtures'

export interface ComplianceReportEntry {
  fixture: WorkoutActivityPair
  result: WorkoutComplianceAnalysis
  timestamp: Date
}

export interface ComplianceReportConfig {
  outputDir: string
  reportName: string
}

const DEFAULT_CONFIG: ComplianceReportConfig = {
  outputDir: path.join(process.cwd(), 'test-results', 'compliance'),
  reportName: 'compliance-analysis-report.html',
}

/**
 * Generate an HTML compliance report from analysis results
 * Also exports all data as independent JSON files for artifact preservation
 */
export function generateComplianceReport(
  entries: ComplianceReportEntry[],
  config: Partial<ComplianceReportConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const outputPath = path.join(finalConfig.outputDir, finalConfig.reportName)

  // Ensure output directory exists
  fs.mkdirSync(finalConfig.outputDir, { recursive: true })

  // Export each entry's data as independent JSON files
  const dataDir = path.join(finalConfig.outputDir, 'data')
  fs.mkdirSync(dataDir, { recursive: true })

  entries.forEach((entry) => {
    const activityId = entry.fixture.activityId

    // Export workout definition
    const workoutData = {
      workoutName: entry.fixture.workoutName,
      athleteFtp: entry.fixture.athleteFtp,
      segments: entry.fixture.segments,
    }
    fs.writeFileSync(
      path.join(dataDir, `workout-${activityId}.json`),
      JSON.stringify(workoutData, null, 2),
      'utf-8'
    )

    // Export power stream
    fs.writeFileSync(
      path.join(dataDir, `power-stream-${activityId}.json`),
      JSON.stringify({ activityId, powerStream: entry.fixture.powerStream }, null, 2),
      'utf-8'
    )

    // Export compliance analysis result
    fs.writeFileSync(
      path.join(dataDir, `compliance-result-${activityId}.json`),
      JSON.stringify(entry.result, null, 2),
      'utf-8'
    )
  })

  // Export summary of all entries
  const summaryData = entries.map((entry) => ({
    activityId: entry.fixture.activityId,
    workoutName: entry.fixture.workoutName,
    athleteFtp: entry.fixture.athleteFtp,
    timestamp: entry.timestamp.toISOString(),
    overall: entry.result.overall,
    metadata: entry.result.metadata,
  }))
  fs.writeFileSync(
    path.join(dataDir, 'summary.json'),
    JSON.stringify(summaryData, null, 2),
    'utf-8'
  )

  const html = buildReportHtml(entries)
  fs.writeFileSync(outputPath, html, 'utf-8')

  return outputPath
}

function buildReportHtml(entries: ComplianceReportEntry[]): string {
  const timestamp = new Date().toISOString()
  const summary = calculateSummaryStats(entries)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Analysis Report</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Compliance Analysis Report</h1>
      <p class="timestamp">Generated: ${timestamp}</p>
      <p class="subtitle">${entries.length} workout${entries.length !== 1 ? 's' : ''} analyzed</p>
    </header>

    ${buildSummarySection(summary, entries)}

    ${buildActivitySections(entries)}

    <footer>
      <p>Compliance Analysis Service v${entries[0]?.result.metadata.algorithm_version || '1.0'}</p>
    </footer>
  </div>

  <script>
    ${getInteractiveScript()}
  </script>
</body>
</html>`
}

interface SummaryStats {
  totalActivities: number
  averageScore: number
  totalSegments: number
  completedSegments: number
  skippedSegments: number
  gradeDistribution: Record<string, number>
  qualityDistribution: Record<string, number>
}

function calculateSummaryStats(entries: ComplianceReportEntry[]): SummaryStats {
  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  const qualityDistribution: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    skipped: 0,
  }

  let totalScore = 0
  let totalSegments = 0
  let completedSegments = 0
  let skippedSegments = 0

  for (const entry of entries) {
    totalScore += entry.result.overall.score
    const grade = entry.result.overall.grade
    gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1
    totalSegments += entry.result.overall.segments_total
    completedSegments += entry.result.overall.segments_completed
    skippedSegments += entry.result.overall.segments_skipped

    for (const seg of entry.result.segments) {
      const quality = seg.match_quality
      qualityDistribution[quality] = (qualityDistribution[quality] ?? 0) + 1
    }
  }

  return {
    totalActivities: entries.length,
    averageScore: entries.length > 0 ? totalScore / entries.length : 0,
    totalSegments,
    completedSegments,
    skippedSegments,
    gradeDistribution,
    qualityDistribution,
  }
}

function buildSummarySection(summary: SummaryStats, entries: ComplianceReportEntry[]): string {
  const completionRate =
    summary.totalSegments > 0
      ? ((summary.completedSegments / summary.totalSegments) * 100).toFixed(1)
      : '0'

  return `
    <section class="summary">
      <h2>Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${summary.totalActivities}</div>
          <div class="stat-label">Activities</div>
        </div>
        <div class="stat-card ${getScoreClass(summary.averageScore)}">
          <div class="stat-value">${summary.averageScore.toFixed(1)}%</div>
          <div class="stat-label">Avg Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completionRate}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.totalSegments}</div>
          <div class="stat-label">Total Segments</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-container">
          <h3>Grade Distribution</h3>
          <div class="grade-bars">
            ${Object.entries(summary.gradeDistribution)
              .map(
                ([grade, count]) => `
              <div class="grade-bar">
                <span class="grade-label grade-${grade}">${grade}</span>
                <div class="bar-track">
                  <div class="bar-fill grade-${grade}" style="width: ${(count / summary.totalActivities) * 100}%"></div>
                </div>
                <span class="grade-count">${count}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="chart-container">
          <h3>Segment Quality</h3>
          <div class="quality-bars">
            ${Object.entries(summary.qualityDistribution)
              .map(
                ([quality, count]) => `
              <div class="quality-bar">
                <span class="quality-label quality-${quality}">${quality}</span>
                <div class="bar-track">
                  <div class="bar-fill quality-${quality}" style="width: ${(count / summary.totalSegments) * 100}%"></div>
                </div>
                <span class="quality-count">${count}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="activity-overview">
        <h3>Activity Overview</h3>
        <table class="overview-table">
          <thead>
            <tr>
              <th>Workout</th>
              <th>Activity ID</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Segments</th>
              <th>Data Quality</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map(
                (entry) => `
              <tr class="clickable" data-activity="${entry.fixture.activityId}">
                <td>${entry.fixture.workoutName}</td>
                <td><code>${entry.fixture.activityId}</code></td>
                <td class="${getScoreClass(entry.result.overall.score)}">${entry.result.overall.score.toFixed(1)}%</td>
                <td><span class="grade-badge grade-${entry.result.overall.grade}">${entry.result.overall.grade}</span></td>
                <td>${entry.result.overall.segments_completed}/${entry.result.overall.segments_total}</td>
                <td><span class="quality-badge quality-${entry.result.metadata.power_data_quality}">${entry.result.metadata.power_data_quality}</span></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`
}

function buildActivitySections(entries: ComplianceReportEntry[]): string {
  return entries.map((entry) => buildActivitySection(entry)).join('\n')
}

// Zone colors matching power-zones.ts
const ZONE_COLORS: Record<number, string> = {
  1: '#94A3B8', // slate-400
  2: '#3B82F6', // blue-500
  3: '#10B981', // emerald-500
  4: '#F59E0B', // amber-500
  5: '#F97316', // orange-500
  6: '#EF4444', // red-500
}

function getZoneFromPowerPct(powerPct: number): number {
  if (powerPct < 56) return 1
  if (powerPct < 76) return 2
  if (powerPct < 90) return 3
  if (powerPct < 105) return 4
  if (powerPct < 120) return 5
  return 6
}

function getZoneColor(zone: number): string {
  return ZONE_COLORS[zone] ?? ZONE_COLORS[1] ?? '#94A3B8'
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

function formatTimeMMSS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function buildPowerProfileSVG(
  plannedSegments: Array<{
    duration_sec: number
    power_low: number
    power_high: number
    type: string
    name?: string
  }>,
  ftp: number,
  powerStream?: number[],
  detectedPauses?: Array<{ start_sec: number; end_sec: number; duration_sec: number }>,
  detectedSegments?: Array<{
    start_time: number
    end_time: number
    quality: string
    compliance_percentage: number
    segment_index: number
  }>
): string {
  const baseWidth = 600
  const chartHeight = 200
  const graphHeight = 140
  const topMargin = 20

  if (plannedSegments.length === 0) return ''

  // Calculate planned duration
  const totalPlannedSec = plannedSegments.reduce((sum, seg) => sum + seg.duration_sec, 0)
  const actualDurationSec = powerStream ? powerStream.length : totalPlannedSec

  // Use actual duration for chart width if activity ran longer
  const totalDurationSec = Math.max(totalPlannedSec, actualDurationSec)
  const width = baseWidth

  const getBarHeight = (powerLow: number, powerHigh: number) => {
    const avgPower = (powerLow + powerHigh) / 2
    const powerPct = (avgPower / ftp) * 100
    const heightPercent = Math.min(200, Math.max(20, powerPct))
    return (heightPercent / 200) * graphHeight
  }

  const getZoneFromPower = (powerLow: number, powerHigh: number): number => {
    const avgPower = (powerLow + powerHigh) / 2
    const powerPct = (avgPower / ftp) * 100
    return getZoneFromPowerPct(powerPct)
  }

  // Build planned workout bars
  let xOffset = 0
  const bars = plannedSegments
    .map((seg) => {
      const segWidth = (seg.duration_sec / totalDurationSec) * width
      const barHeight = getBarHeight(seg.power_low, seg.power_high)
      const y = topMargin + graphHeight - barHeight
      const zone = getZoneFromPower(seg.power_low, seg.power_high)
      const color = getZoneColor(zone)

      const bar = `
      <rect x="${xOffset}" y="${y}" width="${segWidth}" height="${barHeight}" fill="${color}" stroke="#fff" stroke-width="1" opacity="0.7"/>
      ${barHeight > 25 && segWidth > 30 ? `<text x="${xOffset + segWidth / 2}" y="${y + barHeight / 2 + 5}" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">Z${zone}</text>` : ''}
    `
      xOffset += segWidth
      return bar
    })
    .join('')

  // Build actual power overlay line
  let powerOverlay = ''
  if (powerStream && powerStream.length > 0) {
    // Downsample power stream to ~300 points for smooth rendering
    const sampleRate = Math.max(1, Math.floor(powerStream.length / 300))
    const sampledPower: number[] = []
    for (let i = 0; i < powerStream.length; i += sampleRate) {
      // Use rolling average for smoother line
      const windowSize = Math.min(5, powerStream.length - i)
      let sum = 0
      for (let j = 0; j < windowSize; j++) {
        sum += powerStream[i + j] ?? 0
      }
      sampledPower.push(sum / windowSize)
    }

    // Generate SVG path points (no time scaling - show actual duration)
    const points = sampledPower.map((power, i) => {
      const timeSec = i * sampleRate
      const x = (timeSec / totalDurationSec) * width
      // Convert power to % of FTP and map to y coordinate
      const powerPct = (power / ftp) * 100
      const clampedPct = Math.min(200, Math.max(0, powerPct))
      const y = topMargin + graphHeight - (clampedPct / 200) * graphHeight
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    if (points.length > 1) {
      powerOverlay = `
        <polyline
          points="${points.join(' ')}"
          fill="none"
          stroke="#1e293b"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.85"
        />
      `
    }
  }

  const ftpY = topMargin + graphHeight * 0.5
  const gridY1 = topMargin + graphHeight * 0.25
  const gridY2 = topMargin + graphHeight * 0.5
  const gridY3 = topMargin + graphHeight * 0.75

  // Build pause indicators (visual boxes)
  let pauseIndicators = ''
  let pauseAnnotations = ''

  if (detectedPauses && detectedPauses.length > 0) {
    pauseIndicators = detectedPauses
      .map((pause) => {
        const x = (pause.start_sec / totalDurationSec) * width
        const pauseWidth = (pause.duration_sec / totalDurationSec) * width
        return `
        <!-- Pause indicator box -->
        <rect x="${x}" y="${topMargin}" width="${pauseWidth}" height="${graphHeight}"
              fill="#fbbf24" opacity="0.2" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3 2"/>
      `
      })
      .join('')

    // Build pause time annotations (below chart, angled text)
    pauseAnnotations = detectedPauses
      .map((pause) => {
        const x = (pause.start_sec / totalDurationSec) * width
        const pauseWidth = (pause.duration_sec / totalDurationSec) * width
        const centerX = x + pauseWidth / 2
        const durationMin = (pause.duration_sec / 60).toFixed(1)

        return `
        <!-- Pause time annotation -->
        <line x1="${centerX}" y1="${topMargin + graphHeight}" x2="${centerX}" y2="${topMargin + graphHeight + 5}"
              stroke="#f59e0b" stroke-width="1"/>
        <text x="${centerX}" y="${topMargin + graphHeight + 18}"
              font-size="8" font-weight="500" fill="#f59e0b" text-anchor="start"
              transform="rotate(-45, ${centerX}, ${topMargin + graphHeight + 18})">
          ${durationMin}m
        </text>
      `
      })
      .join('')
  }

  // Build detected segment overlays
  let segmentOverlays = ''
  if (detectedSegments && detectedSegments.length > 0) {
    const getQualityColor = (quality: string) => {
      switch (quality) {
        case 'excellent':
          return { fill: '#22c55e', stroke: '#16a34a' } // green
        case 'good':
          return { fill: '#84cc16', stroke: '#65a30d' } // lime
        case 'fair':
          return { fill: '#eab308', stroke: '#ca8a04' } // yellow
        case 'poor':
          return { fill: '#f97316', stroke: '#ea580c' } // orange
        default:
          return { fill: '#94a3b8', stroke: '#64748b' } // gray
      }
    }

    segmentOverlays = detectedSegments
      .map((seg) => {
        const x = (seg.start_time / totalDurationSec) * width
        const segWidth = ((seg.end_time - seg.start_time) / totalDurationSec) * width
        const colors = getQualityColor(seg.quality)

        return `
        <!-- Detected segment overlay -->
        <rect x="${x}" y="${topMargin}" width="${segWidth}" height="${graphHeight}"
              fill="${colors.fill}" opacity="0.15" stroke="${colors.stroke}" stroke-width="2"/>
      `
      })
      .join('')
  }

  // Store power stream data as data attribute for hover functionality
  const powerStreamData = powerStream ? JSON.stringify(powerStream) : '[]'

  // Store planned segments for hover tooltip segment identification
  const segmentsData = JSON.stringify(
    plannedSegments.map((seg) => ({
      name: seg.name || seg.type,
      duration_sec: seg.duration_sec,
    }))
  )

  return `
    <svg viewBox="0 0 ${width} ${chartHeight}" class="power-profile-svg"
         data-width="${width}"
         data-height="${chartHeight}"
         data-graph-height="${graphHeight}"
         data-top-margin="${topMargin}"
         data-ftp="${ftp}"
         data-duration-sec="${totalDurationSec}"
         data-power-stream='${powerStreamData}'
         data-segments='${segmentsData}'>
      <line x1="0" y1="${gridY1}" x2="${width}" y2="${gridY1}" stroke="#e4e6e8" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="0" y1="${gridY2}" x2="${width}" y2="${gridY2}" stroke="#e4e6e8" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="0" y1="${gridY3}" x2="${width}" y2="${gridY3}" stroke="#e4e6e8" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="0" y1="${ftpY}" x2="${width}" y2="${ftpY}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 4"/>
      <text x="5" y="${ftpY - 5}" font-size="12" font-weight="bold" fill="#3b82f6">FTP (${ftp}W)</text>
      ${bars}
      ${powerOverlay}
      ${pauseIndicators}
      ${pauseAnnotations}

      <!-- Detected segments overlay (toggleable) -->
      <g class="detected-segments-overlay">
        ${segmentOverlays}
      </g>

      <!-- Hover tracking elements -->
      <g class="hover-group" style="display: none;">
        <line class="hover-line" x1="0" y1="${topMargin}" x2="0" y2="${topMargin + graphHeight}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle class="hover-dot" cx="0" cy="0" r="3" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
        <rect class="hover-tooltip-bg" x="0" y="0" width="90" height="36" rx="2" fill="#1e293b" opacity="0.95"/>
        <text class="hover-tooltip-segment" x="0" y="0" font-size="8" font-weight="600" fill="#fbbf24" text-anchor="start"></text>
        <text class="hover-tooltip-time" x="0" y="0" font-size="9" font-weight="600" fill="#fff" text-anchor="start"></text>
        <text class="hover-tooltip-power" x="0" y="0" font-size="9" fill="#e2e8f0" text-anchor="start"></text>
      </g>

      <!-- Transparent overlay for mouse events -->
      <rect class="hover-overlay" x="0" y="0" width="${width}" height="${chartHeight}" fill="transparent" style="cursor: crosshair;"/>
    </svg>
  `
}

function buildWorkoutStructure(
  segments: ComplianceReportEntry['fixture']['segments'],
  ftp: number
): string {
  interface GroupedSegment {
    type: 'repeat' | 'single'
    repeat_count?: number
    segments?: Array<{
      type: string
      duration_min: number
      power_low_pct: number
      power_high_pct: number
      description?: string | undefined
    }>
    segment?: {
      type: string
      duration_min: number
      power_low_pct: number
      power_high_pct: number
      description?: string | undefined
    }
  }

  const grouped: GroupedSegment[] = []
  segments.forEach((seg) => {
    if (seg.sets != null && seg.work && seg.recovery) {
      grouped.push({
        type: 'repeat',
        repeat_count: seg.sets,
        segments: [
          {
            type: 'work',
            duration_min: seg.work.duration_min,
            power_low_pct: seg.work.power_low_pct,
            power_high_pct: seg.work.power_high_pct,
            description: seg.description,
          },
          {
            type: 'recovery',
            duration_min: seg.recovery.duration_min,
            power_low_pct: seg.recovery.power_low_pct,
            power_high_pct: seg.recovery.power_high_pct,
          },
        ],
      })
    } else {
      grouped.push({
        type: 'single',
        segment: {
          type: seg.type,
          duration_min: seg.duration_min || 0,
          power_low_pct: seg.power_low_pct || 50,
          power_high_pct: seg.power_high_pct || 60,
          description: seg.description,
        },
      })
    }
  })

  const formatPower = (lowPct: number, highPct: number) => {
    const lowW = Math.round((lowPct / 100) * ftp)
    const highW = Math.round((highPct / 100) * ftp)
    if (lowPct === highPct) return `${lowW}W (${lowPct}%)`
    return `${lowW}-${highW}W (${lowPct}-${highPct}%)`
  }

  const renderSegmentRow = (seg: {
    type: string
    duration_min: number
    power_low_pct: number
    power_high_pct: number
    description?: string | undefined
  }) => {
    const avgPct = (seg.power_low_pct + seg.power_high_pct) / 2
    const zone = getZoneFromPowerPct(avgPct)
    const color = getZoneColor(zone)
    return `
      <div class="structure-row" style="border-left-color: ${color}">
        <span class="structure-duration">${formatSegmentDuration(seg.duration_min)}</span>
        <span class="structure-power" style="color: ${color}">${formatPower(seg.power_low_pct, seg.power_high_pct)}</span>
        <span class="structure-desc">${seg.description || seg.type}</span>
      </div>
    `
  }

  return grouped
    .map((group) => {
      if (group.type === 'repeat' && group.segments) {
        return `
        <div class="structure-repeat">
          <div class="repeat-header">
            <span class="repeat-badge">${group.repeat_count}x</span>
            <span class="repeat-label">Repeat ${group.repeat_count} times</span>
          </div>
          <div class="repeat-content">
            ${group.segments.map(renderSegmentRow).join('')}
          </div>
        </div>
      `
      }
      return group.segment ? renderSegmentRow(group.segment) : ''
    })
    .join('')
}

function buildPowerProfile(entry: ComplianceReportEntry): string {
  const { fixture, result } = entry
  const segments = fixture.segments
  const ftp = fixture.athleteFtp
  const powerStream = fixture.powerStream
  const detectedPauses = result.metadata.detected_pauses

  // Extract detected segments with timing information
  // Filter out skipped segments (actual_start_sec/actual_end_sec will be null)
  const detectedSegments = result.segments
    .filter((seg) => seg.actual_start_sec !== null && seg.actual_end_sec !== null)
    .map((seg) => ({
      start_time: seg.actual_start_sec!,
      end_time: seg.actual_end_sec!,
      quality: seg.match_quality,
      compliance_percentage: seg.scores.overall,
      segment_index: seg.segment_index,
    }))

  // Flatten workout using structure if available (for accurate chart rendering)
  const plannedSegments = flattenWorkoutSegments(fixture.segments, ftp, fixture.structure)

  // Build workout JSON for display
  const workoutJson = {
    name: fixture.workoutName,
    athlete_ftp: fixture.athleteFtp,
    ...(fixture.structure
      ? { structure: fixture.structure }
      : {
          segments: segments.map((seg) => ({
            type: seg.type,
            duration_min: seg.duration_min,
            power_low_pct: seg.power_low_pct,
            power_high_pct: seg.power_high_pct,
            description: seg.description,
            ...(seg.sets != null && { sets: seg.sets }),
            ...(seg.work && { work: seg.work }),
            ...(seg.recovery && { recovery: seg.recovery }),
          })),
        }),
  }

  return `
    <div class="power-profile" data-activity="${fixture.activityId}">
      <div class="profile-header">
        <h3>Power Profile</h3>
        <div class="profile-legend">
          <span class="legend-planned">■ Planned</span>
          <span class="legend-actual">— Actual</span>
          ${detectedPauses && detectedPauses.length > 0 ? '<span class="legend-pause">⚠ Pause</span>' : ''}
          ${detectedSegments.length > 0 ? `<button class="segments-toggle-btn" data-activity="${fixture.activityId}">Show Detected Segments</button>` : ''}
        </div>
        <button class="json-toggle-btn" data-target="json-${fixture.activityId}">View JSON</button>
      </div>
      <div class="profile-chart">
        ${buildPowerProfileSVG(plannedSegments, ftp, powerStream, detectedPauses, detectedSegments)}
      </div>
      <div class="workout-structure collapsible collapsed">
        <button class="collapsible-header" type="button">
          <span class="collapse-icon"></span>
          <span class="collapse-title">Workout Structure</span>
          <span class="collapse-hint">Click to expand</span>
        </button>
        <div class="collapsible-content">
          ${buildWorkoutStructure(segments, ftp)}
        </div>
      </div>
      <div class="json-viewer" id="json-${fixture.activityId}">
        <pre>${syntaxHighlightJson(JSON.stringify(workoutJson, null, 2))}</pre>
      </div>
    </div>`
}

function syntaxHighlightJson(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      if (/:$/.test(match)) {
        return '<span class="json-key">' + match.slice(0, -1) + '</span>:'
      }
      return '<span class="json-string">' + match + '</span>'
    })
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
    .replace(/\bnull\b/g, '<span class="json-null">null</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>')
}

function buildActivitySection(entry: ComplianceReportEntry): string {
  const { fixture, result } = entry

  return `
    <section class="activity" id="activity-${fixture.activityId}">
      <div class="activity-header">
        <div class="activity-title">
          <h2>${fixture.workoutName}</h2>
          <span class="activity-id">Activity: ${fixture.activityId}</span>
        </div>
        <div class="activity-score ${getScoreClass(result.overall.score)}">
          <span class="score-value">${result.overall.score.toFixed(1)}%</span>
          <span class="grade-badge grade-${result.overall.grade}">${result.overall.grade}</span>
        </div>
      </div>

      <div class="activity-meta">
        <div class="meta-item">
          <span class="meta-label">FTP</span>
          <span class="meta-value">${fixture.athleteFtp}W</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Data Points</span>
          <span class="meta-value">${fixture.powerStream.length.toLocaleString()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Segments</span>
          <span class="meta-value">${result.overall.segments_completed}/${result.overall.segments_total}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Data Quality</span>
          <span class="quality-badge quality-${result.metadata.power_data_quality}">${result.metadata.power_data_quality}</span>
        </div>
      </div>

      ${buildPowerProfile(entry)}

      <p class="summary-text">${result.overall.summary}</p>

      ${buildSegmentVisualization(result)}

      ${buildSegmentTable(result)}

      ${buildSegmentDetails(result)}
    </section>`
}

function buildSegmentVisualization(result: WorkoutComplianceAnalysis): string {
  const segments = result.segments
  const totalDuration = segments.reduce((sum, s) => sum + s.planned_duration_sec, 0)

  return `
    <div class="segment-visualization">
      <h3>Segment Timeline</h3>
      <div class="timeline">
        ${segments
          .map((seg) => {
            const widthPct = (seg.planned_duration_sec / totalDuration) * 100
            return `
            <div class="timeline-segment quality-${seg.match_quality}"
                 style="width: ${Math.max(widthPct, 2)}%"
                 title="${seg.segment_name || seg.segment_type}: ${seg.scores.overall_segment_score.toFixed(0)}%">
              <span class="segment-score">${seg.match_quality !== 'skipped' ? seg.scores.overall_segment_score.toFixed(0) + '%' : '—'}</span>
            </div>
          `
          })
          .join('')}
      </div>
      <div class="timeline-legend">
        <span class="legend-item quality-excellent">Excellent</span>
        <span class="legend-item quality-good">Good</span>
        <span class="legend-item quality-fair">Fair</span>
        <span class="legend-item quality-poor">Poor</span>
        <span class="legend-item quality-skipped">Skipped</span>
      </div>
    </div>`
}

function buildSegmentTable(result: WorkoutComplianceAnalysis): string {
  return `
    <div class="segment-table-container">
      <h3>Segment Results</h3>
      <table class="segment-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Segment</th>
            <th>Type</th>
            <th>Score</th>
            <th>Power</th>
            <th>Zone</th>
            <th>Duration</th>
            <th>Quality</th>
          </tr>
        </thead>
        <tbody>
          ${result.segments
            .map(
              (seg, i) => `
            <tr class="segment-row quality-${seg.match_quality}" data-segment="${i}">
              <td>${i + 1}</td>
              <td>${seg.segment_name || '—'}</td>
              <td><span class="type-badge">${seg.segment_type}</span></td>
              <td class="${getScoreClass(seg.scores.overall_segment_score)}">${seg.scores.overall_segment_score.toFixed(0)}%</td>
              <td class="${getScoreClass(seg.scores.power_compliance)}">${seg.scores.power_compliance.toFixed(0)}%</td>
              <td class="${getScoreClass(seg.scores.zone_compliance)}">${seg.scores.zone_compliance.toFixed(0)}%</td>
              <td class="duration-cell ${getScoreClass(seg.scores.duration_compliance)}">
                <span class="duration-times">${formatDuration(seg.planned_duration_sec)} / ${seg.actual_duration_sec !== null ? formatDuration(seg.actual_duration_sec) : '—'}</span>
                <span class="duration-pct">${seg.scores.duration_compliance.toFixed(0)}%</span>
              </td>
              <td><span class="quality-badge quality-${seg.match_quality}">${seg.match_quality}</span></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>`
}

function buildSegmentDetails(result: WorkoutComplianceAnalysis): string {
  return `
    <div class="segment-details collapsible collapsed">
      <button class="collapsible-header" type="button">
        <span class="collapse-icon"></span>
        <span class="collapse-title">Segment Details</span>
        <span class="collapse-hint">Click to expand</span>
      </button>
      <div class="collapsible-content">
        <div class="details-grid">
        ${result.segments
          .map(
            (seg, i) => `
          <div class="detail-card quality-${seg.match_quality}" data-segment="${i}">
            <div class="detail-header">
              <span class="detail-number">#${i + 1}</span>
              <span class="detail-name">${seg.segment_name || seg.segment_type}</span>
              <span class="quality-badge quality-${seg.match_quality}">${seg.match_quality}</span>
            </div>

            <div class="detail-scores">
              <div class="score-bar">
                <span class="score-label">Overall</span>
                <div class="score-track">
                  <div class="score-fill ${getScoreClass(seg.scores.overall_segment_score)}" style="width: ${seg.scores.overall_segment_score}%"></div>
                </div>
                <span class="score-value">${seg.scores.overall_segment_score.toFixed(0)}%</span>
              </div>
              <div class="score-bar">
                <span class="score-label">Power</span>
                <div class="score-track">
                  <div class="score-fill ${getScoreClass(seg.scores.power_compliance)}" style="width: ${seg.scores.power_compliance}%"></div>
                </div>
                <span class="score-value">${seg.scores.power_compliance.toFixed(0)}%</span>
              </div>
              <div class="score-bar">
                <span class="score-label">Zone</span>
                <div class="score-track">
                  <div class="score-fill ${getScoreClass(seg.scores.zone_compliance)}" style="width: ${seg.scores.zone_compliance}%"></div>
                </div>
                <span class="score-value">${seg.scores.zone_compliance.toFixed(0)}%</span>
              </div>
              <div class="score-bar">
                <span class="score-label">Duration</span>
                <div class="score-track">
                  <div class="score-fill ${getScoreClass(seg.scores.duration_compliance)}" style="width: ${seg.scores.duration_compliance}%"></div>
                </div>
                <span class="score-value">${seg.scores.duration_compliance.toFixed(0)}%</span>
              </div>
            </div>

            <div class="detail-comparison">
              <div class="comparison-row">
                <span class="comparison-label">Duration</span>
                <span class="comparison-value">${formatDuration(seg.planned_duration_sec)} / ${seg.actual_duration_sec !== null ? formatDuration(seg.actual_duration_sec) : '—'}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Power</span>
                <span class="comparison-value">${seg.planned_power_low}-${seg.planned_power_high}W / ${seg.actual_avg_power !== null ? seg.actual_avg_power.toFixed(0) + 'W' : '—'}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Zone</span>
                <span class="comparison-value">Z${seg.planned_zone} / ${seg.actual_dominant_zone !== null ? 'Z' + seg.actual_dominant_zone : '—'}</span>
              </div>
            </div>

            <p class="detail-assessment">${seg.assessment}</p>
          </div>
        `
          )
          .join('')}
        </div>
      </div>
    </div>`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

function getScoreClass(score: number): string {
  if (score >= 90) return 'score-excellent'
  if (score >= 75) return 'score-good'
  if (score >= 60) return 'score-fair'
  return 'score-poor'
}

function getStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f8fafc;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #e2e8f0;
    }

    header h1 {
      font-size: 2.5rem;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }

    .timestamp {
      color: #64748b;
      font-size: 0.875rem;
    }

    .subtitle {
      color: #475569;
      font-size: 1.125rem;
    }

    /* Summary Section */
    .summary {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .summary h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #1e293b;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 0.25rem;
    }

    .charts-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .chart-container {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .chart-container h3 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: #475569;
    }

    .grade-bars, .quality-bars {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .grade-bar, .quality-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .grade-label, .quality-label {
      width: 70px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .bar-track {
      flex: 1;
      height: 20px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .grade-count, .quality-count {
      width: 30px;
      text-align: right;
      font-size: 0.875rem;
      color: #64748b;
    }

    /* Grade colors */
    .grade-A, .bar-fill.grade-A { background: #22c55e; color: white; }
    .grade-B, .bar-fill.grade-B { background: #84cc16; color: white; }
    .grade-C, .bar-fill.grade-C { background: #eab308; color: white; }
    .grade-D, .bar-fill.grade-D { background: #f97316; color: white; }
    .grade-F, .bar-fill.grade-F { background: #ef4444; color: white; }

    /* Quality colors */
    .quality-excellent, .bar-fill.quality-excellent { background: #22c55e; color: white; }
    .quality-good, .bar-fill.quality-good { background: #84cc16; color: white; }
    .quality-fair, .bar-fill.quality-fair { background: #eab308; color: white; }
    .quality-poor, .bar-fill.quality-poor { background: #f97316; color: white; }
    .quality-skipped, .bar-fill.quality-skipped { background: #94a3b8; color: white; }
    .quality-partial { background: #f59e0b; color: white; }

    /* Score colors */
    .score-excellent { color: #16a34a; }
    .score-good { color: #65a30d; }
    .score-fair { color: #ca8a04; }
    .score-poor { color: #dc2626; }

    .stat-card.score-excellent { background: #dcfce7; }
    .stat-card.score-good { background: #ecfccb; }
    .stat-card.score-fair { background: #fef9c3; }
    .stat-card.score-poor { background: #fee2e2; }

    /* Overview Table */
    .activity-overview {
      margin-top: 2rem;
    }

    .activity-overview h3 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: #475569;
    }

    .overview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .overview-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      background: #f1f5f9;
      font-weight: 600;
      color: #475569;
    }

    .overview-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .overview-table tr.clickable {
      cursor: pointer;
    }

    .overview-table tr.clickable:hover {
      background: #f8fafc;
    }

    .overview-table code {
      background: #f1f5f9;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.8125rem;
    }

    /* Badges */
    .grade-badge, .quality-badge, .type-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .type-badge {
      background: #e2e8f0;
      color: #475569;
    }

    /* Activity Section */
    .activity {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .activity-title h2 {
      font-size: 1.5rem;
      color: #1e293b;
      margin-bottom: 0.25rem;
    }

    .activity-id {
      font-size: 0.875rem;
      color: #64748b;
    }

    .activity-score {
      text-align: right;
    }

    .activity-score .score-value {
      font-size: 2rem;
      font-weight: 700;
      display: block;
    }

    .activity-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      margin-bottom: 1rem;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .meta-value {
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
    }

    .summary-text {
      color: #475569;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }

    /* Power Profile */
    .power-profile {
      margin-bottom: 1.5rem;
      background: #f8fafc;
      border-radius: 8px;
      padding: 1rem;
    }

    .profile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .profile-header h3 {
      font-size: 0.875rem;
      font-weight: 600;
      color: #475569;
      margin: 0;
    }

    .profile-legend {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      color: #64748b;
    }

    .legend-planned {
      color: #94a3b8;
    }

    .legend-actual {
      color: #1e293b;
      font-weight: 600;
    }

    .legend-pause {
      color: #f59e0b;
      font-weight: 600;
    }

    .json-toggle-btn, .segments-toggle-btn {
      background: #e2e8f0;
      border: none;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #475569;
      cursor: pointer;
      transition: background 0.2s;
    }

    .json-toggle-btn:hover, .segments-toggle-btn:hover {
      background: #cbd5e1;
    }

    .segments-toggle-btn {
      background: #3b82f6;
      color: white;
      font-weight: 500;
    }

    .segments-toggle-btn:hover {
      background: #2563eb;
    }

    .segments-toggle-btn.active {
      background: #16a34a;
    }

    .profile-chart {
      margin-bottom: 1rem;
    }

    .power-profile-svg {
      width: 100%;
      height: auto;
      border-radius: 6px;
      background: white;
    }

    /* Hide detected segments by default */
    .detected-segments-overlay {
      display: none;
    }

    .detected-segments-overlay.visible {
      display: block;
    }

    /* Workout Structure */
    .workout-structure {
      margin-top: 1rem;
    }

    .collapsible .collapsible-header {
      width: 100%;
      font-size: 0.875rem;
      font-weight: 600;
      color: #475569;
      margin: 0;
      padding: 0.75rem 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      user-select: none;
      background: #e2e8f0;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      transition: all 0.2s ease;
      text-align: left;
    }

    .collapsible .collapsible-header:hover {
      background: #cbd5e1;
      border-color: #94a3b8;
    }

    .collapse-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #94a3b8;
      border-radius: 4px;
      color: white;
      font-size: 0.75rem;
      font-weight: bold;
      transition: all 0.2s ease;
    }

    .collapse-icon::before {
      content: '+';
    }

    .collapsible:not(.collapsed) .collapse-icon::before {
      content: '−';
    }

    .collapsible:not(.collapsed) .collapse-icon {
      background: #3b82f6;
    }

    .collapse-title {
      flex: 1;
    }

    .collapse-hint {
      font-size: 0.75rem;
      font-weight: 400;
      color: #94a3b8;
      transition: opacity 0.2s ease;
    }

    .collapsible:not(.collapsed) .collapse-hint {
      opacity: 0;
    }

    .collapsible.collapsed .collapsible-content {
      display: none;
    }

    .collapsible-content {
      padding-top: 0.75rem;
    }

    .structure-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background: white;
      border-radius: 6px;
      margin-bottom: 0.5rem;
      border-left: 4px solid #94a3b8;
    }

    .structure-duration {
      font-weight: 600;
      min-width: 60px;
      color: #1e293b;
    }

    .structure-power {
      font-weight: 500;
      min-width: 140px;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      font-size: 0.8125rem;
    }

    .structure-desc {
      color: #64748b;
      font-size: 0.875rem;
      text-transform: capitalize;
    }

    /* Repeat Sets */
    .structure-repeat {
      background: rgba(245, 158, 11, 0.1);
      border: 2px dashed #f59e0b;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.5rem;
    }

    .repeat-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .repeat-badge {
      background: #f59e0b;
      color: white;
      font-weight: 700;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .repeat-label {
      color: #b45309;
      font-size: 0.875rem;
    }

    .repeat-content .structure-row {
      background: white;
    }

    /* JSON Viewer */
    .json-viewer {
      display: none;
      margin-top: 0.75rem;
      background: #1e293b;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
    }

    .json-viewer.visible {
      display: block;
    }

    .json-viewer pre {
      margin: 0;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      font-size: 0.75rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .json-viewer .json-key { color: #7dd3fc; }
    .json-viewer .json-string { color: #86efac; }
    .json-viewer .json-number { color: #fcd34d; }
    .json-viewer .json-boolean { color: #f472b6; }
    .json-viewer .json-null { color: #94a3b8; }

    /* Segment Visualization */
    .segment-visualization {
      margin-bottom: 2rem;
    }

    .segment-visualization h3 {
      font-size: 1rem;
      color: #475569;
      margin-bottom: 1rem;
    }

    .timeline {
      display: flex;
      height: 60px;
      border-radius: 8px;
      overflow: hidden;
      background: #e2e8f0;
    }

    .timeline-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 2%;
      border-right: 1px solid rgba(255,255,255,0.3);
      transition: transform 0.2s;
      cursor: pointer;
    }

    .timeline-segment:hover {
      transform: scaleY(1.1);
      z-index: 1;
    }

    .timeline-segment.quality-excellent { background: #22c55e; }
    .timeline-segment.quality-good { background: #84cc16; }
    .timeline-segment.quality-fair { background: #eab308; }
    .timeline-segment.quality-poor { background: #f97316; }
    .timeline-segment.quality-skipped { background: #94a3b8; }

    .segment-score {
      font-size: 0.6875rem;
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .timeline-legend {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .legend-item::before {
      content: '';
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .legend-item.quality-excellent::before { background: #22c55e; }
    .legend-item.quality-good::before { background: #84cc16; }
    .legend-item.quality-fair::before { background: #eab308; }
    .legend-item.quality-poor::before { background: #f97316; }
    .legend-item.quality-skipped::before { background: #94a3b8; }

    /* Segment Table */
    .segment-table-container {
      margin-bottom: 2rem;
      overflow-x: auto;
    }

    .segment-table-container h3 {
      font-size: 1rem;
      color: #475569;
      margin-bottom: 1rem;
    }

    .segment-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .segment-table th {
      text-align: left;
      padding: 0.75rem;
      background: #f1f5f9;
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
    }

    .segment-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .segment-table .duration-cell {
      white-space: nowrap;
    }

    .segment-table .duration-times {
      display: block;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      font-size: 0.75rem;
    }

    .segment-table .duration-pct {
      display: block;
      font-size: 0.6875rem;
      opacity: 0.8;
    }

    .segment-row.quality-skipped {
      opacity: 0.6;
    }

    /* Segment Details */
    .segment-details h3 {
      font-size: 1rem;
      color: #475569;
      margin-bottom: 1rem;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .detail-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1rem;
      border-left: 4px solid #94a3b8;
    }

    .detail-card.quality-excellent { border-left-color: #22c55e; }
    .detail-card.quality-good { border-left-color: #84cc16; }
    .detail-card.quality-fair { border-left-color: #eab308; }
    .detail-card.quality-poor { border-left-color: #f97316; }
    .detail-card.quality-skipped { border-left-color: #94a3b8; opacity: 0.7; }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .detail-number {
      font-weight: 700;
      color: #64748b;
    }

    .detail-name {
      flex: 1;
      font-weight: 600;
      color: #1e293b;
    }

    .detail-scores {
      margin-bottom: 1rem;
    }

    .score-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
    }

    .score-bar .score-label {
      width: 60px;
      font-size: 0.75rem;
      color: #64748b;
    }

    .score-track {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .score-fill {
      height: 100%;
      border-radius: 4px;
    }

    .score-fill.score-excellent { background: #22c55e; }
    .score-fill.score-good { background: #84cc16; }
    .score-fill.score-fair { background: #eab308; }
    .score-fill.score-poor { background: #f97316; }

    .score-bar .score-value {
      width: 40px;
      text-align: right;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .detail-comparison {
      background: white;
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .comparison-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      margin-bottom: 0.25rem;
    }

    .comparison-row:last-child {
      margin-bottom: 0;
    }

    .comparison-label {
      width: 60px;
      color: #64748b;
    }

    .comparison-value {
      color: #1e293b;
      font-weight: 500;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      font-size: 0.75rem;
    }

    .detail-assessment {
      font-size: 0.8125rem;
      color: #475569;
      font-style: italic;
    }

    /* Footer */
    footer {
      text-align: center;
      padding-top: 2rem;
      margin-top: 2rem;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 0.875rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }

      .activity-header {
        flex-direction: column;
        gap: 1rem;
      }

      .activity-score {
        text-align: left;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `
}

function getInteractiveScript(): string {
  return `
    // Initialize interactive features
    function initInteractiveFeatures() {
    // Smooth scroll to activity when clicking overview table row
    document.querySelectorAll('.overview-table tr.clickable').forEach(row => {
      row.addEventListener('click', () => {
        const activityId = row.dataset.activity;
        const section = document.getElementById('activity-' + activityId);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Highlight corresponding segment when hovering timeline
    document.querySelectorAll('.timeline-segment').forEach((seg, i) => {
      seg.addEventListener('mouseenter', () => {
        const card = seg.closest('.activity').querySelector('.detail-card[data-segment="' + i + '"]');
        if (card) card.style.transform = 'scale(1.02)';
      });
      seg.addEventListener('mouseleave', () => {
        const card = seg.closest('.activity').querySelector('.detail-card[data-segment="' + i + '"]');
        if (card) card.style.transform = '';
      });
    });

    // Toggle JSON viewer
    document.querySelectorAll('.json-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const jsonViewer = document.getElementById(targetId);
        if (jsonViewer) {
          jsonViewer.classList.toggle('visible');
          btn.textContent = jsonViewer.classList.contains('visible') ? 'Hide JSON' : 'View JSON';
        }
      });
    });

    // Toggle detected segments overlay
    document.querySelectorAll('.segments-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const activityId = btn.dataset.activity;
        const powerProfile = btn.closest('.power-profile');
        const segmentsOverlay = powerProfile.querySelector('.detected-segments-overlay');

        if (segmentsOverlay) {
          segmentsOverlay.classList.toggle('visible');
          btn.classList.toggle('active');
          btn.textContent = segmentsOverlay.classList.contains('visible')
            ? 'Hide Detected Segments'
            : 'Show Detected Segments';
        }
      });
    });

    // Toggle collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const parent = header.closest('.collapsible');
        if (parent) {
          parent.classList.toggle('collapsed');
        }
      });
    });

    // Power profile chart hover tracking
    document.querySelectorAll('.power-profile-svg').forEach(svg => {
      const overlay = svg.querySelector('.hover-overlay');
      const hoverGroup = svg.querySelector('.hover-group');
      const hoverLine = svg.querySelector('.hover-line');
      const hoverDot = svg.querySelector('.hover-dot');
      const tooltipBg = svg.querySelector('.hover-tooltip-bg');
      const tooltipSegment = svg.querySelector('.hover-tooltip-segment');
      const tooltipTime = svg.querySelector('.hover-tooltip-time');
      const tooltipPower = svg.querySelector('.hover-tooltip-power');

      if (!overlay || !hoverGroup) return;

      // Parse data attributes
      const width = parseFloat(svg.dataset.width);
      const graphHeight = parseFloat(svg.dataset.graphHeight);
      const topMargin = parseFloat(svg.dataset.topMargin);
      const ftp = parseFloat(svg.dataset.ftp);
      const durationSec = parseFloat(svg.dataset.durationSec);
      const powerStream = JSON.parse(svg.dataset.powerStream || '[]');
      const segments = JSON.parse(svg.dataset.segments || '[]');

      if (powerStream.length === 0) return; // No power data

      // Helper function to find which segment the current time is in
      const findSegmentAtTime = (timeSec) => {
        let cumulativeTime = 0;
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (timeSec < cumulativeTime + seg.duration_sec) {
            return seg.name;
          }
          cumulativeTime += seg.duration_sec;
        }
        return segments[segments.length - 1]?.name || '';
      };

      overlay.addEventListener('mouseenter', () => {
        hoverGroup.style.display = 'block';
      });

      overlay.addEventListener('mouseleave', () => {
        hoverGroup.style.display = 'none';
      });

      overlay.addEventListener('mousemove', (e) => {
        // Get mouse position relative to SVG
        const rect = svg.getBoundingClientRect();
        const svgX = e.clientX - rect.left;
        const svgY = e.clientY - rect.top;

        // Convert screen coordinates to SVG viewBox coordinates
        const viewBoxWidth = width;
        const viewBoxHeight = parseFloat(svg.getAttribute('viewBox').split(' ')[3]);
        const x = (svgX / rect.width) * viewBoxWidth;
        const y = (svgY / rect.height) * viewBoxHeight;

        // Calculate time and power at this position (no time scaling)
        const actualDurationSec = powerStream.length;
        const timeSec = Math.max(0, Math.min(actualDurationSec - 1, (x / width) * durationSec));
        const timeIndex = Math.floor(timeSec);
        const power = powerStream[timeIndex] || 0;

        // Format time as MM:SS
        const minutes = Math.floor(timeSec / 60);
        const seconds = Math.floor(timeSec % 60);
        const timeStr = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

        // Calculate y position of power line at this time
        const powerPct = (power / ftp) * 100;
        const clampedPct = Math.min(200, Math.max(0, powerPct));
        const powerY = topMargin + graphHeight - (clampedPct / 200) * graphHeight;

        // Update hover line position
        hoverLine.setAttribute('x1', x);
        hoverLine.setAttribute('x2', x);

        // Update hover dot position
        hoverDot.setAttribute('cx', x);
        hoverDot.setAttribute('cy', powerY);

        // Find which segment we're in
        const segmentName = findSegmentAtTime(timeSec);

        // Position tooltip below chart, centered on vertical line
        const tooltipWidth = 90;
        const tooltipX = Math.max(0, Math.min(width - tooltipWidth, x - tooltipWidth / 2));
        const tooltipY = topMargin + graphHeight + 8;

        tooltipBg.setAttribute('x', tooltipX);
        tooltipBg.setAttribute('y', tooltipY);

        tooltipSegment.setAttribute('x', tooltipX + 4);
        tooltipSegment.setAttribute('y', tooltipY + 10);
        tooltipSegment.textContent = segmentName;

        tooltipTime.setAttribute('x', tooltipX + 4);
        tooltipTime.setAttribute('y', tooltipY + 21);
        tooltipTime.textContent = timeStr;

        tooltipPower.setAttribute('x', tooltipX + 4);
        tooltipPower.setAttribute('y', tooltipY + 32);
        tooltipPower.textContent = Math.round(power) + 'W';
      });
    });
    } // End initInteractiveFeatures

    // Call initialization immediately (script is at end of body, DOM is ready)
    initInteractiveFeatures();
  `
}

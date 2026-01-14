/**
 * Workout Compliance Analysis Service
 * Analyzes how well completed activities match planned workouts
 *
 * This service implements pattern-based segment matching to:
 * 1. Identify each segment of the workout (warmup, intervals, recovery, cooldown)
 * 2. Match planned segments to actual performance using intelligent pattern detection
 * 3. Score each segment based on power accuracy, time in zone, and duration
 * 4. Calculate an overall compliance score (0-100)
 */

import type { WorkoutSegment, WorkoutStructure } from '@/lib/types/training-plan'
import {
  convertStepLengthToSeconds,
  extractPowerTarget,
  hasValidStructure,
} from '@/lib/types/training-plan'

// ============================================================================
// Types
// ============================================================================

/**
 * Power zone boundaries in watts
 */
export interface PowerZones {
  z1: { min: number; max: number }
  z2: { min: number; max: number }
  z3: { min: number; max: number }
  z4: { min: number; max: number }
  z5: { min: number; max: number }
}

/**
 * HR zone boundaries in bpm
 */
export interface HRZones {
  z1: { min: number; max: number }
  z2: { min: number; max: number }
  z3: { min: number; max: number }
  z4: { min: number; max: number }
  z5: { min: number; max: number }
}

/**
 * Zone distribution (percentage in each zone, 0-1)
 */
export interface ZoneDistribution {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

/**
 * Adaptive parameters based on workout type
 */
export interface AdaptiveParameters {
  smoothingWindowSec: number // Rolling average window
  minSegmentDurationSec: number // Minimum time to consider a segment
  boundaryStabilitySec: number // Time zone must be stable to mark boundary
}

/**
 * Planned workout segment (after flattening)
 */
export interface PlannedSegment {
  index: number
  name: string
  type: 'warmup' | 'work' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'tempo'
  duration_sec: number
  power_low: number // Absolute watts
  power_high: number // Absolute watts
  target_zone: number // 1-5
  power_low_pct?: number // Optional: % of FTP (for multi-zone detection)
  power_high_pct?: number // Optional: % of FTP (for multi-zone detection)
}

/**
 * Detected effort block from power stream
 */
export interface DetectedBlock {
  start_sec: number
  end_sec: number
  duration_sec: number
  dominant_zone: number
  avg_power: number
  max_power: number
  min_power: number
  zone_distribution: ZoneDistribution
}

/**
 * Detected pause in power stream
 */
export interface DetectedPause {
  start_sec: number
  end_sec: number
  duration_sec: number
}

/**
 * Match between planned and detected
 */
export interface SegmentMatch {
  planned_index: number
  detected_index: number | null
  similarity_score: number
  skipped: boolean
}

/**
 * Compliance scores for a segment
 */
export interface ComplianceScores {
  power_compliance: number
  zone_compliance: number
  duration_compliance: number
  overall_segment_score: number
}

/**
 * Detailed analysis of one segment
 */
export interface SegmentAnalysis {
  segment_index: number
  segment_name: string
  segment_type: string
  match_quality: 'excellent' | 'good' | 'fair' | 'poor' | 'skipped'

  // Planned values
  planned_duration_sec: number
  planned_power_low: number
  planned_power_high: number
  planned_zone: number

  // Actual values (null if skipped)
  actual_start_sec: number | null
  actual_end_sec: number | null
  actual_duration_sec: number | null
  actual_avg_power: number | null
  actual_max_power: number | null
  actual_min_power: number | null
  actual_dominant_zone: number | null
  time_in_zone: ZoneDistribution | null

  // Scores
  scores: ComplianceScores

  // Human-readable
  assessment: string
}

/**
 * Overall workout analysis result
 */
export interface OverallComplianceResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
  segments_completed: number
  segments_skipped: number
  segments_total: number
}

/**
 * Complete workout compliance analysis
 */
export interface WorkoutComplianceAnalysis {
  overall: OverallComplianceResult
  segments: SegmentAnalysis[]
  metadata: {
    algorithm_version: string
    power_data_quality: 'good' | 'partial' | 'missing'
    adaptive_parameters: AdaptiveParameters
    detection_strategy?: 'global' | 'per-segment'
    detected_pauses?: DetectedPause[]
  }
}

// ============================================================================
// Segment Type Weights for Scoring
// ============================================================================

const SEGMENT_WEIGHTS: Record<string, { power: number; zone: number; duration: number }> = {
  warmup: { power: 0.25, zone: 0.35, duration: 0.4 },
  work: { power: 0.45, zone: 0.4, duration: 0.15 },
  interval: { power: 0.45, zone: 0.4, duration: 0.15 },
  recovery: { power: 0.2, zone: 0.3, duration: 0.5 },
  cooldown: { power: 0.25, zone: 0.35, duration: 0.4 },
  steady: { power: 0.4, zone: 0.4, duration: 0.2 },
  tempo: { power: 0.4, zone: 0.4, duration: 0.2 },
}

// ============================================================================
// Zone Calculation Functions
// ============================================================================

/**
 * Calculate 5-zone power model from FTP
 * Based on Coggan power zones
 */
export function calculatePowerZones(ftp: number): PowerZones {
  return {
    z1: { min: 0, max: Math.round(ftp * 0.55) - 1 },
    z2: { min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.75) },
    z3: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.9) },
    z4: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
    z5: { min: Math.round(ftp * 1.06), max: 9999 },
  }
}

/**
 * Calculate 5-zone HR model from LTHR
 * Based on Joe Friel HR zones
 */
export function calculateHRZones(lthr: number): HRZones {
  return {
    z1: { min: 0, max: Math.round(lthr * 0.81) - 1 },
    z2: { min: Math.round(lthr * 0.81), max: Math.round(lthr * 0.89) },
    z3: { min: Math.round(lthr * 0.9), max: Math.round(lthr * 0.93) },
    z4: { min: Math.round(lthr * 0.94), max: Math.round(lthr * 0.99) },
    z5: { min: Math.round(lthr * 1.0), max: 250 },
  }
}

/**
 * Get the target zone for a given power percentage range
 */
export function getTargetZone(powerLowPct: number, powerHighPct: number): number {
  const avgPct = (powerLowPct + powerHighPct) / 2

  if (avgPct < 55) return 1
  if (avgPct <= 75) return 2
  if (avgPct <= 90) return 3
  if (avgPct <= 105) return 4
  return 5
}

// ============================================================================
// Adaptive Parameters
// ============================================================================

/**
 * Get adaptive parameters for a specific segment based on its duration
 * Used for per-segment detection in mixed-duration workouts (Issue #98)
 */
export function getSegmentAdaptiveParameters(segment: PlannedSegment): AdaptiveParameters {
  const duration = segment.duration_sec

  if (duration >= 300) {
    // Long segments (≥5 min): conservative detection
    return {
      smoothingWindowSec: 30,
      minSegmentDurationSec: 60,
      boundaryStabilitySec: 30,
    }
  } else if (duration >= 60) {
    // Medium segments (1-5 min): moderate detection
    return {
      smoothingWindowSec: 15,
      minSegmentDurationSec: 20,
      boundaryStabilitySec: 15,
    }
  } else if (duration >= 15) {
    // Short segments (15s-1min): sensitive detection
    return {
      smoothingWindowSec: 5,
      minSegmentDurationSec: 10,
      boundaryStabilitySec: 5,
    }
  } else {
    // Ultra-short segments (<15s): sprint detection
    // Minimal smoothing to preserve peak power spikes
    return {
      smoothingWindowSec: 1,
      minSegmentDurationSec: 3,
      boundaryStabilitySec: 2,
    }
  }
}

/**
 * Calculate adaptive parameters based on the shortest planned segment
 * Different workout types need different detection sensitivity
 */
export function calculateAdaptiveParameters(plannedSegments: PlannedSegment[]): AdaptiveParameters {
  if (plannedSegments.length === 0) {
    return {
      smoothingWindowSec: 30,
      minSegmentDurationSec: 30,
      boundaryStabilitySec: 20,
    }
  }

  // Find the shortest planned segment
  const shortestSegmentSec = Math.min(...plannedSegments.map((s) => s.duration_sec))

  // Adaptive rules based on shortest segment
  if (shortestSegmentSec <= 15) {
    // Sprint/Neuromuscular workouts (≤15 sec efforts)
    // Minimal smoothing to preserve peak power spikes
    return {
      smoothingWindowSec: 1,
      minSegmentDurationSec: 3,
      boundaryStabilitySec: 2,
    }
  } else if (shortestSegmentSec <= 30) {
    // Short intervals (15-30 sec)
    return {
      smoothingWindowSec: 5,
      minSegmentDurationSec: 10,
      boundaryStabilitySec: 5,
    }
  } else if (shortestSegmentSec <= 60) {
    // Micro intervals (30-60 sec)
    return {
      smoothingWindowSec: 10,
      minSegmentDurationSec: 15,
      boundaryStabilitySec: 10,
    }
  } else if (shortestSegmentSec <= 180) {
    // Standard intervals (1-3 min)
    return {
      smoothingWindowSec: 15,
      minSegmentDurationSec: 20,
      boundaryStabilitySec: 15,
    }
  } else {
    // Long intervals / steady state (>3 min)
    return {
      smoothingWindowSec: 30,
      minSegmentDurationSec: 30,
      boundaryStabilitySec: 20,
    }
  }
}

// ============================================================================
// Segment Flattening
// ============================================================================

/**
 * Map intensity class to PlannedSegment type
 */
function mapIntensityClassToType(
  intensityClass: 'warmUp' | 'active' | 'rest' | 'coolDown'
): PlannedSegment['type'] {
  switch (intensityClass) {
    case 'warmUp':
      return 'warmup'
    case 'coolDown':
      return 'cooldown'
    case 'rest':
      return 'recovery'
    case 'active':
      return 'work'
    default:
      return 'steady'
  }
}

/**
 * Flatten WorkoutStructure into PlannedSegments for compliance analysis
 * NEW: Supports multi-step intervals (Issue #96)
 */
function flattenWorkoutStructure(structure: WorkoutStructure, ftp: number): PlannedSegment[] {
  const flattened: PlannedSegment[] = []
  let index = 0

  for (const segment of structure.structure) {
    const repetitions = segment.length.value
    const isRepetition = segment.type === 'repetition' && repetitions > 1

    for (let rep = 1; rep <= repetitions; rep++) {
      for (const step of segment.steps) {
        const powerTarget = extractPowerTarget(step.targets)
        const durationSec = convertStepLengthToSeconds(step.length)
        const segmentType = mapIntensityClassToType(step.intensityClass)

        // For repetitions, append the rep number to the name
        const name = isRepetition ? `${step.name} ${rep}` : step.name

        flattened.push({
          index: index++,
          name,
          type: segmentType,
          duration_sec: durationSec,
          power_low: Math.round((powerTarget.minValue / 100) * ftp),
          power_high: Math.round((powerTarget.maxValue / 100) * ftp),
          target_zone: getTargetZone(powerTarget.minValue, powerTarget.maxValue),
          power_low_pct: powerTarget.minValue,
          power_high_pct: powerTarget.maxValue,
        })
      }
    }
  }

  return flattened
}

/**
 * Flatten workout segments by expanding interval sets into individual segments
 * Supports both legacy WorkoutSegment[] and new WorkoutStructure format
 *
 * @param segments - Legacy segment format (optional)
 * @param ftp - Functional Threshold Power in watts
 * @param structure - New WorkoutStructure format (optional, takes precedence)
 */
export function flattenWorkoutSegments(
  segments: WorkoutSegment[] | undefined,
  ftp: number,
  structure?: WorkoutStructure
): PlannedSegment[] {
  // NEW: Handle WorkoutStructure format (takes precedence)
  if (hasValidStructure(structure)) {
    return flattenWorkoutStructure(structure, ftp)
  }

  // Legacy format handling
  if (!segments || segments.length === 0) {
    return []
  }

  const flattened: PlannedSegment[] = []
  let index = 0

  for (const segment of segments) {
    // Handle interval sets
    if (segment.sets && segment.work && segment.recovery) {
      for (let set = 1; set <= segment.sets; set++) {
        // Work segment
        flattened.push({
          index: index++,
          name: `${segment.type === 'interval' ? 'Interval' : 'Work'} ${set}`,
          type: 'work',
          duration_sec: segment.work.duration_min * 60,
          power_low: Math.round((segment.work.power_low_pct / 100) * ftp),
          power_high: Math.round((segment.work.power_high_pct / 100) * ftp),
          target_zone: getTargetZone(segment.work.power_low_pct, segment.work.power_high_pct),
          power_low_pct: segment.work.power_low_pct,
          power_high_pct: segment.work.power_high_pct,
        })

        // Recovery segment (except after last set if there's no duration_min on parent)
        if (set < segment.sets || segment.duration_min) {
          flattened.push({
            index: index++,
            name: `Recovery ${set}`,
            type: 'recovery',
            duration_sec: segment.recovery.duration_min * 60,
            power_low: Math.round((segment.recovery.power_low_pct / 100) * ftp),
            power_high: Math.round((segment.recovery.power_high_pct / 100) * ftp),
            target_zone: getTargetZone(
              segment.recovery.power_low_pct,
              segment.recovery.power_high_pct
            ),
            power_low_pct: segment.recovery.power_low_pct,
            power_high_pct: segment.recovery.power_high_pct,
          })
        }
      }
    } else if (segment.duration_min && segment.duration_min > 0) {
      // Simple segment (warmup, cooldown, steady, etc.)
      const powerLowPct = segment.power_low_pct ?? 50
      const powerHighPct = segment.power_high_pct ?? 60

      flattened.push({
        index: index++,
        name: formatSegmentName(segment.type, segment.description),
        type: segment.type,
        duration_sec: segment.duration_min * 60,
        power_low: Math.round((powerLowPct / 100) * ftp),
        power_high: Math.round((powerHighPct / 100) * ftp),
        target_zone: getTargetZone(powerLowPct, powerHighPct),
        power_low_pct: powerLowPct,
        power_high_pct: powerHighPct,
      })
    }
  }

  return flattened
}

function formatSegmentName(type: string, description?: string): string {
  if (description && description.trim()) {
    return description
  }

  const typeNames: Record<string, string> = {
    warmup: 'Warmup',
    cooldown: 'Cooldown',
    recovery: 'Recovery',
    steady: 'Steady',
    tempo: 'Tempo',
    interval: 'Interval',
    work: 'Work',
  }

  return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

// ============================================================================
// Power Stream Processing
// ============================================================================

/**
 * Smooth power stream using rolling average
 */
export function smoothPowerStream(power: number[], windowSec: number): number[] {
  if (power.length === 0) return []
  if (windowSec <= 1) return [...power]

  const smoothed: number[] = []

  for (let i = 0; i < power.length; i++) {
    const windowStart = Math.max(0, i - windowSec + 1)
    const window = power.slice(windowStart, i + 1)
    const avg = window.reduce((a, b) => a + b, 0) / window.length
    smoothed.push(Math.round(avg))
  }

  return smoothed
}

/**
 * Classify power value to zone (1-5)
 */
export function classifyPowerToZone(power: number, zones: PowerZones): number {
  if (power <= zones.z1.max) return 1
  if (power <= zones.z2.max) return 2
  if (power <= zones.z3.max) return 3
  if (power <= zones.z4.max) return 4
  return 5
}

/**
 * Create zone timeline from power stream
 */
export function createZoneTimeline(powerStream: number[], zones: PowerZones): number[] {
  return powerStream.map((power) => classifyPowerToZone(power, zones))
}

/**
 * Detect pauses in power stream
 * A pause is defined as sustained very low power (< threshold) for a minimum duration
 * Common scenarios: bathroom breaks, equipment adjustments, traffic stops
 *
 * @param powerStream - Raw power data (1 Hz)
 * @param powerThreshold - Power below this is considered a pause (default: 20W)
 * @param minDurationSec - Minimum pause duration to detect (default: 30s)
 * @returns Array of detected pauses
 */
export function detectPauses(
  powerStream: number[],
  powerThreshold: number = 20,
  minDurationSec: number = 30
): DetectedPause[] {
  const pauses: DetectedPause[] = []
  let pauseStart = -1

  for (let i = 0; i < powerStream.length; i++) {
    const power = powerStream[i] ?? 0

    if (power < powerThreshold) {
      // Start of potential pause
      if (pauseStart === -1) {
        pauseStart = i
      }
    } else {
      // End of pause
      if (pauseStart !== -1) {
        const duration = i - pauseStart
        if (duration >= minDurationSec) {
          pauses.push({
            start_sec: pauseStart,
            end_sec: i,
            duration_sec: duration,
          })
        }
        pauseStart = -1
      }
    }
  }

  // Handle pause at end of stream
  if (pauseStart !== -1 && powerStream.length - pauseStart >= minDurationSec) {
    pauses.push({
      start_sec: pauseStart,
      end_sec: powerStream.length,
      duration_sec: powerStream.length - pauseStart,
    })
  }

  return pauses
}

/**
 * Create pause-removed power stream for segment matching
 * Returns a new power stream with pauses removed and a mapping from new indices to original indices
 *
 * @param powerStream - Original power data
 * @param pauses - Detected pauses
 * @returns Object with pause-free stream and index mapping
 */
export function removePausesFromStream(
  powerStream: number[],
  pauses: DetectedPause[]
): {
  pauseFreeStream: number[]
  indexMapping: number[] // pauseFreeIndex -> originalIndex
} {
  if (pauses.length === 0) {
    return {
      pauseFreeStream: [...powerStream],
      indexMapping: Array.from({ length: powerStream.length }, (_, i) => i),
    }
  }

  const pauseFreeStream: number[] = []
  const indexMapping: number[] = []

  for (let i = 0; i < powerStream.length; i++) {
    // Check if this index is within any pause
    const isInPause = pauses.some((pause) => i >= pause.start_sec && i < pause.end_sec)

    if (!isInPause) {
      pauseFreeStream.push(powerStream[i] ?? 0)
      indexMapping.push(i)
    }
  }

  return { pauseFreeStream, indexMapping }
}

// ============================================================================
// Segment Detection
// ============================================================================

/**
 * Detect effort blocks from power stream based on zone transitions
 */
export function detectEffortBlocks(
  powerStream: number[],
  zones: PowerZones,
  params: AdaptiveParameters
): DetectedBlock[] {
  if (powerStream.length === 0) return []

  const { minSegmentDurationSec, boundaryStabilitySec } = params

  // Create zone timeline
  const zoneTimeline = createZoneTimeline(powerStream, zones)

  const blocks: DetectedBlock[] = []
  let blockStart = 0
  let currentDominantZone = zoneTimeline[0]!
  const zoneCounts: Record<number, number> = { [currentDominantZone]: 1 }

  for (let i = 1; i < zoneTimeline.length; i++) {
    const zone = zoneTimeline[i]!

    // Check if this could be a zone transition
    if (zone !== currentDominantZone) {
      // Look ahead to see if the new zone is stable
      const lookAhead = zoneTimeline.slice(i, i + boundaryStabilitySec)
      const newZoneCount = lookAhead.filter((z) => z === zone).length

      // If new zone is dominant for the stability window, it's a real transition
      if (newZoneCount >= boundaryStabilitySec * 0.7) {
        const blockDuration = i - blockStart

        // Only save blocks that meet minimum duration
        if (blockDuration >= minSegmentDurationSec) {
          const blockPower = powerStream.slice(blockStart, i)
          blocks.push(createBlock(blockStart, i, blockPower, zoneCounts))
        }

        // Start new block
        blockStart = i
        Object.keys(zoneCounts).forEach((k) => (zoneCounts[Number(k)] = 0))
        currentDominantZone = zone
      }
    }

    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1
    if ((zoneCounts[zone] || 0) > (zoneCounts[currentDominantZone] || 0)) {
      currentDominantZone = zone
    }
  }

  // Don't forget the last block
  const blockDuration = zoneTimeline.length - blockStart
  if (blockDuration >= minSegmentDurationSec) {
    const blockPower = powerStream.slice(blockStart)
    blocks.push(createBlock(blockStart, zoneTimeline.length, blockPower, zoneCounts))
  }

  return blocks
}

function createBlock(
  start: number,
  end: number,
  powerData: number[],
  zoneCounts: Record<number, number>
): DetectedBlock {
  const duration = end - start
  const avgPower =
    powerData.length > 0 ? powerData.reduce((a, b) => a + b, 0) / powerData.length : 0
  const maxPower = powerData.length > 0 ? Math.max(...powerData) : 0
  const minPower = powerData.length > 0 ? Math.min(...powerData) : 0

  // Calculate zone distribution
  const totalZoneCounts = Object.values(zoneCounts).reduce((a, b) => a + b, 0)
  const zoneDistribution: ZoneDistribution = {
    z1: totalZoneCounts > 0 ? (zoneCounts[1] || 0) / totalZoneCounts : 0,
    z2: totalZoneCounts > 0 ? (zoneCounts[2] || 0) / totalZoneCounts : 0,
    z3: totalZoneCounts > 0 ? (zoneCounts[3] || 0) / totalZoneCounts : 0,
    z4: totalZoneCounts > 0 ? (zoneCounts[4] || 0) / totalZoneCounts : 0,
    z5: totalZoneCounts > 0 ? (zoneCounts[5] || 0) / totalZoneCounts : 0,
  }

  // Find dominant zone
  let dominantZone = 1
  let maxCount = 0
  for (const [zone, count] of Object.entries(zoneCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominantZone = Number(zone)
    }
  }

  return {
    start_sec: start,
    end_sec: end,
    duration_sec: duration,
    dominant_zone: dominantZone,
    avg_power: Math.round(avgPower),
    max_power: maxPower,
    min_power: minPower,
    zone_distribution: zoneDistribution,
  }
}

/**
 * Detect effort blocks using segment-specific guidance
 * Processes each planned segment independently with its own adaptive parameters
 * This prevents cross-contamination between long and short segments (Issue #98)
 */
export function detectEffortBlocksWithSegmentGuidance(
  powerStream: number[],
  zones: PowerZones,
  plannedSegments: PlannedSegment[]
): DetectedBlock[] {
  const allBlocks: DetectedBlock[] = []
  let currentTime = 0

  for (const segment of plannedSegments) {
    // Get segment-specific adaptive parameters
    const segmentParams = getSegmentAdaptiveParameters(segment)

    // Extract power data for this segment's time window
    const startSec = currentTime
    const endSec = Math.min(currentTime + segment.duration_sec, powerStream.length)
    const segmentPower = powerStream.slice(startSec, endSec)

    if (segmentPower.length === 0) {
      currentTime = endSec
      continue
    }

    // Detect blocks within this segment using segment-specific params
    const segmentBlocks = detectEffortBlocks(segmentPower, zones, segmentParams)

    // Offset block times to absolute positions and add to results
    for (const block of segmentBlocks) {
      allBlocks.push({
        ...block,
        start_sec: block.start_sec + startSec,
        end_sec: block.end_sec + startSec,
      })
    }

    currentTime = endSec
  }

  return allBlocks
}

// ============================================================================
// Segment Matching
// ============================================================================

/**
 * Calculate similarity score between a planned segment and detected block
 */
export function calculateMatchSimilarity(planned: PlannedSegment, detected: DetectedBlock): number {
  // 1. Zone Match (40% weight)
  const zoneDiff = Math.abs(planned.target_zone - detected.dominant_zone)
  let zoneScore: number
  if (zoneDiff === 0) zoneScore = 100
  else if (zoneDiff === 1) zoneScore = 70
  else if (zoneDiff === 2) zoneScore = 40
  else zoneScore = 10

  // 2. Duration Match (30% weight)
  const durationRatio = detected.duration_sec / planned.duration_sec
  let durationScore: number
  if (durationRatio >= 0.9 && durationRatio <= 1.1) durationScore = 100
  else if (durationRatio >= 0.8 && durationRatio <= 1.2) durationScore = 85
  else if (durationRatio >= 0.7 && durationRatio <= 1.3) durationScore = 70
  else if (durationRatio >= 0.5 && durationRatio <= 1.5) durationScore = 50
  else durationScore = 25

  // 3. Power Match (30% weight)
  const targetMid = (planned.power_low + planned.power_high) / 2
  let powerScore: number
  if (detected.avg_power >= planned.power_low && detected.avg_power <= planned.power_high) {
    powerScore = 100
  } else if (detected.avg_power < planned.power_low) {
    const wattsBelow = planned.power_low - detected.avg_power
    const percentBelow = (wattsBelow / targetMid) * 100
    powerScore = Math.max(0, 100 - percentBelow * 2)
  } else {
    const wattsAbove = detected.avg_power - planned.power_high
    const percentAbove = (wattsAbove / targetMid) * 100
    powerScore = Math.max(0, 100 - percentAbove)
  }

  // Weighted total
  return Math.round(zoneScore * 0.4 + durationScore * 0.3 + powerScore * 0.3)
}

/**
 * Match planned segments to detected blocks using time-window constraints
 *
 * Key improvement: Each planned segment has an expected time window based on cumulative
 * planned duration. Only detected blocks that overlap with this window are considered.
 * This prevents segments with overlapping power targets (e.g., rest and cooldown) from
 * being confused when power alone can't distinguish them.
 */
export function matchSegments(
  planned: PlannedSegment[],
  detected: DetectedBlock[],
  minMatchThreshold: number = 50
): SegmentMatch[] {
  const matches: SegmentMatch[] = []
  const usedDetected = new Set<number>()

  // Calculate expected time windows for each planned segment
  let cumulativeTime = 0
  const timeWindows: Array<{ start: number; end: number }> = []
  for (const p of planned) {
    timeWindows.push({
      start: cumulativeTime,
      end: cumulativeTime + p.duration_sec,
    })
    cumulativeTime += p.duration_sec
  }

  // Track the minimum start time for the next segment
  // This enforces sequential ordering
  let minNextStartTime = 0

  for (let i = 0; i < planned.length; i++) {
    const p = planned[i]!
    const expectedWindow = timeWindows[i]!
    let bestMatch: number | null = null
    let bestScore = 0

    // Only consider detected blocks that overlap with the expected time window
    // Allow small flexibility for late starts (max 60s), but be strict about end time
    // This prevents segments with overlapping power targets from stealing each other's time
    const lateStartTolerance = Math.min(60, p.duration_sec * 0.2)
    const lateEndTolerance = Math.min(30, p.duration_sec * 0.1)

    const searchStart = Math.max(expectedWindow.start - 30, minNextStartTime) // Allow 30s early start but enforce sequential ordering
    const searchEnd = expectedWindow.end + lateEndTolerance

    for (let d = 0; d < detected.length; d++) {
      if (usedDetected.has(d)) continue

      const block = detected[d]!

      // Check if block overlaps with expected time window
      // Block must START before the search window ends AND END after it starts
      const blockOverlapsWindow =
        block.start_sec < searchEnd && block.end_sec > searchStart

      if (!blockOverlapsWindow) continue

      const score = calculateMatchSimilarity(p, block)

      if (score > bestScore && score >= minMatchThreshold) {
        bestMatch = d
        bestScore = score
      }
    }

    if (bestMatch !== null) {
      const matchedBlock = detected[bestMatch]!
      matches.push({
        planned_index: p.index,
        detected_index: bestMatch,
        similarity_score: bestScore,
        skipped: false,
      })
      usedDetected.add(bestMatch)

      // Update minimum start time for next segment
      // Next segment must start at or after the end of this matched block
      minNextStartTime = matchedBlock.end_sec
    } else {
      // No match found - segment was skipped
      matches.push({
        planned_index: p.index,
        detected_index: null,
        similarity_score: 0,
        skipped: true,
      })
      // Even if skipped, advance the minimum start time
      minNextStartTime = expectedWindow.end
    }
  }

  return matches
}

// ============================================================================
// Compliance Scoring
// ============================================================================

/**
 * Calculate power compliance score (0-100)
 */
export function calculatePowerCompliance(
  actualAvgPower: number,
  targetLow: number,
  targetHigh: number
): { score: number; assessment: string } {
  // Perfect: within target range
  if (actualAvgPower >= targetLow && actualAvgPower <= targetHigh) {
    return {
      score: 100,
      assessment: 'Power was within target range',
    }
  }

  const targetMid = (targetLow + targetHigh) / 2

  // Below target
  if (actualAvgPower < targetLow) {
    const wattsBelow = targetLow - actualAvgPower
    const percentBelow = (wattsBelow / targetMid) * 100
    const score = Math.max(0, 100 - percentBelow * 2)

    return {
      score: Math.round(score),
      assessment: `Power was ${Math.round(wattsBelow)}W below target`,
    }
  }

  // Above target
  const wattsAbove = actualAvgPower - targetHigh
  const percentAbove = (wattsAbove / targetMid) * 100
  const score = Math.max(0, 100 - percentAbove)

  return {
    score: Math.round(score),
    assessment: `Power was ${Math.round(wattsAbove)}W above target (good effort!)`,
  }
}

/**
 * Calculate zone compliance score (0-100)
 * Now supports multi-zone targets for power ranges that span multiple zones
 */
export function calculateZoneCompliance(
  timeInZone: ZoneDistribution,
  targetZone: number,
  powerLowPct?: number,
  powerHighPct?: number
): { score: number; assessment: string } {
  // Determine which zones the target power range spans
  const spansMultipleZones =
    powerLowPct !== undefined &&
    powerHighPct !== undefined &&
    getTargetZone(powerLowPct, powerLowPct) !== getTargetZone(powerHighPct, powerHighPct)

  if (spansMultipleZones && powerLowPct !== undefined && powerHighPct !== undefined) {
    // For ranges that span multiple zones (e.g., 50-60% = Z1+Z2), accept any spanned zone
    const lowZone = getTargetZone(powerLowPct, powerLowPct)
    const highZone = getTargetZone(powerHighPct, powerHighPct)

    // Calculate combined time in all spanned zones
    let combinedPercent = 0
    const zones = []
    for (let z = lowZone; z <= highZone; z++) {
      const zoneKey = `z${z}` as keyof ZoneDistribution
      combinedPercent += timeInZone[zoneKey] * 100
      zones.push(z)
    }

    const score = Math.round(combinedPercent)
    const zoneRange = zones.length > 1 ? `Z${zones.join('/Z')}` : `Z${zones[0]}`

    let assessment: string
    if (score >= 90) {
      assessment = `Excellent zone discipline (${score}% in ${zoneRange})`
    } else if (score >= 75) {
      assessment = `Good zone discipline (${score}% in ${zoneRange})`
    } else if (score >= 50) {
      assessment = `Inconsistent zone discipline (${score}% in ${zoneRange})`
    } else {
      assessment = `Poor zone discipline (only ${score}% in ${zoneRange})`
    }

    return { score, assessment }
  }

  // Single zone target - original strict behavior
  const zoneKey = `z${targetZone}` as keyof ZoneDistribution
  const percentInZone = timeInZone[zoneKey] * 100

  const score = Math.round(percentInZone)

  let assessment: string
  if (score >= 90) {
    assessment = `Excellent zone discipline (${score}% in Z${targetZone})`
  } else if (score >= 75) {
    assessment = `Good zone discipline (${score}% in Z${targetZone})`
  } else if (score >= 50) {
    assessment = `Inconsistent zone discipline (${score}% in Z${targetZone})`
  } else {
    assessment = `Poor zone discipline (only ${score}% in Z${targetZone})`
  }

  return { score, assessment }
}

/**
 * Calculate duration compliance score (0-100)
 */
export function calculateDurationCompliance(
  actualDurationSec: number,
  targetDurationSec: number
): { score: number; assessment: string } {
  const ratio = actualDurationSec / targetDurationSec

  let score: number
  let assessment: string

  if (ratio >= 0.95 && ratio <= 1.05) {
    score = 100
    assessment = 'Duration matched plan'
  } else if (ratio >= 0.9 && ratio <= 1.1) {
    score = 95
    assessment = 'Duration very close to plan'
  } else if (ratio >= 0.8 && ratio <= 1.2) {
    score = 85
    assessment =
      ratio < 1
        ? `Segment was ${Math.round((1 - ratio) * 100)}% shorter than planned`
        : `Segment was ${Math.round((ratio - 1) * 100)}% longer than planned`
  } else if (ratio >= 0.6 && ratio <= 1.4) {
    score = 70
    assessment =
      ratio < 1
        ? 'Segment was significantly shorter than planned'
        : 'Segment was significantly longer than planned'
  } else {
    score = Math.max(0, 100 - Math.abs(1 - ratio) * 100)
    assessment =
      ratio < 1 ? 'Segment was much shorter than planned' : 'Segment was much longer than planned'
  }

  return { score: Math.round(score), assessment }
}

/**
 * Calculate overall segment score with weighted components
 */
export function calculateSegmentScore(
  powerScore: number,
  zoneScore: number,
  durationScore: number,
  segmentType: string
): number {
  const weights = SEGMENT_WEIGHTS[segmentType] || { power: 0.35, zone: 0.35, duration: 0.3 }

  return Math.round(
    powerScore * weights.power + zoneScore * weights.zone + durationScore * weights.duration
  )
}

/**
 * Determine match quality from score
 */
export function getMatchQuality(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'skipped' {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 60) return 'fair'
  return 'poor'
}

/**
 * Calculate overall workout compliance score
 */
export function calculateOverallCompliance(segments: SegmentAnalysis[]): OverallComplianceResult {
  const completedSegments = segments.filter((s) => s.match_quality !== 'skipped')
  const skippedCount = segments.filter((s) => s.match_quality === 'skipped').length

  if (completedSegments.length === 0) {
    return {
      score: 0,
      grade: 'F',
      summary: 'Workout not completed',
      segments_completed: 0,
      segments_skipped: skippedCount,
      segments_total: segments.length,
    }
  }

  // Calculate duration-weighted average
  const totalPlannedDuration = completedSegments.reduce((sum, s) => sum + s.planned_duration_sec, 0)

  let weightedScore = 0
  for (const segment of completedSegments) {
    const weight = segment.planned_duration_sec / totalPlannedDuration
    weightedScore += segment.scores.overall_segment_score * weight
  }

  // Penalize for skipped segments (-5 points per skipped segment)
  const skippedPenalty = skippedCount * 5
  const finalScore = Math.max(0, Math.round(weightedScore) - skippedPenalty)

  // Determine grade
  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    finalScore >= 90
      ? 'A'
      : finalScore >= 80
        ? 'B'
        : finalScore >= 70
          ? 'C'
          : finalScore >= 60
            ? 'D'
            : 'F'

  // Generate summary
  let summary: string
  if (finalScore >= 90) {
    summary = 'Outstanding execution! You nailed this workout.'
  } else if (finalScore >= 80) {
    summary = 'Good job! Minor deviations from the plan.'
  } else if (finalScore >= 70) {
    summary = 'Decent effort with some room for improvement.'
  } else if (finalScore >= 60) {
    summary = 'Workout completed but with significant deviations.'
  } else {
    summary = 'Workout was not completed as prescribed.'
  }

  if (skippedCount > 0) {
    summary += ` ${skippedCount} segment${skippedCount > 1 ? 's were' : ' was'} skipped.`
  }

  return {
    score: finalScore,
    grade,
    summary,
    segments_completed: completedSegments.length,
    segments_skipped: skippedCount,
    segments_total: segments.length,
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze workout compliance for a matched workout-activity pair
 * Supports both legacy WorkoutSegment[] and new WorkoutStructure format (Issue #96)
 *
 * @param plannedSegments - Legacy segment format (optional if structure is provided)
 * @param powerStream - Array of power values from activity (1 value per second)
 * @param ftp - Athlete's FTP in watts
 * @param structure - NEW: WorkoutStructure format (takes precedence over plannedSegments)
 */
export function analyzeWorkoutCompliance(
  plannedSegments: WorkoutSegment[] | undefined,
  powerStream: number[],
  ftp: number,
  structure?: WorkoutStructure
): WorkoutComplianceAnalysis {
  // Step 1: Calculate power zones
  const zones = calculatePowerZones(ftp)

  // Step 2: Flatten planned segments (structure takes precedence)
  const flattenedSegments = flattenWorkoutSegments(plannedSegments, ftp, structure)

  // Step 3: Detect pauses in power stream
  // Pauses (bathroom breaks, equipment adjustments) should not affect matching
  const detectedPauses = detectPauses(powerStream)

  // Step 4: Create pause-removed stream for accurate segment matching
  const { pauseFreeStream, indexMapping } = removePausesFromStream(powerStream, detectedPauses)

  // Step 5: Determine detection strategy based on segment duration variance (Issue #98)
  let detectionStrategy: 'global' | 'per-segment' = 'global'
  if (flattenedSegments.length > 0) {
    const durations = flattenedSegments.map((s) => s.duration_sec)
    const minDuration = Math.min(...durations)
    const maxDuration = Math.max(...durations)
    const durationRatio = maxDuration / minDuration

    // If max/min ratio > 10, use per-segment approach (e.g., 15min warmup + 10s sprints)
    if (durationRatio > 10) {
      detectionStrategy = 'per-segment'
    }
  }

  // Step 6: Calculate adaptive parameters
  // For global strategy, use existing logic based on shortest segment
  // For per-segment strategy, we'll use segment-specific params during matching
  const adaptiveParams = calculateAdaptiveParameters(flattenedSegments)

  // Step 7: Smooth pause-removed power stream
  const smoothedPower = smoothPowerStream(pauseFreeStream, adaptiveParams.smoothingWindowSec)

  // Step 8: Detect effort blocks on pause-removed stream
  // For per-segment strategy, use segment-specific parameters during detection
  // For global strategy, use the existing logic based on shortest segment
  const pauseFreeBlocks =
    detectionStrategy === 'per-segment'
      ? detectEffortBlocksWithSegmentGuidance(smoothedPower, zones, flattenedSegments)
      : detectEffortBlocks(smoothedPower, zones, adaptiveParams)

  // Step 9: Match segments to blocks ON PAUSE-FREE TIMELINE
  // This is critical: both planned segments and detected blocks are on the pause-free
  // timeline, so they're aligned and matching works correctly
  const matches = matchSegments(flattenedSegments, pauseFreeBlocks)

  // Step 10: Truncate detected blocks to respect planned segment boundaries
  // This prevents segments with overlapping power targets (e.g., rest + cooldown)
  // from stealing time from each other
  // NOTE: Working on PAUSE-FREE timeline here
  let cumulativeTime = 0
  const adjustedPauseFreeBlocks = pauseFreeBlocks.map((block) => ({ ...block }))

  for (let i = 0; i < flattenedSegments.length; i++) {
    const planned = flattenedSegments[i]!
    const match = matches[i]

    if (match && !match.skipped && match.detected_index !== null) {
      const detectedBlock = adjustedPauseFreeBlocks[match.detected_index]!
      const expectedStart = cumulativeTime
      const expectedEnd = cumulativeTime + planned.duration_sec

      // If the detected block extends significantly beyond the expected end, truncate it
      if (detectedBlock.end_sec > expectedEnd + 30) {
        // Allow 30s tolerance
        const newEnd = expectedEnd + 30
        const truncatedDuration = newEnd - detectedBlock.start_sec

        // Recalculate block statistics for truncated portion
        // Use pause-free power stream for statistics
        const blockPowerData = pauseFreeStream.slice(detectedBlock.start_sec, newEnd)
        const avgPower =
          blockPowerData.length > 0 ? blockPowerData.reduce((a, b) => a + b, 0) / blockPowerData.length : 0
        const maxPower = blockPowerData.length > 0 ? Math.max(...blockPowerData) : 0
        const minPower = blockPowerData.length > 0 ? Math.min(...blockPowerData) : 0

        // Recalculate zone distribution for truncated portion
        const truncatedZoneTimeline = createZoneTimeline(blockPowerData, zones)
        const zoneCounts: Record<number, number> = {}
        for (const zone of truncatedZoneTimeline) {
          zoneCounts[zone] = (zoneCounts[zone] || 0) + 1
        }
        const totalCounts = Object.values(zoneCounts).reduce((a, b) => a + b, 0)
        const zoneDistribution = {
          z1: totalCounts > 0 ? (zoneCounts[1] || 0) / totalCounts : 0,
          z2: totalCounts > 0 ? (zoneCounts[2] || 0) / totalCounts : 0,
          z3: totalCounts > 0 ? (zoneCounts[3] || 0) / totalCounts : 0,
          z4: totalCounts > 0 ? (zoneCounts[4] || 0) / totalCounts : 0,
          z5: totalCounts > 0 ? (zoneCounts[5] || 0) / totalCounts : 0,
        }

        // Find dominant zone
        let dominantZone = 1
        let maxCount = 0
        for (const [zone, count] of Object.entries(zoneCounts)) {
          if (count > maxCount) {
            maxCount = count
            dominantZone = Number(zone)
          }
        }

        adjustedPauseFreeBlocks[match.detected_index] = {
          ...detectedBlock,
          end_sec: newEnd,
          duration_sec: truncatedDuration,
          avg_power: Math.round(avgPower),
          max_power: maxPower,
          min_power: minPower,
          zone_distribution: zoneDistribution,
          dominant_zone: dominantZone,
        }
      }
    }

    cumulativeTime += planned.duration_sec
  }

  // Step 11: Analyze each segment
  // First pass: Determine which segments will use synthetic blocks
  // This prevents circular dependency where we use matched block end times
  // to calculate synthetic block windows
  const willUseSyntheticBlock: boolean[] = []
  for (let i = 0; i < flattenedSegments.length; i++) {
    const p = flattenedSegments[i]!
    const match = matches[i]

    let shouldUseSynthetic = !match || match.skipped || match.detected_index === null

    if (!shouldUseSynthetic && match && match.detected_index !== null) {
      const matchedBlock = adjustedPauseFreeBlocks[match.detected_index]
      if (matchedBlock) {
        const durationRatio = matchedBlock.duration_sec / p.duration_sec
        if (durationRatio < 0.5) {
          // Matched block is less than 50% of planned duration - use synthetic instead
          shouldUseSynthetic = true
        }
      }
    }

    willUseSyntheticBlock.push(shouldUseSynthetic)
  }

  // Second pass: Calculate expected time windows for synthetic block creation
  // Use actual detected end times for GOOD matches, planned times for synthetic blocks
  // NOTE: Still on PAUSE-FREE timeline
  let cumulativeExpectedTime = 0
  const expectedTimeWindows: Array<{ start: number; end: number }> = []
  for (let i = 0; i < flattenedSegments.length; i++) {
    const p = flattenedSegments[i]!
    const match = matches[i]
    const useSynthetic = willUseSyntheticBlock[i]!

    let actualEnd = cumulativeExpectedTime + p.duration_sec

    // Only use detected block end time if it's a GOOD match (not being replaced by synthetic)
    if (!useSynthetic && match && !match.skipped && match.detected_index !== null) {
      const adjustedBlock = adjustedPauseFreeBlocks[match.detected_index]
      if (adjustedBlock) {
        // Use the actual end time from the (possibly truncated) detected block
        actualEnd = adjustedBlock.end_sec
      }
    }
    // For synthetic blocks, use planned duration to calculate end time

    expectedTimeWindows.push({
      start: cumulativeExpectedTime,
      end: Math.min(actualEnd, pauseFreeStream.length), // Cap at end of pause-free stream
    })
    cumulativeExpectedTime = actualEnd
  }

  const segmentAnalyses: SegmentAnalysis[] = flattenedSegments.map((planned, index) => {
    const match = matches.find((m) => m.planned_index === planned.index)
    const shouldUseSyntheticBlock = willUseSyntheticBlock[index]!

    if (shouldUseSyntheticBlock) {
      // No detected block match - create synthetic block from pause-free power data in expected window
      // NOTE: Still on PAUSE-FREE timeline
      const expectedWindow = expectedTimeWindows[index]!
      const syntheticStart = expectedWindow.start
      const syntheticEnd = Math.min(expectedWindow.end, pauseFreeStream.length)
      const syntheticPower = pauseFreeStream.slice(syntheticStart, syntheticEnd)

      if (syntheticPower.length === 0) {
        // Truly skipped - no data available
        return {
          segment_index: planned.index,
          segment_name: planned.name,
          segment_type: planned.type,
          match_quality: 'skipped' as const,
          planned_duration_sec: planned.duration_sec,
          planned_power_low: planned.power_low,
          planned_power_high: planned.power_high,
          planned_zone: planned.target_zone,
          actual_start_sec: null,
          actual_end_sec: null,
          actual_duration_sec: null,
          actual_avg_power: null,
          actual_max_power: null,
          actual_min_power: null,
          actual_dominant_zone: null,
          time_in_zone: null,
          scores: {
            power_compliance: 0,
            zone_compliance: 0,
            duration_compliance: 0,
            overall_segment_score: 0,
          },
          assessment: 'Segment was skipped or not detected',
        }
      }

      // Create synthetic detected block from the expected time window
      const avgPower = syntheticPower.reduce((a, b) => a + b, 0) / syntheticPower.length
      const maxPower = Math.max(...syntheticPower)
      const minPower = Math.min(...syntheticPower)

      const syntheticZoneTimeline = createZoneTimeline(syntheticPower, zones)
      const zoneCounts: Record<number, number> = {}
      for (const zone of syntheticZoneTimeline) {
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1
      }
      const totalCounts = Object.values(zoneCounts).reduce((a, b) => a + b, 0)
      const zoneDistribution = {
        z1: totalCounts > 0 ? (zoneCounts[1] || 0) / totalCounts : 0,
        z2: totalCounts > 0 ? (zoneCounts[2] || 0) / totalCounts : 0,
        z3: totalCounts > 0 ? (zoneCounts[3] || 0) / totalCounts : 0,
        z4: totalCounts > 0 ? (zoneCounts[4] || 0) / totalCounts : 0,
        z5: totalCounts > 0 ? (zoneCounts[5] || 0) / totalCounts : 0,
      }

      let dominantZone = 1
      let maxCount = 0
      for (const [zone, count] of Object.entries(zoneCounts)) {
        if (count > maxCount) {
          maxCount = count
          dominantZone = Number(zone)
        }
      }

      const syntheticDetected: DetectedBlock = {
        start_sec: syntheticStart,
        end_sec: syntheticEnd,
        duration_sec: syntheticEnd - syntheticStart,
        dominant_zone: dominantZone,
        avg_power: Math.round(avgPower),
        max_power: maxPower,
        min_power: minPower,
        zone_distribution: zoneDistribution,
      }

      // Use synthetic block for compliance analysis
      // NOTE: Still on PAUSE-FREE timeline
      var detected: DetectedBlock = syntheticDetected
      // Fall through to compliance calculation below
    } else {
      var detected = adjustedPauseFreeBlocks[match.detected_index]!
    }

    // Calculate compliance scores
    const powerCompliance = calculatePowerCompliance(
      detected.avg_power,
      planned.power_low,
      planned.power_high
    )

    const zoneCompliance = calculateZoneCompliance(
      detected.zone_distribution,
      planned.target_zone,
      planned.power_low_pct,
      planned.power_high_pct
    )

    const durationCompliance = calculateDurationCompliance(
      detected.duration_sec,
      planned.duration_sec
    )

    const overallScore = calculateSegmentScore(
      powerCompliance.score,
      zoneCompliance.score,
      durationCompliance.score,
      planned.type
    )

    // Generate assessment
    const assessments = [
      powerCompliance.assessment,
      zoneCompliance.assessment,
      durationCompliance.assessment,
    ].filter(
      (a) => !a.includes('within target') && !a.includes('matched plan') && !a.includes('Excellent')
    )

    const assessment =
      assessments.length > 0
        ? assessments.join('. ') + '.'
        : 'Segment executed as planned. Great work!'

    return {
      segment_index: planned.index,
      segment_name: planned.name,
      segment_type: planned.type,
      match_quality: getMatchQuality(overallScore),
      planned_duration_sec: planned.duration_sec,
      planned_power_low: planned.power_low,
      planned_power_high: planned.power_high,
      planned_zone: planned.target_zone,
      actual_start_sec: detected.start_sec,
      actual_end_sec: detected.end_sec,
      actual_duration_sec: detected.duration_sec,
      actual_avg_power: detected.avg_power,
      actual_max_power: detected.max_power,
      actual_min_power: detected.min_power,
      actual_dominant_zone: detected.dominant_zone,
      time_in_zone: detected.zone_distribution,
      scores: {
        power_compliance: powerCompliance.score,
        zone_compliance: zoneCompliance.score,
        duration_compliance: durationCompliance.score,
        overall_segment_score: overallScore,
      },
      assessment,
    }
  })

  // Step 12: Map segment times from pause-free timeline to original timeline for display
  // This is the final step - all analysis is done, now we just translate times for the user
  const segmentAnalysesWithOriginalTimes = segmentAnalyses.map((segment) => {
    if (segment.actual_start_sec === null || segment.actual_end_sec === null) {
      // Skipped segment - no mapping needed
      return segment
    }

    // Map pause-free times to original times
    const originalStartSec = indexMapping[segment.actual_start_sec] ?? segment.actual_start_sec
    const originalEndSec = indexMapping[Math.min(segment.actual_end_sec, indexMapping.length - 1)] ?? segment.actual_end_sec

    return {
      ...segment,
      actual_start_sec: originalStartSec,
      actual_end_sec: originalEndSec,
      // Duration remains the same (pause-free duration = actual work duration)
    }
  })

  // Step 13: Calculate overall compliance
  const overall = calculateOverallCompliance(segmentAnalysesWithOriginalTimes)

  // Determine power data quality
  let powerDataQuality: 'good' | 'partial' | 'missing'
  if (powerStream.length === 0) {
    powerDataQuality = 'missing'
  } else if (powerStream.filter((p) => p > 0).length < powerStream.length * 0.8) {
    powerDataQuality = 'partial'
  } else {
    powerDataQuality = 'good'
  }

  return {
    overall,
    segments: segmentAnalysesWithOriginalTimes,
    metadata: {
      algorithm_version: '1.2.0',
      power_data_quality: powerDataQuality,
      adaptive_parameters: adaptiveParams,
      detection_strategy: detectionStrategy,
      detected_pauses: detectedPauses.length > 0 ? detectedPauses : undefined,
    },
  }
}

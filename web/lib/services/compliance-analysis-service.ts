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
    return {
      smoothingWindowSec: 3,
      minSegmentDurationSec: 5,
      boundaryStabilitySec: 3,
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
 * Match planned segments to detected blocks using sliding window
 */
export function matchSegments(
  planned: PlannedSegment[],
  detected: DetectedBlock[],
  minMatchThreshold: number = 50
): SegmentMatch[] {
  const matches: SegmentMatch[] = []
  const usedDetected = new Set<number>()
  let searchStart = 0

  for (const p of planned) {
    let bestMatch: number | null = null
    let bestScore = 0

    // Search window: next 3 detected blocks
    const windowEnd = Math.min(searchStart + 3, detected.length)

    for (let d = searchStart; d < windowEnd; d++) {
      if (usedDetected.has(d)) continue

      const score = calculateMatchSimilarity(p, detected[d]!)

      if (score > bestScore && score >= minMatchThreshold) {
        bestMatch = d
        bestScore = score
      }
    }

    if (bestMatch !== null) {
      matches.push({
        planned_index: p.index,
        detected_index: bestMatch,
        similarity_score: bestScore,
        skipped: false,
      })
      usedDetected.add(bestMatch)
      searchStart = bestMatch + 1
    } else {
      // No match found - segment was skipped
      matches.push({
        planned_index: p.index,
        detected_index: null,
        similarity_score: 0,
        skipped: true,
      })
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
 */
export function calculateZoneCompliance(
  timeInZone: ZoneDistribution,
  targetZone: number
): { score: number; assessment: string } {
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

  // Step 3: Calculate adaptive parameters
  const adaptiveParams = calculateAdaptiveParameters(flattenedSegments)

  // Step 4: Smooth power stream
  const smoothedPower = smoothPowerStream(powerStream, adaptiveParams.smoothingWindowSec)

  // Step 5: Detect effort blocks
  const detectedBlocks = detectEffortBlocks(smoothedPower, zones, adaptiveParams)

  // Step 6: Match segments to blocks
  const matches = matchSegments(flattenedSegments, detectedBlocks)

  // Step 7: Analyze each segment
  const segmentAnalyses: SegmentAnalysis[] = flattenedSegments.map((planned) => {
    const match = matches.find((m) => m.planned_index === planned.index)

    if (!match || match.skipped || match.detected_index === null) {
      // Skipped segment
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

    const detected = detectedBlocks[match.detected_index]!

    // Calculate compliance scores
    const powerCompliance = calculatePowerCompliance(
      detected.avg_power,
      planned.power_low,
      planned.power_high
    )

    const zoneCompliance = calculateZoneCompliance(detected.zone_distribution, planned.target_zone)

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

  // Step 8: Calculate overall compliance
  const overall = calculateOverallCompliance(segmentAnalyses)

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
    segments: segmentAnalyses,
    metadata: {
      algorithm_version: '1.0.0',
      power_data_quality: powerDataQuality,
      adaptive_parameters: adaptiveParams,
    },
  }
}

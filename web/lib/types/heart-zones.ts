/**
 * Heart Rate Zone Definitions
 *
 * Centralized color and configuration for heart rate training zones.
 * Used throughout the application for consistent visualization.
 *
 * Standard 5-zone model based on Max HR percentage:
 * - Z1 (Recovery): 50-60% Max HR
 * - Z2 (Aerobic): 60-70% Max HR
 * - Z3 (Tempo): 70-80% Max HR
 * - Z4 (Threshold): 80-90% Max HR
 * - Z5 (Maximum): 90-100% Max HR
 */

export type HeartZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export interface HeartZoneDefinition {
  /** Zone identifier */
  zone: HeartZone
  /** Zone name */
  name: string
  /** Lower bound (inclusive) as % of Max HR */
  minPct: number
  /** Upper bound (exclusive) as % of Max HR */
  maxPct: number
  /** Hex color for SVG/canvas rendering */
  color: string
  /** Tailwind background class */
  bgClass: string
  /** Tailwind text class */
  textClass: string
  /** Tailwind border class */
  borderClass: string
  /** Training benefit description */
  benefit: string
}

/**
 * Heart rate zone definitions with consistent colors
 *
 * Color scheme follows intensity convention:
 * - Z1: Cool gray for recovery
 * - Z2: Blue for aerobic base
 * - Z3: Green for tempo/endurance
 * - Z4: Amber for threshold
 * - Z5: Red for maximum effort
 */
export const HEART_ZONES: HeartZoneDefinition[] = [
  {
    zone: 'Z1',
    name: 'Recovery',
    minPct: 50,
    maxPct: 60,
    color: '#94A3B8', // slate-400
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-600',
    benefit: 'Active recovery, warm-up',
  },
  {
    zone: 'Z2',
    name: 'Aerobic',
    minPct: 60,
    maxPct: 70,
    color: '#3B82F6', // blue-500
    bgClass: 'bg-blue-100 dark:bg-blue-900/40',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-700',
    benefit: 'Fat burning, endurance base',
  },
  {
    zone: 'Z3',
    name: 'Tempo',
    minPct: 70,
    maxPct: 80,
    color: '#10B981', // emerald-500
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
    benefit: 'Aerobic capacity, efficiency',
  },
  {
    zone: 'Z4',
    name: 'Threshold',
    minPct: 80,
    maxPct: 90,
    color: '#F59E0B', // amber-500
    bgClass: 'bg-amber-100 dark:bg-amber-900/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-700',
    benefit: 'Lactate threshold, race pace',
  },
  {
    zone: 'Z5',
    name: 'Maximum',
    minPct: 90,
    maxPct: 100,
    color: '#EF4444', // red-500
    bgClass: 'bg-red-100 dark:bg-red-900/40',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-300 dark:border-red-700',
    benefit: 'VO2max, peak performance',
  },
]

/**
 * Get zone definition from heart rate percentage of max HR
 */
export function getHeartZoneFromPct(hrPct: number): HeartZoneDefinition {
  for (const zone of HEART_ZONES) {
    if (hrPct < zone.maxPct) {
      return zone
    }
  }
  // Default to Z5 if at or above 100%
  return HEART_ZONES[4]!
}

/**
 * Get zone label (Z1-Z5) from heart rate percentage
 */
export function getHeartZoneLabel(hrPct: number): HeartZone {
  return getHeartZoneFromPct(hrPct).zone
}

/**
 * Get hex color for heart rate percentage (for SVG/canvas)
 */
export function getHeartZoneColor(hrPct: number): string {
  return getHeartZoneFromPct(hrPct).color
}

/**
 * Get zone definition by zone label
 */
export function getHeartZoneByLabel(zone: HeartZone): HeartZoneDefinition {
  const found = HEART_ZONES.find((z) => z.zone === zone)
  return found ?? HEART_ZONES[0]!
}

/**
 * Zone with calculated BPM range based on Max HR
 */
export interface HeartZoneWithBpm extends HeartZoneDefinition {
  /** Lower bound in BPM */
  minBpm: number
  /** Upper bound in BPM */
  maxBpm: number
}

/**
 * Calculate heart rate zones with actual BPM ranges based on Max HR
 */
export function calculateZonesForMaxHr(maxHr: number): HeartZoneWithBpm[] {
  return HEART_ZONES.map((zone) => ({
    ...zone,
    minBpm: Math.round((zone.minPct / 100) * maxHr),
    maxBpm: Math.round((zone.maxPct / 100) * maxHr),
  }))
}

/**
 * Calculate heart rate zones using Karvonen formula (Heart Rate Reserve)
 * More accurate when resting HR is known
 */
export function calculateZonesWithHrReserve(maxHr: number, restingHr: number): HeartZoneWithBpm[] {
  const hrReserve = maxHr - restingHr

  return HEART_ZONES.map((zone) => ({
    ...zone,
    minBpm: Math.round(restingHr + (zone.minPct / 100) * hrReserve),
    maxBpm: Math.round(restingHr + (zone.maxPct / 100) * hrReserve),
  }))
}

/**
 * Custom zone percentages that can be stored per user
 */
export interface CustomHeartZoneConfig {
  zone: HeartZone
  minPct: number
  maxPct: number
}

/**
 * Calculate zones with custom percentage thresholds
 */
export function calculateCustomHeartZonesForMaxHr(
  maxHr: number,
  customZones: CustomHeartZoneConfig[]
): HeartZoneWithBpm[] {
  return customZones.map((custom) => {
    const baseZone = HEART_ZONES.find((z) => z.zone === custom.zone) ?? HEART_ZONES[0]!
    return {
      ...baseZone,
      minPct: custom.minPct,
      maxPct: custom.maxPct,
      minBpm: Math.round((custom.minPct / 100) * maxHr),
      maxBpm: Math.round((custom.maxPct / 100) * maxHr),
    }
  })
}

/**
 * Power Zone Definitions
 *
 * Centralized color and configuration for cycling power zones.
 * Used throughout the application for consistent visualization.
 *
 * Standard 6-zone model based on FTP percentage:
 * - Z1 (Active Recovery): <56% FTP
 * - Z2 (Endurance): 56-75% FTP
 * - Z3 (Tempo): 76-90% FTP
 * - Z4 (Threshold): 91-105% FTP
 * - Z5 (VO2max): 106-120% FTP
 * - Z6 (Anaerobic): >120% FTP
 */

export type PowerZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'Z6'

export interface ZoneDefinition {
  /** Zone identifier */
  zone: PowerZone
  /** Zone name */
  name: string
  /** Lower bound (inclusive) as % of FTP */
  minPct: number
  /** Upper bound (exclusive) as % of FTP, null for Z6 (no upper limit) */
  maxPct: number | null
  /** Hex color for SVG/canvas rendering */
  color: string
  /** Tailwind background class */
  bgClass: string
  /** Tailwind text class */
  textClass: string
  /** Tailwind border class */
  borderClass: string
}

/**
 * Power zone definitions with consistent colors
 *
 * Color scheme follows cycling convention:
 * - Z1/Z2: Cool colors (gray, blue) for recovery/endurance
 * - Z3: Warm transition (green/teal) for tempo
 * - Z4: Warm (yellow/amber) for threshold
 * - Z5: Hot (orange) for VO2max
 * - Z6: Intense (red) for anaerobic
 */
export const POWER_ZONES: ZoneDefinition[] = [
  {
    zone: 'Z1',
    name: 'Active Recovery',
    minPct: 0,
    maxPct: 56,
    color: '#94A3B8', // slate-400
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-600',
  },
  {
    zone: 'Z2',
    name: 'Endurance',
    minPct: 56,
    maxPct: 76,
    color: '#3B82F6', // blue-500
    bgClass: 'bg-blue-100 dark:bg-blue-900/40',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-700',
  },
  {
    zone: 'Z3',
    name: 'Tempo',
    minPct: 76,
    maxPct: 90,
    color: '#10B981', // emerald-500
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
  },
  {
    zone: 'Z4',
    name: 'Threshold',
    minPct: 90,
    maxPct: 105,
    color: '#F59E0B', // amber-500
    bgClass: 'bg-amber-100 dark:bg-amber-900/40',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-700',
  },
  {
    zone: 'Z5',
    name: 'VO2max',
    minPct: 105,
    maxPct: 120,
    color: '#F97316', // orange-500
    bgClass: 'bg-orange-100 dark:bg-orange-900/40',
    textClass: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-orange-300 dark:border-orange-700',
  },
  {
    zone: 'Z6',
    name: 'Anaerobic',
    minPct: 120,
    maxPct: null,
    color: '#EF4444', // red-500
    bgClass: 'bg-red-100 dark:bg-red-900/40',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-300 dark:border-red-700',
  },
]

/**
 * Get zone definition from power percentage
 */
export function getZoneFromPower(powerPct: number): ZoneDefinition {
  for (const zone of POWER_ZONES) {
    if (zone.maxPct === null || powerPct < zone.maxPct) {
      return zone
    }
  }
  // Default to Z6 if somehow above all thresholds (Z6 is index 5)
  return POWER_ZONES[5]!
}

/**
 * Get zone label (Z1-Z6) from power percentage
 */
export function getPowerZoneLabel(powerPct: number): PowerZone {
  return getZoneFromPower(powerPct).zone
}

/**
 * Get hex color for power percentage (for SVG/canvas)
 */
export function getPowerZoneColor(powerPct: number): string {
  return getZoneFromPower(powerPct).color
}

/**
 * Get zone definition by zone label
 */
export function getZoneByLabel(zone: PowerZone): ZoneDefinition {
  const found = POWER_ZONES.find((z) => z.zone === zone)
  // Safe assertion: POWER_ZONES always has Z1, and if zone is valid it will be found
  return found ?? POWER_ZONES[0]!
}

/**
 * Calculate zone from average of low and high power percentages
 */
export function getZoneFromPowerRange(lowPct: number, highPct: number): ZoneDefinition {
  const avgPct = (lowPct + highPct) / 2
  return getZoneFromPower(avgPct)
}

/**
 * Get hex color from power range (for SVG/canvas)
 */
export function getPowerRangeColor(lowPct: number, highPct: number): string {
  return getZoneFromPowerRange(lowPct, highPct).color
}

/**
 * Zone with calculated wattage range based on FTP
 */
export interface ZoneWithWattage extends ZoneDefinition {
  /** Lower bound in watts */
  minWatts: number
  /** Upper bound in watts (null for Z6) */
  maxWatts: number | null
}

/**
 * Calculate power zones with actual wattage ranges based on FTP
 */
export function calculateZonesForFtp(ftp: number): ZoneWithWattage[] {
  return POWER_ZONES.map((zone) => ({
    ...zone,
    minWatts: Math.round((zone.minPct / 100) * ftp),
    maxWatts: zone.maxPct !== null ? Math.round((zone.maxPct / 100) * ftp) : null,
  }))
}

/**
 * Custom zone percentages that can be stored per user
 */
export interface CustomZoneConfig {
  zone: PowerZone
  minPct: number
  maxPct: number | null
}

/**
 * Calculate zones with custom percentage thresholds
 */
export function calculateCustomZonesForFtp(
  ftp: number,
  customZones: CustomZoneConfig[]
): ZoneWithWattage[] {
  return customZones.map((custom) => {
    const baseZone = POWER_ZONES.find((z) => z.zone === custom.zone) ?? POWER_ZONES[0]!
    return {
      ...baseZone,
      minPct: custom.minPct,
      maxPct: custom.maxPct,
      minWatts: Math.round((custom.minPct / 100) * ftp),
      maxWatts: custom.maxPct !== null ? Math.round((custom.maxPct / 100) * ftp) : null,
    }
  })
}

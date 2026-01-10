/**
 * Activity & Workout Styles Library
 *
 * Single source of truth for all activity and workout styling across the application.
 * Provides consistent colors, icons, and helper functions for:
 * - Activity types (from Strava)
 * - Workout intensity levels
 * - Compliance status indicators
 *
 * @see Issue #50 - Create shared Activity & Workout Styles Library
 */

import type { ReactElement } from 'react'
import {
  Bike,
  Monitor,
  PersonStanding,
  Waves,
  Mountain,
  Dumbbell,
  Zap,
  TrendingUp,
  Snowflake,
  Ship,
  Wind,
  Activity,
  Trophy,
  Target,
  Flag,
  User,
  type LucideIcon,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

/**
 * Available icon sizes
 * - xs: 12px (h-3 w-3) - Used in compact views like calendar cells
 * - sm: 16px (h-4 w-4) - Default size for lists
 * - md: 20px (h-5 w-5) - Medium emphasis
 * - lg: 24px (h-6 w-6) - Large emphasis
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg'

/**
 * Workout intensity types matching training plan definitions
 */
export type WorkoutIntensityType =
  | 'endurance'
  | 'tempo'
  | 'sweet_spot'
  | 'threshold'
  | 'vo2max'
  | 'recovery'
  | 'rest'
  | 'mixed'

/**
 * Compliance status based on actual vs planned workout metrics
 */
export type ComplianceStatus =
  | 'on_target' // 90-110%
  | 'slightly_under' // 75-89%
  | 'slightly_over' // 110-130%
  | 'significantly_under' // <75%
  | 'significantly_over' // >130%
  | 'missed' // No activity recorded
  | 'future' // Not yet due

/**
 * Power zone number (1-5 standard model)
 */
export type PowerZone = 1 | 2 | 3 | 4 | 5

/**
 * Workout segment types for interval visualization
 */
export type SegmentType =
  | 'warmup'
  | 'work'
  | 'interval'
  | 'recovery'
  | 'cooldown'
  | 'steady'
  | 'tempo'

/**
 * Workout intensity levels for badge styling
 */
export type IntensityLevel = 'easy' | 'moderate' | 'hard' | 'very_hard'

// ============================================================================
// Icon Size Mapping
// ============================================================================

const ICON_SIZE_MAP: Record<IconSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

// ============================================================================
// Activity Icon Mapping
// ============================================================================

/**
 * Maps Strava sport types to Lucide icons
 */
export const ACTIVITY_ICON_MAP: Record<string, LucideIcon> = {
  // Cycling
  Ride: Bike,
  VirtualRide: Monitor,
  EBikeRide: Zap,
  EMountainBikeRide: Zap,
  GravelRide: Mountain,
  MountainBikeRide: Mountain,

  // Running
  Run: PersonStanding,
  VirtualRun: PersonStanding,
  TrailRun: PersonStanding,

  // Swimming
  Swim: Waves,

  // Walking/Hiking
  Walk: PersonStanding,
  Hike: Mountain,

  // Winter Sports
  AlpineSki: Snowflake,
  BackcountrySki: Snowflake,
  NordicSki: Snowflake,
  Snowboard: Snowflake,
  Snowshoe: Snowflake,
  IceSkate: Snowflake,

  // Water Sports
  Kayaking: Ship,
  Canoeing: Ship,
  Rowing: Ship,
  StandUpPaddling: Ship,
  Surfing: Waves,
  Kitesurf: Ship,
  Windsurf: Ship,

  // Strength & Fitness
  WeightTraining: Dumbbell,
  Workout: Activity,
  CrossFit: Activity,
  HIIT: Activity,
  Yoga: User,
  Pilates: User,

  // Indoor Cardio
  Elliptical: TrendingUp,
  StairStepper: TrendingUp,

  // Skating
  InlineSkate: Wind,
  RollerSki: Wind,

  // Climbing
  RockClimbing: Mountain,

  // Sports
  Golf: Flag,
  Tennis: Target,
  Badminton: Target,
  Squash: Target,
  Soccer: Trophy,
  Football: Trophy,
  Basketball: Trophy,
  Baseball: Trophy,
  Softball: Trophy,
  Hockey: Trophy,
  IceHockey: Trophy,
  Rugby: Trophy,
  Volleyball: Trophy,
}

// ============================================================================
// Activity Color Mapping
// ============================================================================

/**
 * Maps Strava sport types to Tailwind CSS classes
 * Includes background, hover, and border colors
 */
export const ACTIVITY_COLORS: Record<string, string> = {
  // Cycling - Blue shades
  Ride: 'bg-blue-100/80 hover:bg-blue-200/80 border-blue-200',
  VirtualRide: 'bg-blue-50/80 hover:bg-blue-100/80 border-blue-100',
  EBikeRide: 'bg-violet-100/80 hover:bg-violet-200/80 border-violet-200',
  EMountainBikeRide: 'bg-violet-100/80 hover:bg-violet-200/80 border-violet-200',
  GravelRide: 'bg-blue-200/80 hover:bg-blue-300/80 border-blue-300',
  MountainBikeRide: 'bg-blue-200/80 hover:bg-blue-300/80 border-blue-300',

  // Running - Orange shades
  Run: 'bg-orange-100/80 hover:bg-orange-200/80 border-orange-200',
  VirtualRun: 'bg-orange-50/80 hover:bg-orange-100/80 border-orange-100',
  TrailRun: 'bg-amber-100/80 hover:bg-amber-200/80 border-amber-200',

  // Swimming - Cyan
  Swim: 'bg-cyan-100/80 hover:bg-cyan-200/80 border-cyan-200',

  // Walking/Hiking - Green shades
  Walk: 'bg-green-100/80 hover:bg-green-200/80 border-green-200',
  Hike: 'bg-emerald-100/80 hover:bg-emerald-200/80 border-emerald-200',

  // Winter Sports - Sky/ice blue
  AlpineSki: 'bg-sky-100/80 hover:bg-sky-200/80 border-sky-200',
  BackcountrySki: 'bg-sky-100/80 hover:bg-sky-200/80 border-sky-200',
  NordicSki: 'bg-sky-100/80 hover:bg-sky-200/80 border-sky-200',
  Snowboard: 'bg-sky-200/80 hover:bg-sky-300/80 border-sky-300',
  Snowshoe: 'bg-sky-50/80 hover:bg-sky-100/80 border-sky-100',
  IceSkate: 'bg-indigo-100/80 hover:bg-indigo-200/80 border-indigo-200',

  // Water Sports - Teal/Cyan
  Kayaking: 'bg-teal-100/80 hover:bg-teal-200/80 border-teal-200',
  Canoeing: 'bg-teal-100/80 hover:bg-teal-200/80 border-teal-200',
  Rowing: 'bg-teal-200/80 hover:bg-teal-300/80 border-teal-300',
  StandUpPaddling: 'bg-cyan-200/80 hover:bg-cyan-300/80 border-cyan-300',
  Surfing: 'bg-cyan-200/80 hover:bg-cyan-300/80 border-cyan-300',
  Kitesurf: 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-100',
  Windsurf: 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-100',

  // Strength - Purple
  WeightTraining: 'bg-purple-100/80 hover:bg-purple-200/80 border-purple-200',
  Workout: 'bg-purple-200/80 hover:bg-purple-300/80 border-purple-300',
  CrossFit: 'bg-purple-200/80 hover:bg-purple-300/80 border-purple-300',
  HIIT: 'bg-purple-200/80 hover:bg-purple-300/80 border-purple-300',
  Yoga: 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-100',
  Pilates: 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-100',

  // Indoor Cardio - Rose
  Elliptical: 'bg-rose-100/80 hover:bg-rose-200/80 border-rose-200',
  StairStepper: 'bg-rose-100/80 hover:bg-rose-200/80 border-rose-200',

  // Skating - Indigo
  InlineSkate: 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-100',
  RollerSki: 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-100',

  // Climbing - Stone
  RockClimbing: 'bg-stone-200/80 hover:bg-stone-300/80 border-stone-300',

  // Sports
  Golf: 'bg-lime-100/80 hover:bg-lime-200/80 border-lime-200',
  Tennis: 'bg-yellow-100/80 hover:bg-yellow-200/80 border-yellow-200',
  Badminton: 'bg-yellow-100/80 hover:bg-yellow-200/80 border-yellow-200',
  Squash: 'bg-yellow-100/80 hover:bg-yellow-200/80 border-yellow-200',
  Soccer: 'bg-red-100/80 hover:bg-red-200/80 border-red-200',
  Football: 'bg-red-100/80 hover:bg-red-200/80 border-red-200',
  Basketball: 'bg-red-100/80 hover:bg-red-200/80 border-red-200',
  Baseball: 'bg-red-50/80 hover:bg-red-100/80 border-red-100',
  Softball: 'bg-red-50/80 hover:bg-red-100/80 border-red-100',
  Hockey: 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200',
  IceHockey: 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200',
  Rugby: 'bg-red-200/80 hover:bg-red-300/80 border-red-300',
  Volleyball: 'bg-red-200/80 hover:bg-red-300/80 border-red-300',
}

const DEFAULT_ACTIVITY_COLOR = 'bg-gray-100/80 hover:bg-gray-200/80 border-gray-200'

// ============================================================================
// Workout Intensity Color Mapping
// ============================================================================

/**
 * Maps workout intensity types to Tailwind CSS classes
 * Includes dark mode support
 */
export const WORKOUT_INTENSITY_COLORS: Record<WorkoutIntensityType, string> = {
  endurance:
    'bg-green-100/80 hover:bg-green-200/80 border-green-200 dark:bg-green-900/30 dark:border-green-800',
  tempo:
    'bg-yellow-100/80 hover:bg-yellow-200/80 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800',
  sweet_spot:
    'bg-amber-100/80 hover:bg-amber-200/80 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800',
  threshold:
    'bg-orange-100/80 hover:bg-orange-200/80 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800',
  vo2max: 'bg-red-100/80 hover:bg-red-200/80 border-red-200 dark:bg-red-900/30 dark:border-red-800',
  recovery:
    'bg-blue-100/80 hover:bg-blue-200/80 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800',
  rest: 'bg-gray-100/80 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700',
  mixed:
    'bg-purple-100/80 hover:bg-purple-200/80 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800',
}

// ============================================================================
// Compliance Color Mapping
// ============================================================================

/**
 * Maps compliance status to Tailwind CSS classes
 * Used for workout card borders to indicate completion status
 */
export const COMPLIANCE_COLORS: Record<ComplianceStatus, string> = {
  on_target: 'bg-green-50 border-green-400 ring-green-500/50',
  slightly_under: 'bg-yellow-50 border-yellow-400 ring-yellow-500/50',
  slightly_over: 'bg-yellow-50 border-yellow-400 ring-yellow-500/50',
  significantly_under: 'bg-red-50 border-red-400 ring-red-500/50',
  significantly_over: 'bg-red-50 border-red-400 ring-red-500/50',
  missed: 'bg-red-100 border-red-500 ring-red-600/50',
  future: 'bg-gray-50 border-gray-300',
}

// ============================================================================
// Power Zone Color Mapping
// ============================================================================

/**
 * Maps power zones to Tailwind CSS background classes
 * Used for zone distribution visualization in compliance analysis
 *
 * Zone model:
 * - Z1: Active Recovery (blue)
 * - Z2: Endurance (green)
 * - Z3: Tempo (yellow)
 * - Z4: Threshold (orange)
 * - Z5: VO2max (red)
 */
export const POWER_ZONE_COLORS: Record<PowerZone, string> = {
  1: 'bg-blue-400',
  2: 'bg-green-400',
  3: 'bg-yellow-400',
  4: 'bg-orange-400',
  5: 'bg-red-400',
}

// ============================================================================
// Segment Type Color Mapping
// ============================================================================

/**
 * Maps segment types to Tailwind CSS background classes
 * Used for workout segment indicators in compliance analysis
 */
export const SEGMENT_TYPE_COLORS: Record<SegmentType, string> = {
  warmup: 'bg-blue-500',
  work: 'bg-red-500',
  interval: 'bg-red-500',
  recovery: 'bg-green-500',
  cooldown: 'bg-blue-500',
  steady: 'bg-yellow-500',
  tempo: 'bg-orange-500',
}

const DEFAULT_SEGMENT_COLOR = 'bg-gray-400'

// ============================================================================
// Intensity Badge Color Mapping
// ============================================================================

/**
 * Maps intensity levels to badge styling
 * Includes dark mode support
 */
export const INTENSITY_BADGE_COLORS: Record<IntensityLevel, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  very_hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ============================================================================
// Workout Border Color Mapping (for left-border styling)
// ============================================================================

/**
 * Maps workout intensity types to left-border Tailwind CSS classes
 * Used for workout cards with accent left borders
 */
export const WORKOUT_BORDER_COLORS: Record<WorkoutIntensityType, string> = {
  endurance: 'border-l-green-500',
  tempo: 'border-l-yellow-500',
  sweet_spot: 'border-l-amber-500',
  threshold: 'border-l-orange-500',
  vo2max: 'border-l-red-500',
  recovery: 'border-l-blue-500',
  rest: 'border-l-gray-500',
  mixed: 'border-l-purple-500',
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns a Lucide icon element for the given sport type
 *
 * @param sportType - Strava sport type (e.g., 'Ride', 'Run', 'Swim')
 * @param size - Icon size: 'xs' | 'sm' | 'md' | 'lg' (default: 'sm')
 * @returns JSX.Element - Rendered Lucide icon
 *
 * @example
 * ```tsx
 * // Default size (sm = h-4 w-4)
 * {getActivityIcon('Ride')}
 *
 * // Smaller size for compact views
 * {getActivityIcon('Run', 'xs')}
 *
 * // Larger size for emphasis
 * {getActivityIcon('Swim', 'lg')}
 * ```
 */
export function getActivityIcon(sportType: string, size: IconSize = 'sm'): ReactElement {
  const IconComponent = ACTIVITY_ICON_MAP[sportType] || Activity
  const sizeClass = ICON_SIZE_MAP[size]
  return <IconComponent className={`${sizeClass} flex-shrink-0`} strokeWidth={2} />
}

/**
 * Returns Tailwind CSS classes for activity styling
 *
 * @param sportType - Strava sport type (e.g., 'Ride', 'Run', 'Swim')
 * @returns string - Tailwind CSS classes for background, hover, and border
 *
 * @example
 * ```tsx
 * <div className={`rounded-lg border ${getActivityColors('Ride')}`}>
 *   Activity card content
 * </div>
 * ```
 */
export function getActivityColors(sportType: string): string {
  return ACTIVITY_COLORS[sportType] || DEFAULT_ACTIVITY_COLOR
}

/**
 * Returns Tailwind CSS classes for workout intensity styling
 *
 * @param type - Workout intensity type (e.g., 'endurance', 'threshold', 'vo2max')
 * @returns string - Tailwind CSS classes with dark mode support
 *
 * @example
 * ```tsx
 * <div className={`rounded-lg border ${getWorkoutIntensityColors('threshold')}`}>
 *   Workout card content
 * </div>
 * ```
 */
export function getWorkoutIntensityColors(type: string): string {
  if (type in WORKOUT_INTENSITY_COLORS) {
    return WORKOUT_INTENSITY_COLORS[type as WorkoutIntensityType]
  }
  return WORKOUT_INTENSITY_COLORS.mixed
}

/**
 * Determines compliance status from a percentage value
 *
 * @param percentage - Actual percentage of planned workout (null if missed)
 * @param isFuture - Whether the workout is scheduled for the future
 * @returns ComplianceStatus - Categorized compliance status
 *
 * Compliance ranges:
 * - on_target: 90-110%
 * - slightly_under: 75-89%
 * - slightly_over: 110-130%
 * - significantly_under: <75%
 * - significantly_over: >130%
 * - missed: null percentage (past workout with no activity)
 * - future: not yet due
 */
export function getComplianceStatus(
  percentage: number | null,
  isFuture?: boolean
): ComplianceStatus {
  if (isFuture) return 'future'
  if (percentage === null) return 'missed'
  if (percentage >= 90 && percentage <= 110) return 'on_target'
  if (percentage >= 75 && percentage < 90) return 'slightly_under'
  if (percentage > 110 && percentage <= 130) return 'slightly_over'
  if (percentage < 75) return 'significantly_under'
  return 'significantly_over'
}

/**
 * Returns Tailwind CSS classes based on activity compliance percentage
 *
 * @param percentage - Actual percentage of planned workout (null if missed)
 * @param isFuture - Whether the workout is scheduled for the future
 * @returns string - Tailwind CSS classes for compliance indication
 *
 * @example
 * ```tsx
 * // On target (95%)
 * <div className={`border ${getComplianceColors(95)}`}>...</div>
 *
 * // Missed workout
 * <div className={`border ${getComplianceColors(null)}`}>...</div>
 *
 * // Future workout
 * <div className={`border ${getComplianceColors(null, true)}`}>...</div>
 * ```
 */
export function getComplianceColors(percentage: number | null, isFuture?: boolean): string {
  const status = getComplianceStatus(percentage, isFuture)
  return COMPLIANCE_COLORS[status]
}

/**
 * Returns Tailwind CSS class for a power zone
 *
 * @param zone - Power zone number (1-5)
 * @returns string - Tailwind CSS background class
 *
 * @example
 * ```tsx
 * <div className={getPowerZoneColor(3)}>Zone 3</div>
 * // Returns: "bg-yellow-400"
 * ```
 */
export function getPowerZoneColor(zone: number): string {
  if (zone >= 1 && zone <= 5) {
    return POWER_ZONE_COLORS[zone as PowerZone]
  }
  return 'bg-gray-400'
}

/**
 * Returns Tailwind CSS class for a workout segment type
 *
 * @param segmentType - Type of workout segment
 * @returns string - Tailwind CSS background class
 *
 * @example
 * ```tsx
 * <div className={getSegmentTypeColor('warmup')}>Warmup</div>
 * // Returns: "bg-blue-500"
 * ```
 */
export function getSegmentTypeColor(segmentType: string): string {
  if (segmentType in SEGMENT_TYPE_COLORS) {
    return SEGMENT_TYPE_COLORS[segmentType as SegmentType]
  }
  return DEFAULT_SEGMENT_COLOR
}

/**
 * Returns Tailwind CSS classes for intensity level badges
 *
 * @param intensity - Intensity level string
 * @returns string - Tailwind CSS classes for badge styling
 *
 * @example
 * ```tsx
 * <Badge className={getIntensityBadgeColors('hard')}>Hard</Badge>
 * // Returns: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
 * ```
 */
export function getIntensityBadgeColors(intensity: string): string {
  if (intensity in INTENSITY_BADGE_COLORS) {
    return INTENSITY_BADGE_COLORS[intensity as IntensityLevel]
  }
  return INTENSITY_BADGE_COLORS.moderate
}

/**
 * Returns Tailwind CSS class for workout left-border styling
 *
 * @param type - Workout intensity type
 * @returns string - Tailwind CSS border-left class
 *
 * @example
 * ```tsx
 * <div className={`border-l-4 ${getWorkoutBorderColor('threshold')}`}>
 *   Workout card
 * </div>
 * // Returns: "border-l-orange-500"
 * ```
 */
export function getWorkoutBorderColor(type: string): string {
  if (type in WORKOUT_BORDER_COLORS) {
    return WORKOUT_BORDER_COLORS[type as WorkoutIntensityType]
  }
  return WORKOUT_BORDER_COLORS.mixed
}

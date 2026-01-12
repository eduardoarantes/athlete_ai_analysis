'use client'

/**
 * Reusable Workout Detail Popup Component
 *
 * A configurable component for displaying workout details in either a modal or inline format.
 * Each section (description, structure, stats, power profile) can be individually enabled/disabled.
 *
 * Usage:
 * - As a modal: <WorkoutDetailPopup open={true} onOpenChange={setOpen} ... />
 * - As inline content: <WorkoutDetailPopup asInline={true} ... />
 */

import { Clock, Zap, Activity } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type WorkoutStructure,
  formatDuration,
  calculateWorkoutDuration,
  hasValidStructure,
} from '@/lib/types/training-plan'
import { getStructureWorkTime } from '@/lib/utils/workout-structure-helpers'
import { WorkoutStructureDisplay } from '@/components/workout/workout-structure-display'
import { PowerProfileSVG } from '@/components/training/power-profile-svg'
import { cn } from '@/lib/utils'

/**
 * Configuration for which sections to display
 */
export interface WorkoutDetailSectionConfig {
  /** Show workout type and intensity badges */
  showBadges?: boolean
  /** Show duration, TSS, and work time stats */
  showStats?: boolean
  /** Show workout description */
  showDescription?: boolean
  /** Show power profile visualization */
  showPowerProfile?: boolean
  /** Show workout structure details */
  showStructure?: boolean
  /** Show week number and weekday info */
  showWeekInfo?: boolean
  /** Show suitable phases (library workouts only) */
  showSuitablePhases?: boolean
}

/**
 * Base workout data that works with both Workout and WorkoutLibraryItem
 */
export interface BaseWorkoutData {
  name: string
  type?: string
  intensity?: string
  description?: string
  detailed_description?: string
  structure?: WorkoutStructure
  tss?: number | null
  base_duration_min?: number
  base_tss?: number
  suitable_phases?: string[]
  weekday?: string
}

export interface WorkoutDetailPopupProps {
  /** The workout data (can be Workout or WorkoutLibraryItem) */
  workout: BaseWorkoutData | null
  /** Week number (optional, for context) */
  weekNumber?: number
  /** FTP for power profile visualization */
  ftp?: number
  /** Control modal open state (required if not asInline) */
  open?: boolean
  /** Callback when modal state changes (required if not asInline) */
  onOpenChange?: ((open: boolean) => void) | undefined
  /** Configuration for which sections to show */
  sections?: WorkoutDetailSectionConfig
  /** Render as inline content instead of modal */
  asInline?: boolean
  /** Additional className for container */
  className?: string
  /** Additional content to render (e.g., activity matching) */
  children?: React.ReactNode
}

/**
 * Default section configuration - all sections enabled
 */
const DEFAULT_SECTIONS: WorkoutDetailSectionConfig = {
  showBadges: true,
  showStats: true,
  showDescription: true,
  showPowerProfile: true,
  showStructure: true,
  showWeekInfo: false,
  showSuitablePhases: false,
}

/**
 * Format workout type for display
 */
function formatType(type: string): string {
  const labels: Record<string, string> = {
    endurance: 'Endurance',
    tempo: 'Tempo',
    sweet_spot: 'Sweet Spot',
    threshold: 'Threshold',
    vo2max: 'VO2max',
    recovery: 'Recovery',
    mixed: 'Mixed',
  }
  return labels[type] ?? type
}

/**
 * Format intensity for display
 */
function formatIntensity(intensity: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    moderate: 'Moderate',
    hard: 'Hard',
    very_hard: 'Very Hard',
  }
  return labels[intensity] ?? intensity
}

/**
 * Internal component that renders the workout details
 */
function WorkoutDetailContent({
  workout,
  ftp,
  sections = DEFAULT_SECTIONS,
  children,
}: {
  workout: BaseWorkoutData
  ftp?: number
  sections: WorkoutDetailSectionConfig
  children?: React.ReactNode
}) {
  const config = { ...DEFAULT_SECTIONS, ...sections }

  // Calculate metrics
  const totalDuration =
    workout.base_duration_min ??
    (workout.structure ? calculateWorkoutDuration({ structure: workout.structure } as any) : 0)
  const workTime = workout.structure ? getStructureWorkTime(workout.structure) : 0
  const tss = workout.base_tss ?? workout.tss

  const hasDescription = (workout.detailed_description || workout.description)?.trim()
  const hasPowerProfile = ftp && hasValidStructure(workout.structure)
  const hasStructure = hasValidStructure(workout.structure)

  return (
    <div className="space-y-4">
      {/* Inline Stats - shown at top if enabled */}
      {config.showStats && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{formatDuration(totalDuration)}</span>
          </div>
          {workTime > 0 && (
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Work:</span>
              <span className="font-medium">{formatDuration(workTime)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{tss != null ? Math.round(tss) : 'N/A'} TSS</span>
          </div>
          {config.showSuitablePhases &&
            workout.suitable_phases &&
            workout.suitable_phases.length > 0 && (
              <span className="text-xs text-muted-foreground/75">
                {workout.suitable_phases.slice(0, 2).join(', ')}
                {workout.suitable_phases.length > 2 && '...'}
              </span>
            )}
        </div>
      )}

      {/* Workout Description */}
      {config.showDescription && hasDescription && (
        <Card className="gap-1 py-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {workout.detailed_description || workout.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Power Profile Visualization */}
      {config.showPowerProfile && hasPowerProfile && (
        <Card className="gap-1 py-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium">Power Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <PowerProfileSVG structure={workout.structure!} ftp={ftp!} />
          </CardContent>
        </Card>
      )}

      {/* Custom children (e.g., activity matching) */}
      {children}

      {/* Workout Structure */}
      {config.showStructure && hasStructure && (
        <Card className="gap-1 py-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium">Workout Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutStructureDisplay structure={workout.structure!} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Main WorkoutDetailPopup Component
 *
 * Can be used as:
 * 1. A modal dialog (default)
 * 2. Inline content (set asInline={true})
 */
export function WorkoutDetailPopup({
  workout,
  weekNumber,
  ftp = 200,
  open = false,
  onOpenChange,
  sections = DEFAULT_SECTIONS,
  asInline = false,
  className,
  children,
}: WorkoutDetailPopupProps) {
  const config = { ...DEFAULT_SECTIONS, ...sections }

  if (!workout) return null

  // Inline mode - just render the content
  if (asInline) {
    return (
      <div className={cn('space-y-3', className)}>
        <WorkoutDetailContent workout={workout} ftp={ftp} sections={config}>
          {children}
        </WorkoutDetailContent>
      </div>
    )
  }

  // Modal mode
  const dialogProps = onOpenChange ? { open, onOpenChange } : { open }

  return (
    <Dialog {...dialogProps}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <DialogTitle className="text-lg">{workout.name}</DialogTitle>
            {config.showBadges && (
              <>
                {workout.type && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {formatType(workout.type)}
                  </Badge>
                )}
                {workout.intensity && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {formatIntensity(workout.intensity)}
                  </Badge>
                )}
              </>
            )}
          </div>
          {config.showWeekInfo && (weekNumber || workout.weekday) && (
            <DialogDescription className="text-xs">
              {weekNumber && `Week ${weekNumber}`}
              {weekNumber && workout.weekday && ' • '}
              {workout.weekday}
            </DialogDescription>
          )}
        </DialogHeader>

        <WorkoutDetailContent workout={workout} ftp={ftp} sections={config}>
          {children}
        </WorkoutDetailContent>
      </DialogContent>
    </Dialog>
  )
}

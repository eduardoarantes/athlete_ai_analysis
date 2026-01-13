/**
 * WorkoutStructure Display Component
 *
 * Reusable component for displaying workout structure with proper grouping
 * for single steps, 2-step intervals, and multi-step intervals.
 *
 * Supports the full WorkoutStructure format (Issue #96/97).
 */

import { Badge } from '@/components/ui/badge'
import type {
  WorkoutStructure,
  StructuredWorkoutSegment,
  WorkoutStep,
} from '@/lib/types/training-plan'
import { convertStepLengthToMinutes, extractPowerTarget } from '@/lib/types/training-plan'

interface WorkoutStructureDisplayProps {
  structure: WorkoutStructure
  className?: string
}

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60)
    return `${seconds}s`
  }
  if (minutes % 1 === 0) {
    return `${minutes}min`
  }
  return `${minutes.toFixed(1)}min`
}

/**
 * Get color for power range based on % of FTP
 */
function getPowerRangeColor(powerLowPct: number, powerHighPct: number): string {
  const avgPower = (powerLowPct + powerHighPct) / 2

  if (avgPower >= 106) return '#dc2626' // VO2 Max - red-600
  if (avgPower >= 91) return '#ea580c' // Threshold - orange-600
  if (avgPower >= 76) return '#ca8a04' // Tempo - yellow-600
  if (avgPower >= 56) return '#16a34a' // Endurance - green-600
  return '#0284c7' // Recovery - sky-600
}

/**
 * Display a single workout step (used within segments)
 */
function WorkoutStepDisplay({
  step,
  showBorder = true,
}: {
  step: WorkoutStep
  showBorder?: boolean
}) {
  const duration = convertStepLengthToMinutes(step.length)
  const power = extractPowerTarget(step.targets)
  const color = getPowerRangeColor(power.minValue, power.maxValue)

  return (
    <div className="bg-background rounded-lg overflow-hidden">
      <div
        className={`flex items-center gap-4 p-3 ${showBorder ? 'border-l-4' : ''}`}
        style={showBorder ? { borderLeftColor: color } : undefined}
      >
        <div className="font-semibold min-w-[70px]">{formatDuration(duration)}</div>
        <div className="font-medium" style={{ color }}>
          {power.minValue === power.maxValue
            ? `${power.minValue}%`
            : `${power.minValue}-${power.maxValue}%`}
        </div>
        <div className="text-sm text-muted-foreground flex-1">{step.name}</div>
        <Badge variant="outline" className="text-xs">
          {step.intensityClass}
        </Badge>
      </div>
    </div>
  )
}

/**
 * Display a single segment (step or repetition)
 */
function SegmentDisplay({ segment }: { segment: StructuredWorkoutSegment }) {
  const repetitions = segment.length.value
  const isRepetition = segment.type === 'repetition'

  // Single step (no repetition or repetition of 1)
  if (!isRepetition || repetitions === 1) {
    return (
      <div className="space-y-2">
        {segment.steps.map((step, stepIdx) => (
          <WorkoutStepDisplay key={stepIdx} step={step} />
        ))}
      </div>
    )
  }

  // Repetition block (2+ steps repeated multiple times)
  return (
    <div className="bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold px-2.5 py-0.5">
          {repetitions}x
        </Badge>
        <span className="text-sm text-amber-700 dark:text-amber-400">
          {segment.steps.length === 2
            ? `Repeat the following ${repetitions} times:`
            : `Repeat the following ${segment.steps.length} steps ${repetitions} times:`}
        </span>
      </div>
      <div className="space-y-2">
        {segment.steps.map((step, stepIdx) => (
          <WorkoutStepDisplay key={stepIdx} step={step} />
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
        <div className="text-xs text-muted-foreground">
          Total:{' '}
          {formatDuration(
            segment.steps.reduce((sum, step) => sum + convertStepLengthToMinutes(step.length), 0) *
              repetitions
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Main component: Display full workout structure
 */
export function WorkoutStructureDisplay({
  structure,
  className = '',
}: WorkoutStructureDisplayProps) {
  if (!structure?.structure || structure.structure.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No structure data available
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {structure.structure.map((segment, segmentIdx) => (
        <SegmentDisplay key={segmentIdx} segment={segment} />
      ))}
    </div>
  )
}

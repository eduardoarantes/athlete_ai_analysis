'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, Trophy, Target } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type ComplianceGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ComplianceOverview {
  score: number
  grade: ComplianceGrade
  summary: string
  segments_completed: number
  segments_skipped: number
  segments_total: number
}

// ============================================================================
// Grade Badge Component
// ============================================================================

interface GradeBadgeProps {
  grade: ComplianceGrade
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const gradeColors: Record<ComplianceGrade, string> = {
  A: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300',
  C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300',
  D: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300',
  F: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300',
}

const gradeIcons: Record<ComplianceGrade, React.ComponentType<{ className?: string }>> = {
  A: Trophy,
  B: CheckCircle2,
  C: Target,
  D: AlertTriangle,
  F: XCircle,
}

export function GradeBadge({ grade, size = 'md', className }: GradeBadgeProps) {
  const Icon = gradeIcons[grade]
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-lg px-4 py-2 font-bold',
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-semibold border', gradeColors[grade], sizeClasses[size], className)}
    >
      <Icon className={cn('mr-1', size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5')} />
      Grade {grade}
    </Badge>
  )
}

// ============================================================================
// Score Display Component
// ============================================================================

interface ScoreDisplayProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600 dark:text-green-400'
  if (score >= 80) return 'text-blue-600 dark:text-blue-400'
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 60) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function getProgressColor(score: number): string {
  if (score >= 90) return 'bg-green-500'
  if (score >= 80) return 'bg-blue-500'
  if (score >= 70) return 'bg-yellow-500'
  if (score >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}

export function ScoreDisplay({
  score,
  size = 'md',
  showProgress = true,
  className,
}: ScoreDisplayProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('font-bold', sizeClasses[size], getScoreColor(score))}>
        {score.toFixed(0)}%
      </div>
      {showProgress && (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full transition-all duration-500', getProgressColor(score))}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Segment Stats Component
// ============================================================================

interface SegmentStatsProps {
  completed: number
  skipped: number
  total: number
  className?: string
}

export function SegmentStats({ completed, skipped, total, className }: SegmentStatsProps) {
  return (
    <div className={cn('flex items-center gap-4 text-sm', className)}>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-muted-foreground">
          {completed}/{total} completed
        </span>
      </div>
      {skipped > 0 && (
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-muted-foreground">{skipped} skipped</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Combined Compliance Header Component
// ============================================================================

interface ComplianceHeaderProps {
  overview: ComplianceOverview
  compact?: boolean
  className?: string
}

export function ComplianceHeader({ overview, compact = false, className }: ComplianceHeaderProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <GradeBadge grade={overview.grade} size="sm" />
        <span className={cn('font-semibold', getScoreColor(overview.score))}>
          {overview.score.toFixed(0)}%
        </span>
        <span className="text-xs text-muted-foreground">
          {overview.segments_completed}/{overview.segments_total} segments
        </span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScoreDisplay score={overview.score} size="lg" showProgress={false} />
          <GradeBadge grade={overview.grade} size="lg" />
        </div>
      </div>
      <SegmentStats
        completed={overview.segments_completed}
        skipped={overview.segments_skipped}
        total={overview.segments_total}
      />
      <p className="text-sm text-muted-foreground">{overview.summary}</p>
    </div>
  )
}

// ============================================================================
// Inline Compliance Badge (for lists)
// ============================================================================

interface ComplianceBadgeProps {
  score: number
  grade: ComplianceGrade
  onClick?: () => void
  className?: string
}

export function ComplianceBadge({ score, grade, onClick, className }: ComplianceBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm',
        gradeColors[grade],
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className="font-bold">{grade}</span>
      <span className="font-medium">{score.toFixed(0)}%</span>
    </div>
  )
}

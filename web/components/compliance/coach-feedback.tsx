'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Target,
  MessageSquare,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface SegmentNote {
  segment_index: number
  note: string
}

export interface CoachFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
  action_items: string[]
  segment_notes: SegmentNote[]
}

export interface CoachFeedbackResponse {
  feedback: CoachFeedback
  generated_at: string
  model: string
  prompt_version?: string
  cached: boolean
  context?: {
    match_id: string
    workout_name?: string
    workout_type?: string
    overall_score?: number
    overall_grade?: string
  }
}

interface CoachFeedbackCardProps {
  matchId: string
  initialFeedback?: CoachFeedbackResponse | null
  segmentNames?: string[]
  className?: string
  onFeedbackGenerated?: (feedback: CoachFeedbackResponse) => void
}

// ============================================================================
// Component
// ============================================================================

export function CoachFeedbackCard({
  matchId,
  initialFeedback,
  segmentNames = [],
  className,
  onFeedbackGenerated,
}: CoachFeedbackCardProps) {
  const [feedback, setFeedback] = useState<CoachFeedbackResponse | null>(initialFeedback || null)
  const [isLoading, setIsLoading] = useState(!initialFeedback) // Start loading if no initial feedback
  const [isInitialLoad, setIsInitialLoad] = useState(!initialFeedback)
  const [error, setError] = useState<string | null>(null)

  // Fetch cached feedback on mount
  useEffect(() => {
    if (initialFeedback || !matchId) return

    const fetchCachedFeedback = async () => {
      try {
        const response = await fetch(`/api/compliance/${matchId}/coach`)
        if (response.ok) {
          const data: CoachFeedbackResponse = await response.json()
          setFeedback(data)
          onFeedbackGenerated?.(data)
        }
        // 404 is expected if no feedback exists yet - don't treat as error
      } catch {
        // Silently fail - user can generate feedback manually
      } finally {
        setIsLoading(false)
        setIsInitialLoad(false)
      }
    }

    fetchCachedFeedback()
  }, [matchId, initialFeedback, onFeedbackGenerated])

  const generateFeedback = async (regenerate = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = `/api/compliance/${matchId}/coach${regenerate ? '?regenerate=true' : ''}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate feedback')
      }

      const data: CoachFeedbackResponse = await response.json()
      setFeedback(data)
      onFeedbackGenerated?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate feedback')
    } finally {
      setIsLoading(false)
    }
  }

  // Initial loading state (checking for cached feedback)
  if (isInitialLoad && isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Checking for coach feedback...</p>
        </CardContent>
      </Card>
    )
  }

  // No feedback yet - show generate button
  if (!feedback && !isLoading) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">AI Coach Feedback</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Get personalized coaching insights on your workout execution, including strengths,
            areas for improvement, and actionable tips.
          </p>
          {error && (
            <Alert variant="destructive" className="mb-4 max-w-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={() => generateFeedback()} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Coach Feedback
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Generating feedback loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Analyzing your workout...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
        </CardContent>
      </Card>
    )
  }

  // Error state with retry
  if (error && !feedback) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" />
          <h3 className="font-semibold mb-2">Failed to Generate Feedback</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => generateFeedback()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Feedback display
  const { feedback: fb, model, cached, generated_at } = feedback!

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Coach Feedback</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {cached && (
              <Badge variant="secondary" className="text-xs">
                Cached
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateFeedback(true)}
              disabled={isLoading}
              title="Regenerate feedback"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Generated by {model} on {new Date(generated_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm leading-relaxed">{fb.summary}</p>
        </div>

        {/* Strengths */}
        {fb.strengths.length > 0 && (
          <FeedbackSection
            icon={ThumbsUp}
            title="Strengths"
            items={fb.strengths}
            iconColor="text-green-600"
            bgColor="bg-green-50 dark:bg-green-950/30"
          />
        )}

        {/* Improvements */}
        {fb.improvements.length > 0 && (
          <FeedbackSection
            icon={TrendingUp}
            title="Areas for Improvement"
            items={fb.improvements}
            iconColor="text-amber-600"
            bgColor="bg-amber-50 dark:bg-amber-950/30"
          />
        )}

        {/* Action Items */}
        {fb.action_items.length > 0 && (
          <FeedbackSection
            icon={Target}
            title="Action Items"
            items={fb.action_items}
            iconColor="text-blue-600"
            bgColor="bg-blue-50 dark:bg-blue-950/30"
            numbered
          />
        )}

        {/* Segment Notes */}
        {fb.segment_notes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-purple-600" />
              <span>Segment Notes</span>
            </div>
            <div className="space-y-2">
              {fb.segment_notes.map((note, idx) => {
                const segmentName = segmentNames[note.segment_index] || `Segment ${note.segment_index + 1}`
                return (
                  <div
                    key={idx}
                    className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-sm"
                  >
                    <span className="font-medium text-purple-700 dark:text-purple-400">
                      [{segmentName}]
                    </span>{' '}
                    <span className="text-muted-foreground">{note.note}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface FeedbackSectionProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  items: string[]
  iconColor: string
  bgColor: string
  numbered?: boolean
}

function FeedbackSection({
  icon: Icon,
  title,
  items,
  iconColor,
  bgColor,
  numbered,
}: FeedbackSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span>{title}</span>
      </div>
      <ul className={cn('rounded-lg p-3 space-y-2', bgColor)}>
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2 text-sm">
            {numbered ? (
              <span className={cn('font-medium min-w-[1.25rem]', iconColor)}>{idx + 1}.</span>
            ) : (
              <span className={cn('mt-1.5', iconColor)}>•</span>
            )}
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================================
// Compact variant for inline display
// ============================================================================

interface CoachFeedbackBadgeProps {
  hasFeedback?: boolean
  onClick?: () => void
  className?: string
}

export function CoachFeedbackBadge({
  hasFeedback,
  onClick,
  className,
}: CoachFeedbackBadgeProps) {
  return (
    <Badge
      variant={hasFeedback ? 'default' : 'outline'}
      className={cn(
        'cursor-pointer transition-colors',
        hasFeedback
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'hover:bg-muted',
        className
      )}
      onClick={onClick}
    >
      <Sparkles className="h-3 w-3 mr-1" />
      {hasFeedback ? 'View Feedback' : 'Get Coach Feedback'}
    </Badge>
  )
}

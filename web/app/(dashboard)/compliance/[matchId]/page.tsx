'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Gauge,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ComplianceHeader,
  CoachFeedbackCard,
  type ComplianceOverview,
} from '@/components/compliance'
import { SegmentDetailsCard } from '@/components/compliance/segment-details'
import type { WorkoutComplianceAnalysis } from '@/lib/services/compliance-analysis-service'

// ============================================================================
// Types
// ============================================================================

interface ComplianceContext {
  match_id: string
  workout_name: string
  workout_type: string
  workout_description?: string
  workout_date: string
  workout_tss?: number
  activity_id: string
  athlete_ftp: number
  athlete_lthr?: number | null
  cached: boolean
  analyzed_at?: string
  analysis_id?: string
}

interface ComplianceResponse {
  analysis: WorkoutComplianceAnalysis
  context: ComplianceContext
}

// ============================================================================
// Page Component
// ============================================================================

export default function ComplianceResultsPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string

  const [data, setData] = useState<ComplianceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch compliance analysis
  const fetchAnalysis = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const url = `/api/compliance/${matchId}${refresh ? '?refresh=true' : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch compliance analysis')
      }

      const result: ComplianceResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compliance analysis')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (matchId) {
      fetchAnalysis()
    }
  }, [matchId])

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading compliance analysis...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => fetchAnalysis()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { analysis, context } = data

  // Build overview for ComplianceHeader
  const overview: ComplianceOverview = {
    score: analysis.overall.score,
    grade: analysis.overall.grade,
    summary: analysis.overall.summary,
    segments_completed: analysis.overall.segments_completed,
    segments_skipped: analysis.overall.segments_skipped,
    segments_total: analysis.overall.segments_total,
  }

  // Get segment names for coach feedback
  const segmentNames = analysis.segments.map((s) => s.segment_name)

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {context.cached && (
            <Badge variant="secondary" className="text-xs">
              Cached
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalysis(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Workout Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{context.workout_name}</CardTitle>
              <CardDescription className="mt-1">
                {context.workout_type && (
                  <Badge variant="outline" className="mr-2">
                    {context.workout_type}
                  </Badge>
                )}
                Compliance Analysis
              </CardDescription>
            </div>
            <Link
              href={`https://www.strava.com/activities/${context.activity_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Strava
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(context.workout_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>FTP: {context.athlete_ftp}W</span>
            </div>
            {context.athlete_lthr && (
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span>LTHR: {context.athlete_lthr} bpm</span>
              </div>
            )}
            {context.workout_tss && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>TSS: {context.workout_tss}</span>
              </div>
            )}
          </div>
          {context.workout_description && (
            <p className="mt-4 text-sm text-muted-foreground">{context.workout_description}</p>
          )}
        </CardContent>
      </Card>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceHeader overview={overview} />
        </CardContent>
      </Card>

      {/* Segment Details */}
      <SegmentDetailsCard segments={analysis.segments} ftp={context.athlete_ftp} />

      <div className="border-t" />

      {/* AI Coach Feedback */}
      <CoachFeedbackCard matchId={matchId} segmentNames={segmentNames} />

      {/* Metadata Footer */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>Algorithm version: {analysis.metadata.algorithm_version}</p>
        <p>Power data quality: {analysis.metadata.power_data_quality}</p>
        {context.analyzed_at && <p>Analyzed: {new Date(context.analyzed_at).toLocaleString()}</p>}
      </div>
    </div>
  )
}

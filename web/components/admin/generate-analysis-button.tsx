'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarChart3, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'

interface GenerateAnalysisButtonProps {
  userId: string
  hasProfile: boolean
  hasActivities: boolean
}

interface JobStatus {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: {
    phase: string
    percentage: number
  }
  result?: unknown
  error?: string
}

export function GenerateAnalysisButton({
  userId,
  hasProfile,
  hasActivities,
}: GenerateAnalysisButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [periodMonths, setPeriodMonths] = useState('6')
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Poll job status when we have a job_id
  useEffect(() => {
    if (!jobId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/analysis?job_id=${jobId}`)
        const data = await response.json()

        setJobStatus(data)

        // Stop polling when job is complete or failed
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollInterval)
          setIsLoading(false)
        }
      } catch {
        // Continue polling on error
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [jobId, userId])

  const handleGenerateAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    setJobStatus(null)
    setJobId(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          period_months: parseInt(periodMonths, 10),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to start analysis')
      }

      setJobId(data.job_id)
      setJobStatus({
        job_id: data.job_id,
        status: 'queued',
        progress: { phase: 'Starting', percentage: 0 },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  const canGenerate = hasProfile && hasActivities && !isLoading

  const getStatusIcon = () => {
    if (!jobStatus) return null

    switch (jobStatus.status) {
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusText = () => {
    if (!jobStatus) return ''

    switch (jobStatus.status) {
      case 'queued':
        return 'Queued...'
      case 'running':
        return `${jobStatus.progress?.phase || 'Processing'} (${jobStatus.progress?.percentage || 0}%)`
      case 'completed':
        return 'Analysis completed successfully!'
      case 'failed':
        return `Failed: ${jobStatus.error || 'Unknown error'}`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Analysis
        </CardTitle>
        <CardDescription>
          Generate AI-powered performance analysis for this user&apos;s Strava activities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasProfile && (
          <Alert variant="destructive">
            <AlertDescription>
              User does not have an athlete profile. They need to configure FTP, weight, and age
              first.
            </AlertDescription>
          </Alert>
        )}

        {hasProfile && !hasActivities && (
          <Alert>
            <AlertDescription>
              User has no synced Strava activities. Analysis requires activity data.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Analysis Period</label>
            <Select value={periodMonths} onValueChange={setPeriodMonths} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">&nbsp;</label>
            <Button onClick={handleGenerateAnalysis} disabled={!canGenerate} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generate Analysis
                </>
              )}
            </Button>
          </div>
        </div>

        {jobStatus && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {getStatusIcon()}
            <div className="flex-1">
              <div className="text-sm font-medium">{getStatusText()}</div>
              {jobStatus.progress && jobStatus.status === 'running' && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${jobStatus.progress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {jobStatus?.status === 'completed' && jobStatus.result !== undefined && (
          <div className="text-sm text-muted-foreground">
            Analysis results are available in the user&apos;s reports section.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

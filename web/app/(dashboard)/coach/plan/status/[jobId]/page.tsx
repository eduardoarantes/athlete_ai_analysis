'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'

interface JobStatus {
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: {
    phase: string
    percentage: number
  }
  result?: {
    plan_id: string
    plan_data: unknown
  }
  error?: string
}

export default function PlanStatusPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('planStatus')
  const jobId = params.jobId as string

  const [job, setJob] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/coach/plan/status/${jobId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Job not found')
            return
          }
          throw new Error('Failed to fetch job status')
        }

        const data = await response.json()
        setJob(data)

        // Continue polling if job is still running
        if (data.status === 'queued' || data.status === 'running') {
          setTimeout(pollStatus, 2000)
        }
      } catch (err) {
        console.error('Failed to fetch job status:', err)
        setError('Failed to fetch job status')
      }
    }

    pollStatus()
  }, [jobId])

  const getStatusIcon = () => {
    if (!job) return <Loader2 className="h-8 w-8 animate-spin text-primary" />

    switch (job.status) {
      case 'queued':
      case 'running':
        return <Loader2 className="h-8 w-8 animate-spin text-primary" />
      case 'completed':
        return <CheckCircle2 className="h-8 w-8 text-green-600" />
      case 'failed':
        return <AlertCircle className="h-8 w-8 text-red-600" />
    }
  }

  const getStatusText = () => {
    if (!job) return t('loading')

    switch (job.status) {
      case 'queued':
        return t('queued')
      case 'running':
        return job.progress?.phase || t('generating')
      case 'completed':
        return t('completed')
      case 'failed':
        return t('failed')
    }
  }

  const getProgress = () => {
    if (!job) return 0
    if (job.status === 'completed') return 100
    if (job.status === 'failed') return 0
    return job.progress?.percentage || 0
  }

  if (error) {
    return (
      <div className="container max-w-2xl py-8 mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('errorTitle')}</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/coach/create-plan')}>
              {t('tryAgain')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8 mx-auto">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">{getStatusIcon()}</div>
            <CardTitle>{getStatusText()}</CardTitle>
            <CardDescription>
              {job?.status === 'running' && t('pleaseWait')}
              {job?.status === 'queued' && t('inQueue')}
              {job?.status === 'completed' && t('readyToView')}
              {job?.status === 'failed' && t('somethingWentWrong')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={getProgress()} className="h-2 mb-6" />

            {job?.status === 'failed' && job.error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{job.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center gap-4">
              {job?.status === 'completed' && job.result?.plan_id && (
                <Button
                  onClick={() => router.push(`/training-plans/${job.result?.plan_id}`)}
                >
                  {t('viewPlan')}
                </Button>
              )}

              {job?.status === 'failed' && (
                <Button onClick={() => router.push('/coach/create-plan')}>
                  {t('tryAgain')}
                </Button>
              )}

              {(job?.status === 'queued' || job?.status === 'running') && (
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  {t('continueBrowsing')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

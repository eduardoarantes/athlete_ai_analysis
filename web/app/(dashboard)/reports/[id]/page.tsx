'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Mountain,
  Zap,
  Heart,
  Target,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PerformanceAnalysis {
  athlete_profile?: {
    name?: string
    age?: number
    weight_kg?: number
    ftp?: number
    power_to_weight?: number
    max_hr?: number
  }
  period_months?: number
  recent_period?: PeriodData
  previous_period?: PeriodData
  trends?: {
    distance_change_pct?: number
    time_change_pct?: number
    elevation_change_pct?: number
    power_change_pct?: number
    hr_change_pct?: number
    frequency_change_pct?: number
  }
  ai_insights?: {
    summary?: string
    key_findings?: string[]
    strengths?: string[]
    areas_for_improvement?: string[]
    recommendations?: {
      short_term?: string[]
      long_term?: string[]
    }
    training_focus?: string
  }
}

interface PeriodData {
  period?: string
  total_rides?: number
  total_distance_km?: number
  total_time_hours?: number
  total_elevation_m?: number
  avg_power?: number
  avg_hr?: number
  rides_per_week?: number
}

interface Report {
  id: string
  report_type: string
  status: string
  period_start: string | null
  period_end: string | null
  created_at: string
  completed_at: string | null
  report_data: {
    performance_analysis?: PerformanceAnalysis
    activities_analyzed?: number
    ai_metadata?: {
      ai_provider?: string
      ai_model?: string
    }
  } | null
}

export default function ReportDetailPage() {
  const t = useTranslations('reports.detail')
  const tStatus = useTranslations('reports.status')
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadReport()
  }, [params.id])

  const loadReport = async () => {
    const id = params.id as string

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else if (data.status !== 'completed') {
        router.push('/reports')
      } else {
        setReport(data as Report)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatTrend = (value: number | undefined) => {
    if (value === undefined) return null
    const isPositive = value >= 0
    return (
      <span className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {isPositive ? '+' : ''}
        {value.toFixed(1)}%
      </span>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !report) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Report not found</h2>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/reports">{t('backToReports')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const reportData = report.report_data
  const analysis = reportData?.performance_analysis
  const insights = analysis?.ai_insights
  const trends = analysis?.trends
  const recentPeriod = analysis?.recent_period
  const previousPeriod = analysis?.previous_period
  const athleteProfile = analysis?.athlete_profile

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToReports')}
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {report.period_start && report.period_end && (
              <>
                {new Date(report.period_start).toLocaleDateString()} -{' '}
                {new Date(report.period_end).toLocaleDateString()}
              </>
            )}
            {reportData?.activities_analyzed && (
              <> &bull; {t('activitiesAnalyzed', { count: reportData.activities_analyzed })}</>
            )}
          </p>
        </div>
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          {tStatus('completed')}
        </Badge>
      </div>

      {/* AI Summary */}
      {insights?.summary && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              {t('aiSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{insights.summary}</p>
            {insights.training_focus && (
              <div className="mt-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{t('trainingFocus')}:</span>
                <Badge variant="outline">{insights.training_focus}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Athlete Profile */}
      {athleteProfile && (
        <Card>
          <CardHeader>
            <CardTitle>{t('athleteProfile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {athleteProfile.ftp && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Zap className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                  <div className="text-2xl font-bold">{athleteProfile.ftp}W</div>
                  <div className="text-xs text-muted-foreground">{t('ftp')}</div>
                </div>
              )}
              {athleteProfile.weight_kg && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Activity className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                  <div className="text-2xl font-bold">{athleteProfile.weight_kg}kg</div>
                  <div className="text-xs text-muted-foreground">{t('weight')}</div>
                </div>
              )}
              {athleteProfile.power_to_weight && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold">{athleteProfile.power_to_weight.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{t('wkg')}</div>
                </div>
              )}
              {athleteProfile.max_hr && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Heart className="h-5 w-5 mx-auto mb-1 text-red-500" />
                  <div className="text-2xl font-bold">{athleteProfile.max_hr}</div>
                  <div className="text-xs text-muted-foreground">{t('maxHr')}</div>
                </div>
              )}
              {athleteProfile.age && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Activity className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                  <div className="text-2xl font-bold">{athleteProfile.age}</div>
                  <div className="text-xs text-muted-foreground">{t('age')}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Comparison */}
      {recentPeriod && previousPeriod && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{recentPeriod.period || t('recentPeriod')}</CardTitle>
              <CardDescription>{t('currentMetrics')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> {t('totalRides')}
                </span>
                <span className="font-bold">{recentPeriod.total_rides}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> {t('distance')}
                </span>
                <span className="font-bold">{recentPeriod.total_distance_km?.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {t('time')}
                </span>
                <span className="font-bold">{recentPeriod.total_time_hours?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Mountain className="h-4 w-4" /> {t('elevation')}
                </span>
                <span className="font-bold">{recentPeriod.total_elevation_m?.toFixed(0)} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" /> {t('avgPower')}
                </span>
                <span className="font-bold">{recentPeriod.avg_power?.toFixed(0)} W</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{previousPeriod.period || t('previousPeriod')}</CardTitle>
              <CardDescription>{t('comparisonMetrics')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> {t('totalRides')}
                </span>
                <span className="font-bold">{previousPeriod.total_rides}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> {t('distance')}
                </span>
                <span className="font-bold">{previousPeriod.total_distance_km?.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {t('time')}
                </span>
                <span className="font-bold">{previousPeriod.total_time_hours?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Mountain className="h-4 w-4" /> {t('elevation')}
                </span>
                <span className="font-bold">{previousPeriod.total_elevation_m?.toFixed(0)} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" /> {t('avgPower')}
                </span>
                <span className="font-bold">{previousPeriod.avg_power?.toFixed(0)} W</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trends */}
      {trends && (
        <Card>
          <CardHeader>
            <CardTitle>{t('performanceTrends')}</CardTitle>
            <CardDescription>{t('trendsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t('distance')}</div>
                <div className="text-lg font-bold">{formatTrend(trends.distance_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t('time')}</div>
                <div className="text-lg font-bold">{formatTrend(trends.time_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t('elevation')}</div>
                <div className="text-lg font-bold">{formatTrend(trends.elevation_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t('avgPower')}</div>
                <div className="text-lg font-bold">{formatTrend(trends.power_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t('heartRate')}</div>
                <div className="text-lg font-bold">{formatTrend(trends.hr_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t('frequency')}</div>
                <div className="text-lg font-bold">{formatTrend(trends.frequency_change_pct)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Findings, Strengths, Areas for Improvement */}
      <div className="grid md:grid-cols-3 gap-6">
        {insights?.key_findings && insights.key_findings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                {t('keyFindings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {insights.key_findings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-500 mt-1">•</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {insights?.strengths && insights.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {t('strengths')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {insights.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-1">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {insights?.areas_for_improvement && insights.areas_for_improvement.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                {t('areasForImprovement')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {insights.areas_for_improvement.map((area, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-orange-500 mt-1">•</span>
                    {area}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendations */}
      {insights?.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              {t('recommendations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {insights.recommendations.short_term && insights.recommendations.short_term.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-green-600">{t('shortTermActions')}</h4>
                  <ul className="space-y-2">
                    {insights.recommendations.short_term.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {insights.recommendations.long_term && insights.recommendations.long_term.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-blue-600">{t('longTermGoals')}</h4>
                  <ul className="space-y-2">
                    {insights.recommendations.long_term.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Target className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t('generatedOn', { date: new Date(report.completed_at || report.created_at).toLocaleString() })}
            </span>
            {reportData?.ai_metadata && (
              <span>
                {t('aiMetadata', {
                  provider: reportData.ai_metadata.ai_provider || 'Unknown',
                  model: reportData.ai_metadata.ai_model || 'Unknown'
                })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

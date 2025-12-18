import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
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
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

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

export default async function ReportDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    notFound()
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !report) {
    notFound()
  }

  if (report.status !== 'completed') {
    redirect('/reports')
  }

  const reportData = report.report_data as {
    performance_analysis?: PerformanceAnalysis
    activities_analyzed?: number
    ai_metadata?: {
      ai_provider?: string
      ai_model?: string
    }
  } | null

  const analysis = reportData?.performance_analysis
  const insights = analysis?.ai_insights
  const trends = analysis?.trends
  const recentPeriod = analysis?.recent_period
  const previousPeriod = analysis?.previous_period
  const athleteProfile = analysis?.athlete_profile

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Analysis Report</h1>
          <p className="text-muted-foreground">
            {report.period_start && report.period_end && (
              <>
                {new Date(report.period_start).toLocaleDateString()} -{' '}
                {new Date(report.period_end).toLocaleDateString()}
              </>
            )}
            {reportData?.activities_analyzed && (
              <> &bull; {reportData.activities_analyzed} activities analyzed</>
            )}
          </p>
        </div>
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      </div>

      {/* AI Summary */}
      {insights?.summary && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              AI Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{insights.summary}</p>
            {insights.training_focus && (
              <div className="mt-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Training Focus:</span>
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
            <CardTitle>Athlete Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {athleteProfile.ftp && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Zap className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                  <div className="text-2xl font-bold">{athleteProfile.ftp}W</div>
                  <div className="text-xs text-muted-foreground">FTP</div>
                </div>
              )}
              {athleteProfile.weight_kg && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Activity className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                  <div className="text-2xl font-bold">{athleteProfile.weight_kg}kg</div>
                  <div className="text-xs text-muted-foreground">Weight</div>
                </div>
              )}
              {athleteProfile.power_to_weight && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold">{athleteProfile.power_to_weight.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">W/kg</div>
                </div>
              )}
              {athleteProfile.max_hr && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Heart className="h-5 w-5 mx-auto mb-1 text-red-500" />
                  <div className="text-2xl font-bold">{athleteProfile.max_hr}</div>
                  <div className="text-xs text-muted-foreground">Max HR</div>
                </div>
              )}
              {athleteProfile.age && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Activity className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                  <div className="text-2xl font-bold">{athleteProfile.age}</div>
                  <div className="text-xs text-muted-foreground">Age</div>
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
              <CardTitle className="text-lg">{recentPeriod.period || 'Recent Period'}</CardTitle>
              <CardDescription>Current performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Total Rides
                </span>
                <span className="font-bold">{recentPeriod.total_rides}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Distance
                </span>
                <span className="font-bold">{recentPeriod.total_distance_km?.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Time
                </span>
                <span className="font-bold">{recentPeriod.total_time_hours?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Mountain className="h-4 w-4" /> Elevation
                </span>
                <span className="font-bold">{recentPeriod.total_elevation_m?.toFixed(0)} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Avg Power
                </span>
                <span className="font-bold">{recentPeriod.avg_power?.toFixed(0)} W</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{previousPeriod.period || 'Previous Period'}</CardTitle>
              <CardDescription>Comparison metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Total Rides
                </span>
                <span className="font-bold">{previousPeriod.total_rides}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Distance
                </span>
                <span className="font-bold">{previousPeriod.total_distance_km?.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Time
                </span>
                <span className="font-bold">{previousPeriod.total_time_hours?.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Mountain className="h-4 w-4" /> Elevation
                </span>
                <span className="font-bold">{previousPeriod.total_elevation_m?.toFixed(0)} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Avg Power
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
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Changes compared to previous period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Distance</div>
                <div className="text-lg font-bold">{formatTrend(trends.distance_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Time</div>
                <div className="text-lg font-bold">{formatTrend(trends.time_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Elevation</div>
                <div className="text-lg font-bold">{formatTrend(trends.elevation_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Power</div>
                <div className="text-lg font-bold">{formatTrend(trends.power_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Heart Rate</div>
                <div className="text-lg font-bold">{formatTrend(trends.hr_change_pct)}</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Frequency</div>
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
                Key Findings
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
                Strengths
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
                Areas for Improvement
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
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {insights.recommendations.short_term && insights.recommendations.short_term.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-green-600">Short-term Actions</h4>
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
                  <h4 className="font-semibold mb-3 text-blue-600">Long-term Goals</h4>
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
              Generated on {new Date(report.completed_at || report.created_at).toLocaleString()}
            </span>
            {reportData?.ai_metadata && (
              <span>
                AI: {reportData.ai_metadata.ai_provider} / {reportData.ai_metadata.ai_model}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

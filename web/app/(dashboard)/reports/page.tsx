import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  TrendingUp,
  Activity,
} from 'lucide-react'

interface Report {
  id: string
  report_type: string
  status: string
  period_start: string | null
  period_end: string | null
  created_at: string
  completed_at: string | null
  error_message: string | null
  report_data: {
    activities_analyzed?: number
    performance_analysis?: {
      ai_insights?: {
        summary?: string
        training_focus?: string
      }
    }
  } | null
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case 'processing':
        return (
          <Badge className="bg-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <TrendingUp className="h-5 w-5 text-blue-500" />
      case 'training_plan':
        return <Calendar className="h-5 w-5 text-green-500" />
      default:
        return <BarChart3 className="h-5 w-5 text-purple-500" />
    }
  }

  const formatReportType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Reports</h1>
          <p className="text-muted-foreground">Your AI-generated performance analysis reports</p>
        </div>
      </div>

      {reports && reports.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(reports as Report[]).map((report) => {
            const activitiesAnalyzed = report.report_data?.activities_analyzed
            const summary = report.report_data?.performance_analysis?.ai_insights?.summary
            const trainingFocus = report.report_data?.performance_analysis?.ai_insights?.training_focus

            return (
              <Link
                key={report.id}
                href={report.status === 'completed' ? `/reports/${report.id}` : '#'}
                className={report.status !== 'completed' ? 'pointer-events-none' : ''}
              >
                <Card
                  className={`h-full transition-colors ${report.status === 'completed' ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-75'}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getReportTypeIcon(report.report_type)}
                        <CardTitle className="text-lg">
                          {formatReportType(report.report_type)} Report
                        </CardTitle>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>
                    {report.period_start && report.period_end && (
                      <CardDescription>
                        {new Date(report.period_start).toLocaleDateString()} -{' '}
                        {new Date(report.period_end).toLocaleDateString()}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {report.status === 'completed' && summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{summary}</p>
                    )}

                    {report.status === 'failed' && report.error_message && (
                      <p className="text-sm text-red-500 line-clamp-2">{report.error_message}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {activitiesAnalyzed && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-4 w-4" />
                          {activitiesAnalyzed} activities
                        </span>
                      )}
                      {trainingFocus && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          {trainingFocus}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Created {new Date(report.created_at).toLocaleDateString()}
                      {report.completed_at && (
                        <> &bull; Completed {new Date(report.completed_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No reports yet</h2>
            <p className="text-muted-foreground mb-4">
              Performance reports will appear here once generated.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

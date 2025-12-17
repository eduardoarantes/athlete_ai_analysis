'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AIAssistantProps {
  suggestion: string
  wizardData: any
}

export function AIAssistant({ suggestion, wizardData }: AIAssistantProps) {
  const t = useTranslations('createPlan.aiAssistant')
  // Derive insights from wizard data
  const insights = deriveInsights(wizardData, t)

  return (
    <div className="space-y-4 sticky top-4">
      {/* AI Suggestion Card */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {suggestion ? (
            <p className="text-sm leading-relaxed">{suggestion}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('noSuggestion')}</p>
          )}
        </CardContent>
      </Card>

      {/* Insights & Validation */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('quickInsights')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, index) => {
              const Icon =
                insight.type === 'success'
                  ? CheckCircle
                  : insight.type === 'warning'
                    ? AlertCircle
                    : TrendingUp

              return (
                <Alert key={index} variant={insight.type === 'warning' ? 'destructive' : 'default'}>
                  <Icon className="h-4 w-4" />
                  <AlertDescription className="text-sm">{insight.message}</AlertDescription>
                </Alert>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Progress Summary */}
      {wizardData.profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('yourStats')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wizardData.profile.ftp > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('currentFtp')}</span>
                <Badge variant="outline">{wizardData.profile.ftp}W</Badge>
              </div>
            )}
            {wizardData.profile.weight > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('weight')}</span>
                <Badge variant="outline">{wizardData.profile.weight}kg</Badge>
              </div>
            )}
            {wizardData.profile.ftp > 0 && wizardData.profile.weight > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('wkg')}</span>
                <Badge variant="outline">
                  {(wizardData.profile.ftp / wizardData.profile.weight).toFixed(2)}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function deriveInsights(
  wizardData: any,
  t: (key: string, params?: Record<string, string | number>) => string
): Array<{
  type: 'success' | 'warning' | 'info'
  message: string
}> {
  const insights: Array<{ type: 'success' | 'warning' | 'info'; message: string }> = []

  // FTP insights
  if (wizardData.profile?.ftp) {
    const ftp = wizardData.profile.ftp
    const weight = wizardData.profile.weight

    if (ftp && weight) {
      const wkg = ftp / weight

      if (wkg > 4.0) {
        insights.push({
          type: 'success',
          message: t('insightWkgExcellent', { wkg: wkg.toFixed(2) }),
        })
      } else if (wkg < 2.5) {
        insights.push({
          type: 'info',
          message: t('insightWkgImprove'),
        })
      }
    }
  }

  // Goal-specific insights
  if (wizardData.goal === 'improve-ftp' && wizardData.preferences?.daysPerWeek) {
    if (wizardData.preferences.daysPerWeek < 3) {
      insights.push({
        type: 'warning',
        message: t('insightFtpDays'),
      })
    }
  }

  // Timeline insights
  if (wizardData.timeline?.weeks) {
    if (wizardData.timeline.weeks < 8 && wizardData.goal === 'improve-ftp') {
      insights.push({
        type: 'warning',
        message: t('insightFtpWeeks'),
      })
    } else if (wizardData.timeline.weeks >= 12) {
      insights.push({
        type: 'success',
        message: t('insightGreatTimeline'),
      })
    }
  }

  return insights
}

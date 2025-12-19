import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, TrendingUp, Zap } from 'lucide-react'
import { TrainingPlanCalendar } from '@/components/training/training-plan-calendar'
import { SchedulePlanButton } from '@/components/training/schedule-plan-button'
import type { TrainingPlan, TrainingPlanData, PlanSourceMetadata } from '@/lib/types/training-plan'

interface TrainingPlanPageProps {
  params: Promise<{ planId: string }>
}

export default async function TrainingPlanPage({ params }: TrainingPlanPageProps) {
  const { planId } = await params
  const t = await getTranslations('trainingPlan')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const { data: planRow, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (error || !planRow) {
    notFound()
  }

  // Parse plan_data
  const planData: TrainingPlanData =
    typeof planRow.plan_data === 'string' ? JSON.parse(planRow.plan_data) : planRow.plan_data

  const plan: TrainingPlan = {
    ...planRow,
    plan_data: planData,
    metadata: (planRow.metadata as PlanSourceMetadata | null) ?? null,
    status: planRow.status as TrainingPlan['status'],
  }

  // Calculate total TSS for the plan
  const totalPlanTss = planData.weekly_plan.reduce((sum, week) => sum + (week.week_tss || 0), 0)
  const weeksTotal = plan.weeks_total || planData.plan_metadata.total_weeks

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Plan Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{plan.name}</h1>
            {plan.status && (
              <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                {t(`planStatus.${plan.status}`, { defaultValue: plan.status })}
              </Badge>
            )}
          </div>
          {plan.description && <p className="text-muted-foreground">{plan.description}</p>}
        </div>
        <SchedulePlanButton templateId={plan.id} templateName={plan.name} weeksTotal={weeksTotal} />
      </div>

      {/* Plan Overview Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {t('totalWeeks')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{weeksTotal} weeks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {t('ftpGoal')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {planData.plan_metadata.current_ftp} &rarr; {planData.plan_metadata.target_ftp}W
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('planOverview')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{planData.plan_metadata.total_weeks}</p>
              <p className="text-sm text-muted-foreground">{t('totalWeeks')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round(totalPlanTss)}</p>
              <p className="text-sm text-muted-foreground">{t('totalTss')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                +
                {planData.plan_metadata.ftp_gain_watts ||
                  planData.plan_metadata.target_ftp - planData.plan_metadata.current_ftp}
                W
              </p>
              <p className="text-sm text-muted-foreground">{t('ftpGain')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Math.round(totalPlanTss / planData.plan_metadata.total_weeks)}
              </p>
              <p className="text-sm text-muted-foreground">{t('avgWeeklyTss')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar - Template mode (no real dates) */}
      <TrainingPlanCalendar plan={plan} templateMode={true} />
    </div>
  )
}

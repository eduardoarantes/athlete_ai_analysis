import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Target, TrendingUp, Zap } from 'lucide-react'
import { InstanceCalendar } from '@/components/training/instance-calendar'
import { CancelInstanceButton } from '@/components/training/cancel-instance-button'
import type { PlanInstance, TrainingPlanData } from '@/lib/types/training-plan'
import { formatWithGoalLabels } from '@/lib/utils/format-utils'

interface InstancePageProps {
  params: Promise<{ instanceId: string }>
}

export default async function InstancePage({ params }: InstancePageProps) {
  const { instanceId } = await params
  const t = await getTranslations('schedule')
  const tGoals = await getTranslations('goals')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const { data: instanceRow, error } = await supabase
    .from('plan_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('user_id', user.id)
    .single()

  if (error || !instanceRow) {
    notFound()
  }

  const instance = instanceRow as unknown as PlanInstance

  // Parse plan_data
  const planData: TrainingPlanData =
    typeof instance.plan_data === 'string' ? JSON.parse(instance.plan_data) : instance.plan_data

  const startDate = new Date(instance.start_date)
  const endDate = new Date(instance.end_date)

  // Calculate total TSS for the plan
  const totalPlanTss = planData.weekly_plan.reduce((sum, week) => sum + (week.week_tss || 0), 0)

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'scheduled':
        return 'secondary'
      case 'completed':
        return 'outline'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Instance Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{formatWithGoalLabels(instance.name, tGoals)}</h1>
            <Badge variant={getStatusVariant(instance.status)}>
              {t(`status.${instance.status}`)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {startDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            -{' '}
            {endDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        {(instance.status === 'scheduled' || instance.status === 'active') && (
          <CancelInstanceButton
            instanceId={instance.id}
            instanceName={formatWithGoalLabels(instance.name, tGoals)}
          />
        )}
      </div>

      {/* Instance Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t('startDate')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {startDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t('endDate')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {endDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {t('totalWeeks')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{instance.weeks_total} weeks</p>
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
              <p className="text-2xl font-bold">{instance.weeks_total}</p>
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
                {Math.round(totalPlanTss / instance.weeks_total)}
              </p>
              <p className="text-sm text-muted-foreground">{t('avgWeeklyTss')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar with real dates */}
      <InstanceCalendar instance={instance} planData={planData} />
    </div>
  )
}

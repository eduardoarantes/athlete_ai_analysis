import { getTranslations, getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Zap, CalendarDays, Clock } from 'lucide-react'
import type { PlanInstance } from '@/lib/types/training-plan'
import { asPlanInstances } from '@/lib/types/type-guards'
import { parseLocalDate } from '@/lib/utils/date-utils'

export default async function SchedulePage() {
  const t = await getTranslations('schedule')
  const locale = await getLocale()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all non-cancelled instances
  const { data: instances } = await supabase
    .from('plan_instances')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['scheduled', 'active', 'completed'])
    .order('start_date', { ascending: true })

  const typedInstances = asPlanInstances(instances || [])

  // Group instances by status
  const activeInstances = typedInstances.filter((i) => i.status === 'active')
  const scheduledInstances = typedInstances.filter((i) => i.status === 'scheduled')
  const completedInstances = typedInstances.filter((i) => i.status === 'completed')

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'scheduled':
        return 'secondary'
      case 'completed':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const calculateTotalTss = (instance: PlanInstance): number => {
    return (
      instance.plan_data?.weekly_plan?.reduce(
        (sum: number, week: { week_tss?: number }) => sum + (week.week_tss || 0),
        0
      ) || 0
    )
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end)
    return `${startDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`
  }

  const InstanceCard = ({ instance }: { instance: PlanInstance }) => {
    const totalTss = calculateTotalTss(instance)
    const today = new Date()
    const startDate = parseLocalDate(instance.start_date)
    const endDate = parseLocalDate(instance.end_date)

    // Calculate progress for active plans
    let progressPercent = 0
    if (instance.status === 'active') {
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
    }

    // Calculate days until start for scheduled plans
    const daysUntilStart =
      instance.status === 'scheduled'
        ? Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 0

    return (
      <Link key={instance.id} href={`/schedule/${instance.id}`}>
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{instance.name}</CardTitle>
              <Badge variant={getStatusVariant(instance.status)}>
                {t(`status.${instance.status}`)}
              </Badge>
            </div>
            <CardDescription>
              {formatDateRange(instance.start_date, instance.end_date)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {instance.weeks_total} weeks
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                {Math.round(totalTss)} TSS
              </span>
            </div>

            {/* Progress bar for active plans */}
            {instance.status === 'active' && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Days until start for scheduled plans */}
            {instance.status === 'scheduled' && daysUntilStart > 0 && (
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Starts in {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/training-plans">
            <Plus className="h-4 w-4 mr-2" />
            {t('schedulePlan')}
          </Link>
        </Button>
      </div>

      {/* Active Plans */}
      {activeInstances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t('activePlans')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeInstances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Plans */}
      {scheduledInstances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            {t('upcomingPlans')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scheduledInstances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Plans */}
      {completedInstances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-muted-foreground">{t('completedPlans')}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedInstances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {typedInstances.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('noScheduledPlans')}</h2>
            <p className="text-muted-foreground mb-4">{t('noScheduledPlansDescription')}</p>
            <Button asChild>
              <Link href="/training-plans">
                <Plus className="h-4 w-4 mr-2" />
                {t('browseTemplates')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

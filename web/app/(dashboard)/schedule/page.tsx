import { getTranslations, getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { asPlanInstances } from '@/lib/types/type-guards'
import { ScheduleContent } from '@/components/training/schedule-content'
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

  // Automatically mark ended plans as completed
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (instances) {
    for (const instance of instances) {
      if (instance.status === 'scheduled' || instance.status === 'active') {
        const endDate = parseLocalDate(instance.end_date)
        if (endDate < today) {
          // Plan has ended, mark as completed
          await supabase
            .from('plan_instances')
            .update({ status: 'completed' })
            .eq('id', instance.id)
          instance.status = 'completed'
        }
      }
    }
  }

  const typedInstances = asPlanInstances(instances || [])

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

      <ScheduleContent instances={typedInstances} locale={locale} />
    </div>
  )
}

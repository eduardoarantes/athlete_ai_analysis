import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TrainingPlansList } from '@/components/training/training-plans-list'

interface PlanRow {
  id: string
  name: string
  description: string | null
  plan_data: unknown
  weeks_total?: number | null
  created_at: string
}

export default async function TrainingPlansPage() {
  const t = await getTranslations('trainingPlan')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: plans } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Parse plan_data for each plan
  const parsedPlans = (plans as PlanRow[] | null)?.map((plan) => ({
    ...plan,
    plan_data: typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data,
    weeks_total: plan.weeks_total ?? null,
  })) || []

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">Your personalized training plans</p>
        </div>
        <Button asChild>
          <Link href="/coach/create-plan">
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Link>
        </Button>
      </div>

      <TrainingPlansList plans={parsedPlans} />
    </div>
  )
}

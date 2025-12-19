import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Zap } from 'lucide-react'

// Extended type to include optional weeks_total (exists after migration)
interface PlanRow {
  id: string
  name: string
  description: string | null
  status: string | null
  plan_data: unknown
  weeks_total?: number | null
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

      {plans && plans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(plans as PlanRow[]).map((plan) => {
            const planData =
              typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data
            const totalTss =
              planData?.weekly_plan?.reduce(
                (sum: number, week: { week_tss?: number }) => sum + (week.week_tss || 0),
                0
              ) || 0

            return (
              <Link key={plan.id} href={`/training-plans/${plan.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {plan.status && (
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status}
                        </Badge>
                      )}
                    </div>
                    {plan.description && <CardDescription>{plan.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {plan.weeks_total || planData?.plan_metadata?.total_weeks || '?'} weeks
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        {Math.round(totalTss)} TSS
                      </span>
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
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No training plans yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first AI-powered training plan to get started.
            </p>
            <Button asChild>
              <Link href="/coach/create-plan">
                <Plus className="h-4 w-4 mr-2" />
                Create Training Plan
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

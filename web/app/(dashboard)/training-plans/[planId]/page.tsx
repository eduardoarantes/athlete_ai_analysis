import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Target, TrendingUp, Zap } from 'lucide-react'
import { TrainingPlanCalendar } from '@/components/training/training-plan-calendar'
import { SchedulePlanButton } from '@/components/training/schedule-plan-button'
import type { TrainingPlan, TrainingPlanData, PlanSourceMetadata } from '@/lib/types/training-plan'
import { formatWithGoalLabels } from '@/lib/utils/format-utils'
import { checkAdmin } from '@/lib/guards/admin-guard'

interface TrainingPlanPageProps {
  params: Promise<{ planId: string }>
}

export default async function TrainingPlanPage({ params }: TrainingPlanPageProps) {
  const { planId } = await params
  const tGoals = await getTranslations('goals')
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

  // Check if user is admin
  const isAdmin = await checkAdmin(supabase)

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Compact Plan Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{formatWithGoalLabels(plan.name, tGoals)}</h1>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{formatWithGoalLabels(plan.description, tGoals)}</p>
          )}
        </div>

        {/* Inline Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{weeksTotal} weeks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {planData.plan_metadata.current_ftp} &rarr; {planData.plan_metadata.target_ftp}W
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              +{planData.plan_metadata.ftp_gain_watts || planData.plan_metadata.target_ftp - planData.plan_metadata.current_ftp}W
            </span>
          </div>
          <div className="text-muted-foreground">
            {Math.round(totalPlanTss)} TSS ({Math.round(totalPlanTss / planData.plan_metadata.total_weeks)}/wk)
          </div>
        </div>

        <SchedulePlanButton templateId={plan.id} templateName={plan.name} weeksTotal={weeksTotal} />
      </div>

      {/* Calendar - Template mode (no real dates) */}
      <TrainingPlanCalendar plan={plan} templateMode={true} isAdmin={isAdmin} />
    </div>
  )
}

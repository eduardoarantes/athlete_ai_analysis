import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PlanBuilder } from '@/components/plan-builder/plan-builder'

interface EditCustomPlanPageProps {
  params: Promise<{
    planId: string
  }>
}

export default async function EditCustomPlanPage({ params }: EditCustomPlanPageProps) {
  const { planId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify the plan exists, belongs to the user, and is a custom plan
  const { data: plan, error } = await supabase
    .from('training_plans')
    .select('id, created_from')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (error || !plan) {
    notFound()
  }

  // Only allow editing custom_builder plans - redirect AI plans to view page
  if (plan.created_from !== 'custom_builder') {
    redirect(`/training-plans/${planId}`)
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <PlanBuilder planId={planId} />
    </div>
  )
}

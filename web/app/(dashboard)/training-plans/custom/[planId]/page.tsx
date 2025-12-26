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

  // Verify the plan exists and belongs to the user
  const { data: plan, error } = await supabase
    .from('training_plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (error || !plan) {
    notFound()
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <PlanBuilder planId={planId} />
    </div>
  )
}

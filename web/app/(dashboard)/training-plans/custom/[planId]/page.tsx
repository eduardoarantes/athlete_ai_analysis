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
  // Note: created_from column may not be in generated types yet
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdFrom = (plan as any).created_from as string | undefined
  if (createdFrom !== 'custom_builder') {
    redirect(`/training-plans/${planId}`)
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <PlanBuilder planId={planId} />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanBuilder } from '@/components/plan-builder/plan-builder'

export default async function NewCustomPlanPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <PlanBuilder />
    </div>
  )
}

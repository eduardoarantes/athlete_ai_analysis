'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Plan {
  id: string
  name: string
  display_name: string
}

interface UserSubscriptionFormProps {
  userId: string
  currentPlanId: string | null
  currentStatus: string | null
  plans: Plan[]
}

export function UserSubscriptionForm({
  userId,
  currentPlanId,
  currentStatus,
  plans,
}: UserSubscriptionFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [planId, setPlanId] = useState(currentPlanId || '')
  const [status, setStatus] = useState(currentStatus || 'active')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const hasChanges = planId !== currentPlanId || status !== currentStatus

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!hasChanges) return

    startTransition(async () => {
      try {
        const updateData: { planId?: string; subscriptionStatus?: string } = {}

        if (planId !== currentPlanId) {
          updateData.planId = planId
        }
        if (status !== currentStatus) {
          updateData.subscriptionStatus = status
        }

        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

        const data = await response.json()

        if (!response.ok) {
          setMessage({ type: 'error', text: data.error || 'Failed to update subscription' })
          return
        }

        setMessage({ type: 'success', text: 'Subscription updated successfully' })
        router.refresh()
      } catch {
        setMessage({ type: 'error', text: 'An error occurred. Please try again.' })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Plan</label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={!hasChanges || isPending}>
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </form>
  )
}

'use client'

/**
 * Create Plan Dialog Component
 *
 * Shows a dialog to create a new training plan when user drops a workout without an existing plan.
 * Allows user to specify plan name, start date, duration, and goal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import { formatDateString } from '@/lib/utils/date-utils'

interface CreatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlanCreated: (planId: string, startDate: string) => void
  dropDate?: string | undefined // The date where the workout was dropped
}

const GOAL_OPTIONS = [
  { value: 'none', label: 'No specific goal' },
  { value: 'improve_ftp', label: 'Improve FTP' },
  { value: 'build_endurance', label: 'Build Endurance' },
  { value: 'race_preparation', label: 'Race Preparation' },
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'general_fitness', label: 'General Fitness' },
]

export function CreatePlanDialog({ open, onOpenChange, onPlanCreated }: CreatePlanDialogProps) {
  const router = useRouter()

  // Form state
  const today = formatDateString(new Date())
  const [planName, setPlanName] = useState('My Training Plan')
  const [startDate, setStartDate] = useState(today)
  const [duration, setDuration] = useState(12)
  const [goal, setGoal] = useState('none')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate minimum start date (today)
  const minDate = today

  const handleCreate = async () => {
    // Validation
    if (!planName.trim()) {
      setError('Please enter a plan name')
      return
    }
    if (duration < 1 || duration > 52) {
      setError('Duration must be between 1 and 52 weeks')
      return
    }
    if (startDate < minDate) {
      setError('Start date cannot be in the past')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // Create the plan
      const response = await fetch('/api/training-plans/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planName,
          weeks: duration,
          goal: goal === 'none' ? null : goal,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create plan')
      }

      const planData = await response.json()
      const planId = planData.id

      // Schedule the plan
      const scheduleResponse = await fetch(`/api/training-plans/${planId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
        }),
      })

      if (!scheduleResponse.ok) {
        throw new Error('Failed to schedule plan')
      }

      const scheduleData = await scheduleResponse.json()
      const instanceId = scheduleData.instance_id

      // Success - notify parent
      onPlanCreated(instanceId, startDate)
      onOpenChange(false)

      // Reset form
      setPlanName('My Training Plan')
      setStartDate(today)
      setDuration(12)
      setGoal('none')

      // Refresh the page to load the new plan
      router.refresh()
    } catch (err) {
      console.error('Failed to create plan:', err)
      setError('Failed to create plan. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Training Plan</DialogTitle>
          <DialogDescription>
            To schedule workouts, you need a training plan. Let&apos;s create one now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Name */}
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan Name</Label>
            <Input
              id="plan-name"
              placeholder="My Training Plan"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="start-date"
                type="date"
                className="pl-10"
                value={startDate}
                min={minDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (weeks)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              max={52}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 12)}
            />
          </div>

          {/* Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal">Goal (optional)</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger id="goal">
                <SelectValue placeholder="Select a goal" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

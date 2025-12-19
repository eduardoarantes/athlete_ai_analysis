'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CalendarPlus, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { PlanInstance } from '@/lib/types/training-plan'

interface SchedulePlanButtonProps {
  templateId: string
  templateName: string
  weeksTotal: number
}

export function SchedulePlanButton({
  templateId,
  templateName,
  weeksTotal,
}: SchedulePlanButtonProps) {
  const t = useTranslations('schedule')
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<PlanInstance[]>([])

  // Calculate end date based on start date and weeks
  const calculateEndDate = (start: string): string => {
    if (!start) return ''
    const startDateObj = new Date(start)
    const endDateObj = new Date(startDateObj)
    endDateObj.setDate(endDateObj.getDate() + weeksTotal * 7)
    return endDateObj.toISOString().split('T')[0]!
  }

  const endDate = calculateEndDate(startDate)

  const handleSchedule = async () => {
    if (!startDate) {
      setError('Please select a start date')
      return
    }

    setIsLoading(true)
    setError(null)
    setConflicts([])

    try {
      const response = await fetch('/api/plan-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          start_date: startDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'OVERLAP') {
          setConflicts(data.conflicts || [])
          setError(data.message || 'This schedule overlaps with an existing plan')
        } else {
          setError(data.error || 'Failed to schedule plan')
        }
        return
      }

      // Success - redirect to schedule page
      setOpen(false)
      router.push('/schedule')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset state when closing
      setStartDate('')
      setError(null)
      setConflicts([])
    }
  }

  // Get tomorrow's date as minimum
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="h-4 w-4 mr-2" />
          {t('schedulePlan')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('scheduleTitle')}</DialogTitle>
          <DialogDescription>
            {t('scheduleDescription', { planName: templateName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="start-date">{t('startDate')}</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setError(null)
                setConflicts([])
              }}
              min={minDate}
            />
          </div>

          {startDate && (
            <div className="grid gap-2">
              <Label>{t('endDate')}</Label>
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {new Date(endDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                <span className="block text-xs mt-1">
                  ({weeksTotal} weeks from start)
                </span>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {conflicts.length > 0 && (
            <Alert className="border-yellow-500 bg-yellow-50 text-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <p className="font-medium mb-2">{t('conflictsWith')}:</p>
                <ul className="list-disc list-inside space-y-1">
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      {conflict.name} ({new Date(conflict.start_date).toLocaleDateString()} -{' '}
                      {new Date(conflict.end_date).toLocaleDateString()})
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSchedule} disabled={!startDate || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('scheduling')}
              </>
            ) : (
              t('schedule')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

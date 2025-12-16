'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Clock } from 'lucide-react'

interface TimelineStepProps {
  data: {
    timeline?: {
      hasEvent: boolean
      eventDate?: string
      eventType?: string
      weeks?: number
    }
  }
  onUpdate: (data: any) => void
}

const EVENT_TYPE_KEYS = [
  'centuryRide',
  'granFondo',
  'criterium',
  'roadRace',
  'timeTrial',
  'mtbRace',
  'gravelEvent',
  'multiDayTour',
  'other',
] as const

export function TimelineStep({ data, onUpdate }: TimelineStepProps) {
  const t = useTranslations('createPlan.timelineStep')
  const [hasEvent, setHasEvent] = useState(data.timeline?.hasEvent ?? false)
  const [eventDate, setEventDate] = useState(data.timeline?.eventDate || '')
  const [eventType, setEventType] = useState(data.timeline?.eventType || '')
  const [weeks, setWeeks] = useState(data.timeline?.weeks || 12)

  // Initialize timeline data on mount
  useEffect(() => {
    if (!data.timeline) {
      onUpdate({
        timeline: {
          hasEvent: false,
          weeks: 12,
        },
      })
    }
  }, [])

  const handleHasEventChange = (value: string) => {
    const hasEventBool = value === 'yes'
    setHasEvent(hasEventBool)
    onUpdate({
      timeline: {
        hasEvent: hasEventBool,
        eventDate: hasEventBool ? eventDate : undefined,
        eventType: hasEventBool ? eventType : undefined,
        weeks: hasEventBool ? undefined : weeks,
      },
    })
  }

  const handleEventDateChange = (value: string) => {
    setEventDate(value)
    onUpdate({
      timeline: {
        hasEvent: true,
        eventDate: value,
        eventType,
      },
    })
  }

  const handleEventTypeChange = (value: string) => {
    setEventType(value)
    onUpdate({
      timeline: {
        hasEvent: true,
        eventDate,
        eventType: value,
      },
    })
  }

  const handleWeeksChange = (value: number) => {
    setWeeks(value)
    onUpdate({
      timeline: {
        hasEvent: false,
        weeks: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="space-y-4">
        <Label>{t('hasEventQuestion')}</Label>
        <RadioGroup
          value={hasEvent ? 'yes' : 'no'}
          onValueChange={handleHasEventChange}
          className="grid grid-cols-2 gap-4"
        >
          <Label
            htmlFor="event-yes"
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              hasEvent ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="yes" id="event-yes" />
            <Calendar className="h-4 w-4" />
            <span>{t('yesHaveEvent')}</span>
          </Label>

          <Label
            htmlFor="event-no"
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              !hasEvent ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="no" id="event-no" />
            <Clock className="h-4 w-4" />
            <span>{t('noJustDuration')}</span>
          </Label>
        </RadioGroup>
      </div>

      {hasEvent ? (
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="event-type">{t('eventType')}</Label>
            <Select value={eventType} onValueChange={handleEventTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectEventType')} />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_KEYS.map((typeKey) => (
                  <SelectItem key={typeKey} value={typeKey}>
                    {t(`eventTypes.${typeKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-date">{t('eventDate')}</Label>
            <Input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => handleEventDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            {eventDate && (
              <p className="text-xs text-muted-foreground">
                {t('weeksUntilEvent', { weeks: calculateWeeksUntilEvent(eventDate) })}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 pt-4 border-t">
          <Label htmlFor="weeks">{t('trainingDuration')}</Label>
          <div className="space-y-4">
            <Input
              id="weeks"
              type="range"
              min="4"
              max="24"
              step="2"
              value={weeks}
              onChange={(e) => handleWeeksChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('weeksMin')}</span>
              <span className="font-semibold text-primary">{t('weeksValue', { weeks })}</span>
              <span className="text-muted-foreground">{t('weeksMax')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function calculateWeeksUntilEvent(eventDate: string): number {
  const event = new Date(eventDate)
  const now = new Date()
  const diffTime = Math.abs(event.getTime() - now.getTime())
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
  return diffWeeks
}

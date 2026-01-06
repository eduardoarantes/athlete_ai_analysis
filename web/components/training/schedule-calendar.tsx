'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { WorkoutCard } from './workout-card'
import { WorkoutDetailModal, type MatchedActivityData } from './workout-detail-modal'
import type { PlanInstance, Workout } from '@/lib/types/training-plan'
import { parseLocalDate, formatDateString } from '@/lib/utils/date-utils'
import { formatWithGoalLabels } from '@/lib/utils/format-utils'

interface ScheduleCalendarProps {
  instances: PlanInstance[]
  isAdmin?: boolean
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface ScheduledWorkout {
  workout: Workout
  instance: PlanInstance
  weekNumber: number
  date: Date
  index?: number
}

export function ScheduleCalendar({ instances, isAdmin = false }: ScheduleCalendarProps) {
  const t = useTranslations('schedule')
  const tPlan = useTranslations('trainingPlan')
  const tGoals = useTranslations('goals')
  const locale = useLocale()

  // Current month view
  const [currentDate, setCurrentDate] = useState(() => {
    // Start at the current month or the month of the first active/scheduled instance
    const activeInstance = instances.find((i) => i.status === 'active')
    const scheduledInstance = instances.find((i) => i.status === 'scheduled')
    const relevantInstance = activeInstance || scheduledInstance

    if (relevantInstance) {
      return parseLocalDate(relevantInstance.start_date)
    }
    return new Date()
  })

  const [selectedWorkout, setSelectedWorkout] = useState<ScheduledWorkout | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Matches state: Map of "instanceId:date:index" -> MatchedActivityData
  const [matchesMap, setMatchesMap] = useState<Map<string, MatchedActivityData>>(new Map())
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0)
  const autoMatchedRef = useRef<Set<string>>(new Set())

  // Build workouts list for auto-matching
  const buildWorkoutsList = useCallback(
    (instance: PlanInstance) => {
      const workouts: Array<{ date: string; index: number; tss?: number; type?: string }> = []

      if (!instance.plan_data?.weekly_plan) return workouts

      const startDate = parseLocalDate(instance.start_date)

      instance.plan_data.weekly_plan.forEach((week) => {
        if (!week.workouts) return

        week.workouts.forEach((workout, workoutIdx) => {
          const dayIndex = DAYS_OF_WEEK.findIndex(
            (d) => d.toLowerCase() === workout.weekday.toLowerCase()
          )
          if (dayIndex === -1) return

          const startDayOfWeek = startDate.getDay()
          const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
          const weekOneMonday = new Date(startDate)
          weekOneMonday.setDate(startDate.getDate() + daysToMonday)

          const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1
          const workoutDate = new Date(weekOneMonday)
          workoutDate.setDate(
            weekOneMonday.getDate() + (week.week_number - 1) * 7 + adjustedDayIndex
          )

          const workoutEntry: { date: string; index: number; tss?: number; type?: string } = {
            date: formatDateString(workoutDate),
            index: workoutIdx,
          }
          if (workout.tss !== undefined) workoutEntry.tss = workout.tss
          if (workout.type !== undefined) workoutEntry.type = workout.type
          workouts.push(workoutEntry)
        })
      })

      return workouts
    },
    []
  )

  // Fetch matches and run auto-matching
  useEffect(() => {
    const instanceIds = instances.map((i) => i.id)
    if (instanceIds.length === 0) return

    const fetchMatchesAndAutoMatch = async () => {
      try {
        // Fetch existing matches
        const response = await fetch(`/api/schedule/matches?instanceIds=${instanceIds.join(',')}`)
        if (response.ok) {
          const data = await response.json()
          const newMap = new Map<string, MatchedActivityData>()
          for (const [key, value] of Object.entries(data.matches)) {
            newMap.set(key, value as MatchedActivityData)
          }
          setMatchesMap(newMap)

          // Auto-match for each instance (only once per instance)
          let matchedAny = false
          for (const instance of instances) {
            if (autoMatchedRef.current.has(instance.id)) continue

            const workouts = buildWorkoutsList(instance)
            if (workouts.length === 0) continue

            try {
              const autoResponse = await fetch('/api/schedule/matches/auto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  plan_instance_id: instance.id,
                  workouts,
                }),
              })

              if (autoResponse.ok) {
                const autoData = await autoResponse.json()
                if (autoData.matched > 0) {
                  matchedAny = true
                }
              }

              autoMatchedRef.current.add(instance.id)
            } catch {
              // Silently fail auto-matching
            }
          }

          // Refresh matches if any were auto-matched
          if (matchedAny) {
            const refreshResponse = await fetch(
              `/api/schedule/matches?instanceIds=${instanceIds.join(',')}`
            )
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              const refreshMap = new Map<string, MatchedActivityData>()
              for (const [key, value] of Object.entries(refreshData.matches)) {
                refreshMap.set(key, value as MatchedActivityData)
              }
              setMatchesMap(refreshMap)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch matches:', error)
      }
    }

    fetchMatchesAndAutoMatch()
  }, [instances, matchesRefreshKey, buildWorkoutsList])

  const handleMatchChange = () => {
    setMatchesRefreshKey((prev) => prev + 1)
  }

  // Get FTP from first instance's athlete profile
  const ftp = instances[0]?.plan_data?.athlete_profile?.ftp || 200

  // Build a map of date -> workouts from all instances
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>()

    instances.forEach((instance) => {
      if (!instance.plan_data?.weekly_plan) return

      const startDate = parseLocalDate(instance.start_date)

      instance.plan_data.weekly_plan.forEach((week) => {
        if (!week.workouts) return

        week.workouts.forEach((workout) => {
          // Calculate the actual date for this workout
          const dayIndex = DAYS_OF_WEEK.findIndex(
            (d) => d.toLowerCase() === workout.weekday.toLowerCase()
          )
          if (dayIndex === -1) return

          // Week 1 starts on start_date, find the Monday of that week
          const startDayOfWeek = startDate.getDay()
          const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
          const weekOneMonday = new Date(startDate)
          weekOneMonday.setDate(startDate.getDate() + daysToMonday)

          // Calculate the actual date: weekOneMonday + (week_number - 1) * 7 + dayIndex
          // Adjust dayIndex: our array is Sunday=0, but we want Monday=0 for calculation
          const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1
          const workoutDate = new Date(weekOneMonday)
          workoutDate.setDate(
            weekOneMonday.getDate() + (week.week_number - 1) * 7 + adjustedDayIndex
          )

          const dateKey = formatDateString(workoutDate)
          const existing = map.get(dateKey) || []
          existing.push({
            workout,
            instance,
            weekNumber: week.week_number,
            date: workoutDate,
          })
          map.set(dateKey, existing)
        })
      })
    })

    return map
  }, [instances])

  // Get calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // First day of month
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()

    // Last day of month
    const lastDay = new Date(year, month + 1, 0)
    const lastDate = lastDay.getDate()

    // Build calendar grid (6 weeks max)
    const days: (Date | null)[] = []

    // Add empty cells for days before first of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of month
    for (let day = 1; day <= lastDate; day++) {
      days.push(new Date(year, month, day))
    }

    // Pad to complete the last week
    while (days.length % 7 !== 0) {
      days.push(null)
    }

    return days
  }, [currentDate])

  const handleWorkoutClick = (scheduledWorkout: ScheduledWorkout) => {
    setSelectedWorkout(scheduledWorkout)
    setModalOpen(true)
  }

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const today = new Date()
  const todayKey = formatDateString(today)

  const monthName = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{monthName}</h2>
        <div className="flex gap-2">
          <Button onClick={goToToday} variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            {t('today')}
          </Button>
          <Button
            onClick={goToPreviousMonth}
            variant="outline"
            size="icon"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={goToNextMonth} variant="outline" size="icon" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-muted">
          {/* Header Row */}
          {DAYS_SHORT.map((day) => (
            <div key={day} className="bg-background p-2 text-center text-sm font-medium">
              {day}
            </div>
          ))}

          {/* Day Cells */}
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="bg-muted/30 min-h-[120px]" />
            }

            const dateKey = formatDateString(date)
            const workouts = workoutsByDate.get(dateKey) || []
            const isToday = dateKey === todayKey
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()

            return (
              <div
                key={dateKey}
                className={`bg-background p-1.5 min-h-[120px] ${
                  isToday ? 'ring-2 ring-primary ring-inset' : ''
                } ${!isCurrentMonth ? 'opacity-50' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {date.getDate()}
                </div>

                {workouts.length > 0 ? (
                  <div className="space-y-1">
                    {workouts.map((sw, idx) => (
                      <div key={`${sw.instance.id}-${idx}`} className="relative">
                        {instances.length > 1 && (
                          <Badge
                            variant="outline"
                            className="absolute -top-1 -right-1 text-[8px] px-1 py-0 z-10"
                          >
                            {formatWithGoalLabels(sw.instance.name, tGoals).substring(0, 3)}
                          </Badge>
                        )}
                        <WorkoutCard
                          workout={sw.workout}
                          matchedActivity={matchesMap.get(`${sw.instance.id}:${dateKey}:${idx}`)}
                          className="text-[9px]"
                          onClick={() => handleWorkoutClick({ ...sw, index: idx })}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full" />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
          <span>{tPlan('workoutTypes.endurance')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
          <span>{tPlan('workoutTypes.tempo')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200" />
          <span>{tPlan('workoutTypes.threshold')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
          <span>{tPlan('workoutTypes.vo2max')}</span>
        </div>
      </div>

      {/* Workout Detail Modal */}
      <WorkoutDetailModal
        workout={selectedWorkout?.workout || null}
        weekNumber={selectedWorkout?.weekNumber || 0}
        ftp={ftp}
        open={modalOpen}
        onOpenChange={setModalOpen}
        isAdmin={isAdmin}
        planInstanceId={selectedWorkout?.instance.id}
        workoutDate={selectedWorkout ? formatDateString(selectedWorkout.date) : undefined}
        workoutIndex={selectedWorkout?.index}
        matchedActivity={
          selectedWorkout
            ? matchesMap.get(
                `${selectedWorkout.instance.id}:${formatDateString(selectedWorkout.date)}:${selectedWorkout.index}`
              )
            : undefined
        }
        onMatchChange={handleMatchChange}
      />
    </div>
  )
}

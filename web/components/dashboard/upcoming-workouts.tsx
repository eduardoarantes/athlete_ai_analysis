'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Zap, ChevronRight } from 'lucide-react'
import { getWorkoutIntensityColors } from '@/lib/constants/activity-styles'

export interface UpcomingWorkoutData {
  id: string
  instanceId: string
  name: string
  type: string
  weekNumber: number
  date: string // ISO string
  durationMinutes: number
  tss?: number
}

interface UpcomingWorkoutsProps {
  workouts: UpcomingWorkoutData[]
}

export function UpcomingWorkouts({ workouts }: UpcomingWorkoutsProps) {
  const t = useTranslations('dashboard')
  const locale = useLocale()

  if (workouts.length === 0) {
    return null
  }

  const formatWeekday = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    if (dateOnly.getTime() === today.getTime()) {
      return t('today')
    }
    if (dateOnly.getTime() === tomorrow.getTime()) {
      return t('tomorrow')
    }
    return date.toLocaleDateString(locale, {
      weekday: 'short',
    })
  }

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale, {
      month: 'short',
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">{t('upcomingWorkouts')}</CardTitle>
          <CardDescription className="text-xs">{t('upcomingWorkoutsDescription')}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/schedule">
            {t('viewSchedule')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {workouts.map((workout) => {
          const date = new Date(workout.date)

          return (
            <Link key={workout.id} href={`/schedule/${workout.instanceId}`} className="block">
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                {/* Date Column */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="text-xs text-muted-foreground">{formatWeekday(workout.date)}</div>
                  <div className="text-lg font-bold">{date.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatMonth(workout.date)}
                  </div>
                </div>

                {/* Workout Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${getWorkoutIntensityColors(workout.type)}`}
                    >
                      {workout.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Week {workout.weekNumber}</span>
                  </div>
                  <h4 className="font-medium text-sm truncate">{workout.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {workout.durationMinutes}min
                    </span>
                    {workout.tss && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {workout.tss} TSS
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

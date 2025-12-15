'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Activity {
  id: string
  strava_activity_id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_watts?: number
  weighted_average_watts?: number
  average_heartrate?: number
}

interface ActivitiesCalendarProps {
  sportTypeFilter?: string
}

export function ActivitiesCalendar({ sportTypeFilter }: ActivitiesCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivitiesForMonth()
  }, [currentDate, sportTypeFilter])

  const loadActivitiesForMonth = async () => {
    try {
      setLoading(true)

      // Get first and last day of the month
      const firstDay = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      )
      const lastDay = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59
      )

      const params = new URLSearchParams({
        startDate: firstDay.toISOString(),
        endDate: lastDay.toISOString(),
        sortBy: 'start_date',
        sortOrder: 'asc',
        limit: '1000', // Get all activities for the month
      })

      if (sportTypeFilter) {
        params.append('sportType', sportTypeFilter)
      }

      const res = await fetch(`/api/activities?${params}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities || [])
      }
    } catch (err) {
      console.error('Failed to load activities for month:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDistance = (meters: number) => {
    const km = meters / 1000
    return `${km.toFixed(1)} km`
  }

  // Get first day of current month
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  )
  const lastDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  )

  // Get day of week for first day (0 = Sunday)
  const firstDayOfWeek = firstDayOfMonth.getDay()

  // Generate calendar days
  const daysInMonth = lastDayOfMonth.getDate()
  const calendarDays: (number | null)[] = []

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null)
  }

  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // Group activities by date
  const activitiesByDate = new Map<string, Activity[]>()
  activities.forEach((activity) => {
    const activityDate = new Date(activity.start_date)
    const dateKey = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}`

    if (!activitiesByDate.has(dateKey)) {
      activitiesByDate.set(dateKey, [])
    }
    activitiesByDate.get(dateKey)?.push(activity)
  })

  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    )
  }

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    )
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  if (loading) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Loading calendar...
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{monthName}</h2>
        <div className="flex gap-2">
          <Button onClick={goToToday} variant="outline" size="sm">
            Today
          </Button>
          <Button
            onClick={goToPreviousMonth}
            variant="outline"
            size="icon"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={goToNextMonth}
            variant="outline"
            size="icon"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-muted">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="bg-background p-2 text-center text-sm font-medium"
            >
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="bg-muted/50 min-h-[120px]"
                />
              )
            }

            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayActivities = activitiesByDate.get(dateKey) || []

            const isToday =
              new Date().toDateString() ===
              new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                day
              ).toDateString()

            return (
              <div
                key={day}
                className={`bg-background p-2 min-h-[120px] ${
                  isToday ? 'ring-2 ring-primary ring-inset' : ''
                }`}
              >
                <div className="flex flex-col h-full">
                  <div
                    className={`text-sm font-medium mb-2 ${
                      isToday
                        ? 'text-primary font-bold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-1 flex-1 overflow-y-auto">
                    {dayActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"
                        title={`${activity.name}\n${formatDistance(activity.distance)} • ${formatDuration(activity.moving_time)}`}
                      >
                        <div className="font-medium truncate">
                          {activity.name}
                        </div>
                        <div className="text-muted-foreground">
                          {formatDistance(activity.distance)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-primary" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/10" />
          <span>Activity</span>
        </div>
      </div>
    </div>
  )
}

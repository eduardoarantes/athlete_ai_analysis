'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Bike,
  Monitor,
  PersonStanding,
  Waves,
  Mountain,
  Dumbbell,
  Zap,
  TrendingUp,
  Snowflake,
  Ship,
  Wind,
  Activity,
  Trophy,
  Target,
  Flag,
  User
} from 'lucide-react'

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

const getActivityIcon = (sportType: string) => {
  const iconProps = { className: 'h-3 w-3 flex-shrink-0', strokeWidth: 2 }

  switch (sportType) {
    // Cycling
    case 'Ride':
      return <Bike {...iconProps} />
    case 'VirtualRide':
      return <Monitor {...iconProps} />
    case 'EBikeRide':
    case 'EMountainBikeRide':
      return <Zap {...iconProps} />
    case 'GravelRide':
    case 'MountainBikeRide':
      return <Mountain {...iconProps} />

    // Running
    case 'Run':
    case 'VirtualRun':
    case 'TrailRun':
      return <PersonStanding {...iconProps} />

    // Swimming
    case 'Swim':
      return <Waves {...iconProps} />

    // Walking/Hiking
    case 'Walk':
      return <PersonStanding {...iconProps} />
    case 'Hike':
      return <Mountain {...iconProps} />

    // Winter Sports
    case 'AlpineSki':
    case 'BackcountrySki':
    case 'NordicSki':
    case 'Snowboard':
    case 'Snowshoe':
      return <Snowflake {...iconProps} />
    case 'IceSkate':
      return <Snowflake {...iconProps} />

    // Water Sports
    case 'Kayaking':
    case 'Canoeing':
    case 'Rowing':
    case 'StandUpPaddling':
    case 'Kitesurf':
    case 'Windsurf':
      return <Ship {...iconProps} />
    case 'Surfing':
      return <Waves {...iconProps} />

    // Strength & Fitness
    case 'WeightTraining':
      return <Dumbbell {...iconProps} />
    case 'Workout':
    case 'CrossFit':
    case 'HIIT':
      return <Activity {...iconProps} />
    case 'Yoga':
    case 'Pilates':
      return <User {...iconProps} />

    // Indoor Cardio
    case 'Elliptical':
    case 'StairStepper':
      return <TrendingUp {...iconProps} />

    // Skating
    case 'InlineSkate':
    case 'RollerSki':
      return <Wind {...iconProps} />

    // Climbing
    case 'RockClimbing':
      return <Mountain {...iconProps} />

    // Sports
    case 'Golf':
      return <Flag {...iconProps} />
    case 'Tennis':
    case 'Badminton':
    case 'Squash':
      return <Target {...iconProps} />
    case 'Soccer':
    case 'Football':
    case 'Basketball':
    case 'Baseball':
    case 'Softball':
    case 'Hockey':
    case 'IceHockey':
    case 'Rugby':
    case 'Volleyball':
      return <Trophy {...iconProps} />

    // Default
    default:
      return <Activity {...iconProps} />
  }
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

      // Calculate the visible date range (including previous/next month days)
      const firstDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      )
      const firstDayOfWeek = firstDayOfMonth.getDay()

      // First visible day (may be from previous month)
      const firstVisibleDay = new Date(firstDayOfMonth)
      firstVisibleDay.setDate(firstVisibleDay.getDate() - firstDayOfWeek)
      firstVisibleDay.setHours(0, 0, 0, 0)

      // Last day of month
      const lastDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      )

      // Calculate total calendar cells needed
      const daysInMonth = lastDayOfMonth.getDate()
      const totalCells = firstDayOfWeek + daysInMonth
      const weeksNeeded = Math.ceil(totalCells / 7)

      // Last visible day (may be from next month)
      const lastVisibleDay = new Date(firstVisibleDay)
      lastVisibleDay.setDate(lastVisibleDay.getDate() + weeksNeeded * 7 - 1)
      lastVisibleDay.setHours(23, 59, 59, 999)

      const params = new URLSearchParams({
        startDate: firstVisibleDay.toISOString(),
        endDate: lastVisibleDay.toISOString(),
        sortBy: 'start_date',
        sortOrder: 'asc',
        limit: '1000', // Get all activities for visible period
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

  // Calculate first visible day (may be from previous month)
  const firstVisibleDate = new Date(firstDayOfMonth)
  firstVisibleDate.setDate(firstVisibleDate.getDate() - firstDayOfWeek)

  // Generate calendar days (including previous and next month)
  const daysInMonth = lastDayOfMonth.getDate()
  const totalCells = firstDayOfWeek + daysInMonth
  const weeksNeeded = Math.ceil(totalCells / 7)
  const totalDays = weeksNeeded * 7

  const calendarDays: Date[] = []
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(firstVisibleDate)
    date.setDate(date.getDate() + i)
    calendarDays.push(date)
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

  // Calculate monthly summary stats (only for current month activities)
  const currentMonthActivities = activities.filter((activity) => {
    const activityDate = new Date(activity.start_date)
    return (
      activityDate.getMonth() === currentDate.getMonth() &&
      activityDate.getFullYear() === currentDate.getFullYear()
    )
  })

  const totalActivities = currentMonthActivities.length
  const activeDays = new Set(
    currentMonthActivities.map((activity) => {
      const date = new Date(activity.start_date)
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    })
  ).size
  const totalHours =
    currentMonthActivities.reduce(
      (sum, activity) => sum + activity.moving_time,
      0
    ) / 3600
  const totalDistance =
    currentMonthActivities.reduce(
      (sum, activity) => sum + activity.distance,
      0
    ) / 1000

  return (
    <div className="space-y-4 relative">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{monthName}</h2>
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
            <span>
              {totalActivities} {totalActivities === 1 ? 'activity' : 'activities'}
            </span>
            <span>•</span>
            <span>
              {activeDays} active {activeDays === 1 ? 'day' : 'days'}
            </span>
            <span>•</span>
            <span>{totalDistance.toFixed(0)} km</span>
            <span>•</span>
            <span>{totalHours.toFixed(1)} hours</span>
          </div>
        </div>
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
          {calendarDays.map((date, index) => {
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            const dayActivities = activitiesByDate.get(dateKey) || []

            const isToday = new Date().toDateString() === date.toDateString()
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()

            return (
              <div
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                className={`bg-background p-2 min-h-[120px] ${
                  isToday ? 'ring-2 ring-primary ring-inset' : ''
                } ${!isCurrentMonth ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col h-full">
                  <div
                    className={`text-sm font-medium mb-2 ${
                      isToday
                        ? 'text-primary font-bold'
                        : isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1 flex-1 overflow-y-auto">
                    {dayActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"
                        title={`${activity.name}\n${formatDistance(activity.distance)} • ${formatDuration(activity.moving_time)}`}
                      >
                        <div className="font-medium flex items-center gap-1 min-w-0">
                          {getActivityIcon(activity.sport_type)}
                          <span className="truncate flex-1">{activity.name}</span>
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

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading activities...</p>
          </div>
        </div>
      )}
    </div>
  )
}

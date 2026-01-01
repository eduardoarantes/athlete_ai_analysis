'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mountain, Bike, Footprints, Waves, Activity, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityStats {
  sport_type: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  start_date: string
}

interface StatsPanelProps {
  yearActivities: ActivityStats[]
  last4WeeksActivities: ActivityStats[]
  lastYearActivities: ActivityStats[]
  translations: {
    stats: string
    thisYear: string
    last4Weeks: string
    lastYear: string
  }
}

// Sport categories - group similar sports together
const SPORT_GROUPS: Record<string, string[]> = {
  Ride: ['Ride', 'VirtualRide', 'EBikeRide', 'EMountainBikeRide', 'GravelRide', 'MountainBikeRide'],
  Run: ['Run', 'VirtualRun', 'TrailRun'],
  Swim: ['Swim'],
  Walk: ['Walk', 'Hike'],
  WeightTraining: ['WeightTraining', 'Workout', 'Crossfit'],
}

// Get the grouped sport type for a given sport
function getGroupedSport(sportType: string): string {
  for (const [group, sports] of Object.entries(SPORT_GROUPS)) {
    if (sports.includes(sportType)) {
      return group
    }
  }
  return sportType // Return as-is if not in any group
}

// Get icon for sport group
function getSportIcon(sport: string, isActive: boolean) {
  const iconClass = cn(
    'h-4 w-4 transition-colors',
    isActive ? 'text-primary' : 'text-muted-foreground'
  )

  switch (sport) {
    case 'Ride':
      return <Bike className={iconClass} />
    case 'Run':
      return <Footprints className={iconClass} />
    case 'Swim':
      return <Waves className={iconClass} />
    case 'Walk':
      return <Mountain className={iconClass} />
    case 'WeightTraining':
      return <Dumbbell className={iconClass} />
    default:
      return <Activity className={iconClass} />
  }
}

// Calculate stats for a set of activities
function calculateStats(activities: ActivityStats[]) {
  return activities.reduce(
    (acc, activity) => ({
      distance: acc.distance + (activity.distance || 0),
      elevation: acc.elevation + (activity.total_elevation_gain || 0),
      count: acc.count + 1,
    }),
    { distance: 0, elevation: 0, count: 0 }
  )
}

// Format number with thousands separator
function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function StatsPanel({
  yearActivities,
  last4WeeksActivities,
  lastYearActivities,
  translations: t,
}: StatsPanelProps) {
  // Get top 4 sports from yearly activities (or last year if current year is empty)
  const topSports = useMemo(() => {
    const sportCounts: Record<string, number> = {}

    // Use current year activities if available, otherwise fall back to last year
    const activitiesToCount = yearActivities.length > 0 ? yearActivities : lastYearActivities

    activitiesToCount.forEach((activity) => {
      const groupedSport = getGroupedSport(activity.sport_type)
      sportCounts[groupedSport] = (sportCounts[groupedSport] || 0) + 1
    })

    return Object.entries(sportCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([sport]) => sport)
  }, [yearActivities, lastYearActivities])

  // Default to most common sport, or 'all' if no activities
  const [selectedSport, setSelectedSport] = useState<string | null>(null)

  // Set default sport on first render
  const activeSport = selectedSport ?? (topSports[0] || null)

  // Filter activities by selected sport
  const filterBySport = useCallback(
    (activities: ActivityStats[]) => {
      if (!activeSport) return activities
      return activities.filter((a) => getGroupedSport(a.sport_type) === activeSport)
    },
    [activeSport]
  )

  // Calculate filtered stats
  const last4WeeksStats = useMemo(
    () => calculateStats(filterBySport(last4WeeksActivities)),
    [last4WeeksActivities, filterBySport]
  )
  const yearStats = useMemo(
    () => calculateStats(filterBySport(yearActivities)),
    [yearActivities, filterBySport]
  )
  const lastYearStats = useMemo(
    () => calculateStats(filterBySport(lastYearActivities)),
    [lastYearActivities, filterBySport]
  )

  if (topSports.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{t.stats}</CardTitle>
          {/* Sport filter buttons */}
          <div className="flex items-center gap-1">
            {topSports.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  activeSport === sport ? 'bg-primary/10' : 'hover:bg-muted'
                )}
                title={sport}
              >
                {getSportIcon(sport, activeSport === sport)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last 4 Weeks */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t.last4Weeks}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{formatNumber(last4WeeksStats.count)}</p>
              <p className="text-[10px] text-muted-foreground">activities</p>
            </div>
            <div>
              <p className="text-lg font-bold">
                {formatNumber(Math.round(last4WeeksStats.distance / 1000))}
              </p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <Mountain className="h-3 w-3 text-muted-foreground" />
                <p className="text-lg font-bold">
                  {formatNumber(Math.round(last4WeeksStats.elevation))}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">m</p>
            </div>
          </div>
        </div>

        {/* This Year */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t.thisYear}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{formatNumber(yearStats.count)}</p>
              <p className="text-[10px] text-muted-foreground">activities</p>
            </div>
            <div>
              <p className="text-lg font-bold">
                {formatNumber(Math.round(yearStats.distance / 1000))}
              </p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <Mountain className="h-3 w-3 text-muted-foreground" />
                <p className="text-lg font-bold">{formatNumber(Math.round(yearStats.elevation))}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">m</p>
            </div>
          </div>
        </div>

        {/* Last Year */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t.lastYear}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{formatNumber(lastYearStats.count)}</p>
              <p className="text-[10px] text-muted-foreground">activities</p>
            </div>
            <div>
              <p className="text-lg font-bold">
                {formatNumber(Math.round(lastYearStats.distance / 1000))}
              </p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <Mountain className="h-3 w-3 text-muted-foreground" />
                <p className="text-lg font-bold">
                  {formatNumber(Math.round(lastYearStats.elevation))}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">m</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

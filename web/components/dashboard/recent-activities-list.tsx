'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
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
  User,
  ExternalLink,
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
}

interface RecentActivitiesListProps {
  activities: Activity[]
  stravaConnected: boolean
}

const getActivityIcon = (sportType: string) => {
  const iconProps = { className: 'h-4 w-4 flex-shrink-0', strokeWidth: 2 }

  switch (sportType) {
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
    case 'Run':
    case 'VirtualRun':
    case 'TrailRun':
      return <PersonStanding {...iconProps} />
    case 'Swim':
      return <Waves {...iconProps} />
    case 'Walk':
      return <PersonStanding {...iconProps} />
    case 'Hike':
      return <Mountain {...iconProps} />
    case 'AlpineSki':
    case 'BackcountrySki':
    case 'NordicSki':
    case 'Snowboard':
    case 'Snowshoe':
    case 'IceSkate':
      return <Snowflake {...iconProps} />
    case 'Kayaking':
    case 'Canoeing':
    case 'Rowing':
    case 'StandUpPaddling':
    case 'Kitesurf':
    case 'Windsurf':
      return <Ship {...iconProps} />
    case 'Surfing':
      return <Waves {...iconProps} />
    case 'WeightTraining':
      return <Dumbbell {...iconProps} />
    case 'Workout':
    case 'CrossFit':
    case 'HIIT':
      return <Activity {...iconProps} />
    case 'Yoga':
    case 'Pilates':
      return <User {...iconProps} />
    case 'Elliptical':
    case 'StairStepper':
      return <TrendingUp {...iconProps} />
    case 'InlineSkate':
    case 'RollerSki':
      return <Wind {...iconProps} />
    case 'RockClimbing':
      return <Mountain {...iconProps} />
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
    default:
      return <Activity {...iconProps} />
  }
}

const getActivityColors = (sportType: string) => {
  switch (sportType) {
    case 'Ride':
      return 'bg-blue-100/80 hover:bg-blue-200/80 border-blue-200'
    case 'VirtualRide':
      return 'bg-blue-50/80 hover:bg-blue-100/80 border-blue-100'
    case 'EBikeRide':
    case 'EMountainBikeRide':
      return 'bg-violet-100/80 hover:bg-violet-200/80 border-violet-200'
    case 'GravelRide':
    case 'MountainBikeRide':
      return 'bg-blue-200/80 hover:bg-blue-300/80 border-blue-300'
    case 'Run':
      return 'bg-orange-100/80 hover:bg-orange-200/80 border-orange-200'
    case 'VirtualRun':
      return 'bg-orange-50/80 hover:bg-orange-100/80 border-orange-100'
    case 'TrailRun':
      return 'bg-amber-100/80 hover:bg-amber-200/80 border-amber-200'
    case 'Swim':
      return 'bg-cyan-100/80 hover:bg-cyan-200/80 border-cyan-200'
    case 'Walk':
      return 'bg-green-100/80 hover:bg-green-200/80 border-green-200'
    case 'Hike':
      return 'bg-emerald-100/80 hover:bg-emerald-200/80 border-emerald-200'
    case 'AlpineSki':
    case 'BackcountrySki':
    case 'NordicSki':
      return 'bg-sky-100/80 hover:bg-sky-200/80 border-sky-200'
    case 'Snowboard':
      return 'bg-sky-200/80 hover:bg-sky-300/80 border-sky-300'
    case 'Snowshoe':
      return 'bg-sky-50/80 hover:bg-sky-100/80 border-sky-100'
    case 'IceSkate':
      return 'bg-indigo-100/80 hover:bg-indigo-200/80 border-indigo-200'
    case 'Kayaking':
    case 'Canoeing':
      return 'bg-teal-100/80 hover:bg-teal-200/80 border-teal-200'
    case 'Rowing':
      return 'bg-teal-200/80 hover:bg-teal-300/80 border-teal-300'
    case 'StandUpPaddling':
    case 'Surfing':
      return 'bg-cyan-200/80 hover:bg-cyan-300/80 border-cyan-300'
    case 'Kitesurf':
    case 'Windsurf':
      return 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-100'
    case 'WeightTraining':
      return 'bg-purple-100/80 hover:bg-purple-200/80 border-purple-200'
    case 'Workout':
    case 'CrossFit':
    case 'HIIT':
      return 'bg-purple-200/80 hover:bg-purple-300/80 border-purple-300'
    case 'Yoga':
    case 'Pilates':
      return 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-100'
    case 'Elliptical':
    case 'StairStepper':
      return 'bg-rose-100/80 hover:bg-rose-200/80 border-rose-200'
    case 'InlineSkate':
    case 'RollerSki':
      return 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-100'
    case 'RockClimbing':
      return 'bg-stone-200/80 hover:bg-stone-300/80 border-stone-300'
    case 'Golf':
      return 'bg-lime-100/80 hover:bg-lime-200/80 border-lime-200'
    case 'Tennis':
    case 'Badminton':
    case 'Squash':
      return 'bg-yellow-100/80 hover:bg-yellow-200/80 border-yellow-200'
    case 'Soccer':
    case 'Football':
    case 'Basketball':
      return 'bg-red-100/80 hover:bg-red-200/80 border-red-200'
    case 'Baseball':
    case 'Softball':
      return 'bg-red-50/80 hover:bg-red-100/80 border-red-100'
    case 'Hockey':
    case 'IceHockey':
      return 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200'
    case 'Rugby':
    case 'Volleyball':
      return 'bg-red-200/80 hover:bg-red-300/80 border-red-300'
    default:
      return 'bg-gray-100/80 hover:bg-gray-200/80 border-gray-200'
  }
}

export function RecentActivitiesList({ activities, stravaConnected }: RecentActivitiesListProps) {
  const t = useTranslations('activities')

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-12 h-12 text-muted-foreground mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
          />
        </svg>
        <h3 className="font-semibold text-lg mb-2">{t('noActivities')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {stravaConnected
            ? t('activitiesWillAppear')
            : t('connectStravaPrompt')}
        </p>
        <Button asChild>
          <Link href={stravaConnected ? '/activities' : '/settings/integrations'}>
            {stravaConnected ? t('syncActivities') : t('connectStrava')}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const date = new Date(activity.start_date)
        const distance = (activity.distance / 1000).toFixed(1)
        const duration = Math.floor(activity.moving_time / 60)
        const hours = Math.floor(duration / 60)
        const minutes = duration % 60

        return (
          <a
            key={activity.id}
            href={`https://www.strava.com/activities/${activity.strava_activity_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors group ${getActivityColors(activity.sport_type)}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {getActivityIcon(activity.sport_type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate flex items-center gap-2">
                  {activity.name}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#FC4C02] flex-shrink-0" />
                </h4>
                <p className="text-sm text-muted-foreground">
                  {date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {' • '}
                  {activity.sport_type}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <p className="font-medium">{distance} km</p>
              <p className="text-sm text-muted-foreground">
                {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
              </p>
            </div>
          </a>
        )
      })}
    </div>
  )
}

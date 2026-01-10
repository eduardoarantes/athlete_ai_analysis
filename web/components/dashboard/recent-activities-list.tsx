'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { getActivityIcon, getActivityColors } from '@/lib/constants/activity-styles'

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

export function RecentActivitiesList({ activities, stravaConnected }: RecentActivitiesListProps) {
  const t = useTranslations('activities')
  const locale = useLocale()

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
          {stravaConnected ? t('activitiesWillAppear') : t('connectStravaPrompt')}
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
              <div className="flex-shrink-0">{getActivityIcon(activity.sport_type)}</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate flex items-center gap-2">
                  {activity.name}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground flex-shrink-0" />
                </h4>
                <p className="text-sm text-muted-foreground">
                  {date.toLocaleDateString(locale, {
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

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ActivitiesCalendar } from '@/components/activities/activities-calendar'
import { Calendar, Table, Search } from 'lucide-react'

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
  tss?: number | null
  tss_method?: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ActivitiesPage() {
  const t = useTranslations('activitiesPage')
  const [activities, setActivities] = useState<Activity[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('start_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sportTypeFilter, setSportTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')

  useEffect(() => {
    loadActivities()
  }, [pagination.page, sortBy, sortOrder, sportTypeFilter, searchQuery])

  const loadActivities = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      })

      if (sportTypeFilter) {
        params.append('sportType', sportTypeFilter)
      }

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const res = await fetch(`/api/activities?${params}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('subtitle')}
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4 items-center flex-wrap">
            {/* View Toggle */}
            <div className="flex gap-1 border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="gap-2"
              >
                <Table className="h-4 w-4" />
                {t('tableView')}
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                {t('calendarView')}
              </Button>
            </div>

            {/* Search Input - Only for Table View */}
            {viewMode === 'table' && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPagination((p) => ({ ...p, page: 1 }))
                  }}
                  className="pl-9"
                />
              </div>
            )}

            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium">{t('sportType')}:</label>
              <select
                value={sportTypeFilter}
                onChange={(e) => {
                  setSportTypeFilter(e.target.value)
                  setPagination((p) => ({ ...p, page: 1 }))
                }}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="">{t('all')}</option>
                <option value="Ride">{t('ride')}</option>
                <option value="VirtualRide">{t('virtualRide')}</option>
                <option value="Run">{t('run')}</option>
                <option value="Swim">{t('swim')}</option>
              </select>
            </div>

            {viewMode === 'table' && (
              <>
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium">{t('sortBy')}:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="start_date">{t('date')}</option>
                    <option value="distance">{t('distance')}</option>
                    <option value="moving_time">{t('duration')}</option>
                    <option value="average_watts">{t('power')}</option>
                    <option value="tss">{t('tss')}</option>
                  </select>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium">{t('order')}:</label>
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as 'asc' | 'desc')
                    }
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="desc">{t('descending')}</option>
                    <option value="asc">{t('ascending')}</option>
                  </select>
                </div>
              </>
            )}

            <div className="ml-auto text-sm text-muted-foreground">
              {t('totalActivities', { count: pagination.total })}
            </div>
          </div>
        </Card>

        {/* Activities View */}
        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">
            {t('loading')}
          </Card>
        ) : activities.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {t('noActivities')}
            </p>
          </Card>
        ) : viewMode === 'table' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      {t('date')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      {t('activity')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      {t('type')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t('distance')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t('duration')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t('elevation')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t('power')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t('hr')}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t('tss')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activities.map((activity) => (
                    <tr
                      key={activity.id}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(activity.start_date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {activity.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {activity.sport_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatDistance(activity.distance)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatDuration(activity.moving_time)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {Math.round(activity.total_elevation_gain)}m
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {activity.weighted_average_watts
                          ? `${Math.round(activity.weighted_average_watts)}W`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {activity.average_heartrate
                          ? `${Math.round(activity.average_heartrate)} bpm`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {activity.tss != null ? (
                          <span title={activity.tss_method ? t(`tssMethod.${activity.tss_method}`) : ''}>
                            {Math.round(activity.tss)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <ActivitiesCalendar sportTypeFilter={sportTypeFilter} />
        )}

        {/* Pagination - Only for Table View */}
        {viewMode === 'table' && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page - 1 }))
              }
              disabled={pagination.page === 1}
              variant="outline"
            >
              {t('previous')}
            </Button>
            <div className="flex items-center px-4">
              {t('pageOf', { current: pagination.page, total: pagination.totalPages })}
            </div>
            <Button
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page + 1 }))
              }
              disabled={pagination.page === pagination.totalPages}
              variant="outline"
            >
              {t('next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

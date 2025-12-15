'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

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

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ActivitiesPage() {
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

  useEffect(() => {
    loadActivities()
  }, [pagination.page, sortBy, sortOrder, sportTypeFilter])

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
          <h1 className="text-3xl font-bold">Activities</h1>
          <p className="text-muted-foreground mt-2">
            Browse and analyze your synced Strava activities
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium">Sport Type:</label>
              <select
                value={sportTypeFilter}
                onChange={(e) => {
                  setSportTypeFilter(e.target.value)
                  setPagination((p) => ({ ...p, page: 1 }))
                }}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="">All</option>
                <option value="Ride">Ride</option>
                <option value="VirtualRide">Virtual Ride</option>
                <option value="Run">Run</option>
                <option value="Swim">Swim</option>
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="start_date">Date</option>
                <option value="distance">Distance</option>
                <option value="moving_time">Duration</option>
                <option value="average_watts">Power</option>
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium">Order:</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-muted-foreground">
              {pagination.total} total activities
            </div>
          </div>
        </Card>

        {/* Activities Table */}
        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">
            Loading activities...
          </Card>
        ) : activities.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No activities found. Sync your Strava account to see activities.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Activity
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Distance
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Elevation
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Power
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      HR
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page - 1 }))
              }
              disabled={pagination.page === 1}
              variant="outline"
            >
              Previous
            </Button>
            <div className="flex items-center px-4">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <Button
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page + 1 }))
              }
              disabled={pagination.page === pagination.totalPages}
              variant="outline"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

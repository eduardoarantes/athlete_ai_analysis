import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/types/database'

type AthleteProfile = Database['public']['Tables']['athlete_profiles']['Row']

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if athlete profile exists
  let profile: AthleteProfile | null = null
  if (user?.id) {
    const { data } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = (data as AthleteProfile | null)
  }

  // Fetch activity statistics
  let activityCount = 0
  let recentActivities: any[] = []
  let weeklyStats = { distance: 0, time: 0 }
  let monthlyStats = { distance: 0, time: 0 }
  let stravaConnected = false

  if (user?.id) {
    // Check Strava connection
    const { data: connection } = await supabase
      .from('strava_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()
    stravaConnected = !!connection

    if (stravaConnected) {
      // Get total activity count
      const { count } = await supabase
        .from('strava_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      activityCount = count || 0

      // Get recent activities (last 5)
      const { data: activities } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(5)
      recentActivities = activities || []

      // Get weekly stats (last 7 days)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data: weekActivities } = await supabase
        .from('strava_activities')
        .select('distance, moving_time')
        .eq('user_id', user.id)
        .gte('start_date', weekAgo.toISOString())

      if (weekActivities) {
        weeklyStats = weekActivities.reduce(
          (acc, activity) => ({
            distance: acc.distance + (activity.distance || 0),
            time: acc.time + (activity.moving_time || 0),
          }),
          { distance: 0, time: 0 }
        )
      }

      // Get monthly stats (last 30 days)
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 30)
      const { data: monthActivities } = await supabase
        .from('strava_activities')
        .select('distance, moving_time')
        .eq('user_id', user.id)
        .gte('start_date', monthAgo.toISOString())

      if (monthActivities) {
        monthlyStats = monthActivities.reduce(
          (acc, activity) => ({
            distance: acc.distance + (activity.distance || 0),
            time: acc.time + (activity.moving_time || 0),
          }),
          { distance: 0, time: 0 }
        )
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your cycling performance.</p>
      </div>

      {/* Profile Completion Prompt */}
      {!profile && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>Complete your athlete profile to get personalized AI analysis.</span>
            <Button asChild size="sm">
              <Link href="/profile">Complete Profile</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">FTP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.ftp ?? '—'} W</div>
            <p className="text-xs text-muted-foreground">
              {profile && profile.ftp ? 'Functional Threshold Power' : 'Set up your profile'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Max Heart Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.max_hr ?? '—'} bpm</div>
            <p className="text-xs text-muted-foreground">
              {profile && profile.max_hr ? 'Maximum heart rate' : 'Set up your profile'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.weight_kg ?? '—'} kg</div>
            <p className="text-xs text-muted-foreground">
              {profile && profile.weight_kg ? 'Current weight' : 'Set up your profile'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityCount}</div>
            <p className="text-xs text-muted-foreground">
              {stravaConnected ? 'Synced from Strava' : 'Connect Strava to sync'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(weeklyStats.distance / 1000).toFixed(0)} km</div>
            <p className="text-xs text-muted-foreground">
              {Math.floor(weeklyStats.time / 3600)}h {Math.floor((weeklyStats.time % 3600) / 60)}m riding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(monthlyStats.distance / 1000).toFixed(0)} km</div>
            <p className="text-xs text-muted-foreground">
              {Math.floor(monthlyStats.time / 3600)}h {Math.floor((monthlyStats.time % 3600) / 60)}m riding
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Your latest cycling activities</CardDescription>
          </div>
          {recentActivities.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/activities">View All</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
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
              <h3 className="font-semibold text-lg mb-2">No activities yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {stravaConnected
                  ? 'Your activities will appear here after syncing'
                  : 'Connect your Strava account to automatically sync your rides'}
              </p>
              <Button asChild>
                <Link href={stravaConnected ? '/activities' : '/settings/integrations'}>
                  {stravaConnected ? 'Sync Activities' : 'Connect Strava'}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => {
                const date = new Date(activity.start_date)
                const distance = (activity.distance / 1000).toFixed(1)
                const duration = Math.floor(activity.moving_time / 60)
                const hours = Math.floor(duration / 60)
                const minutes = duration % 60

                return (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{activity.name}</h4>
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
                    <div className="text-right">
                      <p className="font-medium">{distance} km</p>
                      <p className="text-sm text-muted-foreground">
                        {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Training */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Training</CardTitle>
          <CardDescription>Your scheduled workouts and training plan</CardDescription>
        </CardHeader>
        <CardContent>
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
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
            <h3 className="font-semibold text-lg mb-2">No training plan yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate an AI-powered training plan based on your goals
            </p>
            <Button asChild>
              <Link href="/training-plans">Create Training Plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

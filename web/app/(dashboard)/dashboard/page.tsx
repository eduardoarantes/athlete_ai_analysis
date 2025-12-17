import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/types/database'
import { RecentActivitiesList } from '@/components/dashboard/recent-activities-list'
import { StravaConnectionToast } from '@/components/dashboard/strava-connection-toast'
import { StravaSyncStatus } from '@/components/dashboard/strava-sync-status'
import { StatsPanel } from '@/components/dashboard/stats-panel'
import { User, Zap, Heart, Scale, TrendingUp } from 'lucide-react'

type AthleteProfile = Database['public']['Tables']['athlete_profiles']['Row']

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
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
    profile = data as AthleteProfile | null
  }

  // Fetch activity statistics
  let recentActivities: any[] = []
  let lastWeekActivities: any[] = []
  let monthActivities: any[] = []
  let yearActivities: any[] = []
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
      // Get recent activities (last 5)
      const { data: activities } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(5)
      recentActivities = activities || []

      // Get user's timezone from profile, default to UTC
      const userTimezone = profile?.timezone || 'UTC'

      // Calculate date ranges in user's timezone
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const todayStr = formatter.format(now) // YYYY-MM-DD in user's timezone
      const todayInUserTz = new Date(todayStr + 'T00:00:00')

      // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      // We want Monday as start of week
      const dayOfWeek = todayInUserTz.getDay()
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      // Start of current week (Monday)
      const startOfWeek = new Date(todayInUserTz)
      startOfWeek.setDate(todayInUserTz.getDate() - daysFromMonday)

      // Start of last week (previous Monday)
      const startOfLastWeek = new Date(startOfWeek)
      startOfLastWeek.setDate(startOfWeek.getDate() - 7)
      const endOfLastWeek = new Date(startOfWeek) // End of last week = start of this week

      // Start of current month (1st)
      const startOfMonth = new Date(todayInUserTz)
      startOfMonth.setDate(1)

      // Start of current year (Jan 1st)
      const startOfYear = new Date(todayInUserTz.getFullYear(), 0, 1)

      // Get last week activities
      const { data: lastWeekData } = await supabase
        .from('strava_activities')
        .select('sport_type, distance, moving_time, total_elevation_gain, start_date')
        .eq('user_id', user.id)
        .gte('start_date', startOfLastWeek.toISOString())
        .lt('start_date', endOfLastWeek.toISOString())

      lastWeekActivities = lastWeekData || []

      // Get monthly activities
      const { data: monthData } = await supabase
        .from('strava_activities')
        .select('sport_type, distance, moving_time, total_elevation_gain, start_date')
        .eq('user_id', user.id)
        .gte('start_date', startOfMonth.toISOString())

      monthActivities = monthData || []

      // Get yearly activities
      const { data: yearData } = await supabase
        .from('strava_activities')
        .select('sport_type, distance, moving_time, total_elevation_gain, start_date')
        .eq('user_id', user.id)
        .gte('start_date', startOfYear.toISOString())

      yearActivities = yearData || []
    }
  }

  // Calculate W/kg if both FTP and weight are available
  const wattsPerKg =
    profile?.ftp && profile?.weight_kg ? (profile.ftp / profile.weight_kg).toFixed(2) : null

  return (
    <>
      {/* Strava connection toast notification */}
      <Suspense fallback={null}>
        <StravaConnectionToast />
      </Suspense>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Side Panel - Athlete Profile & Stats */}
        <aside className="lg:w-72 flex-shrink-0 space-y-4">
          {/* Profile Card */}
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {profile ? `${profile.first_name}` : t('athlete')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('setupProfile').split(' ').slice(-1)[0]}
                  </CardDescription>
                </div>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {!profile ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">{t('setupProfilePrompt')}</p>
                  <Button asChild size="sm" className="w-full">
                    <Link href="/profile">{t('completeProfile')}</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* FTP */}
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-tight">{t('ftp')}</p>
                      <p className="text-xs font-semibold">
                        {profile.ftp ? `${profile.ftp}W` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Max HR */}
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <Heart className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {t('maxHr')}
                      </p>
                      <p className="text-xs font-semibold">
                        {profile.max_hr ? `${profile.max_hr}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Scale className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {t('weight')}
                      </p>
                      <p className="text-xs font-semibold">
                        {profile.weight_kg ? `${profile.weight_kg}kg` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* W/kg */}
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-tight">{t('wkg')}</p>
                      <p className="text-xs font-semibold">{wattsPerKg || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Panel with Sport Filter */}
          {stravaConnected && (
            <StatsPanel
              yearActivities={yearActivities}
              monthActivities={monthActivities}
              lastWeekActivities={lastWeekActivities}
              translations={{
                stats: t('stats'),
                thisYear: t('thisYear'),
                thisMonth: t('thisMonth'),
                lastWeek: t('lastWeek'),
              }}
            />
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Welcome Section with CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('welcome')}</h1>
              <p className="text-muted-foreground">{t('subtitle')}</p>
            </div>
            <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
              <Link href="/coach/create-plan">{t('createTrainingPlan')}</Link>
            </Button>
          </div>

          {/* Profile Completion Prompt - Only on mobile/tablet where side panel is not visible */}
          {!profile && (
            <Alert className="lg:hidden">
              <AlertDescription className="flex items-center justify-between">
                <span>{t('completeProfilePrompt')}</span>
                <Button asChild size="sm">
                  <Link href="/profile">{t('completeProfile')}</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Strava Sync Status - Only shows when connected */}
          <StravaSyncStatus />

          {/* Recent Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('recentActivities')}</CardTitle>
                <CardDescription>{t('recentActivitiesDescription')}</CardDescription>
              </div>
              {recentActivities.length > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/activities">{t('viewAll')}</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <RecentActivitiesList
                activities={recentActivities}
                stravaConnected={stravaConnected}
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  )
}

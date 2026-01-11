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
import {
  UpcomingWorkouts,
  type UpcomingWorkoutData,
} from '@/components/dashboard/upcoming-workouts'
import { asPlanInstances } from '@/lib/types/type-guards'
import { type PlanInstance, type Workout, calculateWorkoutDuration } from '@/lib/types/training-plan'
import { User, Zap, Heart, Scale, TrendingUp } from 'lucide-react'
import { PowerZonesHoverCard } from '@/components/profile/power-zones-hover-card'
import { HeartZonesHoverCard } from '@/components/profile/heart-zones-hover-card'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Helper function to compute upcoming workouts from plan instances
function getUpcomingWorkouts(instances: PlanInstance[], limit: number = 3): UpcomingWorkoutData[] {
  const workouts: UpcomingWorkoutData[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const instance of instances) {
    if (!instance.plan_data?.weekly_plan) continue

    const startDate = new Date(instance.start_date + 'T00:00:00')

    for (const week of instance.plan_data.weekly_plan) {
      if (!week.workouts) continue

      for (const workout of week.workouts) {
        // Calculate the actual date for this workout
        const dayIndex = DAYS_OF_WEEK.findIndex(
          (d) => d.toLowerCase() === workout.weekday.toLowerCase()
        )
        if (dayIndex === -1) continue

        // Week 1 starts on start_date, find the Monday of that week
        const startDayOfWeek = startDate.getDay()
        const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
        const weekOneMonday = new Date(startDate)
        weekOneMonday.setDate(startDate.getDate() + daysToMonday)

        // Calculate the actual date
        const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1
        const workoutDate = new Date(weekOneMonday)
        workoutDate.setDate(weekOneMonday.getDate() + (week.week_number - 1) * 7 + adjustedDayIndex)

        // Only include future workouts (today or later)
        if (workoutDate >= today) {
          // Calculate duration from workout structure
          const durationMinutes = calculateWorkoutDuration(workout as Workout) || 60

          const workoutData: UpcomingWorkoutData = {
            id: `${instance.id}-${week.week_number}-${workout.weekday}`,
            instanceId: instance.id,
            name: workout.name,
            type: workout.type || 'Workout',
            weekNumber: week.week_number,
            date: workoutDate.toISOString(),
            durationMinutes,
          }
          if (workout.tss !== undefined) {
            workoutData.tss = workout.tss
          }
          workouts.push(workoutData)
        }
      }
    }
  }

  // Sort by date and take first N
  return workouts
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit)
}

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
  let last4WeeksActivities: any[] = []
  let yearActivities: any[] = []
  let lastYearActivities: any[] = []
  let stravaConnected = false

  if (user?.id) {
    // Check Strava connection
    const { data: connection } = await supabase
      .from('strava_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()
    stravaConnected = !!connection

    // Always fetch activities from database (they might exist from previous syncs)
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

    // Start of last 4 weeks (4 Mondays ago)
    const startOfLast4Weeks = new Date(startOfWeek)
    startOfLast4Weeks.setDate(startOfWeek.getDate() - 28)

    // Start of last year (Jan 1st of previous year)
    const startOfLastYear = new Date(todayInUserTz.getFullYear() - 1, 0, 1)
    const endOfLastYear = new Date(todayInUserTz.getFullYear(), 0, 1) // Jan 1st of current year

    // Start of current year (Jan 1st)
    const startOfYear = new Date(todayInUserTz.getFullYear(), 0, 1)

    // Get last 4 weeks activities
    const { data: last4WeeksData } = await supabase
      .from('strava_activities')
      .select('sport_type, distance, moving_time, total_elevation_gain, start_date')
      .eq('user_id', user.id)
      .gte('start_date', startOfLast4Weeks.toISOString())
      .lt('start_date', startOfWeek.toISOString())

    last4WeeksActivities = last4WeeksData || []

    // Get yearly activities
    const { data: yearData } = await supabase
      .from('strava_activities')
      .select('sport_type, distance, moving_time, total_elevation_gain, start_date')
      .eq('user_id', user.id)
      .gte('start_date', startOfYear.toISOString())

    yearActivities = yearData || []

    // Get last year activities
    const { data: lastYearData } = await supabase
      .from('strava_activities')
      .select('sport_type, distance, moving_time, total_elevation_gain, start_date')
      .eq('user_id', user.id)
      .gte('start_date', startOfLastYear.toISOString())
      .lt('start_date', endOfLastYear.toISOString())

    lastYearActivities = lastYearData || []
  }

  // Fetch active/scheduled plan instances for upcoming workouts
  const { data: planInstancesData } = await supabase
    .from('plan_instances')
    .select('*')
    .eq('user_id', user?.id || '')
    .in('status', ['active', 'scheduled'])
    .order('start_date', { ascending: true })

  // Automatically mark ended plans as completed
  const todayForPlanCheck = new Date()
  todayForPlanCheck.setHours(0, 0, 0, 0)

  if (planInstancesData) {
    for (const instance of planInstancesData) {
      const endDate = new Date(instance.end_date + 'T00:00:00')
      if (endDate < todayForPlanCheck) {
        // Plan has ended, mark as completed
        await supabase.from('plan_instances').update({ status: 'completed' }).eq('id', instance.id)
        instance.status = 'completed'
      }
    }
  }

  // Filter to only include plans that are still active/scheduled after status update
  const activePlanInstances = (planInstancesData || []).filter(
    (p) => p.status === 'active' || p.status === 'scheduled'
  )
  const planInstances = asPlanInstances(activePlanInstances)
  const upcomingWorkouts = getUpcomingWorkouts(planInstances, 3)

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
                  {/* FTP with Power Zones Hover */}
                  {profile.ftp ? (
                    <PowerZonesHoverCard ftp={profile.ftp}>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {t('ftp')}
                          </p>
                          <p className="text-xs font-semibold">{profile.ftp}W</p>
                        </div>
                      </div>
                    </PowerZonesHoverCard>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {t('ftp')}
                        </p>
                        <p className="text-xs font-semibold">—</p>
                      </div>
                    </div>
                  )}

                  {/* Max HR with Heart Rate Zones Hover */}
                  {profile.max_hr ? (
                    <HeartZonesHoverCard maxHr={profile.max_hr} restingHr={profile.resting_hr}>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <Heart className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {t('maxHr')}
                          </p>
                          <p className="text-xs font-semibold">{profile.max_hr}</p>
                        </div>
                      </div>
                    </HeartZonesHoverCard>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <Heart className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {t('maxHr')}
                        </p>
                        <p className="text-xs font-semibold">—</p>
                      </div>
                    </div>
                  )}

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

          {/* Stats Panel with Sport Filter - Show if there are any activities (current or last year) */}
          {(yearActivities.length > 0 || lastYearActivities.length > 0) && (
            <StatsPanel
              yearActivities={yearActivities}
              last4WeeksActivities={last4WeeksActivities}
              lastYearActivities={lastYearActivities}
              translations={{
                stats: t('stats'),
                thisYear: t('thisYear'),
                last4Weeks: t('last4Weeks'),
                lastYear: t('lastYear'),
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

          {/* Upcoming Workouts - Only shows if there are upcoming workouts */}
          {upcomingWorkouts.length > 0 && <UpcomingWorkouts workouts={upcomingWorkouts} />}

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

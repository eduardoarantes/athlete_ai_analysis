import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserCheck,
  Activity,
  Link as LinkIcon,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { transformAdminStatsRow } from '@/lib/types/admin'
import type { AdminStatsRow } from '@/lib/types/admin'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Fetch admin statistics
  const { data: statsData, error } = await supabase.rpc('get_admin_stats' as never)

  const stats =
    statsData && (statsData as AdminStatsRow[])[0]
      ? transformAdminStatsRow((statsData as AdminStatsRow[])[0]!)
      : null

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Failed to load statistics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and statistics</p>
      </div>

      {/* User Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+{stats.users.last_7_days} this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users (7d)</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users.active_7_days.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.users.total > 0
                ? `${Math.round((stats.users.active_7_days / stats.users.total) * 100)}% of total`
                : '0% of total'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Strava Connected</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.strava.total_connections.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.users.total > 0
                ? `${Math.round((stats.strava.total_connections / stats.users.total) * 100)}% connected`
                : '0% connected'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.content.total_activities.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              +{stats.content.activities_last_7_days} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Free</Badge>
                  <span className="text-sm text-muted-foreground">Basic features</span>
                </div>
                <span className="font-semibold">{stats.subscriptions.by_plan.free}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">Pro</Badge>
                  <span className="text-sm text-muted-foreground">$19.99/mo</span>
                </div>
                <span className="font-semibold">{stats.subscriptions.by_plan.pro}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500">Team</Badge>
                  <span className="text-sm text-muted-foreground">$49.99/mo</span>
                </div>
                <span className="font-semibold">{stats.subscriptions.by_plan.team}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Subscriptions</span>
                <span className="font-semibold text-green-600">{stats.subscriptions.active}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Cancelled</span>
                <span className="font-semibold text-red-600">{stats.subscriptions.cancelled}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strava Sync Status</CardTitle>
            <CardDescription>Sync health in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Successful Syncs</span>
                </div>
                <span className="font-semibold text-green-600">
                  {stats.strava.successful_syncs}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Failed Syncs</span>
                </div>
                <span className="font-semibold text-red-600">{stats.strava.failed_syncs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Syncs (24h)</span>
                </div>
                <span className="font-semibold">{stats.strava.syncs_last_24h}</span>
              </div>
            </div>

            {stats.strava.failed_syncs > 0 && (
              <div className="mt-6 pt-4 border-t">
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  {Math.round(
                    (stats.strava.failed_syncs /
                      (stats.strava.successful_syncs + stats.strava.failed_syncs)) *
                      100
                  )}
                  % failure rate - consider investigating
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Content Overview</CardTitle>
          <CardDescription>Platform content statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.content.total_profiles.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Profiles Created</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.content.total_training_plans.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Training Plans</div>
              <div className="text-xs text-green-600 mt-1">
                {stats.content.active_training_plans} active
              </div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.content.total_reports.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Reports Generated</div>
              <div className="text-xs text-green-600 mt-1">
                {stats.content.completed_reports} completed
              </div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {stats.content.activities_last_30_days.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Activities (30d)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

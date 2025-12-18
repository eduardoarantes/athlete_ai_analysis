import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { transformAdminUserRow } from '@/lib/types/admin'
import type { AdminUserRow } from '@/lib/types/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  FileText,
  Target,
} from 'lucide-react'
import { UserSubscriptionForm } from '@/components/admin/user-subscription-form'
import { GenerateAnalysisButton } from '@/components/admin/generate-analysis-button'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    notFound()
  }

  // Fetch user details
  const { data: userData, error } = await supabase.rpc(
    'get_admin_user_by_id' as never,
    {
      target_user_id: id,
    } as never
  )

  if (error || !userData || (userData as AdminUserRow[]).length === 0) {
    notFound()
  }

  const user = transformAdminUserRow((userData as AdminUserRow[])[0]!)

  // Fetch subscription plans for the form
  const { data: plans } = await supabase
    .from('subscription_plans' as never)
    .select('id, name, display_name')
    .eq('is_active', true)
    .order('sort_order')

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatShortDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge className="bg-orange-500">Admin</Badge>
    }
    return <Badge variant="secondary">User</Badge>
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>
      case 'suspended':
        return <Badge className="bg-yellow-500">Suspended</Badge>
      case 'cancelled':
        return <Badge className="bg-red-500">Cancelled</Badge>
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>
      default:
        return <Badge variant="outline">None</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user.profile.first_name && user.profile.last_name
              ? `${user.profile.first_name} ${user.profile.last_name}`
              : 'User Details'}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Mail className="h-4 w-4" />
            {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getRoleBadge(user.role)}
          {getStatusBadge(user.subscription.status)}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>User account details and dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Account Created
                </div>
                <div className="font-medium">{formatShortDate(user.account_created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Email Confirmed
                </div>
                <div className="font-medium">
                  {user.email_confirmed_at
                    ? formatShortDate(user.email_confirmed_at)
                    : 'Not confirmed'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last Sign In
                </div>
                <div className="font-medium">{formatDate(user.last_sign_in_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">User ID</div>
                <div className="font-mono text-xs break-all">{user.user_id}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Management */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Manage user subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSubscriptionForm
              userId={user.user_id}
              currentPlanId={user.subscription.plan_id}
              currentStatus={user.subscription.status}
              plans={(plans || []) as { id: string; name: string; display_name: string }[]}
            />
            {user.subscription.started_at && (
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                <div>Started: {formatShortDate(user.subscription.started_at)}</div>
                {user.subscription.ends_at && (
                  <div>Ends: {formatShortDate(user.subscription.ends_at)}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Athlete profile settings (read-only)</CardDescription>
          </CardHeader>
          <CardContent>
            {user.profile.exists ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">First Name</div>
                  <div className="font-medium">{user.profile.first_name || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last Name</div>
                  <div className="font-medium">{user.profile.last_name || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Language</div>
                  <div className="font-medium">{user.profile.preferred_language || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Timezone</div>
                  <div className="font-medium">{user.profile.timezone || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Units</div>
                  <div className="font-medium">{user.profile.units_system || '—'}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">No profile created yet</div>
            )}
          </CardContent>
        </Card>

        {/* Strava Connection */}
        <Card>
          <CardHeader>
            <CardTitle>Strava Connection</CardTitle>
            <CardDescription>Integration status</CardDescription>
          </CardHeader>
          <CardContent>
            {user.strava.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Connected</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Last Sync</div>
                    <div>{formatDate(user.strava.last_sync_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sync Status</div>
                    <div className="capitalize">{user.strava.sync_status || '—'}</div>
                  </div>
                </div>
                {user.strava.sync_error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                    Error: {user.strava.sync_error}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span>Not connected</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Content created by this user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Activity className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{user.counts.total_activities}</div>
                <div className="text-sm text-muted-foreground">Activities</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Target className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">{user.counts.total_training_plans}</div>
                <div className="text-sm text-muted-foreground">Training Plans</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <FileText className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold">{user.counts.total_reports}</div>
                <div className="text-sm text-muted-foreground">Reports</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions: Generate Analysis */}
        <div className="md:col-span-2">
          <GenerateAnalysisButton
            userId={user.user_id}
            hasProfile={user.profile.exists}
            hasActivities={user.counts.total_activities > 0}
          />
        </div>
      </div>
    </div>
  )
}

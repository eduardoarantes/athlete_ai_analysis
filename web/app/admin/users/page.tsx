import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { transformAdminUserRows } from '@/lib/types/admin'
import type { AdminUserRow } from '@/lib/types/admin'
import { UsersTable } from '@/components/admin/users-table'
import { UsersFilters } from '@/components/admin/users-filters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SearchParams {
  search?: string
  role?: string
  subscription?: string
  strava?: string
  page?: string
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Parse query parameters
  const search = params.search || null
  const role = params.role || null
  const subscription = params.subscription || null
  const strava = params.strava === 'true' ? true : params.strava === 'false' ? false : null
  const page = parseInt(params.page || '1', 10)
  const limit = 20
  const offset = (page - 1) * limit

  // Fetch users
  const { data: usersData, error: usersError } = await supabase.rpc(
    'get_admin_users' as never,
    {
      search_query: search,
      role_filter: role,
      subscription_filter: subscription,
      strava_filter: strava,
      limit_count: limit,
      offset_count: offset,
    } as never
  )

  // Fetch total count
  const { data: totalCount } = await supabase.rpc(
    'get_admin_users_count' as never,
    {
      search_query: search,
      role_filter: role,
      subscription_filter: subscription,
      strava_filter: strava,
    } as never
  )

  const users = usersData ? transformAdminUserRows(usersData as AdminUserRow[]) : []
  const total = Number(totalCount) || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage platform users and subscriptions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            {total} total users
            {search && ` matching "${search}"`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<div>Loading filters...</div>}>
            <UsersFilters
              currentSearch={search || ''}
              currentRole={role || ''}
              currentSubscription={subscription || ''}
              currentStrava={strava}
            />
          </Suspense>

          {usersError ? (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load users. Please try again.
            </div>
          ) : (
            <UsersTable users={users} currentPage={page} totalPages={totalPages} total={total} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

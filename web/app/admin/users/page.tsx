import { Suspense } from 'react'
import { adminUserService } from '@/lib/services/admin'
import type { UserRole } from '@/lib/types/admin'
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

  // Parse query parameters
  const search = params.search || undefined
  const role = (params.role as UserRole) || undefined
  const subscription = params.subscription || undefined
  const strava = params.strava === 'true' ? true : params.strava === 'false' ? false : undefined
  const page = parseInt(params.page || '1', 10)
  const limit = 20
  const offset = (page - 1) * limit

  // Fetch users using TypeScript service
  let users: Awaited<ReturnType<typeof adminUserService.queryUsers>> = []
  let total = 0
  let usersError = false

  try {
    const queryFilters = {
      ...(search && { search }),
      ...(role && { role }),
      ...(subscription && { subscription }),
      ...(strava !== undefined && { strava }),
      limit,
      offset,
    }

    const countFilters = {
      ...(search && { search }),
      ...(role && { role }),
      ...(subscription && { subscription }),
      ...(strava !== undefined && { strava }),
    }

    users = await adminUserService.queryUsers(queryFilters)
    total = await adminUserService.countUsers(countFilters)
  } catch (error) {
    console.error('Failed to fetch admin users:', error)
    usersError = true
    users = []
  }

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
              currentStrava={strava ?? null}
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

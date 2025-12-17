'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import type { AdminUser } from '@/lib/types/admin'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ExternalLink, CheckCircle, XCircle } from 'lucide-react'

interface UsersTableProps {
  users: AdminUser[]
  currentPage: number
  totalPages: number
  total: number
}

export function UsersTable({ users, currentPage, totalPages, total }: UsersTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`)
    })
  }

  const formatDate = (dateString: string | null) => {
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

  const getPlanBadge = (planName: string | null) => {
    switch (planName) {
      case 'pro':
        return <Badge className="bg-blue-500">Pro</Badge>
      case 'team':
        return <Badge className="bg-purple-500">Team</Badge>
      case 'free':
      default:
        return <Badge variant="outline">Free</Badge>
    }
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

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No users found matching your criteria.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Strava</TableHead>
              <TableHead>Activities</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {user.profile.first_name && user.profile.last_name
                        ? `${user.profile.first_name} ${user.profile.last_name}`
                        : 'No name'}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>{getPlanBadge(user.subscription.plan_name)}</TableCell>
                <TableCell>{getStatusBadge(user.subscription.status)}</TableCell>
                <TableCell>
                  {user.strava.connected ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs">Not connected</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{user.counts.total_activities}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(user.account_created_at)}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/users/${user.user_id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, total)} of {total}{' '}
          users
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

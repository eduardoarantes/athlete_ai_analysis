'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

interface UsersFiltersProps {
  currentSearch: string
  currentRole: string
  currentSubscription: string
  currentStrava: boolean | null
}

export function UsersFilters({
  currentSearch,
  currentRole,
  currentSubscription,
  currentStrava,
}: UsersFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch)

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    // Reset to page 1 when filters change
    params.delete('page')

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search })
  }

  const clearFilters = () => {
    setSearch('')
    startTransition(() => {
      router.push('/admin/users')
    })
  }

  const hasFilters = currentSearch || currentRole || currentSubscription || currentStrava !== null

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          Search
        </Button>
      </form>

      {/* Role Filter */}
      <Select
        value={currentRole || 'all'}
        onValueChange={(value) => updateFilters({ role: value })}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>

      {/* Subscription Filter */}
      <Select
        value={currentSubscription || 'all'}
        onValueChange={(value) => updateFilters({ subscription: value })}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Plans</SelectItem>
          <SelectItem value="free">Free</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="team">Team</SelectItem>
        </SelectContent>
      </Select>

      {/* Strava Filter */}
      <Select
        value={currentStrava === null ? 'all' : currentStrava ? 'true' : 'false'}
        onValueChange={(value) => updateFilters({ strava: value })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Strava" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Strava</SelectItem>
          <SelectItem value="true">Connected</SelectItem>
          <SelectItem value="false">Not Connected</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}

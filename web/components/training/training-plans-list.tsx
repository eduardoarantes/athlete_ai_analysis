'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Plus, Zap, Search, Target, TrendingUp, ChevronRight } from 'lucide-react'
import { formatWithGoalLabels, GOAL_KEYS } from '@/lib/utils/format-utils'

interface PlanData {
  weekly_plan?: Array<{ week_tss?: number }>
  plan_metadata?: {
    total_weeks?: number
    current_ftp?: number
    target_ftp?: number
  }
}

interface TrainingPlan {
  id: string
  name: string
  description: string | null
  plan_data: PlanData
  weeks_total: number | null
  created_at: string
  goal?: string
}

interface TrainingPlansListProps {
  plans: TrainingPlan[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function extractGoalFromName(name: string): string | null {
  for (const key of GOAL_KEYS) {
    if (name.includes(key)) {
      return key
    }
  }
  return null
}

export function TrainingPlansList({ plans }: TrainingPlansListProps) {
  const tGoals = useTranslations('goals')
  const tCommon = useTranslations('common')

  const [searchQuery, setSearchQuery] = useState('')
  const [goalFilter, setGoalFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date' | 'weeks' | 'tss'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Process plans with computed values
  const processedPlans = useMemo(() => {
    return plans.map((plan) => {
      const planData = plan.plan_data
      const totalTss =
        planData?.weekly_plan?.reduce((sum, week) => sum + (week.week_tss || 0), 0) || 0
      const weeks = plan.weeks_total || planData?.plan_metadata?.total_weeks || 0
      const goal = extractGoalFromName(plan.name)
      const currentFtp = planData?.plan_metadata?.current_ftp
      const targetFtp = planData?.plan_metadata?.target_ftp

      return {
        ...plan,
        totalTss,
        weeks,
        goal,
        currentFtp,
        targetFtp,
      }
    })
  }, [plans])

  // Filter and sort plans
  const filteredPlans = useMemo(() => {
    let result = processedPlans

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (plan) =>
          plan.name.toLowerCase().includes(query) || plan.description?.toLowerCase().includes(query)
      )
    }

    // Goal filter
    if (goalFilter) {
      result = result.filter((plan) => plan.goal === goalFilter)
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'weeks':
          comparison = a.weeks - b.weeks
          break
        case 'tss':
          comparison = a.totalTss - b.totalTss
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [processedPlans, searchQuery, goalFilter, sortBy, sortOrder])

  // Empty state
  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No training plans yet</h2>
          <p className="text-muted-foreground mb-4">
            Create your first AI-powered training plan to get started.
          </p>
          <Button asChild>
            <Link href="/coach/create-plan">
              <Plus className="h-4 w-4 mr-2" />
              Create Training Plan
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={tCommon('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Goal Filter */}
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Goal:</label>
            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-md text-sm bg-background"
            >
              <option value="">All Goals</option>
              {GOAL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {tGoals(key)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'weeks' | 'tss')}
              className="px-3 py-1.5 border rounded-md text-sm bg-background"
            >
              <option value="date">Date Created</option>
              <option value="weeks">Duration</option>
              <option value="tss">Total TSS</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex gap-2 items-center">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-1.5 border rounded-md text-sm bg-background"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {/* Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredPlans.length} of {plans.length} plans
          </div>
        </div>
      </Card>

      {/* Plans List */}
      {filteredPlans.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No plans match your filters</p>
        </Card>
      ) : (
        <div>
          {filteredPlans.map((plan) => (
            <Link key={plan.id} href={`/training-plans/${plan.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer mb-[10px]">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    {/* Plan Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {formatWithGoalLabels(plan.name, tGoals)}
                        </h3>
                        {plan.goal && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {tGoals(plan.goal)}
                          </Badge>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {formatWithGoalLabels(plan.description, tGoals)}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Target className="h-4 w-4" />
                        <span>{plan.weeks} weeks</span>
                      </div>

                      {plan.currentFtp && plan.targetFtp && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>
                            {plan.currentFtp} → {plan.targetFtp}W
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Zap className="h-4 w-4" />
                        <span>{Math.round(plan.totalTss)} TSS</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(plan.created_at)}</span>
                      </div>
                    </div>

                    {/* Mobile Stats */}
                    <div className="flex sm:hidden items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{plan.weeks}w</span>
                      <span>{Math.round(plan.totalTss)} TSS</span>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

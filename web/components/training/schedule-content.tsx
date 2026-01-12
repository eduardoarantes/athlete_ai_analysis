'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Zap, CalendarDays, Clock, List, LayoutGrid } from 'lucide-react'
import { ScheduleCalendar } from './schedule-calendar'
import { CollapsibleSidebar } from '@/components/schedule/collapsible-sidebar'
import { DraggableLibraryWorkout } from '@/components/schedule/dnd/draggable-library-workout'
import { WorkoutBrowser } from '@/components/plan-builder/workout-browser'
import { WorkoutLibraryCard } from '@/components/plan-builder/workout-library-card'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import type { PlanInstance } from '@/lib/types/training-plan'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import { parseLocalDate } from '@/lib/utils/date-utils'
import { formatWithGoalLabels } from '@/lib/utils/format-utils'
import { WorkoutDetailPopup } from '@/components/workout/workout-detail-popup'

const SIDEBAR_STORAGE_KEY = 'schedule-sidebar-collapsed'

interface ScheduleContentProps {
  instances: PlanInstance[]
  locale: string
}

export function ScheduleContent({ instances, locale }: ScheduleContentProps) {
  const t = useTranslations('schedule')
  const tGoals = useTranslations('goals')

  // Group instances by status
  const activeInstances = instances.filter((i) => i.status === 'active')
  const scheduledInstances = instances.filter((i) => i.status === 'scheduled')
  const completedInstances = instances.filter((i) => i.status === 'completed')

  // Check if any active/scheduled plan has future workouts (end_date >= today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const plansWithFutureContent = [...activeInstances, ...scheduledInstances].filter((instance) => {
    const endDate = parseLocalDate(instance.end_date)
    return endDate >= today
  })

  // Only show calendar if there are plans with future content
  const hasCalendarContent = plansWithFutureContent.length > 0

  // Default to list view if no calendar content
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(
    hasCalendarContent ? 'calendar' : 'list'
  )

  // State for library workout detail popup
  const [selectedLibraryWorkout, setSelectedLibraryWorkout] = useState<WorkoutLibraryItem | null>(
    null
  )
  const [libraryWorkoutModalOpen, setLibraryWorkoutModalOpen] = useState(false)

  // Sidebar collapsed state (persisted to localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(SIDEBAR_STORAGE_KEY, false)

  // Handler for when a library workout is clicked in the sidebar
  const handleLibraryWorkoutSelect = useCallback((workout: WorkoutLibraryItem) => {
    setSelectedLibraryWorkout(workout)
    setLibraryWorkoutModalOpen(true)
  }, [])

  // Get FTP from first instance for workout display
  const ftp = plansWithFutureContent[0]?.plan_data?.athlete_profile?.ftp || 200

  // Get single instance ID for sidebar (only show sidebar for single instance)
  const singleInstance = plansWithFutureContent.length === 1 ? plansWithFutureContent[0] : null

  // Custom render for workout cards - wrap with schedule DnD
  const renderWorkoutCard = useCallback(
    (workout: WorkoutLibraryItem) => {
      if (!singleInstance) return null
      return (
        <DraggableLibraryWorkout key={workout.id} workout={workout} instanceId={singleInstance.id}>
          <WorkoutLibraryCard
            workout={workout}
            onClick={() => handleLibraryWorkoutSelect(workout)}
            isDraggable
            compact
          />
        </DraggableLibraryWorkout>
      )
    },
    [singleInstance, handleLibraryWorkoutSelect]
  )

  // Create sidebar content for single instance edit mode
  const sidebarContent = useMemo(() => {
    if (!singleInstance) return undefined
    return (
      <CollapsibleSidebar
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
        expandedWidth={300}
      >
        <WorkoutBrowser
          compact
          isDragEnabled={false} // We handle DnD ourselves with custom render
          onSelectWorkout={handleLibraryWorkoutSelect}
          renderWorkoutCard={renderWorkoutCard}
          className="h-full"
        />
      </CollapsibleSidebar>
    )
  }, [
    singleInstance,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    handleLibraryWorkoutSelect,
    renderWorkoutCard,
  ])

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'scheduled':
        return 'secondary'
      case 'completed':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const calculateTotalTss = (instance: PlanInstance): number => {
    return (
      instance.plan_data?.weekly_plan?.reduce(
        (sum: number, week: { week_tss?: number }) => sum + (week.week_tss || 0),
        0
      ) || 0
    )
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end)
    return `${startDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`
  }

  const InstanceCard = ({ instance }: { instance: PlanInstance }) => {
    const totalTss = calculateTotalTss(instance)
    const today = new Date()
    const startDate = parseLocalDate(instance.start_date)
    const endDate = parseLocalDate(instance.end_date)

    // Calculate progress for active plans
    let progressPercent = 0
    if (instance.status === 'active') {
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
    }

    // Calculate days until start for scheduled plans
    const daysUntilStart =
      instance.status === 'scheduled'
        ? Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 0

    return (
      <Link key={instance.id} href={`/schedule/${instance.id}`}>
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {formatWithGoalLabels(instance.name, tGoals)}
              </CardTitle>
              <Badge variant={getStatusVariant(instance.status)}>
                {t(`status.${instance.status}`)}
              </Badge>
            </div>
            <CardDescription>
              {formatDateRange(instance.start_date, instance.end_date)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {instance.weeks_total} weeks
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                {Math.round(totalTss)} TSS
              </span>
            </div>

            {/* Progress bar for active plans */}
            {instance.status === 'active' && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Days until start for scheduled plans */}
            {instance.status === 'scheduled' && daysUntilStart > 0 && (
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Starts in {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Empty state
  if (instances.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('noScheduledPlans')}</h2>
          <p className="text-muted-foreground mb-4">{t('noScheduledPlansDescription')}</p>
          <Button asChild>
            <Link href="/training-plans">
              <Plus className="h-4 w-4 mr-2" />
              {t('browseTemplates')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      {hasCalendarContent && (
        <div className="flex justify-end">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              {t('calendarView')}
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              {t('listView')}
            </Button>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && hasCalendarContent && (
        <ScheduleCalendar instances={plansWithFutureContent} sidebarContent={sidebarContent} />
      )}

      {/* List View */}
      {(viewMode === 'list' || !hasCalendarContent) && (
        <>
          {/* Active Plans */}
          {activeInstances.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                {t('activePlans')}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeInstances.map((instance) => (
                  <InstanceCard key={instance.id} instance={instance} />
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Plans */}
          {scheduledInstances.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {t('upcomingPlans')}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scheduledInstances.map((instance) => (
                  <InstanceCard key={instance.id} instance={instance} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Plans */}
          {completedInstances.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-muted-foreground">{t('completedPlans')}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedInstances.map((instance) => (
                  <InstanceCard key={instance.id} instance={instance} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Library Workout Detail Modal */}
      <WorkoutDetailPopup
        workout={selectedLibraryWorkout}
        ftp={ftp}
        open={libraryWorkoutModalOpen}
        onOpenChange={setLibraryWorkoutModalOpen}
        sections={{
          showBadges: true,
          showStats: true,
          showDescription: true,
          showPowerProfile: true,
          showStructure: true,
          showWeekInfo: false,
          showSuitablePhases: true,
        }}
      />
    </div>
  )
}

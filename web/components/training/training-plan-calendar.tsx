'use client'

import { useState, useMemo, Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { WorkoutCard } from './workout-card'
import { WorkoutDetailModal } from './workout-detail-modal'
import type { TrainingPlan, Workout, WeeklyPlan } from '@/lib/types/training-plan'

interface TrainingPlanCalendarProps {
  plan: TrainingPlan
  /** When true, shows weekday names only without real dates (for template preview) */
  templateMode?: boolean
  /** When true, shows admin features like JSON view */
  isAdmin?: boolean
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKS_PER_PAGE = 4

export function TrainingPlanCalendar({
  plan,
  templateMode: _templateMode = false,
  isAdmin = false,
}: TrainingPlanCalendarProps) {
  const t = useTranslations('trainingPlan')
  const planData = plan.plan_data
  const totalWeeks = planData.weekly_plan.length

  // Start at first page for template mode, otherwise calculate based on dates
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedWorkout, setSelectedWorkout] = useState<{
    workout: Workout
    weekNumber: number
  } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Get FTP from athlete profile
  const ftp = planData.athlete_profile?.ftp || 200

  // Handle workout click
  const handleWorkoutClick = (workout: Workout, weekNumber: number) => {
    setSelectedWorkout({ workout, weekNumber })
    setModalOpen(true)
  }

  // Get weeks for current page
  const startWeek = currentPage * WEEKS_PER_PAGE + 1
  const endWeek = Math.min(startWeek + WEEKS_PER_PAGE - 1, totalWeeks)

  const visibleWeeks: WeeklyPlan[] = useMemo(() => {
    return planData.weekly_plan.filter(
      (w) => w.week_number >= startWeek && w.week_number <= endWeek
    )
  }, [planData.weekly_plan, startWeek, endWeek])

  // Map workouts to day index for a specific week
  const getWorkoutsByDay = (weekData: WeeklyPlan): Map<number, Workout> => {
    const map = new Map<number, Workout>()
    if (weekData?.workouts) {
      weekData.workouts.forEach((workout) => {
        const dayIndex = DAYS_OF_WEEK.findIndex(
          (d) => d.toLowerCase() === workout.weekday.toLowerCase()
        )
        if (dayIndex !== -1) {
          map.set(dayIndex, workout)
        }
      })
    }
    return map
  }

  const totalPages = Math.ceil(totalWeeks / WEEKS_PER_PAGE)

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
  }

  // Calculate total TSS for visible weeks
  const visibleTotalTss = visibleWeeks.reduce((sum, w) => sum + (w.week_tss || 0), 0)

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold">
            Weeks {startWeek}-{endWeek} of {totalWeeks}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Zap className="h-3 w-3" />
              {Math.round(visibleTotalTss)} TSS ({WEEKS_PER_PAGE}-week total)
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={goToPreviousPage}
            variant="outline"
            size="icon"
            disabled={currentPage <= 0}
            aria-label="Previous 4 weeks"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={goToNextPage}
            variant="outline"
            size="icon"
            disabled={currentPage >= totalPages - 1}
            aria-label="Next 4 weeks"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-8 gap-px bg-muted">
          {/* Header Row */}
          <div className="bg-background p-2 text-center text-sm font-medium">Week</div>
          {DAYS_SHORT.map((day) => (
            <div key={day} className="bg-background p-2 text-center text-sm font-medium">
              {day}
            </div>
          ))}

          {/* Week Rows */}
          {visibleWeeks.map((weekData) => {
            const workoutsByDay = getWorkoutsByDay(weekData)

            return (
              <Fragment key={weekData.week_number}>
                {/* Week Label Cell */}
                <div className="bg-background p-2 text-xs border-r">
                  <div className="font-semibold">Week {weekData.week_number}</div>
                  <Badge variant="outline" className="text-[10px] mt-1 capitalize">
                    {weekData.phase}
                  </Badge>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {Math.round(weekData.week_tss || 0)}
                  </div>
                </div>

                {/* Day Cells */}
                {DAYS_OF_WEEK.map((day, dayIndex) => {
                  const workout = workoutsByDay.get(dayIndex)

                  return (
                    <div
                      key={`${weekData.week_number}-${day}`}
                      className="bg-background p-1.5 min-h-[100px]"
                    >
                      {workout ? (
                        <WorkoutCard
                          workout={workout}
                          className="text-[10px]"
                          onClick={() => handleWorkoutClick(workout, weekData.week_number)}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
                          Rest
                        </div>
                      )}
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
          <span>{t('workoutTypes.endurance')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
          <span>{t('workoutTypes.tempo')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200" />
          <span>{t('workoutTypes.threshold')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
          <span>{t('workoutTypes.vo2max')}</span>
        </div>
      </div>

      {/* Workout Detail Modal */}
      <WorkoutDetailModal
        workout={selectedWorkout?.workout || null}
        weekNumber={selectedWorkout?.weekNumber || 0}
        ftp={ftp}
        open={modalOpen}
        onOpenChange={setModalOpen}
        isAdmin={isAdmin}
      />
    </div>
  )
}

'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react'
import { WorkoutCard } from './workout-card'
import { NoteCard } from './note-card'
import { NoteDialog } from './note-dialog'
import { WorkoutDetailModal, type MatchedActivityData } from './workout-detail-modal'
import { NoteContextMenu } from '@/components/schedule/note-context-menu'
import { toast } from 'sonner'
import type { PlanInstance, Workout, PlanInstanceNote } from '@/lib/types/training-plan'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import { parseLocalDate, formatDateString } from '@/lib/utils/date-utils'
import { applyWorkoutOverrides } from '@/lib/utils/apply-workout-overrides'
import { formatWithGoalLabels } from '@/lib/utils/format-utils'
import {
  ScheduleDndContext,
  DraggableScheduledWorkout,
  DroppableCalendarDay,
} from '@/components/schedule/dnd'
import {
  ScheduleClipboardProvider,
  WorkoutContextMenu,
  CalendarDayContextMenu,
} from '@/components/schedule'
import { errorLogger } from '@/lib/monitoring/error-logger'

interface ScheduleCalendarProps {
  instances: PlanInstance[]
  isAdmin?: boolean
  allowEditing?: boolean
  /** Sidebar content to render inside the DnD context (for library workout drag) */
  sidebarContent?: React.ReactNode
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Removed: convertLibrarySegmentsToSchedule - segments are no longer used
// Library workouts now use the structure field directly

interface ScheduledWorkout {
  workout: Workout
  instance: PlanInstance
  weekNumber: number
  date: Date
  index?: number
}

export function ScheduleCalendar({
  instances,
  isAdmin = false,
  allowEditing = true,
  sidebarContent,
}: ScheduleCalendarProps) {
  const router = useRouter()
  const t = useTranslations('schedule')
  const tPlan = useTranslations('trainingPlan')
  const tGoals = useTranslations('goals')
  const locale = useLocale()

  // Current month view
  const [currentDate, setCurrentDate] = useState(() => {
    // Start at the current month or the month of the first active/scheduled instance
    const activeInstance = instances.find((i) => i.status === 'active')
    const scheduledInstance = instances.find((i) => i.status === 'scheduled')
    const relevantInstance = activeInstance || scheduledInstance

    if (relevantInstance) {
      return parseLocalDate(relevantInstance.start_date)
    }
    return new Date()
  })

  const [selectedWorkout, setSelectedWorkout] = useState<ScheduledWorkout | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Notes state
  const [notesByDate, setNotesByDate] = useState<Map<string, PlanInstanceNote[]>>(new Map())
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteDialogMode, setNoteDialogMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedNoteDate, setSelectedNoteDate] = useState<string>('')
  const [selectedNote, setSelectedNote] = useState<PlanInstanceNote | undefined>(undefined)

  // Edit state
  // Error message for user feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Loading state for workout operations
  const [isOperationLoading, setIsOperationLoading] = useState(false)

  // Find MANUAL_WORKOUTS instance (always exists for each user)
  const manualWorkoutsInstance = instances.find((i) => i.instance_type === 'manual_workouts')

  // Find non-manual instances (real training plans)
  const realInstances = instances.filter((i) => i.instance_type !== 'manual_workouts')

  // Primary instance for editing:
  // - If only 1 real plan exists, use it
  // - Otherwise, use MANUAL_WORKOUTS (for adding workouts without a plan)
  const primaryInstanceId =
    realInstances.length === 1 ? realInstances[0]?.id : manualWorkoutsInstance?.id || null

  const canEdit = allowEditing && !!primaryInstanceId

  // Matches state: Map of "instanceId:workoutId" (or legacy "instanceId:date:index") -> MatchedActivityData
  const [matchesMap, setMatchesMap] = useState<Map<string, MatchedActivityData>>(new Map())
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0)
  const autoMatchedRef = useRef<Set<string>>(new Set())

  // Ref to prevent duplicate drops (race condition protection)
  const libraryDropInProgressRef = useRef<Set<string>>(new Set())

  // Build workouts list for auto-matching
  const buildWorkoutsList = useCallback((instance: PlanInstance) => {
    const workouts: Array<{ date: string; index: number; tss?: number; type?: string }> = []

    if (!instance.plan_data?.weekly_plan) return workouts

    // Get effective workouts by date (reads directly from plan_data)
    const effectiveWorkouts = applyWorkoutOverrides(instance.plan_data)

    effectiveWorkouts.forEach((dateWorkouts, dateKey) => {
      dateWorkouts.forEach((effectiveWorkout) => {
        const workoutEntry: { date: string; index: number; tss?: number; type?: string } = {
          date: dateKey,
          index: effectiveWorkout.originalIndex,
        }
        if (effectiveWorkout.workout.tss !== undefined)
          workoutEntry.tss = effectiveWorkout.workout.tss
        if (effectiveWorkout.workout.type !== undefined)
          workoutEntry.type = effectiveWorkout.workout.type
        workouts.push(workoutEntry)
      })
    })

    return workouts
  }, [])

  // Fetch matches and run auto-matching
  useEffect(() => {
    const instanceIds = instances.map((i) => i.id)
    if (instanceIds.length === 0) return

    const fetchMatchesAndAutoMatch = async () => {
      try {
        // Fetch existing matches
        const response = await fetch(`/api/schedule/matches?instanceIds=${instanceIds.join(',')}`)
        if (response.ok) {
          const data = await response.json()
          const newMap = new Map<string, MatchedActivityData>()
          for (const [key, value] of Object.entries(data.matches)) {
            newMap.set(key, value as MatchedActivityData)
          }
          setMatchesMap(newMap)

          // Auto-match for each instance (only once per instance)
          let matchedAny = false
          for (const instance of instances) {
            if (autoMatchedRef.current.has(instance.id)) continue

            const workouts = buildWorkoutsList(instance)
            if (workouts.length === 0) continue

            try {
              const autoResponse = await fetch('/api/schedule/matches/auto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  plan_instance_id: instance.id,
                  workouts,
                }),
              })

              if (autoResponse.ok) {
                const autoData = await autoResponse.json()
                if (autoData.matched > 0) {
                  matchedAny = true
                }
              }

              autoMatchedRef.current.add(instance.id)
            } catch {
              // Silently fail auto-matching
            }
          }

          // Refresh matches if any were auto-matched
          if (matchedAny) {
            const refreshResponse = await fetch(
              `/api/schedule/matches?instanceIds=${instanceIds.join(',')}`
            )
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              const refreshMap = new Map<string, MatchedActivityData>()
              for (const [key, value] of Object.entries(refreshData.matches)) {
                refreshMap.set(key, value as MatchedActivityData)
              }
              setMatchesMap(refreshMap)
            }
          }
        }
      } catch (error) {
        errorLogger.logError(error as Error, {
          path: 'schedule-calendar/fetchMatchesAndAutoMatch',
          metadata: { instanceIds: instances.map((i) => i.id) },
        })
      }
    }

    fetchMatchesAndAutoMatch()
  }, [instances, matchesRefreshKey, buildWorkoutsList])

  const handleMatchChange = () => {
    setMatchesRefreshKey((prev) => prev + 1)
  }

  // Fetch notes for the primary instance on mount
  useEffect(() => {
    if (!primaryInstanceId) return

    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/schedule/${primaryInstanceId}/notes/`)
        if (response.ok) {
          const data = await response.json()
          const map = new Map<string, PlanInstanceNote[]>()
          for (const note of data.notes || []) {
            const existing = map.get(note.note_date) || []
            existing.push(note)
            map.set(note.note_date, existing)
          }
          setNotesByDate(map)
        }
      } catch (error) {
        errorLogger.logError(error as Error, {
          path: 'schedule-calendar/fetchNotes',
          metadata: { primaryInstanceId },
        })
      }
    }

    fetchNotes()
  }, [primaryInstanceId])

  // Note handlers
  const handleAddNote = useCallback((date: string) => {
    setSelectedNoteDate(date)
    setSelectedNote(undefined)
    setNoteDialogMode('create')
    setNoteDialogOpen(true)
  }, [])

  const handleViewNote = useCallback((note: PlanInstanceNote) => {
    setSelectedNoteDate(note.note_date)
    setSelectedNote(note)
    setNoteDialogMode('view')
    setNoteDialogOpen(true)
  }, [])

  const handleEditNote = useCallback((note: PlanInstanceNote) => {
    setSelectedNoteDate(note.note_date)
    setSelectedNote(note)
    setNoteDialogMode('edit')
    setNoteDialogOpen(true)
  }, [])

  // Optimistic note creation - add temp note to UI immediately
  const handleOptimisticNoteCreate = useCallback((tempNote: PlanInstanceNote) => {
    setNotesByDate((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(tempNote.note_date) || []
      newMap.set(tempNote.note_date, [...existing, tempNote])
      return newMap
    })
  }, [])

  // On successful note creation - replace temp note with real one
  const handleNoteSuccess = useCallback((note: PlanInstanceNote, tempId?: string) => {
    setNotesByDate((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(note.note_date) || []

      if (tempId) {
        // Replace temp note with real note
        const updatedNotes = existing.map((n) => (n.id === tempId ? note : n))
        newMap.set(note.note_date, updatedNotes)
      } else {
        // Edit case - replace by real ID
        const updatedNotes = existing.map((n) => (n.id === note.id ? note : n))
        newMap.set(note.note_date, updatedNotes)
      }
      return newMap
    })
  }, [])

  // Rollback optimistic create on error
  const handleNoteCreateError = useCallback((tempId: string, noteDate: string) => {
    setNotesByDate((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(noteDate) || []
      newMap.set(
        noteDate,
        existing.filter((n) => n.id !== tempId)
      )
      return newMap
    })
  }, [])

  // Optimistic note deletion - remove from UI immediately, return note for potential rollback
  // Use ref to track notesByDate for synchronous access in callbacks
  const notesByDateRef = useRef<Map<string, PlanInstanceNote[]>>(notesByDate)
  useEffect(() => {
    notesByDateRef.current = notesByDate
  }, [notesByDate])

  const handleOptimisticNoteDelete = useCallback((noteId: string): PlanInstanceNote | undefined => {
    // Find the note synchronously from the ref before updating state
    // This avoids race conditions where setState callback might not have executed yet
    let deletedNote: PlanInstanceNote | undefined
    for (const notes of notesByDateRef.current.values()) {
      const note = notes.find((n) => n.id === noteId)
      if (note) {
        deletedNote = note
        break
      }
    }

    if (deletedNote) {
      setNotesByDate((prev) => {
        const newMap = new Map(prev)
        const notes = newMap.get(deletedNote.note_date)
        if (notes) {
          newMap.set(
            deletedNote.note_date,
            notes.filter((n) => n.id !== noteId)
          )
        }
        return newMap
      })
    }

    return deletedNote
  }, [])

  // Rollback optimistic delete on error
  const handleNoteDeleteError = useCallback((note: PlanInstanceNote) => {
    setNotesByDate((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(note.note_date) || []
      newMap.set(note.note_date, [...existing, note])
      return newMap
    })
  }, [])

  const handleDownloadAttachment = useCallback(async (note: PlanInstanceNote) => {
    if (!note.attachment_s3_key) return
    try {
      const response = await fetch(`/api/schedule/notes/${note.id}/attachment/`)
      if (response.ok) {
        const data = await response.json()
        window.open(data.downloadUrl, '_blank')
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleDownloadAttachment',
        metadata: { noteId: note.id },
      })
    }
  }, [])

  // Error handler for DnD and other operations
  const handleError = useCallback((message: string) => {
    setErrorMessage(message)
    // Auto-dismiss after 5 seconds
    setTimeout(() => setErrorMessage(null), 5000)
  }, [])

  // Schedule editing handlers with loading states
  const handleMoveWorkout = async (
    instanceId: string,
    source: { date: string; index: number },
    target: { date: string; index: number }
  ) => {
    // Make API call to move workout
    setIsOperationLoading(true)
    try {
      const response = await fetch(`/api/schedule/${instanceId}/workouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          source: { date: source.date, index: source.index },
          target: { date: target.date, index: target.index },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to move workout. Please try again.')
        return
      }

      // Refetch plan data to get updated workouts with new scheduled_date
      router.refresh()
    } catch (error) {
      console.error('Error moving workout:', error)
      setErrorMessage('Failed to move workout. Please try again.')
    } finally {
      setIsOperationLoading(false)
    }
  }

  const handleCopyWorkout = async (
    instanceId: string,
    source: { date: string; index: number },
    target: { date: string; index: number }
  ) => {
    // Make API call to copy workout
    setIsOperationLoading(true)
    try {
      const response = await fetch(`/api/schedule/${instanceId}/workouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          source: { date: source.date, index: source.index },
          target: { date: target.date, index: target.index },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to copy workout. Please try again.')
        return
      }

      // Refetch plan data to get updated workouts
      router.refresh()
    } catch (error) {
      console.error('Error copying workout:', error)
      setErrorMessage('Failed to copy workout. Please try again.')
    } finally {
      setIsOperationLoading(false)
    }
  }

  const handleDeleteWorkout = async (instanceId: string, date: string, index: number) => {
    // Make API call to delete workout
    setIsOperationLoading(true)
    try {
      const response = await fetch(`/api/schedule/${instanceId}/workouts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, index }),
      })

      if (!response.ok) {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to delete workout. Please try again.')
        return
      }

      // Refetch plan data to get updated workouts
      router.refresh()
    } catch (error) {
      console.error('Error deleting workout:', error)
      setErrorMessage('Failed to delete workout. Please try again.')
    } finally {
      setIsOperationLoading(false)
    }
  }

  const handlePasteWorkout = (
    instanceId: string,
    sourceDate: string,
    sourceIndex: number,
    targetDate: string,
    targetIndex: number
  ) => {
    handleCopyWorkout(
      instanceId,
      { date: sourceDate, index: sourceIndex },
      { date: targetDate, index: targetIndex }
    )
  }

  // Handler for adding library workouts via drag-and-drop
  const handleAddLibraryWorkout = async (workout: WorkoutLibraryItem, targetDate: string) => {
    // Check if target date is in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDateObj = parseLocalDate(targetDate)

    if (targetDateObj < today) {
      toast.error('Cannot add workouts to past dates')
      return
    }

    // Ensure we have a primary instance (should always have MANUAL_WORKOUTS)
    if (!primaryInstanceId) {
      toast.error('No plan available. Please refresh the page.')
      return
    }

    // Prevent duplicate drops (race condition protection)
    const dropKey = `${workout.id}:${targetDate}`
    if (libraryDropInProgressRef.current.has(dropKey)) {
      return
    }
    libraryDropInProgressRef.current.add(dropKey)

    // API call - workout is added directly to plan_data.weekly_plan
    setIsOperationLoading(true)
    try {
      const response = await fetch(`/api/schedule/${primaryInstanceId}/workouts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout_id: workout.id,
          target_date: targetDate,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to add workout')
      } else {
        toast.success('Workout added successfully!')
        // Refresh to show the new workout
        router.refresh()
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleAddLibraryWorkout',
        metadata: { workoutId: workout.id, targetDate },
      })
      toast.error('Failed to add workout. Please try again.')
    } finally {
      // Clear the drop-in-progress flag
      libraryDropInProgressRef.current.delete(dropKey)
      setIsOperationLoading(false)
    }
  }

  // Get FTP from first instance's athlete profile
  const ftp = instances[0]?.plan_data?.athlete_profile?.ftp || 200

  // Build a map of date -> workouts from all instances
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>()

    instances.forEach((instance) => {
      const startDate = parseLocalDate(instance.start_date)

      // Get effective workouts by date (reads directly from plan_data)
      const effectiveWorkouts = applyWorkoutOverrides(instance.plan_data)

      // Convert effective workouts to ScheduledWorkout format
      effectiveWorkouts.forEach((workouts, dateKey) => {
        const workoutDate = parseLocalDate(dateKey)

        // Calculate week number from date and instance start
        const startDayOfWeek = startDate.getDay()
        const daysToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
        const weekOneMonday = new Date(startDate)
        weekOneMonday.setDate(startDate.getDate() + daysToMonday)
        const daysSinceWeekOne = Math.floor(
          (workoutDate.getTime() - weekOneMonday.getTime()) / (1000 * 60 * 60 * 24)
        )
        const weekNumber = Math.floor(daysSinceWeekOne / 7) + 1

        const existing = map.get(dateKey) || []
        workouts.forEach((effectiveWorkout) => {
          // Use the workout from applyWorkoutOverrides - it already has full data
          existing.push({
            workout: effectiveWorkout.workout,
            instance,
            weekNumber,
            date: workoutDate,
            index: effectiveWorkout.originalIndex,
          })
        })
        map.set(dateKey, existing)
      })
    })

    return map
  }, [instances])

  // Get calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // First day of month
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()

    // Last day of month
    const lastDay = new Date(year, month + 1, 0)
    const lastDate = lastDay.getDate()

    // Build calendar grid (6 weeks max)
    const days: (Date | null)[] = []

    // Add empty cells for days before first of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of month
    for (let day = 1; day <= lastDate; day++) {
      days.push(new Date(year, month, day))
    }

    // Pad to complete the last week
    while (days.length % 7 !== 0) {
      days.push(null)
    }

    return days
  }, [currentDate])

  const handleWorkoutClick = (scheduledWorkout: ScheduledWorkout) => {
    setSelectedWorkout(scheduledWorkout)
    setModalOpen(true)
  }

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const today = new Date()
  const todayKey = formatDateString(today)

  const monthName = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  const calendarContent = (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{monthName}</h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={goToToday} variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            {t('today')}
          </Button>
          <Button
            onClick={goToPreviousMonth}
            variant="outline"
            size="icon"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={goToNextMonth} variant="outline" size="icon" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isOperationLoading && (
        <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-900">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <AlertDescription>Processing workout operation...</AlertDescription>
          </div>
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-muted">
          {/* Header Row */}
          {DAYS_SHORT.map((day) => (
            <div key={day} className="bg-background p-2 text-center text-sm font-medium">
              {day}
            </div>
          ))}

          {/* Day Cells */}
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="bg-muted/30 min-h-[120px] h-full" />
            }

            const dateKey = formatDateString(date)
            const workouts = workoutsByDate.get(dateKey) || []
            const notes = notesByDate.get(dateKey) || []
            const isToday = dateKey === todayKey
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()

            const dayCellContent = (
              <div
                className={`bg-background p-1.5 min-h-[120px] h-full ${
                  isToday ? 'ring-2 ring-primary ring-inset' : ''
                } ${!isCurrentMonth ? 'opacity-50' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {date.getDate()}
                </div>

                {workouts.length > 0 || notes.length > 0 ? (
                  <div className="space-y-1">
                    {/* Render workouts */}
                    {workouts.map((sw, idx) => {
                      // Use stored index (week.workouts index) for consistency with overrides
                      const workoutIndex = sw.index ?? idx
                      // Try workout.id key first (new format), fall back to date:index (legacy)
                      const workoutIdKey = sw.workout.id
                        ? `${sw.instance.id}:${sw.workout.id}`
                        : null
                      const legacyKey = `${sw.instance.id}:${dateKey}:${workoutIndex}`
                      const matchData =
                        (workoutIdKey && matchesMap.get(workoutIdKey)) || matchesMap.get(legacyKey)
                      const hasMatch = !!matchData

                      const workoutCard = (
                        <WorkoutCard
                          workout={sw.workout}
                          matchedActivity={matchData}
                          className="text-[9px]"
                          onClick={() => handleWorkoutClick({ ...sw, index: workoutIndex })}
                        />
                      )

                      // In edit mode with single instance, wrap with DnD and context menu
                      // DraggableScheduledWorkout must be outside so drag listeners capture events first
                      if (canEdit) {
                        return (
                          <div key={`${sw.instance.id}-${workoutIndex}`} className="relative">
                            <DraggableScheduledWorkout
                              instanceId={sw.instance.id}
                              date={dateKey}
                              index={workoutIndex}
                              workout={sw.workout}
                              hasMatch={hasMatch}
                              isEditMode={canEdit}
                            >
                              <WorkoutContextMenu
                                instanceId={sw.instance.id}
                                date={dateKey}
                                index={workoutIndex}
                                workout={sw.workout}
                                hasMatch={hasMatch}
                                isEditMode={canEdit}
                                onViewDetails={() =>
                                  handleWorkoutClick({ ...sw, index: workoutIndex })
                                }
                                onDelete={() =>
                                  handleDeleteWorkout(sw.instance.id, dateKey, workoutIndex)
                                }
                              >
                                {workoutCard}
                              </WorkoutContextMenu>
                            </DraggableScheduledWorkout>
                          </div>
                        )
                      }

                      // Normal mode - workout card with context menu (view only) and optional badge
                      return (
                        <div key={`${sw.instance.id}-${workoutIndex}`} className="relative">
                          {instances.length > 1 && (
                            <Badge
                              variant="outline"
                              className="absolute -top-1 -right-1 text-[8px] px-1 py-0 z-10"
                            >
                              {formatWithGoalLabels(sw.instance.name, tGoals).substring(0, 3)}
                            </Badge>
                          )}
                          <WorkoutContextMenu
                            instanceId={sw.instance.id}
                            date={dateKey}
                            index={workoutIndex}
                            workout={sw.workout}
                            hasMatch={hasMatch}
                            isEditMode={false}
                            onViewDetails={() => handleWorkoutClick({ ...sw, index: workoutIndex })}
                          >
                            {workoutCard}
                          </WorkoutContextMenu>
                        </div>
                      )
                    })}

                    {/* Render notes */}
                    {notes.map((note) => (
                      <NoteContextMenu
                        key={note.id}
                        note={note}
                        onView={() => handleViewNote(note)}
                        onEdit={() => handleEditNote(note)}
                        onDelete={async () => {
                          // Confirm and delete with optimistic UI
                          if (confirm('Are you sure you want to delete this note?')) {
                            // Optimistic: remove from UI immediately
                            const deletedNote = handleOptimisticNoteDelete(note.id)

                            try {
                              const response = await fetch(
                                `/api/schedule/${primaryInstanceId}/notes/${note.id}/`,
                                { method: 'DELETE' }
                              )
                              if (!response.ok) {
                                throw new Error(`Delete failed: ${response.status}`)
                              }
                              // Success - note already removed from UI
                            } catch (error) {
                              // Rollback: restore the note on error
                              if (deletedNote) {
                                handleNoteDeleteError(deletedNote)
                              }
                              errorLogger.logError(error as Error, {
                                path: 'schedule-calendar/onDelete',
                                metadata: { noteId: note.id, primaryInstanceId },
                              })
                              handleError('Failed to delete note. Please try again.')
                            }
                          }
                        }}
                        onDownload={() => handleDownloadAttachment(note)}
                      >
                        <NoteCard
                          note={note}
                          className="text-[9px]"
                          onClick={() => handleViewNote(note)}
                        />
                      </NoteContextMenu>
                    ))}
                  </div>
                ) : (
                  <div className="h-full" />
                )}
              </div>
            )

            // If sidebar exists (library mode), make days droppable for library workouts
            // If canEdit is also true, add context menu for full editing
            if (sidebarContent || canEdit) {
              const droppableDay = (
                <DroppableCalendarDay
                  date={dateKey}
                  isEditMode={canEdit}
                  allowLibraryDrops={!!sidebarContent}
                  className="h-full"
                >
                  {dayCellContent}
                </DroppableCalendarDay>
              )

              // If in full edit mode, wrap with context menu
              if (canEdit) {
                return (
                  <CalendarDayContextMenu
                    key={dateKey}
                    date={dateKey}
                    isEditMode={canEdit}
                    existingWorkoutsCount={workouts.length}
                    onAddNote={() => handleAddNote(dateKey)}
                  >
                    {droppableDay}
                  </CalendarDayContextMenu>
                )
              }

              // Library mode only - droppable but no context menu
              return <div key={dateKey}>{droppableDay}</div>
            }

            return (
              <div key={dateKey} className="h-full">
                {dayCellContent}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
          <span>{tPlan('workoutTypes.endurance')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
          <span>{tPlan('workoutTypes.tempo')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200" />
          <span>{tPlan('workoutTypes.threshold')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
          <span>{tPlan('workoutTypes.vo2max')}</span>
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
        planInstanceId={selectedWorkout?.instance.id}
        workoutDate={selectedWorkout ? formatDateString(selectedWorkout.date) : undefined}
        workoutIndex={selectedWorkout?.index}
        matchedActivity={
          selectedWorkout
            ? // Try workout.id key first (new format), fall back to date:index (legacy)
              (selectedWorkout.workout.id &&
                matchesMap.get(`${selectedWorkout.instance.id}:${selectedWorkout.workout.id}`)) ||
              matchesMap.get(
                `${selectedWorkout.instance.id}:${formatDateString(selectedWorkout.date)}:${selectedWorkout.index}`
              )
            : undefined
        }
        onMatchChange={handleMatchChange}
      />

      {/* Note Dialog - only render when open to avoid invalid date errors */}
      {primaryInstanceId && noteDialogOpen && selectedNoteDate && (
        <NoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          mode={noteDialogMode}
          instanceId={primaryInstanceId}
          noteDate={selectedNoteDate}
          {...(selectedNote ? { existingNote: selectedNote } : {})}
          onOptimisticCreate={handleOptimisticNoteCreate}
          onSuccess={handleNoteSuccess}
          onCreateError={handleNoteCreateError}
          onOptimisticDelete={handleOptimisticNoteDelete}
          onDeleteError={handleNoteDeleteError}
        />
      )}
    </div>
  )

  // Layout with sidebar (with or without DnD depending on edit mode)
  const layoutWithSidebar = sidebarContent ? (
    <div className="flex h-full">
      {sidebarContent}
      <div className="flex-1 overflow-auto pl-5">{calendarContent}</div>
    </div>
  ) : (
    calendarContent
  )

  // Wrap with DnD when sidebar is present (for library workout drops)
  // If canEdit is also true, add clipboard provider for full editing
  if (sidebarContent) {
    const dndContent = (
      <ScheduleDndContext
        onMoveWorkout={handleMoveWorkout}
        onAddLibraryWorkout={handleAddLibraryWorkout}
        onError={handleError}
        isEditMode={canEdit}
      >
        {layoutWithSidebar}
      </ScheduleDndContext>
    )

    // If in edit mode, also wrap with clipboard provider
    if (canEdit && primaryInstanceId) {
      return (
        <ScheduleClipboardProvider instanceId={primaryInstanceId} onPaste={handlePasteWorkout}>
          {dndContent}
        </ScheduleClipboardProvider>
      )
    }

    return dndContent
  }

  // No sidebar - just show calendar
  return layoutWithSidebar
}

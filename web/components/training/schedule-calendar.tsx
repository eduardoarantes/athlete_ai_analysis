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
import type {
  PlanInstance,
  Workout,
  PlanInstanceNote,
  TrainingPlanData,
  WeeklyPlan,
} from '@/lib/types/training-plan'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'
import type { ManualWorkout } from '@/lib/types/manual-workout'
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
import { CALENDAR_DAYS_SHORT } from '@/lib/constants/weekdays'

interface ScheduleCalendarProps {
  instances: PlanInstance[]
  isAdmin?: boolean
  allowEditing?: boolean
  /** Sidebar content to render inside the DnD context (for library workout drag) */
  sidebarContent?: React.ReactNode
}

// Removed: convertLibrarySegmentsToSchedule - segments are no longer used
// Library workouts now use the structure field directly

// Helper to get weekday name from day number (0 = Sunday)
const getWeekdayName = (dayNum: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayNum] || 'Sunday' // Default to Sunday if out of bounds
}

// Helper to deep clone plan_data
const clonePlanData = (data: TrainingPlanData): TrainingPlanData => {
  return JSON.parse(JSON.stringify(data))
}

// Helper to find or create a week for a target date
const findOrCreateWeek = (planData: TrainingPlanData, targetDate: string): WeeklyPlan => {
  // Parse target date
  const date = parseLocalDate(targetDate)

  // Find which week this date belongs to based on plan start
  // Use the first workout's date as the plan start reference
  const firstWorkout = planData.weekly_plan[0]?.workouts[0]
  const startDate = firstWorkout?.scheduled_date
    ? parseLocalDate(firstWorkout.scheduled_date)
    : date

  // Calculate week number (1-based)
  const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(daysDiff / 7) + 1

  // Find or create the week
  let week = planData.weekly_plan.find((w) => w.week_number === weekNumber)
  if (!week) {
    week = {
      week_number: weekNumber,
      phase: 'Base', // Default phase
      week_tss: 0,
      workouts: [],
    }
    planData.weekly_plan.push(week)
    planData.weekly_plan.sort((a, b) => a.week_number - b.week_number)
  }

  return week
}

interface ScheduledWorkout {
  workout: Workout
  instance: PlanInstance
  weekNumber: number
  date: Date
  index?: number
  // Manual workout fields (null if from plan)
  manualWorkoutId?: string | null
  sourcePlanInstanceId?: string | null
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

  // Manual workouts state
  const [manualWorkouts, setManualWorkouts] = useState<ManualWorkout[]>([])

  // Edit state
  // Error message for user feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  // Local state for optimistic UI updates
  const [localInstances, setLocalInstances] = useState<PlanInstance[]>(instances)
  const localInstancesRef = useRef<PlanInstance[]>(instances)

  // Sync local instances when prop changes (server data takes precedence)
  useEffect(() => {
    setLocalInstances(instances)
    localInstancesRef.current = instances
  }, [instances])

  // Matches state: Map of "instanceId:workoutId" (or legacy "instanceId:date:index") -> MatchedActivityData
  const [matchesMap, setMatchesMap] = useState<Map<string, MatchedActivityData>>(new Map())
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0)
  const autoMatchedRef = useRef<Set<string>>(new Set())

  // Ref to prevent duplicate drops (race condition protection)
  const libraryDropInProgressRef = useRef<Set<string>>(new Set())

  // Build workouts list for auto-matching
  const buildWorkoutsList = useCallback((instance: PlanInstance) => {
    const workouts: Array<{ id: string; scheduled_date: string; tss?: number; type?: string }> = []

    if (!instance.plan_data?.weekly_plan) return workouts

    // Get effective workouts by date (reads directly from plan_data)
    const effectiveWorkouts = applyWorkoutOverrides(instance.plan_data)

    effectiveWorkouts.forEach((dateWorkouts) => {
      dateWorkouts.forEach((effectiveWorkout) => {
        // Skip workouts without ID or scheduled_date
        if (!effectiveWorkout.workout.id || !effectiveWorkout.workout.scheduled_date) return

        const workoutEntry: { id: string; scheduled_date: string; tss?: number; type?: string } = {
          id: effectiveWorkout.workout.id,
          scheduled_date: effectiveWorkout.workout.scheduled_date,
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

  // Fetch manual workouts for the current month
  useEffect(() => {
    const fetchManualWorkouts = async () => {
      try {
        // Calculate date range for current month view
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const startDate = formatDateString(new Date(year, month, 1))
        const endDate = formatDateString(new Date(year, month + 1, 0))

        const response = await fetch(
          `/api/manual-workouts?start_date=${startDate}&end_date=${endDate}`
        )

        if (response.ok) {
          const data = await response.json()
          setManualWorkouts(data.data || [])
        } else {
          errorLogger.logWarning('Failed to fetch manual workouts', {
            path: 'schedule-calendar/fetchManualWorkouts',
            metadata: { status: response.status },
          })
        }
      } catch (error) {
        errorLogger.logError(error as Error, {
          path: 'schedule-calendar/fetchManualWorkouts',
        })
      }
    }

    fetchManualWorkouts()
  }, [currentDate])

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
  // Optimistic update for moving workouts
  const handleOptimisticMove = useCallback(
    (instanceId: string, workoutId: string, targetDate: string): (() => void) => {
      // Capture original state for rollback
      const originalInstances = [...localInstancesRef.current]

      // Update local state optimistically
      setLocalInstances((prev) => {
        return prev.map((instance) => {
          if (instance.id !== instanceId) return instance

          const planData = clonePlanData(instance.plan_data)

          // Find and modify the workout
          let movedWorkout: Workout | null = null
          planData.weekly_plan.forEach((week) => {
            const workoutIndex = week.workouts.findIndex((w) => w.id === workoutId)
            if (workoutIndex >= 0) {
              const workout = week.workouts[workoutIndex]
              if (workout) {
                movedWorkout = {
                  ...workout,
                  scheduled_date: targetDate,
                  weekday: getWeekdayName(parseLocalDate(targetDate).getDay()),
                }
                week.workouts.splice(workoutIndex, 1)
                week.week_tss = week.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
              }
            }
          })

          // Add to target week
          if (movedWorkout) {
            const targetWeek = findOrCreateWeek(planData, targetDate)
            targetWeek.workouts.push(movedWorkout)
            targetWeek.week_tss = targetWeek.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
          }

          return { ...instance, plan_data: planData }
        })
      })

      // Return rollback function
      return () => setLocalInstances(originalInstances)
    },
    []
  )

  const handleMoveWorkout = async (instanceId: string, workoutId: string, targetDate: string) => {
    // Apply optimistic update
    const rollback = handleOptimisticMove(instanceId, workoutId, targetDate)

    try {
      const response = await fetch(`/api/schedule/${instanceId}/workouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          source: { workout_id: workoutId },
          target: { date: targetDate },
        }),
      })

      if (!response.ok) {
        rollback() // Rollback on error
        const error = await response.json()
        toast.error(error.error || 'Failed to move workout')
        return
      }

      const result = await response.json()

      // Check if workout was extracted to manual workouts
      if (result.extracted && result.manual_workout) {
        // Add to manual workouts state
        setManualWorkouts((prev) => [...prev, result.manual_workout])
        toast.success('Workout moved outside plan range (now a manual workout)')
      }

      // Success - sync with server to get canonical state
      router.refresh()
    } catch (error) {
      rollback() // Rollback on error
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleMoveWorkout',
        metadata: { instanceId, workoutId, targetDate },
      })
      toast.error('Failed to move workout. Please try again.')
    }
  }

  // Handler for moving manual workouts
  const handleMoveManualWorkout = async (manualWorkoutId: string, targetDate: string) => {
    try {
      const response = await fetch(`/api/manual-workouts/${manualWorkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: targetDate,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to move workout')
        return
      }

      const result = await response.json()
      const updatedWorkout = result.data

      // Optimistically update manual workouts state
      setManualWorkouts((prev) => prev.map((w) => (w.id === manualWorkoutId ? updatedWorkout : w)))

      toast.success('Workout moved successfully!')
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleMoveManualWorkout',
        metadata: { manualWorkoutId, targetDate },
      })
      toast.error('Failed to move workout. Please try again.')
    }
  }

  // Optimistic update for copying workouts
  const handleOptimisticCopy = useCallback(
    (instanceId: string, workoutId: string, targetDate: string): (() => void) => {
      const originalInstances = [...localInstancesRef.current]
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      setLocalInstances((prev) => {
        return prev.map((instance) => {
          if (instance.id !== instanceId) return instance

          const planData = clonePlanData(instance.plan_data)

          // Find workout to copy
          let workoutToCopy: Workout | null = null
          for (const week of planData.weekly_plan) {
            const workout = week.workouts.find((w) => w.id === workoutId)
            if (workout) {
              workoutToCopy = workout
              break
            }
          }

          if (workoutToCopy) {
            const copiedWorkout: Workout = {
              ...workoutToCopy,
              id: tempId, // Temporary ID until server confirms
              scheduled_date: targetDate,
              weekday: getWeekdayName(parseLocalDate(targetDate).getDay()),
            }

            const targetWeek = findOrCreateWeek(planData, targetDate)
            targetWeek.workouts.push(copiedWorkout)
            targetWeek.week_tss = targetWeek.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
          }

          return { ...instance, plan_data: planData }
        })
      })

      return () => setLocalInstances(originalInstances)
    },
    []
  )

  const handleCopyWorkout = async (instanceId: string, workoutId: string, targetDate: string) => {
    // Apply optimistic update
    const rollback = handleOptimisticCopy(instanceId, workoutId, targetDate)

    try {
      const response = await fetch(`/api/schedule/${instanceId}/workouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          source: { workout_id: workoutId },
          target: { date: targetDate },
        }),
      })

      if (!response.ok) {
        rollback()
        const error = await response.json()
        toast.error(error.error || 'Failed to copy workout')
        return
      }

      router.refresh()
    } catch (error) {
      rollback()
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleCopyWorkout',
        metadata: { instanceId, workoutId, targetDate },
      })
      toast.error('Failed to copy workout. Please try again.')
    }
  }

  // Optimistic update for deleting workouts
  const handleOptimisticDelete = useCallback(
    (instanceId: string, workoutId: string): (() => void) => {
      const originalInstances = [...localInstancesRef.current]

      setLocalInstances((prev) => {
        return prev.map((instance) => {
          if (instance.id !== instanceId) return instance

          const planData = clonePlanData(instance.plan_data)

          // Find and remove workout
          planData.weekly_plan.forEach((week) => {
            const workoutIndex = week.workouts.findIndex((w) => w.id === workoutId)
            if (workoutIndex >= 0) {
              week.workouts.splice(workoutIndex, 1)
              week.week_tss = week.workouts.reduce((sum, w) => sum + (w.tss || 0), 0)
            }
          })

          return { ...instance, plan_data: planData }
        })
      })

      return () => setLocalInstances(originalInstances)
    },
    []
  )

  const handleDeleteWorkout = async (instanceId: string, workoutId: string) => {
    const rollback = handleOptimisticDelete(instanceId, workoutId)

    try {
      const response = await fetch(`/api/schedule/${instanceId}/workouts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_id: workoutId }),
      })

      if (!response.ok) {
        rollback()
        const error = await response.json()
        toast.error(error.error || 'Failed to delete workout')
        return
      }

      router.refresh()
    } catch (error) {
      rollback()
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleDeleteWorkout',
        metadata: { instanceId, workoutId },
      })
      toast.error('Failed to delete workout. Please try again.')
    }
  }

  // Handler for deleting manual workouts
  const handleDeleteManualWorkout = async (manualWorkoutId: string) => {
    try {
      const response = await fetch(`/api/manual-workouts/${manualWorkoutId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete workout')
        return
      }

      // Optimistically remove from manual workouts state
      setManualWorkouts((prev) => prev.filter((w) => w.id !== manualWorkoutId))

      toast.success('Workout deleted successfully!')
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'schedule-calendar/handleDeleteManualWorkout',
        metadata: { manualWorkoutId },
      })
      toast.error('Failed to delete workout. Please try again.')
    }
  }

  const handlePasteWorkout = (instanceId: string, workoutId: string, targetDate: string) => {
    handleCopyWorkout(instanceId, workoutId, targetDate)
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

    // Prevent duplicate drops (race condition protection)
    const dropKey = `${workout.id}:${targetDate}`
    if (libraryDropInProgressRef.current.has(dropKey)) {
      return
    }
    libraryDropInProgressRef.current.add(dropKey)

    try {
      // Use new manual workouts API
      const response = await fetch('/api/manual-workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          library_workout_id: workout.id,
          scheduled_date: targetDate,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to add workout')
      } else {
        const result = await response.json()
        const newManualWorkout = result.data

        // Optimistically add to manual workouts state
        setManualWorkouts((prev) => [...prev, newManualWorkout])

        toast.success('Workout added successfully!')
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
    }
  }

  // Get FTP from first instance's athlete profile
  const ftp = instances[0]?.plan_data?.athlete_profile?.ftp || 200

  // Build a map of date -> workouts from all instances (plan + manual)
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>()

    // Add plan workouts
    localInstances.forEach((instance) => {
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

    // Add manual workouts
    manualWorkouts.forEach((manualWorkout) => {
      const dateKey = manualWorkout.scheduled_date
      const workoutDate = parseLocalDate(dateKey)
      const existing = map.get(dateKey) || []

      // Create a pseudo-instance for manual workouts (needed for consistency)
      // Use the manualWorkoutsInstance if available, or create a minimal one
      const pseudoInstance: PlanInstance =
        manualWorkoutsInstance ||
        ({
          id: 'manual-workouts',
          user_id: '',
          name: 'Manual Workouts',
          status: 'active',
          start_date: dateKey,
          end_date: dateKey,
          plan_data: { weekly_plan: [] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          instance_type: 'manual_workouts',
          template_id: null,
          weeks_total: 0,
          workout_overrides: null,
        } as unknown as PlanInstance)

      existing.push({
        workout: manualWorkout.workout_data,
        instance: pseudoInstance,
        weekNumber: 0, // Manual workouts don't have week numbers
        date: workoutDate,
        manualWorkoutId: manualWorkout.id,
        sourcePlanInstanceId: manualWorkout.source_plan_instance_id,
      })

      map.set(dateKey, existing)
    })

    return map
  }, [localInstances, manualWorkouts, manualWorkoutsInstance])

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
          {CALENDAR_DAYS_SHORT.map((day) => (
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
                          extractedFromPlan={sw.sourcePlanInstanceId}
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
                              manualWorkoutId={sw.manualWorkoutId}
                            >
                              <WorkoutContextMenu
                                instanceId={sw.instance.id}
                                workout={sw.workout}
                                hasMatch={hasMatch}
                                isEditMode={canEdit}
                                onViewDetails={() =>
                                  handleWorkoutClick({ ...sw, index: workoutIndex })
                                }
                                {...(sw.workout.id
                                  ? {
                                      onDelete: () => {
                                        // Route to correct delete handler based on source
                                        if (sw.manualWorkoutId) {
                                          handleDeleteManualWorkout(sw.manualWorkoutId)
                                        } else {
                                          handleDeleteWorkout(
                                            sw.instance.id,
                                            sw.workout.id as string
                                          )
                                        }
                                      },
                                    }
                                  : {})}
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
        onMoveManualWorkout={handleMoveManualWorkout}
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

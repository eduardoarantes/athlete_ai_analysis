'use client'

/**
 * Plan Builder Context
 *
 * React Context for managing plan builder state across components.
 * Provides reducer dispatch, undo/redo helpers, and auto-save functionality.
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react'
import type {
  PlanBuilderState,
  PlanBuilderAction,
  DayOfWeek,
  WeekState,
  PlanMetadata,
} from '@/lib/types/plan-builder'
import type { TrainingPhase, WorkoutLibraryItem } from '@/lib/types/workout-library'
import { createInitialPlanBuilderState } from '@/lib/types/plan-builder'
import { planBuilderReducer, canUndo, canRedo } from '@/lib/utils/plan-builder-reducer'
import { validatePlan } from '@/lib/utils/plan-validator'

/**
 * Context value interface
 */
interface PlanBuilderContextValue {
  /** Current state */
  state: PlanBuilderState

  /** Raw dispatch function */
  dispatch: Dispatch<PlanBuilderAction>

  /** Whether undo is available */
  canUndo: boolean

  /** Whether redo is available */
  canRedo: boolean

  /** Whether the plan is currently loading */
  isLoading: boolean

  // Action helpers
  /** Initialize or reset the plan */
  initPlan: (data: Partial<PlanBuilderState>) => void

  /** Update plan metadata */
  updateMetadata: (metadata: Partial<PlanMetadata>) => void

  /** Add a new week */
  addWeek: (phase: TrainingPhase) => void

  /** Remove a week */
  removeWeek: (weekNumber: number) => void

  /** Update week phase */
  updateWeekPhase: (weekNumber: number, phase: TrainingPhase) => void

  /** Update week notes */
  updateWeekNotes: (weekNumber: number, notes: string) => void

  /** Copy workouts from one week to another */
  copyWeek: (sourceWeekNumber: number, targetWeekNumber: number) => void

  /** Add a workout to a day */
  addWorkout: (weekNumber: number, day: DayOfWeek, workout: WorkoutLibraryItem) => void

  /** Remove a workout placement */
  removeWorkout: (weekNumber: number, day: DayOfWeek, placementId: string) => void

  /** Move a workout between days/weeks */
  moveWorkout: (
    sourceWeek: number,
    sourceDay: DayOfWeek,
    targetWeek: number,
    targetDay: DayOfWeek,
    placementId: string,
    newOrder: number
  ) => void

  /** Reorder workouts within a day */
  reorderWorkouts: (weekNumber: number, day: DayOfWeek, placementIds: string[]) => void

  /** Undo last action */
  undo: () => void

  /** Redo undone action */
  redo: () => void

  /** Validate the plan */
  validate: () => { isValid: boolean; errors: string[]; warnings: string[] }

  /** Clear validation errors/warnings */
  clearValidation: () => void

  /** Get a specific week by number */
  getWeek: (weekNumber: number) => WeekState | undefined

  /** Save the plan immediately */
  saveNow: () => Promise<void>

  /** Publish the plan (save and set as active) */
  publishPlan: () => Promise<void>
}

/**
 * Create the context with undefined default
 */
const PlanBuilderContext = createContext<PlanBuilderContextValue | undefined>(undefined)

/**
 * Provider props
 */
interface PlanBuilderProviderProps {
  children: ReactNode
  initialState?: Partial<PlanBuilderState> | undefined
  /** Plan ID to load (for editing existing plans) */
  planId?: string | undefined
  /** Whether auto-save is enabled (default: true) */
  autoSaveEnabled?: boolean | undefined
  /** Auto-save debounce in milliseconds (default: 2000) */
  autoSaveDebounceMs?: number | undefined
}

/**
 * Save plan to API
 */
async function savePlanToApi(
  state: PlanBuilderState,
  publish: boolean = false
): Promise<{ planId: string; savedAt: string }> {
  const isUpdate = Boolean(state.planId)
  const url = isUpdate ? `/api/custom-plans/${state.planId}` : '/api/custom-plans'
  const method = isUpdate ? 'PUT' : 'POST'

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: state.planId ?? undefined,
      metadata: state.metadata,
      weeks: state.weeks.map((week) => ({
        weekNumber: week.weekNumber,
        phase: week.phase,
        workouts: week.workouts,
        weeklyTss: week.weeklyTss,
        notes: week.notes,
      })),
      publish,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save plan')
  }

  return response.json()
}

/**
 * Plan Builder Provider Component
 */
export function PlanBuilderProvider({
  children,
  initialState,
  planId,
  autoSaveEnabled = true,
  autoSaveDebounceMs = 2000,
}: PlanBuilderProviderProps) {
  const [state, dispatch] = useReducer(
    planBuilderReducer,
    createInitialPlanBuilderState(
      planId ?? initialState?.planId ?? undefined,
      initialState?.metadata,
      initialState?.weeks
    )
  )

  const [isLoading, setIsLoading] = useState(Boolean(planId))
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)

  // Load existing plan if planId is provided
  useEffect(() => {
    if (!planId) return

    async function loadPlan() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/custom-plans/${planId}`)
        if (!response.ok) {
          throw new Error('Failed to load plan')
        }
        const data = await response.json()

        dispatch({
          type: 'INIT_PLAN',
          payload: {
            planId: data.plan.id,
            metadata: {
              name: data.plan.name,
              description: data.plan.description,
              goal: data.plan.goal,
              targetFtp: data.plan.targetFtp,
            },
            weeks: data.weeks,
            isDirty: false,
          },
        })
      } catch (error) {
        dispatch({
          type: 'SAVE_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to load plan' },
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadPlan()
  }, [planId])

  // Auto-save effect
  useEffect(() => {
    if (!autoSaveEnabled || !state.isDirty || !state.metadata.name || isSavingRef.current) {
      return
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) return

      isSavingRef.current = true
      dispatch({ type: 'MARK_SAVING' })

      try {
        const result = await savePlanToApi(state)
        dispatch({ type: 'MARK_SAVED', payload: { planId: result.planId } })
      } catch (error) {
        dispatch({
          type: 'SAVE_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to save' },
        })
      } finally {
        isSavingRef.current = false
      }
    }, autoSaveDebounceMs)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [state, autoSaveEnabled, autoSaveDebounceMs])

  // Action helpers - memoized for stability
  const initPlan = useCallback((data: Partial<PlanBuilderState>) => {
    dispatch({ type: 'INIT_PLAN', payload: data })
  }, [])

  const updateMetadata = useCallback((metadata: Partial<PlanMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', payload: metadata })
  }, [])

  const addWeek = useCallback((phase: TrainingPhase) => {
    dispatch({ type: 'ADD_WEEK', payload: { phase } })
  }, [])

  const removeWeek = useCallback((weekNumber: number) => {
    dispatch({ type: 'REMOVE_WEEK', payload: { weekNumber } })
  }, [])

  const updateWeekPhase = useCallback((weekNumber: number, phase: TrainingPhase) => {
    dispatch({ type: 'UPDATE_WEEK_PHASE', payload: { weekNumber, phase } })
  }, [])

  const updateWeekNotes = useCallback((weekNumber: number, notes: string) => {
    dispatch({ type: 'UPDATE_WEEK_NOTES', payload: { weekNumber, notes } })
  }, [])

  const copyWeek = useCallback((sourceWeekNumber: number, targetWeekNumber: number) => {
    dispatch({
      type: 'COPY_WEEK',
      payload: { sourceWeekNumber, targetWeekNumber },
    })
  }, [])

  const addWorkout = useCallback(
    (weekNumber: number, day: DayOfWeek, workout: WorkoutLibraryItem) => {
      dispatch({ type: 'ADD_WORKOUT', payload: { weekNumber, day, workout } })
    },
    []
  )

  const removeWorkout = useCallback(
    (weekNumber: number, day: DayOfWeek, placementId: string) => {
      dispatch({ type: 'REMOVE_WORKOUT', payload: { weekNumber, day, placementId } })
    },
    []
  )

  const moveWorkout = useCallback(
    (
      sourceWeek: number,
      sourceDay: DayOfWeek,
      targetWeek: number,
      targetDay: DayOfWeek,
      placementId: string,
      newOrder: number
    ) => {
      dispatch({
        type: 'MOVE_WORKOUT',
        payload: { sourceWeek, sourceDay, targetWeek, targetDay, placementId, newOrder },
      })
    },
    []
  )

  const reorderWorkouts = useCallback(
    (weekNumber: number, day: DayOfWeek, placementIds: string[]) => {
      dispatch({ type: 'REORDER_WORKOUTS', payload: { weekNumber, day, placementIds } })
    },
    []
  )

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  const validate = useCallback(() => {
    const result = validatePlan(state)
    dispatch({
      type: 'VALIDATE',
      payload: { errors: result.errors, warnings: result.warnings },
    })
    return result
  }, [state])

  const clearValidation = useCallback(() => {
    dispatch({ type: 'CLEAR_VALIDATION' })
  }, [])

  const getWeek = useCallback(
    (weekNumber: number) => {
      return state.weeks.find((w) => w.weekNumber === weekNumber)
    },
    [state.weeks]
  )

  // Manual save function
  const saveNow = useCallback(async () => {
    if (isSavingRef.current || !state.metadata.name) return

    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }

    isSavingRef.current = true
    dispatch({ type: 'MARK_SAVING' })

    try {
      const result = await savePlanToApi(state)
      dispatch({ type: 'MARK_SAVED', payload: { planId: result.planId } })
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to save' },
      })
      throw error
    } finally {
      isSavingRef.current = false
    }
  }, [state])

  // Publish plan function (saves and sets as active)
  const publishPlan = useCallback(async () => {
    if (isSavingRef.current || !state.metadata.name) return

    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }

    isSavingRef.current = true
    dispatch({ type: 'MARK_SAVING' })

    try {
      const result = await savePlanToApi(state, true) // publish = true
      dispatch({ type: 'MARK_SAVED', payload: { planId: result.planId } })
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to publish' },
      })
      throw error
    } finally {
      isSavingRef.current = false
    }
  }, [state])

  // Memoized context value
  const value = useMemo<PlanBuilderContextValue>(
    () => ({
      state,
      dispatch,
      canUndo: canUndo(state),
      canRedo: canRedo(state),
      isLoading,
      initPlan,
      updateMetadata,
      addWeek,
      removeWeek,
      updateWeekPhase,
      updateWeekNotes,
      copyWeek,
      addWorkout,
      removeWorkout,
      moveWorkout,
      reorderWorkouts,
      undo,
      redo,
      validate,
      clearValidation,
      getWeek,
      saveNow,
      publishPlan,
    }),
    [
      state,
      isLoading,
      initPlan,
      updateMetadata,
      addWeek,
      removeWeek,
      updateWeekPhase,
      updateWeekNotes,
      copyWeek,
      addWorkout,
      removeWorkout,
      moveWorkout,
      reorderWorkouts,
      undo,
      redo,
      validate,
      clearValidation,
      getWeek,
      saveNow,
      publishPlan,
    ]
  )

  return <PlanBuilderContext.Provider value={value}>{children}</PlanBuilderContext.Provider>
}

/**
 * Hook to use the plan builder context
 *
 * @throws Error if used outside of PlanBuilderProvider
 */
export function usePlanBuilder(): PlanBuilderContextValue {
  const context = useContext(PlanBuilderContext)

  if (context === undefined) {
    throw new Error('usePlanBuilder must be used within a PlanBuilderProvider')
  }

  return context
}

/**
 * Hook for plan builder state only (for components that only need to read)
 */
export function usePlanBuilderState(): PlanBuilderState {
  const { state } = usePlanBuilder()
  return state
}

/**
 * Hook for week-specific data
 */
export function useWeek(weekNumber: number): WeekState | undefined {
  const { getWeek } = usePlanBuilder()
  return getWeek(weekNumber)
}

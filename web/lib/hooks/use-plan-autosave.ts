import { useEffect, useRef, useCallback } from 'react'
import type { PlanBuilderState, SavePlanRequest, SavePlanResponse } from '@/lib/types/plan-builder'

/**
 * Auto-save configuration options
 */
interface AutoSaveOptions {
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean
  /** Callback on save start */
  onSaveStart?: () => void
  /** Callback on save success */
  onSaveSuccess?: (response: SavePlanResponse) => void
  /** Callback on save error */
  onSaveError?: (error: string) => void
}

/**
 * Return type for the auto-save hook
 */
interface UseAutoSaveReturn {
  /** Trigger an immediate save */
  saveNow: () => Promise<void>
  /** Whether a save is currently in progress */
  isSaving: boolean
}

/**
 * Convert plan builder state to API request format
 */
function stateToRequest(state: PlanBuilderState): SavePlanRequest {
  const request: SavePlanRequest = {
    metadata: state.metadata,
    weeks: state.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      phase: week.phase,
      workouts: week.workouts,
      weeklyTss: week.weeklyTss,
      ...(week.notes ? { notes: week.notes } : {}),
    })),
    publish: false, // Auto-save always saves as draft
  }

  // Only include planId if it exists
  if (state.planId) {
    request.planId = state.planId
  }

  return request
}

/**
 * Save plan to API
 */
async function savePlan(state: PlanBuilderState): Promise<SavePlanResponse> {
  const request = stateToRequest(state)
  const isUpdate = Boolean(state.planId)
  const url = isUpdate ? `/api/custom-plans/${state.planId}` : '/api/custom-plans'
  const method = isUpdate ? 'PUT' : 'POST'

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save plan')
  }

  return response.json()
}

/**
 * Hook for auto-saving plan builder state
 *
 * Automatically saves the plan when state changes (debounced).
 * Also provides manual save functionality.
 *
 * @param state - The plan builder state to save
 * @param options - Auto-save options
 * @returns Auto-save controls and status
 */
export function useAutoSave(
  state: PlanBuilderState,
  options: AutoSaveOptions = {}
): UseAutoSaveReturn {
  const { debounceMs = 2000, enabled = true, onSaveStart, onSaveSuccess, onSaveError } = options

  const isSavingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stateRef = useRef(state)
  const pendingSaveRef = useRef(false)

  // Keep state ref updated
  stateRef.current = state

  // Perform the actual save
  const performSave = useCallback(async () => {
    // Don't save if already saving
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    const currentState = stateRef.current

    // Don't save if not dirty or no meaningful content
    if (!currentState.isDirty || !currentState.metadata.name) {
      return
    }

    isSavingRef.current = true
    onSaveStart?.()

    try {
      const response = await savePlan(currentState)
      onSaveSuccess?.(response)
    } catch (error) {
      onSaveError?.(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      isSavingRef.current = false

      // If there was a pending save request while we were saving, save again
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        performSave()
      }
    }
  }, [onSaveStart, onSaveSuccess, onSaveError])

  // Debounced save effect
  useEffect(() => {
    if (!enabled || !state.isDirty) {
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      performSave()
    }, debounceMs)

    // Cleanup on unmount or when state changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [state, enabled, debounceMs, performSave])

  // Manual save function
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    await performSave()
  }, [performSave])

  return {
    saveNow,
    isSaving: isSavingRef.current,
  }
}

/**
 * Hook to load an existing plan
 */
export function useLoadPlan(planId: string | undefined) {
  return {
    load: async () => {
      if (!planId) return null

      const response = await fetch(`/api/custom-plans/${planId}`)
      if (!response.ok) {
        throw new Error('Failed to load plan')
      }
      return response.json()
    },
  }
}

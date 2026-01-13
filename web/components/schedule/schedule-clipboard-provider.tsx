'use client'

/**
 * Schedule Clipboard Provider
 *
 * Manages clipboard state for copy/paste operations on scheduled workouts.
 * Provides context for tracking copied workout and operations.
 */

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import type { Workout } from '@/lib/types/training-plan'

interface CopiedWorkout {
  instanceId: string
  workout: Workout
  copiedAt: Date
}

type PasteHandler = (instanceId: string, workoutId: string, targetDate: string) => void

interface ScheduleClipboardContextValue {
  copiedWorkout: CopiedWorkout | null
  copyWorkout: (instanceId: string, workout: Workout) => void
  pasteWorkout: (targetDate: string) => void
  clearClipboard: () => void
  hasClipboard: boolean
}

const ScheduleClipboardContext = createContext<ScheduleClipboardContextValue | null>(null)

interface ScheduleClipboardProviderProps {
  children: ReactNode
  instanceId: string
  onPaste: PasteHandler
}

export function ScheduleClipboardProvider({
  children,
  instanceId,
  onPaste,
}: ScheduleClipboardProviderProps) {
  const [copiedWorkout, setCopiedWorkout] = useState<CopiedWorkout | null>(null)

  const copyWorkout = useCallback((sourceInstanceId: string, workout: Workout) => {
    setCopiedWorkout({
      instanceId: sourceInstanceId,
      workout,
      copiedAt: new Date(),
    })
  }, [])

  const pasteWorkout = useCallback(
    (targetDate: string) => {
      if (!copiedWorkout || !copiedWorkout.workout.id) return

      onPaste(instanceId, copiedWorkout.workout.id, targetDate)
      // Keep clipboard for multi-paste - user can paste same workout multiple times
    },
    [copiedWorkout, instanceId, onPaste]
  )

  const clearClipboard = useCallback(() => {
    setCopiedWorkout(null)
  }, [])

  return (
    <ScheduleClipboardContext.Provider
      value={{
        copiedWorkout,
        copyWorkout,
        pasteWorkout,
        clearClipboard,
        hasClipboard: !!copiedWorkout,
      }}
    >
      {children}
    </ScheduleClipboardContext.Provider>
  )
}

// Default context value for when no provider is present (view-only mode)
const defaultContextValue: ScheduleClipboardContextValue = {
  copiedWorkout: null,
  copyWorkout: () => {},
  pasteWorkout: () => {},
  clearClipboard: () => {},
  hasClipboard: false,
}

export function useScheduleClipboard(): ScheduleClipboardContextValue {
  const context = useContext(ScheduleClipboardContext)
  // Return safe default when not within a provider (view-only mode)
  return context || defaultContextValue
}

import { useEffect, useRef, useCallback, useState } from 'react'
import { toast } from 'react-hot-toast'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutoSaveOptions<T> {
  data: T
  onSave: (data: T) => Promise<void>
  debounceMs?: number
  enabled?: boolean
}

interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  lastSaved: Date | null
  forceSave: () => Promise<void>
}

/**
 * Custom hook for auto-saving form data with debouncing
 *
 * @param options Configuration object
 * @param options.data The data to save
 * @param options.onSave Async function that saves the data
 * @param options.debounceMs Debounce delay in milliseconds (default: 1000)
 * @param options.enabled Whether auto-save is enabled (default: true)
 *
 * @returns Object with saveStatus, lastSaved date, and forceSave function
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 1000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousDataRef = useRef<T>(data)
  const isSavingRef = useRef(false)

  const save = useCallback(async () => {
    if (isSavingRef.current) return

    isSavingRef.current = true
    setSaveStatus('saving')

    try {
      await onSave(data)
      setSaveStatus('saved')
      setLastSaved(new Date())
      previousDataRef.current = data

      // Reset to idle after showing "saved" for 2 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
    } catch (error) {
      console.error('Auto-save error:', error)
      setSaveStatus('error')
      toast.error('Failed to save changes')

      // Reset to idle after showing error for 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } finally {
      isSavingRef.current = false
    }
  }, [data, onSave])

  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    await save()
  }, [save])

  useEffect(() => {
    if (!enabled) return

    // Don't auto-save if data hasn't changed
    if (JSON.stringify(data) === JSON.stringify(previousDataRef.current)) {
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      save()
    }, debounceMs)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, enabled, debounceMs, save])

  return {
    saveStatus,
    lastSaved,
    forceSave,
  }
}

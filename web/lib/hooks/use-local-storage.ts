'use client'

/**
 * useLocalStorage Hook
 *
 * A hook for persisting state to localStorage with SSR support.
 * Handles hydration mismatches and provides a useState-like API.
 *
 * Part of Issue #72: Workout Library Sidebar
 */

import { useState, useCallback, useSyncExternalStore } from 'react'

/**
 * Helper to read from localStorage safely
 */
function getStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue
  }
  try {
    const item = window.localStorage.getItem(key)
    if (item !== null) {
      return JSON.parse(item) as T
    }
  } catch {
    // If parsing fails, return initial value
  }
  return initialValue
}

/**
 * Hook for persisting state to localStorage
 *
 * @param key - localStorage key
 * @param initialValue - default value if key doesn't exist
 * @returns [value, setValue] tuple similar to useState
 *
 * @example
 * const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', false)
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Use lazy initialization to read from localStorage
  const [storedValue, setStoredValue] = useState<T>(() => getStoredValue(key, initialValue))

  // Check if we're on the client for SSR compatibility
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  // Memoized setter that also updates localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((currentValue) => {
        // Handle function updates
        const valueToStore = value instanceof Function ? value(currentValue) : value

        // Only write to localStorage on client
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
          } catch {
            // Silently fail if localStorage is full or unavailable
          }
        }

        return valueToStore
      })
    },
    [key]
  )

  // Return initial value during SSR to avoid hydration mismatch
  return [isClient ? storedValue : initialValue, setValue]
}

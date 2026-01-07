/**
 * Schedule DnD Types
 *
 * Type definitions for drag and drop operations on scheduled workouts
 */

import type { Workout } from '@/lib/types/training-plan'

// Drag item types
export type ScheduleDragItemType = 'scheduled-workout'

// Workout data passed during drag
export interface ScheduledWorkoutDragData {
  type: 'scheduled-workout'
  instanceId: string
  date: string // YYYY-MM-DD
  index: number
  workout: Workout
  hasMatch: boolean // Whether workout has a matched activity
}

// Drop target data
export interface CalendarDayDropData {
  date: string // YYYY-MM-DD
  isPast: boolean
}

// Create unique IDs for draggables and droppables
export function createScheduledWorkoutDraggableId(
  instanceId: string,
  date: string,
  index: number
): string {
  return `scheduled-workout-${instanceId}-${date}-${index}`
}

export function parseScheduledWorkoutDraggableId(
  id: string
): { instanceId: string; date: string; index: number } | null {
  const prefix = 'scheduled-workout-'
  if (!id.startsWith(prefix)) return null

  const rest = id.slice(prefix.length)
  const parts = rest.split('-')

  // UUID is 5 parts (36 chars with dashes), date is 3 parts, index is 1
  // Format: uuid-uuid-uuid-uuid-uuid-YYYY-MM-DD-index
  if (parts.length < 9) return null

  const instanceId = parts.slice(0, 5).join('-')
  const date = parts.slice(5, 8).join('-')
  const indexPart = parts[8]
  if (indexPart === undefined) return null

  const index = parseInt(indexPart, 10)
  if (isNaN(index)) return null

  return { instanceId, date, index }
}

export function createCalendarDayDroppableId(date: string): string {
  return `calendar-day-${date}`
}

export function parseCalendarDayDroppableId(id: string): { date: string } | null {
  const prefix = 'calendar-day-'
  if (!id.startsWith(prefix)) return null

  const date = id.slice(prefix.length)
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  return { date }
}

/**
 * Schedule DnD Types
 *
 * Type definitions for drag and drop operations on scheduled workouts
 */

import type { Workout } from '@/lib/types/training-plan'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'

// Drag item types - extended to include library workouts
export type ScheduleDragItemType = 'scheduled-workout' | 'library-workout'

// Workout data passed during drag (existing scheduled workout)
export interface ScheduledWorkoutDragData {
  type: 'scheduled-workout'
  instanceId: string
  date: string // YYYY-MM-DD
  index: number
  workout: Workout
  hasMatch: boolean // Whether workout has a matched activity
}

// Library workout data for drag operations (new workout from library)
export interface LibraryWorkoutDragData {
  type: 'library-workout'
  workout: WorkoutLibraryItem
}

// Union type for all schedule drag data
export type ScheduleDragData = ScheduledWorkoutDragData | LibraryWorkoutDragData

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

// Create unique draggable ID for library workout
export function createLibraryWorkoutDraggableId(workoutId: string): string {
  return `library-workout-${workoutId}`
}

// Check if draggable ID is from library
export function isLibraryWorkoutDraggable(id: string): boolean {
  return id.startsWith('library-workout-')
}

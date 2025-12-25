/**
 * Drag and Drop Types
 *
 * Type definitions for the plan builder drag-and-drop system.
 *
 * Part of Issue #23: Plan Builder Phase 3 - Drag-and-Drop
 */

import type { DayOfWeek } from '@/lib/types/plan-builder'
import type { WorkoutLibraryItem } from '@/lib/types/workout-library'

/**
 * Types of draggable items
 */
export type DragItemType = 'library-workout' | 'placed-workout'

/**
 * Data attached to a draggable library workout
 */
export interface LibraryWorkoutDragData {
  type: 'library-workout'
  workout: WorkoutLibraryItem
}

/**
 * Data attached to a draggable placed workout
 */
export interface PlacedWorkoutDragData {
  type: 'placed-workout'
  placementId: string
  weekNumber: number
  day: DayOfWeek
  workoutName: string
}

/**
 * Union type for all drag data
 */
export type DragData = LibraryWorkoutDragData | PlacedWorkoutDragData

/**
 * Data attached to a droppable day slot
 */
export interface DayDropData {
  weekNumber: number
  day: DayOfWeek
}

/**
 * Create a unique droppable ID for a day slot
 */
export function createDayDroppableId(weekNumber: number, day: DayOfWeek): string {
  return `day-${weekNumber}-${day}`
}

/**
 * Parse a day droppable ID
 */
export function parseDayDroppableId(id: string): DayDropData | null {
  const match = id.match(/^day-(\d+)-(\w+)$/)
  if (!match) return null

  const weekNumber = parseInt(match[1]!, 10)
  const day = match[2] as DayOfWeek

  return { weekNumber, day }
}

/**
 * Create a unique draggable ID for a placed workout
 */
export function createPlacedWorkoutDraggableId(
  weekNumber: number,
  day: DayOfWeek,
  placementId: string
): string {
  return `placed-${weekNumber}-${day}-${placementId}`
}

/**
 * Create a unique draggable ID for a library workout
 */
export function createLibraryWorkoutDraggableId(workoutId: string): string {
  return `library-${workoutId}`
}

/**
 * Check if a draggable ID is from the library
 */
export function isLibraryDraggable(id: string): boolean {
  return id.startsWith('library-')
}

/**
 * Check if a draggable ID is a placed workout
 */
export function isPlacedWorkoutDraggable(id: string): boolean {
  return id.startsWith('placed-')
}

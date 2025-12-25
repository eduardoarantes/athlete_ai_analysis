/**
 * Plan Builder Reducer
 *
 * State management for the drag-and-drop custom plan builder.
 * Supports undo/redo via history stack.
 *
 * Part of Issue #22: Plan Builder Phase 2 - State Management
 */

import type {
  PlanBuilderState,
  PlanBuilderAction,
  WeekState,
  WorkoutsData,
  HistoryEntry,
  DayOfWeek,
  WorkoutPlacement,
} from '@/lib/types/plan-builder'
import { createEmptyWorkoutsData, createEmptyWeekState } from '@/lib/types/plan-builder'
import { calculateWeeklyTss } from './tss-calculator'

/**
 * Days of the week for iteration
 */
const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/**
 * Check if undo is available
 */
export function canUndo(state: PlanBuilderState): boolean {
  return state.historyIndex >= 0
}

/**
 * Check if redo is available
 */
export function canRedo(state: PlanBuilderState): boolean {
  return state.historyIndex < state.history.length - 1
}

/**
 * Create a history entry from current state
 */
function createHistoryEntry(state: PlanBuilderState, actionDescription: string): HistoryEntry {
  // Serialize only the data we need to restore
  const stateToSave = {
    planId: state.planId,
    metadata: state.metadata,
    weeks: state.weeks,
  }

  return {
    state: JSON.stringify(stateToSave),
    actionDescription,
    timestamp: Date.now(),
  }
}

/**
 * Push state to history stack
 */
function pushToHistory(state: PlanBuilderState, actionDescription: string): PlanBuilderState {
  // Create entry before the action
  const entry = createHistoryEntry(state, actionDescription)

  // If we're in the middle of history, clear forward history
  const history = state.history.slice(0, state.historyIndex + 1)

  // Add new entry
  history.push(entry)

  // Limit history size
  if (history.length > state.maxHistorySize) {
    history.shift()
  }

  return {
    ...state,
    history,
    historyIndex: history.length - 1,
  }
}

/**
 * Recalculate TSS for a week based on its workouts
 */
function recalculateWeekTss(week: WeekState): WeekState {
  return {
    ...week,
    weeklyTss: calculateWeeklyTss(week.workouts),
  }
}

/**
 * Find week by week number
 */
function findWeekIndex(weeks: WeekState[], weekNumber: number): number {
  return weeks.findIndex((w) => w.weekNumber === weekNumber)
}

/**
 * Update a specific week in the weeks array
 */
function updateWeek(
  weeks: WeekState[],
  weekNumber: number,
  updater: (week: WeekState) => WeekState
): WeekState[] {
  return weeks.map((week) => {
    if (week.weekNumber === weekNumber) {
      return updater(week)
    }
    return week
  })
}

/**
 * Main plan builder reducer
 */
export function planBuilderReducer(
  state: PlanBuilderState,
  action: PlanBuilderAction
): PlanBuilderState {
  switch (action.type) {
    case 'INIT_PLAN': {
      return {
        ...state,
        ...action.payload,
        isDirty: false,
        history: [],
        historyIndex: -1,
        validationErrors: [],
        validationWarnings: [],
      }
    }

    case 'UPDATE_METADATA': {
      return {
        ...state,
        metadata: {
          ...state.metadata,
          ...action.payload,
        },
        isDirty: true,
      }
    }

    case 'ADD_WEEK': {
      const stateWithHistory = pushToHistory(state, 'Add week')

      const newWeekNumber = state.weeks.length + 1
      const newWeek = createEmptyWeekState(newWeekNumber, action.payload.phase)

      return {
        ...stateWithHistory,
        weeks: [...state.weeks, newWeek],
        isDirty: true,
      }
    }

    case 'REMOVE_WEEK': {
      const weekIndex = findWeekIndex(state.weeks, action.payload.weekNumber)
      if (weekIndex === -1) {
        return state
      }

      const stateWithHistory = pushToHistory(state, `Remove week ${action.payload.weekNumber}`)

      // Remove week and renumber remaining weeks
      const newWeeks = state.weeks
        .filter((_, i) => i !== weekIndex)
        .map((week, index) => ({
          ...week,
          weekNumber: index + 1,
        }))

      return {
        ...stateWithHistory,
        weeks: newWeeks,
        isDirty: true,
      }
    }

    case 'UPDATE_WEEK_PHASE': {
      const stateWithHistory = pushToHistory(
        state,
        `Update week ${action.payload.weekNumber} phase`
      )

      return {
        ...stateWithHistory,
        weeks: updateWeek(state.weeks, action.payload.weekNumber, (week) => ({
          ...week,
          phase: action.payload.phase,
        })),
        isDirty: true,
      }
    }

    case 'UPDATE_WEEK_NOTES': {
      const stateWithHistory = pushToHistory(
        state,
        `Update week ${action.payload.weekNumber} notes`
      )

      return {
        ...stateWithHistory,
        weeks: updateWeek(state.weeks, action.payload.weekNumber, (week) => ({
          ...week,
          notes: action.payload.notes,
        })),
        isDirty: true,
      }
    }

    case 'COPY_WEEK': {
      const sourceWeekIndex = findWeekIndex(state.weeks, action.payload.sourceWeekNumber)
      const targetWeekIndex = findWeekIndex(state.weeks, action.payload.targetWeekNumber)

      if (sourceWeekIndex === -1 || targetWeekIndex === -1) {
        return state
      }

      const stateWithHistory = pushToHistory(
        state,
        `Copy week ${action.payload.sourceWeekNumber} to ${action.payload.targetWeekNumber}`
      )

      const sourceWeek = state.weeks[sourceWeekIndex]!

      // Deep copy workouts with new IDs
      const copiedWorkouts: WorkoutsData = createEmptyWorkoutsData()

      for (const day of DAYS) {
        copiedWorkouts[day] = sourceWeek.workouts[day].map((placement) => ({
          ...placement,
          id: crypto.randomUUID(),
        }))
      }

      return {
        ...stateWithHistory,
        weeks: updateWeek(state.weeks, action.payload.targetWeekNumber, (week) =>
          recalculateWeekTss({
            ...week,
            workouts: copiedWorkouts,
          })
        ),
        isDirty: true,
      }
    }

    case 'ADD_WORKOUT': {
      const { weekNumber, day, workout } = action.payload
      const stateWithHistory = pushToHistory(state, `Add workout to week ${weekNumber} ${day}`)

      const weekIndex = findWeekIndex(state.weeks, weekNumber)
      if (weekIndex === -1) {
        return state
      }

      const week = state.weeks[weekIndex]!
      const existingPlacements = week.workouts[day]
      const newOrder = existingPlacements.length

      const newPlacement: WorkoutPlacement = {
        id: crypto.randomUUID(),
        workoutKey: workout.id,
        order: newOrder,
        workout: {
          name: workout.name,
          type: workout.type,
          base_duration_min: workout.base_duration_min,
          base_tss: workout.base_tss,
        },
      }

      const newWorkouts: WorkoutsData = {
        ...week.workouts,
        [day]: [...existingPlacements, newPlacement],
      }

      return {
        ...stateWithHistory,
        weeks: updateWeek(state.weeks, weekNumber, (w) =>
          recalculateWeekTss({
            ...w,
            workouts: newWorkouts,
          })
        ),
        isDirty: true,
      }
    }

    case 'REMOVE_WORKOUT': {
      const { weekNumber, day, placementId } = action.payload
      const stateWithHistory = pushToHistory(state, `Remove workout from week ${weekNumber} ${day}`)

      const weekIndex = findWeekIndex(state.weeks, weekNumber)
      if (weekIndex === -1) {
        return state
      }

      const week = state.weeks[weekIndex]!
      const filteredPlacements = week.workouts[day]
        .filter((p) => p.id !== placementId)
        .map((p, index) => ({ ...p, order: index }))

      const newWorkouts: WorkoutsData = {
        ...week.workouts,
        [day]: filteredPlacements,
      }

      return {
        ...stateWithHistory,
        weeks: updateWeek(state.weeks, weekNumber, (w) =>
          recalculateWeekTss({
            ...w,
            workouts: newWorkouts,
          })
        ),
        isDirty: true,
      }
    }

    case 'MOVE_WORKOUT': {
      const { sourceWeek, sourceDay, targetWeek, targetDay, placementId, newOrder } = action.payload

      const stateWithHistory = pushToHistory(
        state,
        `Move workout from week ${sourceWeek} ${sourceDay} to week ${targetWeek} ${targetDay}`
      )

      const sourceWeekIndex = findWeekIndex(state.weeks, sourceWeek)
      if (sourceWeekIndex === -1) {
        return state
      }

      const sourceWeekData = state.weeks[sourceWeekIndex]!
      const placementIndex = sourceWeekData.workouts[sourceDay].findIndex(
        (p) => p.id === placementId
      )

      if (placementIndex === -1) {
        return state
      }

      const placement = sourceWeekData.workouts[sourceDay][placementIndex]!

      // Remove from source
      const newSourcePlacements = sourceWeekData.workouts[sourceDay]
        .filter((p) => p.id !== placementId)
        .map((p, index) => ({ ...p, order: index }))

      let newWeeks = [...state.weeks]

      // Update source week
      newWeeks = updateWeek(newWeeks, sourceWeek, (w) =>
        recalculateWeekTss({
          ...w,
          workouts: {
            ...w.workouts,
            [sourceDay]: newSourcePlacements,
          },
        })
      )

      // Add to target
      const targetWeekIndex = findWeekIndex(newWeeks, targetWeek)
      if (targetWeekIndex === -1) {
        return state
      }

      const targetWeekData = newWeeks[targetWeekIndex]!
      const targetPlacements = [...targetWeekData.workouts[targetDay]]

      // Insert at new order position
      const placementWithNewOrder = { ...placement, order: newOrder }
      targetPlacements.splice(newOrder, 0, placementWithNewOrder)

      // Reorder all placements
      const reorderedPlacements = targetPlacements.map((p, index) => ({
        ...p,
        order: index,
      }))

      newWeeks = updateWeek(newWeeks, targetWeek, (w) =>
        recalculateWeekTss({
          ...w,
          workouts: {
            ...w.workouts,
            [targetDay]: reorderedPlacements,
          },
        })
      )

      return {
        ...stateWithHistory,
        weeks: newWeeks,
        isDirty: true,
      }
    }

    case 'REORDER_WORKOUTS': {
      const { weekNumber, day, placementIds } = action.payload
      const stateWithHistory = pushToHistory(state, `Reorder workouts in week ${weekNumber} ${day}`)

      const weekIndex = findWeekIndex(state.weeks, weekNumber)
      if (weekIndex === -1) {
        return state
      }

      const week = state.weeks[weekIndex]!
      const placementMap = new Map(week.workouts[day].map((p) => [p.id, p]))

      const reorderedPlacements = placementIds
        .map((id, index) => {
          const placement = placementMap.get(id)
          if (!placement) return null
          return { ...placement, order: index }
        })
        .filter((p): p is WorkoutPlacement => p !== null)

      const newWorkouts: WorkoutsData = {
        ...week.workouts,
        [day]: reorderedPlacements,
      }

      return {
        ...stateWithHistory,
        weeks: updateWeek(state.weeks, weekNumber, (w) => ({
          ...w,
          workouts: newWorkouts,
        })),
        isDirty: true,
      }
    }

    case 'UNDO': {
      if (!canUndo(state)) {
        return state
      }

      // Get the state to restore
      const entry = state.history[state.historyIndex]!
      const restoredData = JSON.parse(entry.state) as {
        planId: string | null
        metadata: PlanBuilderState['metadata']
        weeks: WeekState[]
      }

      // Save current state for redo (append to history if we're at the end)
      const newHistory = [...state.history]
      if (state.historyIndex === state.history.length - 1) {
        const currentEntry = createHistoryEntry(state, 'Current state for redo')
        newHistory.push(currentEntry)
      }

      return {
        ...state,
        planId: restoredData.planId,
        metadata: restoredData.metadata,
        weeks: restoredData.weeks,
        history: newHistory,
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      }
    }

    case 'REDO': {
      if (!canRedo(state)) {
        return state
      }

      // Move forward in history and restore that state
      const nextIndex = state.historyIndex + 1
      const nextEntry = state.history[nextIndex + 1]

      if (!nextEntry) {
        return state
      }

      const restoredData = JSON.parse(nextEntry.state) as {
        planId: string | null
        metadata: PlanBuilderState['metadata']
        weeks: WeekState[]
      }

      return {
        ...state,
        planId: restoredData.planId,
        metadata: restoredData.metadata,
        weeks: restoredData.weeks,
        historyIndex: nextIndex,
        isDirty: true,
      }
    }

    case 'MARK_SAVING': {
      return {
        ...state,
        isSaving: true,
      }
    }

    case 'MARK_SAVED': {
      return {
        ...state,
        planId: action.payload.planId,
        isSaving: false,
        isDirty: false,
        lastSavedAt: Date.now(),
        saveError: null,
      }
    }

    case 'SAVE_ERROR': {
      return {
        ...state,
        isSaving: false,
        saveError: action.payload.error,
      }
    }

    case 'VALIDATE': {
      return {
        ...state,
        validationErrors: action.payload.errors,
        validationWarnings: action.payload.warnings,
      }
    }

    case 'CLEAR_VALIDATION': {
      return {
        ...state,
        validationErrors: [],
        validationWarnings: [],
      }
    }

    default: {
      // Exhaustive check - this should never happen
      return action satisfies never
    }
  }
}

/**
 * Get action description for debugging
 */
export function getActionDescription(action: PlanBuilderAction): string {
  switch (action.type) {
    case 'INIT_PLAN':
      return 'Initialize plan'
    case 'UPDATE_METADATA':
      return 'Update metadata'
    case 'ADD_WEEK':
      return `Add ${action.payload.phase} week`
    case 'REMOVE_WEEK':
      return `Remove week ${action.payload.weekNumber}`
    case 'UPDATE_WEEK_PHASE':
      return `Update week ${action.payload.weekNumber} to ${action.payload.phase}`
    case 'UPDATE_WEEK_NOTES':
      return `Update week ${action.payload.weekNumber} notes`
    case 'COPY_WEEK':
      return `Copy week ${action.payload.sourceWeekNumber} to ${action.payload.targetWeekNumber}`
    case 'ADD_WORKOUT':
      return `Add workout to week ${action.payload.weekNumber} ${action.payload.day}`
    case 'REMOVE_WORKOUT':
      return `Remove workout from week ${action.payload.weekNumber} ${action.payload.day}`
    case 'MOVE_WORKOUT':
      return `Move workout from week ${action.payload.sourceWeek} to ${action.payload.targetWeek}`
    case 'REORDER_WORKOUTS':
      return `Reorder workouts in week ${action.payload.weekNumber} ${action.payload.day}`
    case 'UNDO':
      return 'Undo'
    case 'REDO':
      return 'Redo'
    case 'MARK_SAVING':
      return 'Mark saving'
    case 'MARK_SAVED':
      return 'Mark saved'
    case 'SAVE_ERROR':
      return 'Save error'
    case 'VALIDATE':
      return 'Validate'
    case 'CLEAR_VALIDATION':
      return 'Clear validation'
  }
}

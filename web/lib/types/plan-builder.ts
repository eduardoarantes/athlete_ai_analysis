/**
 * Plan Builder TypeScript Types
 * Types for the drag-and-drop custom plan builder state
 *
 * Part of Issue #21: Plan Builder Phase 1 - Foundation
 */

import type { TrainingPhase, WorkoutLibraryItem } from './workout-library'

/**
 * Days of the week (lowercase for consistency with state keys)
 */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

/**
 * A workout placement in the calendar
 * Created when a workout is dragged from the library to a day
 */
export interface WorkoutPlacement {
  /** Unique ID for this placement (for drag-drop and deletion) */
  id: string

  /** Reference to the workout in the library */
  workoutKey: string

  /** Display order within the day (for multiple workouts per day) */
  order: number

  /** Optional notes specific to this placement */
  notes?: string

  /** Cached workout data for display (denormalized for performance) */
  workout?: {
    name: string
    type: string
    base_duration_min: number
    base_tss: number
  }
}

/**
 * Workout placements organized by day
 * This is the structure stored in custom_plan_weeks.workouts_data
 */
export interface WorkoutsData {
  monday: WorkoutPlacement[]
  tuesday: WorkoutPlacement[]
  wednesday: WorkoutPlacement[]
  thursday: WorkoutPlacement[]
  friday: WorkoutPlacement[]
  saturday: WorkoutPlacement[]
  sunday: WorkoutPlacement[]
}

/**
 * Create empty workouts data structure
 */
export function createEmptyWorkoutsData(): WorkoutsData {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  }
}

/**
 * State for a single week in the plan builder
 */
export interface WeekState {
  /** Unique ID for the week (for React keys and DB) */
  id: string

  /** Week number (1-based) */
  weekNumber: number

  /** Training phase for this week */
  phase: TrainingPhase

  /** Workout placements by day */
  workouts: WorkoutsData

  /** Calculated weekly TSS */
  weeklyTss: number

  /** Optional notes for the week */
  notes?: string | undefined
}

/**
 * Create an empty week state
 */
export function createEmptyWeekState(weekNumber: number, phase: TrainingPhase = 'Base'): WeekState {
  return {
    id: crypto.randomUUID(),
    weekNumber,
    phase,
    workouts: createEmptyWorkoutsData(),
    weeklyTss: 0,
  }
}

/**
 * Plan metadata (name, description, FTP, etc.)
 */
export interface PlanMetadata {
  /** Plan name */
  name: string

  /** Plan description */
  description?: string | undefined

  /** Target FTP for TSS calculations */
  targetFtp?: number | undefined

  /** Plan goal (e.g., "Improve FTP", "Complete century ride") */
  goal?: string | undefined
}

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  /** Serialized state before the action */
  state: string

  /** Description of the action (for debugging) */
  actionDescription: string

  /** Timestamp of the action */
  timestamp: number
}

/**
 * Complete plan builder state
 */
export interface PlanBuilderState {
  /** Plan ID (null for new plans, UUID for existing) */
  planId: string | null

  /** Plan metadata */
  metadata: PlanMetadata

  /** Array of week states */
  weeks: WeekState[]

  /** Whether there are unsaved changes */
  isDirty: boolean

  /** Whether the plan is being saved */
  isSaving: boolean

  /** Last save timestamp */
  lastSavedAt: number | null

  /** Save error message (if any) */
  saveError: string | null

  /** Undo history stack */
  history: HistoryEntry[]

  /** Current position in history (for redo) */
  historyIndex: number

  /** Maximum history entries to keep */
  maxHistorySize: number

  /** Validation errors */
  validationErrors: string[]

  /** Validation warnings */
  validationWarnings: string[]
}

/**
 * Create initial plan builder state
 */
export function createInitialPlanBuilderState(
  existingPlanId?: string,
  existingMetadata?: PlanMetadata,
  existingWeeks?: WeekState[]
): PlanBuilderState {
  const defaultMetadata: PlanMetadata = {
    name: '',
  }

  return {
    planId: existingPlanId ?? null,
    metadata: existingMetadata ?? defaultMetadata,
    weeks: existingWeeks ?? [],
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    saveError: null,
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,
    validationErrors: [],
    validationWarnings: [],
  }
}

/**
 * Action types for the plan builder reducer
 */
export type PlanBuilderAction =
  | { type: 'INIT_PLAN'; payload: Partial<PlanBuilderState> }
  | { type: 'UPDATE_METADATA'; payload: Partial<PlanMetadata> }
  | { type: 'ADD_WEEK'; payload: { phase: TrainingPhase } }
  | { type: 'REMOVE_WEEK'; payload: { weekNumber: number } }
  | { type: 'UPDATE_WEEK_PHASE'; payload: { weekNumber: number; phase: TrainingPhase } }
  | { type: 'UPDATE_WEEK_NOTES'; payload: { weekNumber: number; notes: string } }
  | { type: 'COPY_WEEK'; payload: { sourceWeekNumber: number; targetWeekNumber: number } }
  | {
      type: 'ADD_WORKOUT'
      payload: { weekNumber: number; day: DayOfWeek; workout: WorkoutLibraryItem }
    }
  | { type: 'REMOVE_WORKOUT'; payload: { weekNumber: number; day: DayOfWeek; placementId: string } }
  | {
      type: 'MOVE_WORKOUT'
      payload: {
        sourceWeek: number
        sourceDay: DayOfWeek
        targetWeek: number
        targetDay: DayOfWeek
        placementId: string
        newOrder: number
      }
    }
  | {
      type: 'REORDER_WORKOUTS'
      payload: { weekNumber: number; day: DayOfWeek; placementIds: string[] }
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVING' }
  | { type: 'MARK_SAVED'; payload: { planId: string } }
  | { type: 'SAVE_ERROR'; payload: { error: string } }
  | { type: 'VALIDATE'; payload: { errors: string[]; warnings: string[] } }
  | { type: 'CLEAR_VALIDATION' }

/**
 * Database record for custom_plan_weeks table
 */
export interface CustomPlanWeekRecord {
  id: string
  plan_id: string
  week_number: number
  phase: TrainingPhase
  workouts_data: WorkoutsData
  weekly_tss: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * API request to create/update a custom plan
 */
export interface SavePlanRequest {
  /** Plan ID (null for new plans) */
  planId?: string

  /** Plan metadata */
  metadata: PlanMetadata

  /** Week states to save */
  weeks: Array<{
    weekNumber: number
    phase: TrainingPhase
    workouts: WorkoutsData
    weeklyTss: number
    notes?: string
  }>

  /** Whether to publish (set is_draft=false) */
  publish?: boolean
}

/**
 * API response from save operation
 */
export interface SavePlanResponse {
  success: boolean
  planId: string
  savedAt: string
  errors?: string[]
}

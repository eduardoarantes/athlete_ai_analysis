/**
 * Training Plan TypeScript Types
 * Defines the structure of training plan data stored in plan_data JSON
 */

// =========================================================================
// Multi-Step Interval Types (Issue #96)
// =========================================================================

/**
 * Length specification for a workout step (duration or distance)
 */
export interface StepLength {
  unit: 'second' | 'minute' | 'hour' | 'meter' | 'kilometer' | 'mile'
  value: number
}

/**
 * Target for a workout step (power, heart rate, cadence)
 */
export interface StepTarget {
  type: 'power' | 'heartrate' | 'cadence'
  minValue: number
  maxValue: number
  /** Unit: 'percentOfFtp' or 'watts' for power, 'bpm' for HR, 'rpm' for cadence */
  unit?: 'percentOfFtp' | 'watts' | 'bpm' | 'rpm'
}

/**
 * A single step within a workout segment
 */
export interface WorkoutStep {
  name: string
  intensityClass: 'warmUp' | 'active' | 'rest' | 'coolDown'
  length: StepLength
  openDuration?: boolean
  targets: StepTarget[]
}

/**
 * Segment/repetition block length (always in repetitions)
 */
export interface SegmentLength {
  unit: 'repetition'
  value: number
}

/**
 * A segment within a workout - supports multi-step intervals
 *
 * Examples:
 * - Single step (warmup): type='step', length.value=1, steps=[{warmup step}]
 * - 2-step interval: type='repetition', length.value=5, steps=[{work}, {recovery}]
 * - 3-step interval: type='repetition', length.value=10, steps=[{Z3}, {Z5}, {Z2}]
 */
export interface StructuredWorkoutSegment {
  type: 'step' | 'repetition'
  length: SegmentLength
  steps: WorkoutStep[]
}

/**
 * Complete workout structure with multi-step interval support
 */
export interface WorkoutStructure {
  primaryIntensityMetric: 'percentOfFtp' | 'watts' | 'heartrate'
  primaryLengthMetric: 'duration' | 'distance'
  structure: StructuredWorkoutSegment[]
  /** Polyline for simplified visualization [[time, intensity], ...] normalized 0-1 */
  polyline?: [number, number][]
}

// =========================================================================
// Type Guards and Validation (Issue #96)
// =========================================================================

/**
 * Type guard to check if a WorkoutStructure has valid content
 * Use this instead of manual checks like `structure?.structure?.length > 0`
 */
export function hasValidStructure(structure?: WorkoutStructure): structure is WorkoutStructure {
  return !!(structure?.structure && structure.structure.length > 0)
}

/**
 * Validate StepLength value - must be positive
 * @throws Error if value is invalid
 */
export function validateStepLength(length: StepLength): void {
  if (length.value <= 0) {
    throw new Error(`StepLength value must be positive, got ${length.value}`)
  }
}

/**
 * Validate StepTarget values - must be non-negative and minValue <= maxValue
 * @throws Error if values are invalid
 */
export function validateStepTarget(target: StepTarget): void {
  if (target.minValue < 0) {
    throw new Error(`StepTarget minValue must be non-negative, got ${target.minValue}`)
  }
  if (target.maxValue < 0) {
    throw new Error(`StepTarget maxValue must be non-negative, got ${target.maxValue}`)
  }
  if (target.minValue > target.maxValue) {
    throw new Error(
      `StepTarget minValue (${target.minValue}) cannot be greater than maxValue (${target.maxValue})`
    )
  }
}

/**
 * Safe validation that returns boolean instead of throwing
 */
export function isValidStepLength(length: StepLength): boolean {
  return length.value > 0
}

/**
 * Safe validation that returns boolean instead of throwing
 */
export function isValidStepTarget(target: StepTarget): boolean {
  return target.minValue >= 0 && target.maxValue >= 0 && target.minValue <= target.maxValue
}

// =========================================================================
// Shared Power Target Extraction (Issue #96)
// =========================================================================

/**
 * Power target result from extracting power values from StepTarget array
 */
export interface PowerTargetResult {
  minValue: number
  maxValue: number
}

/**
 * Extract power target values from a step's targets array
 * Shared utility to avoid duplication across components and services
 *
 * @param targets - Array of StepTarget objects
 * @param defaultMin - Default minimum value if no power target found (default: 50)
 * @param defaultMax - Default maximum value if no power target found (default: 60)
 * @returns Power target with minValue and maxValue
 */
export function extractPowerTarget(
  targets: StepTarget[],
  defaultMin: number = 50,
  defaultMax: number = 60
): PowerTargetResult {
  const powerTarget = targets.find((t) => t.type === 'power')
  if (powerTarget) {
    return {
      minValue: powerTarget.minValue,
      maxValue: powerTarget.maxValue,
    }
  }
  return { minValue: defaultMin, maxValue: defaultMax }
}

// =========================================================================
// Step Length Conversion Functions (Issue #96)
// =========================================================================

/**
 * Convert StepLength to seconds
 */
export function convertStepLengthToSeconds(length: StepLength): number {
  switch (length.unit) {
    case 'second':
      return length.value
    case 'minute':
      return length.value * 60
    case 'hour':
      return length.value * 3600
    default:
      // For distance-based lengths, return value as-is (caller should handle)
      return length.value
  }
}

/**
 * Convert StepLength to minutes
 */
export function convertStepLengthToMinutes(length: StepLength): number {
  switch (length.unit) {
    case 'second':
      return length.value / 60
    case 'minute':
      return length.value
    case 'hour':
      return length.value * 60
    default:
      // For distance-based lengths, convert value/60 (assumed seconds)
      return length.value / 60
  }
}

/**
 * Calculate total duration of a WorkoutStructure in minutes
 */
export function calculateStructureDuration(structure: WorkoutStructure): number {
  return structure.structure.reduce((total, segment) => {
    const repetitions = segment.length.value
    const stepsTotal = segment.steps.reduce((stepSum, step) => {
      return stepSum + convertStepLengthToMinutes(step.length)
    }, 0)
    return total + stepsTotal * repetitions
  }, 0)
}

// =========================================================================
// Legacy WorkoutSegment Type (Issue #96/97 - Deprecated)
// =========================================================================

/**
 * @deprecated Legacy workout segment format - use StructuredWorkoutSegment instead (Issue #96/97)
 * This interface is kept for backward compatibility with old data but should not be used in new code.
 * All new workouts use WorkoutStructure with StructuredWorkoutSegment[] instead.
 *
 * Migration status:
 * - ✅ UI components: Fully migrated to WorkoutStructure
 * - ✅ Data files: All workouts use WorkoutStructure format
 * - ⚠️  Some helper types keep this for backward compatibility with stored overrides
 *
 * @see StructuredWorkoutSegment for the new multi-step interval format
 * @see WorkoutStructure for the complete workout structure format
 */
export interface WorkoutSegment {
  type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady' | 'work' | 'tempo'
  duration_min: number
  power_low_pct?: number | undefined
  power_high_pct?: number | undefined
  description?: string | undefined
  sets?: number | undefined
  work?:
    | {
        duration_min: number
        power_low_pct: number
        power_high_pct: number
      }
    | undefined
  recovery?:
    | {
        duration_min: number
        power_low_pct: number
        power_high_pct: number
      }
    | undefined
}

export interface Workout {
  /** Unique identifier for this workout instance (UUID format) */
  id?: string
  weekday: string
  name: string
  description?: string
  detailed_description?: string
  type?:
    | 'endurance'
    | 'tempo'
    | 'sweet_spot'
    | 'threshold'
    | 'vo2max'
    | 'recovery'
    | 'mixed'
    | 'rest'
    | string
  tss?: number
  /** Full workout structure with multi-step interval support (Issue #96) */
  structure?: WorkoutStructure
  /** Source of the workout: 'library' for pre-defined workouts, 'llm' for AI-generated */
  source?: 'library' | 'llm'
  /** ID of the workout in the library - NanoID format (only present when source='library') */
  library_workout_id?: string
}

export interface WeeklyPlan {
  week_number: number
  phase: string
  phase_rationale?: string
  week_tss: number
  workouts: Workout[]
  weekly_focus?: string
  weekly_watch_points?: string
}

export interface AthleteProfile {
  name?: string
  age?: number
  ftp: number
  max_hr?: number
  weight_kg?: number
  power_to_weight?: number
  goals?: string[]
  current_training_status?: string
  available_training_days?: string[]
  weekly_training_hours?: number
}

export interface PlanMetadata {
  total_weeks: number
  current_ftp: number
  target_ftp: number
  ftp_gain_watts?: number
  ftp_gain_percent?: number
  plan_type?: string
}

/**
 * Source metadata for tracking how the plan was generated
 */
export interface PlanSourceMetadata {
  /** Source system that generated the plan */
  source: 'cycling-ai-python-api' | 'manual' | 'imported'
  /** AI provider used (e.g., 'anthropic', 'openai', 'gemini', 'ollama') */
  ai_provider?: string | undefined
  /** Specific AI model used (e.g., 'claude-3-sonnet', 'gpt-4') */
  ai_model?: string | undefined
  /** Version of the cycling-ai library */
  library_version?: string | undefined
  /** Timestamp when the plan was generated */
  generated_at: string
  /** Job ID from the generation process */
  job_id?: string | undefined
  /** Any additional provider-specific metadata */
  provider_metadata?: Record<string, unknown> | undefined
}

export interface TrainingPlanData {
  athlete_profile: AthleteProfile
  plan_metadata: PlanMetadata
  coaching_notes?: string
  monitoring_guidance?: string
  weekly_plan: WeeklyPlan[]
}

/**
 * Training Plan Template (no dates - reusable)
 * Templates define the workout structure but are not bound to specific dates.
 * Users schedule templates by creating PlanInstance records with start dates.
 */
export interface TrainingPlan {
  id: string
  user_id: string
  name: string
  /** Training goal (added in migration, optional for backward compatibility) */
  goal?: string
  description: string | null
  /** Duration in weeks (added in migration, optional for backward compatibility) */
  weeks_total?: number | null
  plan_data: TrainingPlanData
  /** Source metadata tracking how the plan was generated */
  metadata: PlanSourceMetadata | null
  status: 'draft' | 'active' | 'completed' | 'archived' | null
  /** Source of plan creation: 'custom_builder', 'ai', 'imported', etc. */
  created_from?: string | null
  created_at: string
  updated_at: string
  /** @deprecated Will be removed after migration - use PlanInstance.start_date instead */
  start_date?: string
  /** @deprecated Will be removed after migration - use PlanInstance.end_date instead */
  end_date?: string
}

/** Library workout data stored in copies for persistence */
export interface LibraryWorkoutData {
  /** Unique identifier for this workout instance (UUID format) */
  id?: string
  /** Original library workout ID (nanoid from workout library) - for provenance tracking */
  library_workout_id?: string | undefined
  name: string
  type: string
  tss: number
  duration_min?: number | undefined
  description?: string | undefined
  /** Full workout structure with multi-step interval support (Issue #96) */
  structure?: WorkoutStructure | undefined
}

/**
 * Workout overrides for schedule modifications
 * Stored in plan_instances.workout_overrides JSONB column
 */
export interface WorkoutOverrides {
  /** Moved workouts: target key -> source location */
  moves: Record<string, { original_date: string; original_index: number; moved_at: string }>
  /** Copied workouts: target key -> source location. For library workouts, includes workout data. */
  copies: Record<
    string,
    {
      source_date: string
      source_index: number
      copied_at: string
      /** Library workout details (only present when source_date starts with 'library:') */
      library_workout?: LibraryWorkoutData
    }
  >
  /** Deleted workout keys (date:index format) */
  deleted: string[]
}

/**
 * Plan Instance (scheduled on calendar with specific dates)
 * An instance is created when a user schedules a template.
 * Contains a snapshot of the template's plan_data at creation time.
 */
export interface PlanInstance {
  id: string
  user_id: string
  /** Reference to the original template (null if template was deleted) */
  template_id: string | null
  /** Plan name (snapshot from template) */
  name: string
  /** Start date in ISO format (YYYY-MM-DD) */
  start_date: string
  /** End date in ISO format (YYYY-MM-DD), calculated from start_date + weeks */
  end_date: string
  /** Duration in weeks (snapshot from template) */
  weeks_total: number
  /** Full plan data (SNAPSHOT: copied from template at instance creation) */
  plan_data: TrainingPlanData
  /** Workout modifications (moves, copies, deletes) */
  workout_overrides: WorkoutOverrides | null
  /** Instance status */
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

/**
 * Helper type for creating a new plan instance
 */
export interface CreatePlanInstanceInput {
  template_id: string
  start_date: string // ISO date string (YYYY-MM-DD)
}

/**
 * Response when checking for overlapping instances
 */
export interface OverlapCheckResult {
  hasOverlap: boolean
  conflicts: PlanInstance[]
}

// =============================================================================
// Note Types (Issue #49 - Note Card Feature)
// =============================================================================

/**
 * Note attached to a specific date in a training plan instance
 * Stored in the plan_instance_notes table
 */
export interface PlanInstanceNote {
  id: string
  plan_instance_id: string
  user_id: string
  title: string
  description: string | null
  /** Date in YYYY-MM-DD format */
  note_date: string
  /** S3 object key for the attachment */
  attachment_s3_key: string | null
  /** Original filename of the attachment */
  attachment_filename: string | null
  /** File size in bytes (max 10MB = 10485760) */
  attachment_size_bytes: number | null
  /** MIME type of the attachment */
  attachment_content_type: string | null
  created_at: string
  updated_at: string
}

/**
 * Input for creating a new note
 */
export interface CreateNoteInput {
  title: string
  description?: string
  /** Date in YYYY-MM-DD format */
  note_date: string
}

/**
 * Input for updating an existing note
 */
export interface UpdateNoteInput {
  title?: string
  description?: string
  /** Date in YYYY-MM-DD format */
  note_date?: string
  /** Set to true to remove the current attachment */
  removeAttachment?: boolean
}

/**
 * Allowed MIME types for note attachments
 */
export const NOTE_ATTACHMENT_ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const

/**
 * Type for allowed attachment MIME types
 */
export type NoteAttachmentType = (typeof NOTE_ATTACHMENT_ALLOWED_TYPES)[number]

/**
 * Maximum file size for note attachments (10MB)
 */
export const NOTE_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024

/**
 * Human-readable allowed file extensions for UI display
 */
export const NOTE_ATTACHMENT_ALLOWED_EXTENSIONS = [
  'PDF',
  'PNG',
  'JPG',
  'JPEG',
  'DOC',
  'DOCX',
  'TXT',
]

/**
 * Check if a MIME type is allowed for note attachments
 */
export function isAllowedAttachmentType(mimeType: string): mimeType is NoteAttachmentType {
  return NOTE_ATTACHMENT_ALLOWED_TYPES.includes(mimeType as NoteAttachmentType)
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format duration in minutes to human-readable string
 * - Less than 1 minute: shows in seconds (e.g., "30s")
 * - 1-59 minutes: shows with max 1 decimal (e.g., "5m", "5.5m")
 * - 60+ minutes: shows hours and minutes (e.g., "1h 30m")
 */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 1) {
    // Less than 1 minute - show in seconds
    return `${Math.round(totalMinutes * 60)}s`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)

  if (hours === 0) {
    // Less than an hour - show with max 1 decimal if needed
    const rounded = Math.round(totalMinutes * 10) / 10
    return Number.isInteger(rounded) ? `${rounded}m` : `${rounded.toFixed(1)}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Calculate total duration of a workout from its structure
 */
export function calculateWorkoutDuration(workout: Workout): number {
  if (workout.structure?.structure) {
    return calculateStructureDuration(workout.structure)
  }
  return 0
}

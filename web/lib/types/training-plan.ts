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
// Legacy WorkoutSegment Type (current format, will be migrated)
// =========================================================================

/**
 * Current workout segment format - will be migrated to StructuredWorkoutSegment
 * @see StructuredWorkoutSegment for the new multi-step interval format
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
  /** NEW: Full workout structure with multi-step interval support (Issue #96) */
  structure?: WorkoutStructure
  /** Current segment format - will be migrated to structure */
  segments?: WorkoutSegment[]
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
  name: string
  type: string
  tss: number
  duration_min?: number | undefined
  description?: string | undefined
  /** NEW: Full workout structure with multi-step interval support (Issue #96) */
  structure?: WorkoutStructure | undefined
  /** Current segment format - will be migrated to structure */
  segments?: WorkoutSegment[] | undefined
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
 */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)

  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Calculate total duration of a workout from its structure or legacy segments
 * NEW: Supports WorkoutStructure with multi-step intervals (Issue #96)
 */
export function calculateWorkoutDuration(workout: Workout): number {
  // NEW: Handle WorkoutStructure format
  if (workout.structure?.structure) {
    return calculateStructureDuration(workout.structure)
  }

  // Legacy format handling
  if (!workout.segments || workout.segments.length === 0) {
    return 0
  }

  return workout.segments.reduce((total, segment) => {
    let segmentDuration = segment.duration_min || 0

    // Handle interval sets
    if (segment.sets && segment.work && segment.recovery) {
      const setDuration = (segment.work.duration_min + segment.recovery.duration_min) * segment.sets
      segmentDuration += setDuration
    }

    return total + segmentDuration
  }, 0)
}

/**
 * Migration script to add unique workout IDs to existing plan instances
 *
 * This script:
 * 1. Fetches all plan_instances
 * 2. For each instance, adds deterministic UUIDs to each workout in plan_data
 * 3. Updates plan_data in the database
 * 4. Updates all workout_activity_matches to include the workout_id
 *
 * Run with: npx tsx scripts/migrate-workout-ids.ts
 *
 * Requirements:
 * - NEXT_PUBLIC_SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { addDays, parseISO, format } from 'date-fns'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Namespace for deterministic UUID generation
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

/**
 * Generate a deterministic UUID based on instance ID, date, and index
 * This ensures idempotent migrations - running the script multiple times
 * will generate the same UUIDs for the same workouts
 */
function generateDeterministicId(instanceId: string, date: string, index: number): string {
  const input = `${NAMESPACE}:${instanceId}:${date}:${index}`
  const hash = createHash('sha256').update(input).digest('hex')

  // Format as UUID (8-4-4-4-12)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-')
}

const DAY_TO_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

interface WorkoutSegment {
  type: string
  duration_min: number
  power_low_pct?: number
  power_high_pct?: number
  sets?: number
  work?: { duration_min: number; power_low_pct: number; power_high_pct: number }
  recovery?: { duration_min: number; power_low_pct: number; power_high_pct: number }
  description?: string
}

interface Workout {
  id?: string
  weekday: string
  name: string
  type?: string
  tss?: number
  description?: string
  detailed_description?: string
  segments?: WorkoutSegment[]
  source?: string
  library_workout_id?: string
}

interface WeeklyPlan {
  week_number: number
  theme?: string
  workouts: Workout[]
}

interface TrainingPlanData {
  plan_metadata?: {
    total_weeks?: number
    [key: string]: unknown
  }
  weekly_plan: WeeklyPlan[]
  [key: string]: unknown
}

interface PlanInstance {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  plan_data: TrainingPlanData
  workout_overrides?: {
    moves?: Record<string, { original_date: string; original_index: number }>
    copies?: Record<
      string,
      {
        source_date: string
        source_index: number
        library_workout?: {
          id?: string
          name?: string
          type?: string
          tss?: number
          duration_min?: number
          description?: string
          segments?: WorkoutSegment[]
        }
      }
    >
    deleted?: string[]
  }
}

interface WorkoutActivityMatch {
  id: string
  user_id: string
  plan_instance_id: string
  workout_id: string | null
  workout_date: string
  workout_index: number
  strava_activity_id: string
}

async function migratePlanInstances(): Promise<Map<string, Map<string, string>>> {
  console.log('📋 Fetching plan instances...\n')

  const { data: instances, error } = await supabase
    .from('plan_instances')
    .select('id, user_id, name, start_date, end_date, plan_data, workout_overrides')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch plan instances: ${error.message}`)
  }

  console.log(`Found ${instances?.length || 0} plan instances\n`)

  // Map of instance_id -> (date:index -> workout_id)
  const workoutIdMaps = new Map<string, Map<string, string>>()

  let updatedCount = 0
  let skippedCount = 0

  for (const instance of (instances || []) as PlanInstance[]) {
    const workoutIdMap = new Map<string, string>()
    workoutIdMaps.set(instance.id, workoutIdMap)

    let needsUpdate = false
    const planData = instance.plan_data

    if (!planData?.weekly_plan) {
      console.log(`  ⏭️  Skipping ${instance.name} (${instance.id}): No weekly_plan`)
      skippedCount++
      continue
    }

    const startDate = parseISO(instance.start_date)

    // Add IDs to all workouts in the plan
    const updatedWeeklyPlan = planData.weekly_plan.map((week) => {
      const weekStartOffset = (week.week_number - 1) * 7

      const updatedWorkouts = week.workouts.map((workout, workoutIndex) => {
        const dayIndex = DAY_TO_INDEX[workout.weekday] ?? 0
        const workoutDate = addDays(startDate, weekStartOffset + dayIndex)
        const dateKey = format(workoutDate, 'yyyy-MM-dd')
        const mapKey = `${dateKey}:${workoutIndex}`

        // Use existing ID or generate deterministic one
        const workoutId =
          workout.id || generateDeterministicId(instance.id, dateKey, workoutIndex)

        if (!workout.id) {
          needsUpdate = true
        }

        // Store in map for match updates
        workoutIdMap.set(mapKey, workoutId)

        return {
          ...workout,
          id: workoutId,
        }
      })

      return {
        ...week,
        workouts: updatedWorkouts,
      }
    })

    // Also handle library workouts in workout_overrides.copies
    if (instance.workout_overrides?.copies) {
      for (const [targetKey, copy] of Object.entries(instance.workout_overrides.copies)) {
        if (copy.source_date.startsWith('library:') && copy.library_workout) {
          // Parse target key (date:index)
          const parts = targetKey.split(':')
          if (parts.length === 2) {
            const [date, indexStr] = parts
            const index = parseInt(indexStr!, 10)

            // Use existing library_workout.id or generate deterministic one
            const libraryWorkoutId =
              copy.library_workout.id ||
              generateDeterministicId(instance.id, `library:${date}`, index)

            if (!copy.library_workout.id) {
              copy.library_workout.id = libraryWorkoutId
              needsUpdate = true
            }

            // Map uses date:index but with high index for library workouts
            workoutIdMap.set(`${date}:${index}`, libraryWorkoutId)
          }
        }
      }
    }

    if (!needsUpdate) {
      console.log(`  ✅ ${instance.name}: Already has workout IDs`)
      skippedCount++
      continue
    }

    // Update the plan_data
    const updatedPlanData = {
      ...planData,
      weekly_plan: updatedWeeklyPlan,
    }

    const { error: updateError } = await supabase
      .from('plan_instances')
      .update({
        plan_data: updatedPlanData,
        workout_overrides: instance.workout_overrides,
      })
      .eq('id', instance.id)

    if (updateError) {
      console.error(`  ❌ Failed to update ${instance.name}: ${updateError.message}`)
      continue
    }

    console.log(`  ✅ Updated ${instance.name} (${instance.id})`)
    updatedCount++
  }

  console.log(`\n📊 Plan instances: ${updatedCount} updated, ${skippedCount} skipped\n`)

  return workoutIdMaps
}

async function migrateWorkoutMatches(workoutIdMaps: Map<string, Map<string, string>>): Promise<void> {
  console.log('🔗 Fetching workout matches...\n')

  const { data: matches, error } = await supabase
    .from('workout_activity_matches')
    .select('id, user_id, plan_instance_id, workout_id, workout_date, workout_index, strava_activity_id')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch workout matches: ${error.message}`)
  }

  console.log(`Found ${matches?.length || 0} workout matches\n`)

  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0

  for (const match of (matches || []) as WorkoutActivityMatch[]) {
    // Skip if already has workout_id
    if (match.workout_id) {
      skippedCount++
      continue
    }

    // Get the workout ID map for this instance
    const workoutIdMap = workoutIdMaps.get(match.plan_instance_id)
    if (!workoutIdMap) {
      console.log(`  ⚠️  No workout map for instance ${match.plan_instance_id}`)
      notFoundCount++
      continue
    }

    // Look up the workout_id
    const mapKey = `${match.workout_date}:${match.workout_index}`
    const workoutId = workoutIdMap.get(mapKey)

    if (!workoutId) {
      console.log(`  ⚠️  No workout found for ${mapKey} in instance ${match.plan_instance_id}`)
      notFoundCount++
      continue
    }

    // Update the match
    const { error: updateError } = await supabase
      .from('workout_activity_matches')
      .update({ workout_id: workoutId })
      .eq('id', match.id)

    if (updateError) {
      console.error(`  ❌ Failed to update match ${match.id}: ${updateError.message}`)
      continue
    }

    updatedCount++
  }

  console.log(`\n📊 Workout matches: ${updatedCount} updated, ${skippedCount} skipped, ${notFoundCount} not found\n`)
}

async function main() {
  console.log('🚀 Starting workout ID migration...\n')
  console.log('=' .repeat(60) + '\n')

  try {
    // Step 1: Add IDs to all workouts in plan instances
    const workoutIdMaps = await migratePlanInstances()

    console.log('=' .repeat(60) + '\n')

    // Step 2: Update workout matches with workout_ids
    await migrateWorkoutMatches(workoutIdMaps)

    console.log('=' .repeat(60) + '\n')
    console.log('✅ Migration completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })

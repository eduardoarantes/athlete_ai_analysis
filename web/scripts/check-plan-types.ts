/**
 * Check what plan types exist in the database
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envFile = readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}

envFile.split('\n').forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1]?.trim()
    const value = match[2]?.trim()
    if (key && value) {
      envVars[key] = value
    }
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

async function check() {
  console.log('🔍 Checking plan types and workout_overrides usage...\n')

  const { data, error } = await supabase
    .from('plan_instances')
    .select('id, workout_overrides, plan_data')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('📊 Total plans:', data?.length)

  // Check workout_overrides usage
  let withOverrides = 0
  let withNonEmptyOverrides = 0
  let withScheduledDate = 0
  let withoutScheduledDate = 0

  data?.forEach((plan) => {
    if (plan.workout_overrides) {
      withOverrides++
      const overrides = plan.workout_overrides as any
      if (
        Object.keys(overrides.moves || {}).length > 0 ||
        Object.keys(overrides.copies || {}).length > 0 ||
        (overrides.deleted || []).length > 0
      ) {
        withNonEmptyOverrides++
        console.log(`\n⚠️  Plan ${plan.id} has active overrides:`)
        console.log(
          `   Moves: ${Object.keys(overrides.moves || {}).length}, Copies: ${Object.keys(overrides.copies || {}).length}, Deleted: ${(overrides.deleted || []).length}`
        )
      }
    }

    // Check if workouts have scheduled_date
    const planData = plan.plan_data as any
    if (planData?.weekly_plan) {
      let hasScheduledDate = false
      let hasNoScheduledDate = false

      planData.weekly_plan.forEach((week: any) => {
        week.workouts?.forEach((workout: any) => {
          if (workout.scheduled_date) {
            hasScheduledDate = true
          } else {
            hasNoScheduledDate = true
          }
        })
      })

      if (hasScheduledDate) withScheduledDate++
      if (hasNoScheduledDate) withoutScheduledDate++
    }
  })

  console.log('\n📊 Workout Overrides Usage:')
  console.log(`   Plans with workout_overrides field: ${withOverrides}`)
  console.log(`   Plans with NON-EMPTY overrides: ${withNonEmptyOverrides}`)

  console.log('\n📊 Scheduled Date Usage:')
  console.log(`   Plans with scheduled_date workouts: ${withScheduledDate}`)
  console.log(`   Plans with legacy (no scheduled_date) workouts: ${withoutScheduledDate}`)

  if (withNonEmptyOverrides === 0 && withoutScheduledDate === 0) {
    console.log('\n✅ All plans use scheduled_date, no active overrides!')
    console.log('   Safe to remove workout_overrides system')
  } else {
    console.log('\n⚠️  Some plans still use the old system')
  }
}

check()

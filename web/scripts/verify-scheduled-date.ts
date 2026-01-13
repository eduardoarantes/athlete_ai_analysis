/**
 * Verify Scheduled Date System
 *
 * Checks that all workouts in plan_data have scheduled_date field
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables from .env.local
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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey =
  envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function verifyScheduledDate() {
  console.log('🔍 Verifying Scheduled Date System\n')
  console.log('='.repeat(60))

  // Fetch all plan instances
  const { data: instances, error } = await supabase
    .from('plan_instances')
    .select('id, name, start_date, plan_data')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching plan instances:', error.message)
    process.exit(1)
  }

  if (!instances || instances.length === 0) {
    console.log('\n⚠️  No plan instances found in database')
    process.exit(0)
  }

  console.log(`\nFound ${instances.length} plan instance(s)\n`)

  let totalWorkouts = 0
  let workoutsWithScheduledDate = 0
  let workoutsWithoutScheduledDate = 0

  instances.forEach((instance, idx) => {
    console.log(`\n${idx + 1}. Plan: ${instance.name || 'Unnamed'}`)
    console.log(`   ID: ${instance.id}`)
    console.log(`   Start Date: ${instance.start_date}`)

    const planData = instance.plan_data as any

    if (!planData?.weekly_plan) {
      console.log('   ⚠️  No weekly_plan data')
      return
    }

    console.log(`   Weeks: ${planData.weekly_plan.length}`)

    planData.weekly_plan.forEach((week: any) => {
      if (!week.workouts || week.workouts.length === 0) return

      console.log(`\n   Week ${week.week_number}:`)
      week.workouts.forEach((workout: any, workoutIdx: number) => {
        totalWorkouts++

        if (workout.scheduled_date) {
          workoutsWithScheduledDate++
          console.log(
            `      ✅ [${workoutIdx}] ${workout.name} - ${workout.scheduled_date} (${workout.weekday})`
          )
        } else {
          workoutsWithoutScheduledDate++
          console.log(
            `      ❌ [${workoutIdx}] ${workout.name} - NO scheduled_date (weekday: ${workout.weekday})`
          )
        }
      })
    })
  })

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Total workouts: ${totalWorkouts}`)
  console.log(`   ✅ With scheduled_date: ${workoutsWithScheduledDate}`)
  console.log(`   ❌ Without scheduled_date: ${workoutsWithoutScheduledDate}`)

  if (workoutsWithoutScheduledDate > 0) {
    console.log('\n⚠️  Warning: Some workouts are missing scheduled_date field')
    console.log('   These workouts use the legacy system (week_number + weekday)')
  }

  if (workoutsWithScheduledDate === totalWorkouts && totalWorkouts > 0) {
    console.log('\n✅ All workouts have scheduled_date - system is working correctly!')
  }
}

verifyScheduledDate().catch((error) => {
  console.error('\n❌ Error:', error)
  process.exit(1)
})

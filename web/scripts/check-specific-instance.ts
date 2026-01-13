/**
 * Check Specific Instance
 *
 * Checks a specific plan instance to verify scheduled_date system
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

// Instance ID from server logs
const INSTANCE_ID = 'e0582e96-f902-4cdf-abf3-2218dce27d39'

async function checkInstance() {
  console.log('🔍 Checking Instance:', INSTANCE_ID)
  console.log('='.repeat(60))

  const { data: instance, error } = await supabase
    .from('plan_instances')
    .select('*')
    .eq('id', INSTANCE_ID)
    .single()

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  if (!instance) {
    console.log('❌ Instance not found')
    process.exit(1)
  }

  console.log(`\n✅ Found instance: ${instance.name || 'Unnamed'}`)
  console.log(`   Start Date: ${instance.start_date}`)
  console.log(`   Status: ${instance.status}`)
  console.log(`   Type: ${instance.type}`)

  const planData = instance.plan_data as any

  if (!planData?.weekly_plan) {
    console.log('\n❌ No weekly_plan data')
    process.exit(1)
  }

  console.log(`\n📅 Weekly Plan:`)
  console.log(`   Total weeks: ${planData.weekly_plan.length}`)

  let totalWorkouts = 0
  let withScheduledDate = 0
  let withoutScheduledDate = 0

  planData.weekly_plan.forEach((week: any) => {
    if (!week.workouts || week.workouts.length === 0) return

    console.log(`\n   Week ${week.week_number}:`)
    week.workouts.forEach((workout: any, idx: number) => {
      totalWorkouts++

      if (workout.scheduled_date) {
        withScheduledDate++
        console.log(`      ✅ [${idx}] ${workout.name}`)
        console.log(`         scheduled_date: ${workout.scheduled_date}`)
        console.log(`         weekday: ${workout.weekday}`)
        if (workout.library_workout_id) {
          console.log(`         library_workout_id: ${workout.library_workout_id}`)
        }
      } else {
        withoutScheduledDate++
        console.log(`      ❌ [${idx}] ${workout.name} - NO scheduled_date!`)
        console.log(`         weekday: ${workout.weekday}`)
      }
    })
  })

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Results:')
  console.log(`   Total workouts: ${totalWorkouts}`)
  console.log(`   ✅ With scheduled_date: ${withScheduledDate}`)
  console.log(`   ❌ Without scheduled_date: ${withoutScheduledDate}`)

  if (withoutScheduledDate > 0) {
    console.error('\n❌ FAIL: Some workouts missing scheduled_date')
    process.exit(1)
  }

  if (totalWorkouts === 0) {
    console.log('\n⚠️  No workouts found in plan')
    process.exit(0)
  }

  console.log('\n✅ SUCCESS: All workouts have scheduled_date!')
}

checkInstance().catch((error) => {
  console.error('\n❌ Error:', error)
  process.exit(1)
})

/**
 * Test Scheduled Date System
 *
 * Tests the complete workflow:
 * 1. Create a new user
 * 2. Create a manual training plan
 * 3. Add library workouts to the plan
 * 4. Move workouts between dates (drag-and-drop)
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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function testWorkflow() {
  console.log('🧪 Testing Scheduled Date System\n')
  console.log('='.repeat(60))

  // Step 1: Create a new user
  console.log('\n📝 Step 1: Creating new user...')
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('❌ Failed to create user:', authError?.message)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log(`✅ User created: ${testEmail}`)
  console.log(`   User ID: ${userId}`)

  // Get access token for API calls
  const { error: sessionError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: testEmail,
  })

  if (sessionError) {
    console.error('❌ Failed to generate session:', sessionError.message)
    process.exit(1)
  }

  // Sign in as the user
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (signInError || !signInData.session) {
    console.error('❌ Failed to sign in:', signInError?.message)
    process.exit(1)
  }

  const accessToken = signInData.session.access_token
  console.log(`✅ User signed in successfully`)

  // Step 2: Create a manual training plan
  console.log('\n📝 Step 2: Creating manual training plan...')

  const createProfileResponse = await fetch('http://localhost:3000/api/profile/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-access-token=${accessToken}; sb-refresh-token=${signInData.session.refresh_token}`,
    },
    body: JSON.stringify({
      profile: {
        ftp: 250,
        weight: 75,
        experience_level: 'intermediate',
      },
      planType: 'MANUAL_WORKOUTS',
      startDate: '2026-01-13',
    }),
  })

  if (!createProfileResponse.ok) {
    const error = await createProfileResponse.text()
    console.error('❌ Failed to create profile:', error)
    process.exit(1)
  }

  const profileResult = await createProfileResponse.json()
  const instanceId = profileResult.plan_instance_id
  console.log(`✅ Manual training plan created`)
  console.log(`   Instance ID: ${instanceId}`)
  console.log(`   Start date: 2026-01-13`)

  // Wait a bit for the database to settle
  await sleep(1000)

  // Step 3: Add library workouts
  console.log('\n📝 Step 3: Adding library workouts...')

  // Add workout to 2026-01-13 (Monday)
  console.log('   Adding workout to 2026-01-13 (Monday)...')
  const addWorkout1Response = await fetch(
    `http://localhost:3000/api/schedule/${instanceId}/workouts/add`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sb-access-token=${accessToken}; sb-refresh-token=${signInData.session.refresh_token}`,
      },
      body: JSON.stringify({
        workout_id: 'gwqknjoUfr', // Replace with actual library workout ID
        target_date: '2026-01-13',
      }),
    }
  )

  if (!addWorkout1Response.ok) {
    const error = await addWorkout1Response.text()
    console.error('❌ Failed to add workout 1:', error)
    process.exit(1)
  }

  const workout1Result = await addWorkout1Response.json()
  console.log(`   ✅ Workout added to 2026-01-13`)
  console.log(`      Workout: ${workout1Result.workout.name}`)
  console.log(`      Week: ${workout1Result.week_number}`)

  // Add workout to 2026-01-15 (Wednesday)
  console.log('   Adding workout to 2026-01-15 (Wednesday)...')
  const addWorkout2Response = await fetch(
    `http://localhost:3000/api/schedule/${instanceId}/workouts/add`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sb-access-token=${accessToken}; sb-refresh-token=${signInData.session.refresh_token}`,
      },
      body: JSON.stringify({
        workout_id: 'gwqknjoUfr',
        target_date: '2026-01-15',
      }),
    }
  )

  if (!addWorkout2Response.ok) {
    const error = await addWorkout2Response.text()
    console.error('❌ Failed to add workout 2:', error)
    process.exit(1)
  }

  const workout2Result = await addWorkout2Response.json()
  console.log(`   ✅ Workout added to 2026-01-15`)
  console.log(`      Workout: ${workout2Result.workout.name}`)

  // Add workout to 2026-01-20 (Monday, week 2)
  console.log('   Adding workout to 2026-01-20 (Monday, Week 2)...')
  const addWorkout3Response = await fetch(
    `http://localhost:3000/api/schedule/${instanceId}/workouts/add`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sb-access-token=${accessToken}; sb-refresh-token=${signInData.session.refresh_token}`,
      },
      body: JSON.stringify({
        workout_id: 'gwqknjoUfr',
        target_date: '2026-01-20',
      }),
    }
  )

  if (!addWorkout3Response.ok) {
    const error = await addWorkout3Response.text()
    console.error('❌ Failed to add workout 3:', error)
    process.exit(1)
  }

  const workout3Result = await addWorkout3Response.json()
  console.log(`   ✅ Workout added to 2026-01-20`)
  console.log(`      Workout: ${workout3Result.workout.name}`)
  console.log(`      Week: ${workout3Result.week_number}`)

  // Step 4: Verify workouts are stored with scheduled_date
  console.log('\n📝 Step 4: Verifying workouts have scheduled_date...')

  const { data: instance, error: instanceError } = await supabase
    .from('plan_instances')
    .select('plan_data')
    .eq('id', instanceId)
    .single()

  if (instanceError || !instance) {
    console.error('❌ Failed to fetch plan instance:', instanceError?.message)
    process.exit(1)
  }

  const planData = instance.plan_data as any
  let totalWorkouts = 0
  let workoutsWithScheduledDate = 0

  planData.weekly_plan.forEach((week: any) => {
    week.workouts.forEach((workout: any) => {
      totalWorkouts++
      if (workout.scheduled_date) {
        workoutsWithScheduledDate++
        console.log(
          `   ✅ ${workout.name} - scheduled_date: ${workout.scheduled_date}, weekday: ${workout.weekday}`
        )
      } else {
        console.log(`   ❌ ${workout.name} - NO scheduled_date!`)
      }
    })
  })

  console.log(`\n   Total workouts: ${totalWorkouts}`)
  console.log(`   Workouts with scheduled_date: ${workoutsWithScheduledDate}`)

  if (workoutsWithScheduledDate !== totalWorkouts) {
    console.error('❌ Not all workouts have scheduled_date!')
    process.exit(1)
  }

  // Step 5: Test moving a workout (drag-and-drop)
  console.log('\n📝 Step 5: Testing workout move (drag-and-drop)...')
  console.log('   Moving workout from 2026-01-13 to 2026-01-14 (Tuesday)...')

  const moveResponse = await fetch(`http://localhost:3000/api/schedule/${instanceId}/workouts`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-access-token=${accessToken}; sb-refresh-token=${signInData.session.refresh_token}`,
    },
    body: JSON.stringify({
      action: 'move',
      source: {
        date: '2026-01-13',
        index: 0,
      },
      target: {
        date: '2026-01-14',
        index: 0,
      },
    }),
  })

  if (!moveResponse.ok) {
    const error = await moveResponse.text()
    console.error('❌ Failed to move workout:', error)
    process.exit(1)
  }

  await moveResponse.json()
  console.log(`   ✅ Workout moved successfully`)

  // Step 6: Verify the workout was moved
  console.log('\n📝 Step 6: Verifying workout was moved...')

  const { data: updatedInstance, error: updatedError } = await supabase
    .from('plan_instances')
    .select('plan_data')
    .eq('id', instanceId)
    .single()

  if (updatedError || !updatedInstance) {
    console.error('❌ Failed to fetch updated instance:', updatedError?.message)
    process.exit(1)
  }

  const updatedPlanData = updatedInstance.plan_data as any
  let foundOnMonday = false
  let foundOnTuesday = false

  updatedPlanData.weekly_plan.forEach((week: any) => {
    week.workouts.forEach((workout: any) => {
      if (workout.scheduled_date === '2026-01-13') {
        foundOnMonday = true
        console.log(`   ❌ Workout still on Monday (2026-01-13)!`)
      }
      if (workout.scheduled_date === '2026-01-14') {
        foundOnTuesday = true
        console.log(
          `   ✅ Workout found on Tuesday (2026-01-14) - ${workout.name}, weekday: ${workout.weekday}`
        )
      }
    })
  })

  if (foundOnMonday) {
    console.error('❌ Workout was not moved from Monday!')
    process.exit(1)
  }

  if (!foundOnTuesday) {
    console.error('❌ Workout was not found on Tuesday!')
    process.exit(1)
  }

  console.log(`   ✅ Workout successfully moved to new date`)

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('✅ ALL TESTS PASSED!')
  console.log('\nSummary:')
  console.log(`   • User created: ${testEmail}`)
  console.log(`   • Manual plan created: ${instanceId}`)
  console.log(`   • 3 library workouts added`)
  console.log(`   • All workouts have scheduled_date field`)
  console.log(`   • Workout drag-and-drop works correctly`)
  console.log('\n🎉 The scheduled_date system is working perfectly!')
}

testWorkflow().catch((error) => {
  console.error('\n❌ Test failed:', error)
  process.exit(1)
})

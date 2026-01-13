/**
 * Delete All Data Script
 *
 * WARNING: This will delete ALL users, plans, and plan instances from the database.
 * Use with caution!
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
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function deleteAllData() {
  console.log('🗑️  Starting data deletion...\n')

  // Delete workout_activity_matches first (foreign key to plan_instances)
  console.log('Deleting workout_activity_matches...')
  const { error: matchesError, count: matchesCount } = await supabase
    .from('workout_activity_matches')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (matchesError) {
    console.error('❌ Error deleting workout_activity_matches:', matchesError.message)
  } else {
    console.log(`✅ Deleted ${matchesCount || 0} workout activity matches`)
  }

  // Delete plan_instances (scheduled plans)
  console.log('\nDeleting plan_instances...')
  const { error: instancesError, count: instancesCount } = await supabase
    .from('plan_instances')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (instancesError) {
    console.error('❌ Error deleting plan_instances:', instancesError.message)
  } else {
    console.log(`✅ Deleted ${instancesCount || 0} plan instances`)
  }

  // Delete training_plans
  console.log('\nDeleting training_plans...')
  const { error: plansError, count: plansCount } = await supabase
    .from('training_plans')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (plansError) {
    console.error('❌ Error deleting training_plans:', plansError.message)
  } else {
    console.log(`✅ Deleted ${plansCount || 0} training plans`)
  }

  // Delete user profiles
  console.log('\nDeleting user_profiles...')
  const { error: profilesError, count: profilesCount } = await supabase
    .from('user_profiles')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (profilesError) {
    console.error('❌ Error deleting user_profiles:', profilesError.message)
  } else {
    console.log(`✅ Deleted ${profilesCount || 0} user profiles`)
  }

  // Delete auth users (this will cascade to other tables)
  console.log('\nDeleting auth users...')
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Error listing users:', listError.message)
  } else if (users && users.users.length > 0) {
    let deletedCount = 0
    for (const user of users.users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error(`❌ Error deleting user ${user.email}:`, deleteError.message)
      } else {
        deletedCount++
      }
    }
    console.log(`✅ Deleted ${deletedCount} auth users`)
  } else {
    console.log('✅ No users to delete')
  }

  console.log('\n✅ Data deletion complete!')
}

deleteAllData().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})

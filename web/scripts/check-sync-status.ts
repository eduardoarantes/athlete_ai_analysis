import { createClient } from '@supabase/supabase-js'

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

async function checkSyncStatus() {
  console.log('🔍 Checking Strava sync status...\n')

  // Get all strava connections
  const { data: connections, error: connError } = await supabase
    .from('strava_connections')
    .select('*')
    .order('created_at', { ascending: false })

  if (connError) {
    console.error('❌ Error fetching connections:', connError)
    return
  }

  console.log(`📊 Found ${connections?.length || 0} Strava connection(s)\n`)

  if (connections && connections.length > 0) {
    connections.forEach((conn: any, index: number) => {
      console.log(`Connection ${index + 1}:`)
      console.log(`  User ID: ${conn.user_id}`)
      console.log(`  Athlete ID: ${conn.athlete_id}`)
      console.log(`  Sync Status: ${conn.sync_status}`)
      console.log(`  Sync Error: ${conn.sync_error || 'None'}`)
      console.log(`  Last Sync: ${conn.last_sync_at || 'Never'}`)
      console.log(`  Created: ${conn.created_at}`)
      console.log(`  Updated: ${conn.updated_at}`)
      console.log()
    })
  }

  // Get recent jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .eq('type', 'strava_sync')
    .order('created_at', { ascending: false })
    .limit(10)

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError)
    return
  }

  console.log(`📋 Recent sync jobs (last 10):\n`)

  if (jobs && jobs.length > 0) {
    jobs.forEach((job: any, index: number) => {
      console.log(`Job ${index + 1}:`)
      console.log(`  ID: ${job.id}`)
      console.log(`  User ID: ${job.user_id}`)
      console.log(`  Status: ${job.status}`)
      console.log(`  Attempts: ${job.attempts}/${job.max_attempts}`)
      console.log(`  Error: ${job.error || 'None'}`)
      console.log(`  Created: ${job.created_at}`)
      console.log(`  Started: ${job.started_at || 'Not started'}`)
      console.log(`  Completed: ${job.completed_at || 'Not completed'}`)
      if (job.result) {
        console.log(`  Result:`, JSON.stringify(job.result, null, 2))
      }
      console.log()
    })
  } else {
    console.log('  No jobs found')
  }

  // Get activity count
  const { count: activityCount } = await supabase
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })

  console.log(`\n🚴 Total activities synced: ${activityCount || 0}`)
}

checkSyncStatus()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })

/**
 * Clean all training plans and instances from database
 * Run with: npx tsx scripts/clean-plans.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Read .env.local file manually
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}

envContent.split('\n').forEach((line) => {
  const match = line.match(/^([^=:#]+)=(.*)$/)
  if (match) {
    const key = match[1]!.trim()
    const value = match[2]!.trim().replace(/^["']|["']$/g, '')
    envVars[key] = value
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
  console.log('🗑️  Cleaning all training plans and instances...\n')

  // Delete plan instances first (foreign key constraint)
  const { error: instancesError } = await supabase
    .from('plan_instances')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (instancesError) {
    console.error('❌ Error deleting plan instances:', instancesError)
    process.exit(1)
  }
  console.log('✓ All plan instances deleted')

  // Delete training plans
  const { error: plansError } = await supabase
    .from('training_plans')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (plansError) {
    console.error('❌ Error deleting training plans:', plansError)
    process.exit(1)
  }
  console.log('✓ All training plans deleted')

  // Delete custom plan weeks
  const { error: weeksError } = await supabase
    .from('custom_plan_weeks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (weeksError) {
    console.error('❌ Error deleting custom plan weeks:', weeksError)
    process.exit(1)
  }
  console.log('✓ All custom plan weeks deleted')

  console.log('\n✅ Database cleaned successfully!')
}

main()

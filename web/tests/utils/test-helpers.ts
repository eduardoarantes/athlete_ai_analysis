import { Page } from '@playwright/test'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Supabase configuration
// For Supabase Cloud, you must set SUPABASE_SERVICE_ROLE_KEY environment variable
// Get this from: Supabase Dashboard > Project Settings > API > service_role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Default local development key (only works with local Supabase)
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

function getServiceKey(): string {
  if (supabaseServiceKey) {
    return supabaseServiceKey
  }
  // Check if we're connecting to local Supabase
  if (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')) {
    return LOCAL_SERVICE_KEY
  }
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY environment variable is required for Supabase Cloud.\n' +
      'Get it from: Supabase Dashboard > Project Settings > API > service_role key\n' +
      'Then run tests with: SUPABASE_SERVICE_ROLE_KEY=your-key pnpm test:headed'
  )
}

export interface TestUser {
  id: string
  email: string
  password: string
}

export function createSupabaseAdmin(): SupabaseClient<Database> {
  const serviceKey = getServiceKey()
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Creates a test user with confirmed email
 */
export async function createTestUser(
  supabase: SupabaseClient<Database>,
  prefix: string = 'test'
): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}@example.com`
  const password = 'TestPassword123!'

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) throw authError

  return {
    id: authData.user.id,
    email,
    password,
  }
}

/**
 * Creates a test user with a profile (for tests that need authenticated users with profiles)
 */
export async function createTestUserWithProfile(
  supabase: SupabaseClient<Database>,
  prefix: string = 'test'
): Promise<TestUser> {
  const user = await createTestUser(supabase, prefix)

  const { error: profileError } = await supabase.from('athlete_profiles').insert({
    user_id: user.id,
    first_name: 'Test',
    last_name: 'User',
    age: 30,
    gender: 'male',
    ftp: 250,
    max_hr: 180,
    weight_kg: 70,
  })

  if (profileError) throw profileError

  return user
}

/**
 * Logs in a test user via the UI
 */
export async function loginTestUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for either dashboard or onboarding redirect
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 })
}

/**
 * Deletes a test user and all associated data
 */
export async function deleteTestUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  // Delete in order of dependencies
  await supabase.from('strava_activities').delete().eq('user_id', userId)
  await supabase.from('athlete_profiles').delete().eq('user_id', userId)
  await supabase.auth.admin.deleteUser(userId)
}

/**
 * Selects an option from a shadcn/ui Select component
 */
export async function selectOption(
  page: Page,
  triggerSelector: string,
  optionText: string
): Promise<void> {
  // Click the trigger to open the dropdown
  await page.click(triggerSelector)
  await page.waitForTimeout(300) // Wait for animation

  // Click the option
  await page.click(`[role="option"]:has-text("${optionText}")`)
}

/**
 * Fills onboarding step 1 form
 */
export async function fillOnboardingStep1(
  page: Page,
  data: { firstName: string; lastName: string; age: string; gender: string }
): Promise<void> {
  await page.fill('input[name="firstName"]', data.firstName)
  await page.fill('input[name="lastName"]', data.lastName)
  await page.fill('input[name="age"]', data.age)

  // Gender uses shadcn/ui Select
  await selectOption(page, 'button[role="combobox"]', data.gender)
}

/**
 * Clicks the Next button and waits for transition
 */
export async function clickNextAndWait(page: Page): Promise<void> {
  await page.click('button:has-text("Next")')
  await page.waitForTimeout(500)
}

/**
 * Creates mock Strava activities for testing
 */
export async function createMockActivities(
  supabase: SupabaseClient<Database>,
  userId: string,
  count: number = 3
): Promise<void> {
  const now = new Date()
  const activities = []

  for (let i = 0; i < count; i++) {
    const daysAgo = i * 2 // Activities 0, 2, 4 days ago
    const activityDate = new Date(now)
    activityDate.setDate(now.getDate() - daysAgo)

    const activityTypes = [
      { sport_type: 'Ride', name: 'Morning Ride', distance: 45000, time: 5400 },
      { sport_type: 'Run', name: 'Evening Run', distance: 10000, time: 3000 },
      { sport_type: 'VirtualRide', name: 'Zwift Workout', distance: 30000, time: 3600 },
    ]

    const activity = activityTypes[i % activityTypes.length]

    activities.push({
      user_id: userId,
      strava_activity_id: 1000000000 + i,
      name: `${activity.name} ${i + 1}`,
      type: activity.sport_type,
      sport_type: activity.sport_type,
      start_date: activityDate.toISOString(),
      distance: activity.distance,
      moving_time: activity.time,
      elapsed_time: activity.time + 300, // Add 5 minutes for pauses
      average_watts: 200,
      max_watts: 350,
      average_heartrate: 145,
      max_heartrate: 175,
      total_elevation_gain: 450,
    })
  }

  const { error } = await supabase.from('strava_activities').insert(activities)

  if (error) throw error
}

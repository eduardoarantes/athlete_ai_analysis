import { test, expect } from '@playwright/test'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

test.describe('Activities Calendar', () => {
  let supabase: SupabaseClient<Database>
  let testUserId: string
  let testEmail: string

  test.beforeAll(async () => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  })

  test.beforeEach(async ({ page }) => {
    // Create a unique test user
    testEmail = `test-calendar-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-123',
      email_confirm: true,
    })

    if (authError) throw authError
    testUserId = authData.user.id

    // Create profile
    const { error: profileError } = await supabase.from('athlete_profiles').insert({
      user_id: testUserId,
      first_name: 'Test',
      last_name: 'User',
      ftp: 250,
      max_hr: 180,
      weight_kg: 70,
    })

    if (profileError) throw profileError

    // Create test activities in different months
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15)
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15)

    // Use unique activity IDs based on timestamp
    const baseId = Date.now()

    const activities = [
      {
        user_id: testUserId,
        strava_activity_id: baseId + 1,
        name: 'Current Month Ride',
        type: 'Ride',
        sport_type: 'Ride',
        start_date: currentMonth.toISOString(),
        distance: 30000,
        moving_time: 3600,
        elapsed_time: 3600,
        total_elevation_gain: 300,
        average_watts: 200,
        weighted_average_watts: 220,
      },
      {
        user_id: testUserId,
        strava_activity_id: baseId + 2,
        name: 'Previous Month Ride',
        type: 'Ride',
        sport_type: 'Ride',
        start_date: previousMonth.toISOString(),
        distance: 40000,
        moving_time: 4200,
        elapsed_time: 4200,
        total_elevation_gain: 400,
        average_watts: 210,
        weighted_average_watts: 230,
      },
      {
        user_id: testUserId,
        strava_activity_id: baseId + 3,
        name: 'Two Months Ago Ride',
        type: 'Ride',
        sport_type: 'Ride',
        start_date: twoMonthsAgo.toISOString(),
        distance: 50000,
        moving_time: 5000,
        elapsed_time: 5000,
        total_elevation_gain: 500,
        average_watts: 220,
        weighted_average_watts: 240,
      },
    ]

    const { error: activitiesError } = await supabase.from('strava_activities').insert(activities)

    if (activitiesError) throw activitiesError

    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', 'test-password-123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test.afterEach(async () => {
    // Cleanup: delete test user and associated data
    if (testUserId) {
      await supabase.from('strava_activities').delete().eq('user_id', testUserId)
      await supabase.from('athlete_profiles').delete().eq('user_id', testUserId)
      await supabase.auth.admin.deleteUser(testUserId)
    }
  })

  test('should show activities when navigating to previous months', async ({ page }) => {
    // Navigate to activities page
    await page.goto('/app/activities')
    await page.waitForLoadState('networkidle')

    // Switch to calendar view
    await page.click('button:has-text("Calendar")')
    await page.waitForTimeout(500)

    // Verify current month activity is visible
    await expect(page.locator('text=Current Month Ride')).toBeVisible()

    // Click previous month button
    await page.click('button[aria-label="Previous month"]', { force: true })
    await page.waitForTimeout(1000)

    // BUG: This should pass but currently fails because activities are not fetched for the previous month
    await expect(page.locator('text=Previous Month Ride')).toBeVisible()

    // Click previous month button again
    await page.click('button[aria-label="Previous month"]', { force: true })
    await page.waitForTimeout(1000)

    // BUG: This should pass but currently fails
    await expect(page.locator('text=Two Months Ago Ride')).toBeVisible()
  })

  test('should update activities when navigating to next month', async ({ page }) => {
    // Navigate to activities page
    await page.goto('/app/activities')
    await page.waitForLoadState('networkidle')

    // Switch to calendar view
    await page.click('button:has-text("Calendar")')
    await page.waitForTimeout(500)

    // Navigate to previous month first
    await page.click('button[aria-label="Previous month"]', { force: true })
    await page.waitForTimeout(1000)

    // Now navigate forward
    await page.click('button[aria-label="Next month"]', { force: true })
    await page.waitForTimeout(1000)

    // Should show current month activity again
    await expect(page.locator('text=Current Month Ride')).toBeVisible()
  })

  test('should return to current month when clicking Today button', async ({ page }) => {
    // Navigate to activities page
    await page.goto('/app/activities')
    await page.waitForLoadState('networkidle')

    // Switch to calendar view
    await page.click('button:has-text("Calendar")')
    await page.waitForTimeout(500)

    // Navigate to previous month
    await page.click('button[aria-label="Previous month"]', { force: true })
    await page.waitForTimeout(1000)

    // Click Today button
    await page.click('button:has-text("Today")')
    await page.waitForTimeout(1000)

    // Should show current month activity
    await expect(page.locator('text=Current Month Ride')).toBeVisible()
  })
})

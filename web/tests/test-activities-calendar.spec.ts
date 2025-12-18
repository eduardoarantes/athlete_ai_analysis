import { test, expect } from '@playwright/test'
import {
  createSupabaseAdmin,
  createTestUserWithProfile,
  deleteTestUser,
  loginTestUser,
  type TestUser,
} from './utils/test-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

test.describe('Activities Calendar', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser
  let baseActivityId: number

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.beforeEach(async ({ page }) => {
    // Create a test user with profile
    testUser = await createTestUserWithProfile(supabase, 'calendar')

    // Create test activities in different months
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15)
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15)

    // Use unique activity IDs based on timestamp
    baseActivityId = Date.now()

    const activities = [
      {
        user_id: testUser.id,
        strava_activity_id: baseActivityId + 1,
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
        user_id: testUser.id,
        strava_activity_id: baseActivityId + 2,
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
        user_id: testUser.id,
        strava_activity_id: baseActivityId + 3,
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
    await loginTestUser(page, testUser)

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test.afterEach(async () => {
    // Cleanup: delete test user and associated data
    if (testUser?.id) {
      await supabase.from('strava_activities').delete().eq('user_id', testUser.id)
      await deleteTestUser(supabase, testUser.id)
    }
  })

  test('should show activities when navigating to previous months', async ({ page }) => {
    // Navigate to activities page
    await page.goto('/activities')
    await page.waitForLoadState('networkidle')

    // Switch to calendar view
    const calendarButton = page.locator('button:has-text("Calendar")')
    if (await calendarButton.isVisible()) {
      await calendarButton.click()
      await page.waitForTimeout(500)
    }

    // Verify current month activity is visible
    await expect(page.locator('text=Current Month Ride')).toBeVisible({ timeout: 10000 })

    // Click previous month button
    const prevButton = page.locator('button[aria-label="Previous month"]')
    await prevButton.click({ force: true })
    await page.waitForTimeout(1000)

    // Should show previous month activity
    await expect(page.locator('text=Previous Month Ride')).toBeVisible({ timeout: 10000 })

    // Click previous month button again
    await prevButton.click({ force: true })
    await page.waitForTimeout(1000)

    // Should show two months ago activity
    await expect(page.locator('text=Two Months Ago Ride')).toBeVisible({ timeout: 10000 })
  })

  test('should update activities when navigating to next month', async ({ page }) => {
    // Navigate to activities page
    await page.goto('/activities')
    await page.waitForLoadState('networkidle')

    // Switch to calendar view
    const calendarButton = page.locator('button:has-text("Calendar")')
    if (await calendarButton.isVisible()) {
      await calendarButton.click()
      await page.waitForTimeout(500)
    }

    // Navigate to previous month first
    await page.click('button[aria-label="Previous month"]', { force: true })
    await page.waitForTimeout(1000)

    // Now navigate forward
    await page.click('button[aria-label="Next month"]', { force: true })
    await page.waitForTimeout(1000)

    // Should show current month activity again
    await expect(page.locator('text=Current Month Ride')).toBeVisible({ timeout: 10000 })
  })

  test('should return to current month when clicking Today button', async ({ page }) => {
    // Navigate to activities page
    await page.goto('/activities')
    await page.waitForLoadState('networkidle')

    // Switch to calendar view
    const calendarButton = page.locator('button:has-text("Calendar")')
    if (await calendarButton.isVisible()) {
      await calendarButton.click()
      await page.waitForTimeout(500)
    }

    // Navigate to previous month
    await page.click('button[aria-label="Previous month"]', { force: true })
    await page.waitForTimeout(1000)

    // Click Today button
    await page.click('button:has-text("Today")')
    await page.waitForTimeout(1000)

    // Should show current month activity
    await expect(page.locator('text=Current Month Ride')).toBeVisible({ timeout: 10000 })
  })
})

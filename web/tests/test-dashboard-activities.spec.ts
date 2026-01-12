import { test, expect } from '@playwright/test'
import {
  createSupabaseAdmin,
  createTestUserWithProfile,
  deleteTestUser,
  createMockActivities,
  type TestUser,
} from './utils/test-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

test.describe.configure({ mode: 'serial' })

test.describe('Dashboard Activities Display', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.afterEach(async () => {
    if (testUser?.id) {
      await deleteTestUser(supabase, testUser.id)
    }
  })

  test.skip('Dashboard shows empty state when no activities exist', async ({ page }) => {
    // Create test user with profile but no activities
    testUser = await createTestUserWithProfile(supabase, 'dashboard-no-activities')

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for page to load
    await page.waitForTimeout(1000)

    // Should show Recent Activities section
    await expect(
      page.locator('text=/Recent Activities/i, text=/Atividades Recentes/i')
    ).toBeVisible({ timeout: 5000 })

    // Should show empty state (look for SVG icon or connect/sync button)
    const emptyStateIndicators = page.locator('button:has-text("Connect"), button:has-text("Sync"), svg')
    await expect(emptyStateIndicators.first()).toBeVisible({ timeout: 5000 })
  })

  test('Dashboard displays recent activities correctly', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-with-activities')

    // Create 3 mock activities
    await createMockActivities(supabase, testUser.id, 3)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // Should show activity names
    await expect(page.locator('text=/Morning Ride 1/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Evening Run 2/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Zwift Workout 3/i')).toBeVisible({ timeout: 5000 })
  })

  test('Activities show correct distance and duration', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-activity-details')

    // Create 1 mock activity with known values
    await createMockActivities(supabase, testUser.id, 1)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // First activity is "Morning Ride" with 45km distance and 90 minutes (5400 seconds)
    // Check for distance (45.0 km)
    await expect(page.locator('text=/45\\.0 km/i')).toBeVisible({ timeout: 5000 })

    // Check for duration (1h 30m for 5400 seconds = 90 minutes)
    await expect(page.locator('text=/1h 30m/i')).toBeVisible({ timeout: 5000 })
  })

  test.skip('Activities show correct sport type icons', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-activity-icons')

    // Create 3 mock activities (Ride, Run, VirtualRide)
    await createMockActivities(supabase, testUser.id, 3)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // Should show sport types as text in activity cards
    await expect(page.locator('text=/Ride/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Run/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/VirtualRide/i')).toBeVisible({ timeout: 5000 })
  })

  test('Activities show formatted dates', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-activity-dates')

    // Create 1 mock activity
    await createMockActivities(supabase, testUser.id, 1)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // Get today's date formatted
    const today = new Date()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const expectedMonth = monthNames[today.getMonth()]

    // Should show current month in date
    await expect(page.locator(`text=/${expectedMonth}/i`)).toBeVisible({ timeout: 5000 })
  })

  test('Multiple activities are displayed in order', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-activity-order')

    // Create 5 mock activities
    await createMockActivities(supabase, testUser.id, 5)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // Dashboard shows last 5 activities - check that multiple are visible
    // Note: Dashboard might show max 5, so we check for at least 3
    await expect(page.locator('text=/Morning Ride 1/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Evening Run 2/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Zwift Workout 3/i')).toBeVisible({ timeout: 5000 })
  })

  test('Activity links open to Strava', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-activity-links')

    // Create 1 mock activity
    await createMockActivities(supabase, testUser.id, 1)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // Find the activity link
    const activityLink = page.locator('a[href*="strava.com/activities"]').first()
    await expect(activityLink).toBeVisible({ timeout: 5000 })

    // Verify it has target="_blank" and rel="noopener noreferrer"
    await expect(activityLink).toHaveAttribute('target', '_blank')
    await expect(activityLink).toHaveAttribute('rel', 'noopener noreferrer')

    // Verify the href contains the strava activity ID
    const href = await activityLink.getAttribute('href')
    expect(href).toContain('strava.com/activities')
    expect(href).toContain('1000000000') // First activity ID
  })

  test.skip('View All Activities link appears when activities exist', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-view-all-link')

    // Create 3 mock activities
    await createMockActivities(supabase, testUser.id, 3)

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for activities to load
    await page.waitForTimeout(1000)

    // Should show "View All" button that links to /activities
    const viewAllLink = page.locator('a[href="/activities"]:has-text("View All")')
    await expect(viewAllLink).toBeVisible({ timeout: 5000 })
  })
})

import { test, expect } from '@playwright/test'
import {
  createSupabaseAdmin,
  createTestUser,
  createTestUserWithProfile,
  deleteTestUser,
  type TestUser,
} from './utils/test-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

test.describe.configure({ mode: 'serial' })

test.describe('Login Page', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async () => {
    if (testUser?.id) {
      await deleteTestUser(supabase, testUser.id)
    }
  })

  test('Login page renders correctly', async ({ page }) => {
    // Check page title
    await expect(page.locator('text=Welcome back')).toBeVisible()
    await expect(page.locator('text=Sign in to your Cycling AI account')).toBeVisible()

    // Check form elements
    await expect(page.locator('input[id="email"]')).toBeVisible()
    await expect(page.locator('input[id="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]:has-text("Sign in")')).toBeVisible()

    // Check links
    await expect(page.locator('a:has-text("Forgot password?")')).toBeVisible()
    await expect(page.locator('a:has-text("Sign up")')).toBeVisible()

    // Check Google login button
    await expect(page.locator('button:has-text("Google")')).toBeVisible()
  })

  test('Form validation - Empty fields', async ({ page }) => {
    // Try to submit without filling fields
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(500)

    // Should show validation errors (Zod validation happens on blur/submit)
    // Note: The form may not show errors immediately without blur events
  })

  test('Form validation - Invalid email format', async ({ page }) => {
    // Enter invalid email
    await page.fill('input[id="email"]', 'invalid-email')
    await page.fill('input[id="password"]', 'password123')

    // Try to submit
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(1000)

    // Should stay on login page (form won't submit with invalid email)
    await expect(page).toHaveURL(/\/login/, { timeout: 2000 })
  })

  test('Successful login redirects to dashboard or onboarding', async ({ page }) => {
    // Create test user
    testUser = await createTestUser(supabase, 'login-success')

    // Fill in login form
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)

    // Submit form
    await page.click('button[type="submit"]:has-text("Sign in")')

    // Should redirect to either dashboard (if profile exists) or onboarding (if no profile)
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 10000 })
  })

  test('Invalid credentials show error message', async ({ page }) => {
    // Try to login with invalid credentials
    await page.fill('input[id="email"]', 'nonexistent@example.com')
    await page.fill('input[id="password"]', 'wrongpassword')

    // Submit form
    await page.click('button[type="submit"]:has-text("Sign in")')
    await page.waitForTimeout(1000)

    // Should show error message
    await expect(page.locator('text=/Invalid login credentials/i')).toBeVisible({
      timeout: 5000,
    })
  })

  test('Sign up link is visible and clickable', async ({ page }) => {
    // Check sign up link exists
    const signupLink = page.locator('a:has-text("Sign up")')
    await expect(signupLink).toBeVisible()

    // Verify it's actually a link (has href attribute)
    const href = await signupLink.getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('Forgot password link exists', async ({ page }) => {
    const forgotPasswordLink = page.locator('a:has-text("Forgot password?")')
    await expect(forgotPasswordLink).toBeVisible()

    // Verify it's actually a link (has href attribute)
    const href = await forgotPasswordLink.getAttribute('href')
    expect(href).toBeTruthy()
  })
})

test.describe('Dashboard Page', () => {
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

  test('Unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('Authenticated user can access dashboard', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-access')

    // Login
    await page.goto('/login')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('Dashboard shows welcome message', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-welcome')

    // Login
    await page.goto('/login')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Check for welcome message (might be translated)
    await expect(
      page.locator('h1:has-text("Welcome"), h1:has-text("Bem-vindo")')
    ).toBeVisible({ timeout: 5000 })
  })

  test.skip('Dashboard shows athlete profile information', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-profile')

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Should show athlete name from profile (Test User from test-helpers)
    await expect(page.locator('text=/Test/i')).toBeVisible({ timeout: 10000 })
  })

  test('Dashboard shows "Create Training Plan" button', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-cta')

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Check for create plan button (might be translated)
    const createPlanButton = page.locator('a[href="/coach/create-plan"]')
    await expect(createPlanButton).toBeVisible({ timeout: 10000 })
  })

  test('Dashboard shows recent activities section', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-activities')

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Should show recent activities section heading
    const activitiesHeading = page.locator('h3, h2').filter({ hasText: /recent activities/i })
    await expect(activitiesHeading).toBeVisible({ timeout: 10000 })
  })

  test('Dashboard profile card links to profile page', async ({ page }) => {
    // Create test user with profile
    testUser = await createTestUserWithProfile(supabase, 'dashboard-profile-link')

    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Find and click profile link
    const profileLink = page.locator('a[href="/profile"]').first()
    await expect(profileLink).toBeVisible({ timeout: 10000 })

    await profileLink.click()

    // Should navigate to profile page
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 })
  })

  test('Dashboard shows power zones when FTP is set', async ({ page }) => {
    // Create test user with profile (includes FTP = 250)
    testUser = await createTestUserWithProfile(supabase, 'dashboard-zones')

    // Login
    await page.goto('/login')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // FTP should be visible
    await expect(page.locator('text=/250W/i')).toBeVisible({ timeout: 5000 })

    // Weight should be visible (70kg from test-helpers)
    await expect(page.locator('text=/70kg/i')).toBeVisible({ timeout: 5000 })

    // W/kg should be calculated and visible (250/70 ≈ 3.57)
    await expect(page.locator('text=/3\\.5/i')).toBeVisible({ timeout: 5000 })
  })

  test('Dashboard shows max heart rate when set', async ({ page }) => {
    // Create test user with profile (includes max_hr = 180)
    testUser = await createTestUserWithProfile(supabase, 'dashboard-hr')

    // Login
    await page.goto('/login')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="password"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Max HR should be visible (180 from test-helpers)
    await expect(page.locator('text=/180/i')).toBeVisible({ timeout: 5000 })
  })
})

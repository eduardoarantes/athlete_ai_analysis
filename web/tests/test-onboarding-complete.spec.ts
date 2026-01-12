import { test, expect } from '@playwright/test'
import {
  createSupabaseAdmin,
  createTestUser,
  deleteTestUser,
  loginTestUser,
  type TestUser,
} from './utils/test-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

test.describe.configure({ mode: 'serial' })

test.describe('Complete Onboarding Flow', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.beforeEach(async ({ page }) => {
    // Create a test user without profile
    testUser = await createTestUser(supabase, 'onboarding-complete')

    // Login - should redirect to onboarding since no profile exists
    await loginTestUser(page, testUser)

    // Ensure we're on onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 })
  })

  test.afterEach(async () => {
    if (testUser?.id) {
      await deleteTestUser(supabase, testUser.id)
    }
  })

  test('Complete onboarding flow - all steps', async ({ page }) => {
    // STEP 1: Personal Information
    await expect(page.locator('input[name="firstName"]')).toBeVisible({ timeout: 5000 })

    // Fill required fields
    await page.fill('input[name="firstName"]', 'John')
    await page.fill('input[name="lastName"]', 'Doe')
    await page.fill('input[name="age"]', '30')

    // Select gender from dropdown
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300) // Wait for dropdown animation
    await page.click('[role="option"]:has-text("Male")')

    // Click Next to go to Step 2
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // STEP 2: Performance Metrics
    await expect(page.locator('label:has-text("FTP")')).toBeVisible({ timeout: 5000 })

    // Fill optional FTP value
    await page.fill('input[name="ftp"]', '250')

    // Click Next to go to Step 3
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // STEP 3: Training Goals
    await expect(page.locator('h2:has-text("Training Goals")')).toBeVisible({ timeout: 5000 })

    // Click on the first goal checkbox by clicking its label
    const firstGoalLabel = page.locator('label[for="improve_ftp"]')
    await expect(firstGoalLabel).toBeVisible()
    await firstGoalLabel.click()
    await page.waitForTimeout(300)

    // Verify checkbox is checked
    const firstCheckbox = page.locator('#improve_ftp')
    await expect(firstCheckbox).toBeChecked()

    // Click Next to go to Step 4
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // STEP 4: Preferences (Language)
    await expect(page.locator('text=/preferences/i')).toBeVisible({ timeout: 5000 })

    // Select language
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("English")')

    // Complete onboarding
    await page.click('button:has-text("Complete")')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('Step 1: Validation - Required fields', async ({ page }) => {
    // Try to proceed without filling fields
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // Check for validation errors with correct messages
    await expect(page.locator('text=/First name is required/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Last name is required/i')).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Validation - Age constraints', async ({ page }) => {
    // Fill required text fields
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')

    // Test age too young
    await page.fill('input[name="age"]', '10')
    await page.locator('input[name="age"]').blur()
    await page.waitForTimeout(500)

    await expect(page.locator('text=/at least 13/i')).toBeVisible({ timeout: 5000 })

    // Test age too old - use the actual validation message
    await page.fill('input[name="age"]', '121')
    await page.locator('input[name="age"]').blur()
    await page.waitForTimeout(500)

    // The actual message is "Please enter a realistic age"
    await expect(page.locator('text=/realistic age/i')).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Validation - Gender required', async ({ page }) => {
    // Fill all except gender
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')

    // Try to proceed
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // The actual message is "Please select your gender" - look for the error message specifically
    await expect(page.locator('p.text-destructive:has-text("Please select your gender")')).toBeVisible({ timeout: 5000 })
  })

  test('Step 2: Validation - FTP constraints', async ({ page }) => {
    // Complete Step 1
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Male")')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Test FTP > 999
    await page.fill('input[name="ftp"]', '1000')
    await page.locator('input[name="ftp"]').blur()
    await page.waitForTimeout(500)

    await expect(page.locator('text=/at most 999/i')).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: Validation - At least one goal required', async ({ page }) => {
    // Complete Steps 1-2
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Male")')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Skip Step 2
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Try to proceed without selecting any goals
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    await expect(page.locator('text=/at least one goal/i')).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: Multiple goals selection', async ({ page }) => {
    // Complete Steps 1-2
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Male")')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Skip Step 2
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Select multiple goals by clicking their labels
    await page.locator('label[for="improve_ftp"]').click()
    await page.waitForTimeout(200)
    await page.locator('label[for="build_endurance"]').click()
    await page.waitForTimeout(200)

    // Verify both are checked
    await expect(page.locator('#improve_ftp')).toBeChecked()
    await expect(page.locator('#build_endurance')).toBeChecked()

    // Should be able to proceed
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Should be on Step 4
    await expect(page.locator('text=/preferences/i')).toBeVisible({ timeout: 5000 })
  })

  test('Step 2: Optional fields can be skipped', async ({ page }) => {
    // Complete Step 1
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Male")')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Verify we're on Step 2
    await expect(page.locator('label:has-text("FTP")')).toBeVisible()

    // Skip without filling anything
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Should proceed to Step 3
    await expect(page.locator('h2:has-text("Training Goals")')).toBeVisible({ timeout: 5000 })
  })

  test('Step 2: Unit toggle works', async ({ page }) => {
    // Complete Step 1
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Male")')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Look for the Metric button
    const metricButton = page.locator('button:has-text("Metric")')
    await expect(metricButton).toBeVisible()

    // Click to toggle to Imperial
    await metricButton.click()
    await page.waitForTimeout(300)

    // Should now show Imperial button
    const imperialButton = page.locator('button:has-text("Imperial")')
    await expect(imperialButton).toBeVisible()
  })

  test('Navigation: Back button works', async ({ page }) => {
    // Complete Step 1
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Male")')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Should be on Step 2
    await expect(page.locator('label:has-text("FTP")')).toBeVisible()

    // Click Back
    const backButton = page.locator('button:has-text("Back")')
    await backButton.click()
    await page.waitForTimeout(500)

    // Should be back on Step 1
    await expect(page.locator('input[name="firstName"]')).toBeVisible()
    await expect(page.locator('input[name="firstName"]')).toHaveValue('Test')
  })
})

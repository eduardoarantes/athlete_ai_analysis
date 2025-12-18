import { test, expect } from '@playwright/test'
import {
  createSupabaseAdmin,
  createTestUser,
  deleteTestUser,
  loginTestUser,
  fillOnboardingStep1,
  clickNextAndWait,
  selectOption,
  type TestUser,
} from './utils/test-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

test.describe('Onboarding Validation Flow', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.beforeEach(async ({ page }) => {
    // Create a test user without profile (so they go to onboarding)
    testUser = await createTestUser(supabase, 'validation-flow')

    // Login - should redirect to onboarding since no profile exists
    await loginTestUser(page, testUser)

    // Ensure we're on onboarding
    await expect(page).toHaveURL(/\/onboarding/)
  })

  test.afterEach(async () => {
    if (testUser?.id) {
      await deleteTestUser(supabase, testUser.id)
    }
  })

  test('Step 1: Should show validation errors when clicking Next without filling required fields', async ({
    page,
  }) => {
    // Click Next without filling any fields
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // Check for validation error messages
    const firstNameError = page.locator('text=/First name is required/i')
    const lastNameError = page.locator('text=/Last name is required/i')

    await expect(firstNameError).toBeVisible({ timeout: 5000 })
    await expect(lastNameError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Should show validation on blur (touch) behavior', async ({ page }) => {
    // Focus and blur first name field without entering value
    const firstNameInput = page.locator('input[name="firstName"]')
    await firstNameInput.focus()
    await firstNameInput.blur()
    await page.waitForTimeout(500)

    // Should show validation error for first name
    const firstNameError = page.locator('text=/First name is required/i')
    await expect(firstNameError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Should validate age constraints', async ({ page }) => {
    // Fill required fields
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')

    // Try age too young (less than 13)
    const ageInput = page.locator('input[name="age"]')
    await ageInput.fill('10')
    await ageInput.blur()
    await page.waitForTimeout(500)

    // Should show min age error
    const minAgeError = page.locator('text=/at least 13/i')
    await expect(minAgeError).toBeVisible({ timeout: 5000 })

    // Try age too old (more than 120)
    await ageInput.fill('121')
    await ageInput.blur()
    await page.waitForTimeout(500)

    // Should show max age error
    const maxAgeError = page.locator('text=/at most 120/i')
    await expect(maxAgeError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Should validate gender is required', async ({ page }) => {
    // Fill all fields except gender
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="age"]', '30')

    // Click Next
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // Should show gender required error
    const genderError = page.locator('text=/gender/i').filter({ hasText: /required/i })
    await expect(genderError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Complete validation - should proceed to Step 2', async ({ page }) => {
    // Fill all required fields correctly
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })

    // Click Next
    await clickNextAndWait(page)

    // Should see step 2 content (FTP field)
    const ftpLabel = page.locator('label:has-text("FTP")')
    await expect(ftpLabel).toBeVisible({ timeout: 5000 })
  })

  test('Step 2: Should validate FTP constraints', async ({ page }) => {
    // Complete Step 1 first
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Try FTP > 999
    const ftpInput = page.locator('input[name="ftp"]')
    await ftpInput.fill('1000')
    await ftpInput.blur()
    await page.waitForTimeout(500)

    // Should show max FTP error
    const ftpError = page.locator('text=/must be at most 999/i')
    await expect(ftpError).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: Should validate at least one goal is required', async ({ page }) => {
    // Complete Step 1
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Skip Step 2 (all fields optional)
    await clickNextAndWait(page)

    // Try to proceed without selecting any goals
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // Should show at least one goal error
    const goalsError = page.locator('text=/at least one goal/i')
    await expect(goalsError).toBeVisible({ timeout: 5000 })
  })

  test('Step 4: Should validate language is required', async ({ page }) => {
    // Complete Steps 1-3
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Step 2 - skip
    await clickNextAndWait(page)

    // Step 3 - select at least one goal
    const firstGoalCheckbox = page.locator('input[type="checkbox"]').first()
    await firstGoalCheckbox.check({ force: true })
    await clickNextAndWait(page)

    // Step 4 - try to complete without selecting language
    await page.click('button:has-text("Complete")')
    await page.waitForTimeout(500)

    // Should show language required error
    const languageError = page.locator('text=/language/i').filter({ hasText: /required/i })
    await expect(languageError).toBeVisible({ timeout: 5000 })
  })

  test('Complete flow: Should create profile and redirect to dashboard', async ({ page }) => {
    // Complete Steps 1-4
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Step 2 - fill optional FTP
    await page.fill('input[name="ftp"]', '250')
    await clickNextAndWait(page)

    // Step 3 - select a goal
    const firstGoalCheckbox = page.locator('input[type="checkbox"]').first()
    await firstGoalCheckbox.check({ force: true })
    await clickNextAndWait(page)

    // Step 4 - select language
    await selectOption(page, 'button[role="combobox"]', 'English')

    // Complete onboarding
    await page.click('button:has-text("Complete")')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })
})

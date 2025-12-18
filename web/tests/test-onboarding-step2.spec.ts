import { test, expect } from '@playwright/test'
import {
  createSupabaseAdmin,
  createTestUser,
  deleteTestUser,
  loginTestUser,
  fillOnboardingStep1,
  clickNextAndWait,
  type TestUser,
} from './utils/test-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

test.describe('Onboarding Step 2', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.beforeEach(async ({ page }) => {
    // Create a test user without profile (so they go to onboarding)
    testUser = await createTestUser(supabase, 'onboarding-step2')

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

  test('should proceed to step 2 after completing step 1', async ({ page }) => {
    // Fill step 1 form
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })

    // Click Next to go to step 2
    await clickNextAndWait(page)

    // Verify we're on step 2 by checking for FTP field
    const ftpLabel = page.locator('label:has-text("FTP")')
    await expect(ftpLabel).toBeVisible({ timeout: 5000 })
  })

  test('should allow proceeding with optional fields empty in step 2', async ({ page }) => {
    // Complete step 1
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Verify we're on step 2
    const ftpLabel = page.locator('label:has-text("FTP")')
    await expect(ftpLabel).toBeVisible()

    // Click Next without filling optional fields
    await clickNextAndWait(page)

    // Should proceed to step 3 (Goals)
    const goalsLabel = page.locator('text=/goals/i')
    await expect(goalsLabel).toBeVisible({ timeout: 5000 })
  })

  test('should validate FTP maximum value', async ({ page }) => {
    // Complete step 1
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Enter FTP value greater than 999
    const ftpInput = page.locator('input[name="ftp"]')
    await ftpInput.fill('1000')
    await ftpInput.blur()

    // Should show validation error
    const ftpError = page.locator('text=/must be at most 999/i')
    await expect(ftpError).toBeVisible({ timeout: 5000 })
  })

  test('should toggle between metric and imperial units', async ({ page }) => {
    // Complete step 1
    await fillOnboardingStep1(page, {
      firstName: 'Test',
      lastName: 'User',
      age: '30',
      gender: 'Male',
    })
    await clickNextAndWait(page)

    // Find the unit toggle button
    const metricButton = page.locator('button:has-text("Metric")')
    await expect(metricButton).toBeVisible()

    // Click to toggle to imperial
    await metricButton.click()

    // Should show Imperial
    const imperialButton = page.locator('button:has-text("Imperial")')
    await expect(imperialButton).toBeVisible({ timeout: 3000 })
  })
})

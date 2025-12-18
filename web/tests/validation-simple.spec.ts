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

test.describe('Simple Validation Test', () => {
  let supabase: SupabaseClient<Database>
  let testUser: TestUser

  test.beforeAll(async () => {
    supabase = createSupabaseAdmin()
  })

  test.beforeEach(async ({ page }) => {
    // Create a test user without profile (so they go to onboarding)
    testUser = await createTestUser(supabase, 'validation-simple')

    // Login - should redirect to onboarding since no profile exists
    await loginTestUser(page, testUser)
  })

  test.afterEach(async () => {
    if (testUser?.id) {
      await deleteTestUser(supabase, testUser.id)
    }
  })

  test('Check if validation messages appear on Step 1', async ({ page }) => {
    // Ensure we're on onboarding
    await expect(page).toHaveURL(/\/onboarding/)

    console.log('✓ Reached onboarding page')

    // Try to click Next without filling any fields
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    console.log('✓ Clicked Next button')

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/validation-simple-step1.png', fullPage: true })

    // Check for validation error messages
    const firstNameError = page.locator('text=/First name is required/i')
    const lastNameError = page.locator('text=/Last name is required/i')

    const firstNameVisible = await firstNameError.isVisible()
    const lastNameVisible = await lastNameError.isVisible()

    console.log('First name error visible:', firstNameVisible)
    console.log('Last name error visible:', lastNameVisible)

    // Assert that at least one validation message appears
    expect(firstNameVisible || lastNameVisible).toBeTruthy()

    console.log('✓ Validation messages are working!')
  })
})

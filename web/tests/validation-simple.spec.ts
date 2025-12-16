import { test, expect } from '@playwright/test'

test.describe('Simple Validation Test', () => {
  test('Check if validation messages appear on Step 1', async ({ page }) => {
    // Navigate to signup page
    await page.goto('http://localhost:3000/en/signup')

    // Fill signup form
    const testEmail = `test-validation-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'

    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)
    await page.click('button[type="submit"]')

    // Wait for redirect to onboarding
    await page.waitForURL('**/onboarding**', { timeout: 15000 })

    console.log('✓ Reached onboarding page')

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/onboarding-initial.png', fullPage: true })

    // Try to click Next without filling anything
    await page.click('button:has-text("Next")')

    // Wait a moment for validation to trigger
    await page.waitForTimeout(1000)

    // Take screenshot after clicking Next
    await page.screenshot({ path: 'test-results/after-clicking-next.png', fullPage: true })

    // Check if any validation error messages are visible
    const errorMessages = page.locator('[role="alert"], .text-destructive, [class*="error"]')
    const errorCount = await errorMessages.count()

    console.log(`Found ${errorCount} error elements`)

    // Try to find specific error messages
    const firstNameError = page.locator('text=/first name/i').and(page.locator('text=/required/i'))
    const lastNameError = page.locator('text=/last name/i').and(page.locator('text=/required/i'))

    const firstNameVisible = await firstNameError.isVisible().catch(() => false)
    const lastNameVisible = await lastNameError.isVisible().catch(() => false)

    console.log(`First name error visible: ${firstNameVisible}`)
    console.log(`Last name error visible: ${lastNameVisible}`)

    // Also check for any text containing "required"
    const requiredTexts = page.locator('text=/required/i')
    const requiredCount = await requiredTexts.count()
    console.log(`Found ${requiredCount} elements with "required" text`)

    if (requiredCount > 0) {
      for (let i = 0; i < Math.min(requiredCount, 5); i++) {
        const text = await requiredTexts.nth(i).textContent()
        console.log(`  - "${text}"`)
      }
    }

    // This test just reports what it finds
    expect(errorCount).toBeGreaterThan(0)
  })
})

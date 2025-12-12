import { test, expect } from '@playwright/test'

test.describe('Onboarding Validation Flow', () => {
  test.beforeEach(async ({ page }) => {
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
    await page.waitForURL('**/onboarding**', { timeout: 10000 })
  })

  test('Step 1: Should show validation errors when clicking Next without filling required fields', async ({ page }) => {
    console.log('Testing Step 1 validation...')

    // Click Next without filling any fields
    await page.click('button:has-text("Next")')

    // Wait a moment for validation to trigger
    await page.waitForTimeout(500)

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/step1-validation-empty.png', fullPage: true })

    // Check for validation error messages
    const firstNameError = page.locator('text=/First name is required/i')
    const lastNameError = page.locator('text=/Last name is required/i')

    console.log('Checking for first name error...')
    await expect(firstNameError).toBeVisible({ timeout: 5000 })

    console.log('Checking for last name error...')
    await expect(lastNameError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Should show validation on blur (touch) behavior', async ({ page }) => {
    console.log('Testing Step 1 blur validation...')

    // Focus and blur first name field without entering value
    await page.click('input[name="firstName"]')
    await page.click('input[name="lastName"]') // Focus elsewhere to trigger blur

    // Wait for validation
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step1-validation-blur.png', fullPage: true })

    // Should show validation error for first name
    const firstNameError = page.locator('text=/First name is required/i')
    console.log('Checking for first name error after blur...')
    await expect(firstNameError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Should validate age constraints', async ({ page }) => {
    console.log('Testing Step 1 age validation...')

    // Fill required fields
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')

    // Try negative age
    await page.fill('input[type="number"][name="age"]', '-5')
    await page.click('input[name="firstName"]') // Blur to trigger validation
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step1-age-negative.png', fullPage: true })

    // Should show positive age error
    const ageError = page.locator('text=/Age must be positive/i')
    console.log('Checking for negative age error...')
    await expect(ageError).toBeVisible({ timeout: 5000 })

    // Try age too young
    await page.fill('input[type="number"][name="age"]', '10')
    await page.click('input[name="firstName"]') // Blur to trigger validation
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step1-age-young.png', fullPage: true })

    // Should show min age error
    const minAgeError = page.locator('text=/at least 13/i')
    console.log('Checking for minimum age error...')
    await expect(minAgeError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Should validate gender is required', async ({ page }) => {
    console.log('Testing Step 1 gender validation...')

    // Fill all fields except gender
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[type="number"][name="age"]', '30')

    // Click Next
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step1-gender-required.png', fullPage: true })

    // Should show gender required error
    const genderError = page.locator('text=/gender/i').filter({ hasText: /required/i })
    console.log('Checking for gender required error...')
    await expect(genderError).toBeVisible({ timeout: 5000 })
  })

  test('Step 1: Complete validation - should proceed to Step 2', async ({ page }) => {
    console.log('Testing Step 1 complete form...')

    // Fill all required fields correctly
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[type="number"][name="age"]', '30')

    // Select gender
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('text=Male')

    // Take screenshot
    await page.screenshot({ path: 'test-results/step1-complete.png', fullPage: true })

    // Click Next
    await page.click('button:has-text("Next")')

    // Wait for step indicator to show step 2
    await page.waitForTimeout(1000)

    // Take screenshot of step 2
    await page.screenshot({ path: 'test-results/step2-loaded.png', fullPage: true })

    // Should see step 2 content (FTP field)
    const ftpLabel = page.locator('text=/FTP/i')
    console.log('Checking if Step 2 loaded...')
    await expect(ftpLabel).toBeVisible({ timeout: 5000 })
  })

  test('Step 2: Should validate FTP constraints', async ({ page }) => {
    console.log('Testing Step 2 FTP validation...')

    // Complete Step 1 first
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[type="number"][name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('text=Male')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Try FTP > 999
    const ftpInput = page.locator('input[type="number"]').first()
    await ftpInput.fill('1000')
    await ftpInput.blur()
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step2-ftp-max.png', fullPage: true })

    // Should show max FTP error
    const ftpError = page.locator('text=/FTP must be at most 999/i')
    console.log('Checking for FTP max error...')
    await expect(ftpError).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: Should validate at least one goal is required', async ({ page }) => {
    console.log('Testing Step 3 goals validation...')

    // Complete Step 1
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[type="number"][name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('text=Male')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Skip Step 2 (all fields optional)
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Try to proceed without selecting any goals
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step3-goals-required.png', fullPage: true })

    // Should show at least one goal error
    const goalsError = page.locator('text=/at least one goal/i')
    console.log('Checking for goals required error...')
    await expect(goalsError).toBeVisible({ timeout: 5000 })
  })

  test('Step 4: Should validate language is required', async ({ page }) => {
    console.log('Testing Step 4 language validation...')

    // Complete Steps 1-3
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[type="number"][name="age"]', '30')
    await page.click('button[role="combobox"]')
    await page.waitForTimeout(300)
    await page.click('text=Male')
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Select at least one goal
    await page.check('input[type="checkbox"]', { force: true })
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Try to complete without selecting language
    await page.click('button:has-text("Complete Profile")')
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({ path: 'test-results/step4-language-required.png', fullPage: true })

    // Should show language required error
    const languageError = page.locator('text=/language/i').filter({ hasText: /required/i })
    console.log('Checking for language required error...')
    await expect(languageError).toBeVisible({ timeout: 5000 })
  })
})

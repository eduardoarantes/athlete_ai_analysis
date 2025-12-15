import { test, expect } from '@playwright/test'

test('test onboarding step 2 next button', async ({ page }) => {
  // Navigate to onboarding
  await page.goto('http://localhost:3000/onboarding')

  // Wait for page to load
  await page.waitForLoadState('networkidle')

  // Take screenshot of initial state
  await page.screenshot({ path: 'onboarding-initial.png' })

  // Check if we're on step 1
  const step1Title = await page.textContent('h2')
  console.log('Step 1 title:', step1Title)

  // Fill step 1 form
  await page.fill('[name="firstName"]', 'Test')
  await page.fill('[name="lastName"]', 'User')
  await page.fill('[name="age"]', '30')
  await page.selectOption('[name="gender"]', 'male')

  // Click Next to go to step 2
  await page.click('button:has-text("Next")')

  // Wait for step 2
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'onboarding-step2.png' })

  const step2Title = await page.textContent('h2')
  console.log('Step 2 title:', step2Title)

  // Check the form ID
  const formId = await page.getAttribute('form#step-two-form', 'id')
  console.log('Form ID:', formId)

  // Check the Next button
  const nextButton = await page.locator('button:has-text("Next")')
  const buttonType = await nextButton.getAttribute('type')
  const buttonForm = await nextButton.getAttribute('form')
  const isDisabled = await nextButton.isDisabled()

  console.log('Next button type:', buttonType)
  console.log('Next button form attribute:', buttonForm)
  console.log('Next button disabled:', isDisabled)

  // Try clicking Next without filling anything
  await nextButton.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'onboarding-step2-after-click.png' })

  // Check if there are validation errors
  const errors = await page.locator('.text-destructive').allTextContents()
  console.log('Validation errors:', errors)

  // Check if we're still on step 2
  const currentTitle = await page.textContent('h2')
  console.log('Current title after click:', currentTitle)
})

import { defineConfig, devices } from '@playwright/test'

// Get port from environment or use default
// Note: dotenv automatically loads ../.env before this runs
const WEB_PORT = process.env.WEB_PORT || process.env.PORT || '3000'
const BASE_URL = `http://localhost:${WEB_PORT}`

console.log(`[Playwright Config] Using BASE_URL: ${BASE_URL}`)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI && { workers: 1 }),
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `PORT=${WEB_PORT} pnpm dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      PORT: WEB_PORT,
      NODE_ENV: process.env.NODE_ENV || 'test',
      ...(process.env.TZ && { TZ: process.env.TZ }),
    },
  },
})

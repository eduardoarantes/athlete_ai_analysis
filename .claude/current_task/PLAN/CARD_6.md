# CARD 6: Update Next.js Service to Call API

**Status:** Pending
**Estimated Time:** 1.5 hours
**Dependencies:** CARD_5
**Assignee:** Implementation Agent

---

## Objective

Update `web/lib/services/cycling-coach-service.ts` to call the FastAPI backend instead of spawning CLI processes.

---

## Tasks

### 1. Update `web/lib/services/cycling-coach-service.ts`

Replace the `executePlanGeneration` method to call API instead of spawning processes:

```typescript
/**
 * Execute the Python API for plan generation (background process)
 */
private async executePlanGeneration(
  jobId: string,
  jobDir: string,
  _csvPath: string,
  _profilePath: string,
  params: TrainingPlanParams
): Promise<void> {
  const supabase = await createClient()

  try {
    // Update status to running
    await supabase
      .from('plan_generation_jobs')
      .update({ status: 'running' })
      .eq('id', jobId)

    // Build athlete profile for API
    const athleteProfile = {
      ftp: params.profile.ftp,
      weight_kg: params.profile.weight,
      max_hr: params.profile.maxHR,
      age: 35, // TODO: Get from user profile
      goals: params.customGoal ? [params.goal, params.customGoal] : [params.goal],
      training_availability: {
        hours_per_week: parseFloat(params.profile.weeklyHours),
        week_days: this.getWeekDaysString(params.profile.daysPerWeek),
      },
      experience_level: params.profile.experienceLevel,
      weekly_hours_available: parseFloat(params.profile.weeklyHours),
      training_days_per_week: params.profile.daysPerWeek,
    }

    // Calculate weeks
    const weeks = params.timeline.hasEvent
      ? this.calculateWeeksUntilEvent(params.timeline.eventDate!)
      : params.timeline.weeks || 12

    // Call FastAPI
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
    const response = await fetch(`${apiUrl}/plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athlete_profile: athleteProfile,
        weeks: weeks,
        target_ftp: params.profile.ftp * 1.05, // 5% improvement target
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'API request failed')
    }

    const apiJobData = await response.json()
    const apiJobId = apiJobData.job_id

    // Poll API for completion
    await this.pollJobStatus(apiJobId, jobId, weeks || 12, supabase)

  } catch (error) {
    // Update job as failed
    await supabase
      .from('plan_generation_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', jobId)
  }
}

/**
 * Poll API job status until completion
 */
private async pollJobStatus(
  apiJobId: string,
  dbJobId: string,
  weeks: number,
  supabase: any
): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
  const maxAttempts = 60 // 2 minutes with 2-second intervals
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++

    const statusResponse = await fetch(`${apiUrl}/plan/status/${apiJobId}`)

    if (!statusResponse.ok) {
      throw new Error('Failed to get job status from API')
    }

    const jobStatus = await statusResponse.json()

    // Update progress in database
    if (jobStatus.progress) {
      await supabase
        .from('plan_generation_jobs')
        .update({ progress: jobStatus.progress })
        .eq('id', dbJobId)
    }

    if (jobStatus.status === 'completed') {
      // Success - extract plan data
      const planData = jobStatus.result.training_plan

      // Store plan in database
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + weeks * 7)

      const { data: plan } = await supabase
        .from('training_plans')
        .insert({
          user_id: dbJobId.split('_')[2] ?? '',
          name: `Training Plan - ${weeks} weeks`,
          goal: planData.athlete_profile?.goals?.[0] || 'General fitness',
          start_date: new Date().toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          weeks_total: weeks,
          status: 'active',
          plan_data: planData as never,
        } as never)
        .select()
        .single()

      // Update job status
      await supabase
        .from('plan_generation_jobs')
        .update({
          status: 'completed',
          result: { plan_id: plan?.id, plan_data: planData } as unknown as Record<string, unknown>,
        } as never)
        .eq('id', dbJobId)

      return
    }

    if (jobStatus.status === 'failed') {
      throw new Error(jobStatus.error || 'Job failed')
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error('Job polling timeout')
}

/**
 * Get comma-separated week days string based on number of days
 */
private getWeekDaysString(daysPerWeek: number): string {
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  if (daysPerWeek >= 7) {
    return allDays.join(', ')
  }

  // For fewer days, prioritize weekend + weekdays
  const priority = ['Saturday', 'Sunday', 'Wednesday', 'Monday', 'Friday', 'Tuesday', 'Thursday']
  return priority.slice(0, daysPerWeek).sort().join(', ')
}
```

### 2. Update `web/.env.local.example`

Add API URL configuration:

```bash
# FastAPI Backend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Existing variables...
```

### 3. Update `web/README.md` (Development Section)

Add instructions for running both servers:

```markdown
## Development

### Prerequisites
- Node.js 20+
- pnpm
- Python 3.11+ (for backend API)

### Running the Application

1. **Start the FastAPI backend:**
   ```bash
   cd ..  # Navigate to project root
   ./scripts/start_api.sh
   ```

2. **Start the Next.js dev server:**
   ```bash
   cd web
   pnpm dev
   ```

3. Open http://localhost:3000

The application will communicate with the Python backend at http://localhost:8000.
```

### 4. Create `web/tests/integration/api-integration.spec.ts`

Test the API integration:

```typescript
import { test, expect } from '@playwright/test'

test.describe('API Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Assume logged in
    // await loginUser(page)
  })

  test('should generate training plan via API', async ({ page }) => {
    // Navigate to wizard
    await page.goto('/coach/wizard')

    // Fill wizard steps (simplified)
    // Step 1: Goals
    await page.click('[data-testid="goal-improve-ftp"]')
    await page.click('[data-testid="next-button"]')

    // Step 2: Timeline
    await page.fill('[data-testid="weeks-input"]', '12')
    await page.click('[data-testid="next-button"]')

    // Step 3: Profile
    await page.fill('[data-testid="ftp-input"]', '265')
    await page.fill('[data-testid="weight-input"]', '70')
    await page.fill('[data-testid="max-hr-input"]', '186')
    await page.click('[data-testid="next-button"]')

    // Step 4: Preferences
    await page.selectOption('[data-testid="days-per-week"]', '5')
    await page.fill('[data-testid="weekly-hours"]', '7')
    await page.click('[data-testid="generate-button"]')

    // Should redirect to status page
    await page.waitForURL('/coach/plan/*', { timeout: 5000 })

    // Should show job status
    await expect(page.locator('[data-testid="job-status"]')).toBeVisible()

    // Should eventually complete (with generous timeout for LLM)
    await expect(page.locator('[data-testid="job-status"]')).toContainText('completed', {
      timeout: 120000, // 2 minutes
    })

    // Should show plan
    await expect(page.locator('[data-testid="training-plan"]')).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // TODO: Test error scenarios
  })
})
```

---

## Verification Steps

### 1. Update Environment Variables

```bash
cd web
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 2. Start Both Servers

Terminal 1:
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis
./scripts/start_api.sh
```

Terminal 2:
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web
pnpm dev
```

### 3. Test Wizard Flow

1. Open http://localhost:3000/coach/wizard
2. Fill in all wizard steps
3. Submit
4. Should see job status page
5. Should see "running" status
6. Should eventually see "completed" status
7. Should see training plan

### 4. Verify Database

Check Supabase dashboard:
- `plan_generation_jobs` table should have job
- `training_plans` table should have completed plan

### 5. Test Error Handling

Try invalid input (negative FTP) - should show validation error

---

## Files Modified

- `web/lib/services/cycling-coach-service.ts` (replace CLI with API calls)
- `web/.env.local.example` (add API URL)
- `web/README.md` (add dev setup instructions)
- `web/tests/integration/api-integration.spec.ts` (new)

---

## Acceptance Criteria

- [x] No more `spawn()` calls to Python CLI
- [x] API calls work end-to-end
- [x] Job status polling works
- [x] Plans save to database
- [x] Error handling works
- [x] Integration test passes
- [x] Documentation updated

---

## Next Card

**CARD_7.md** - Testing & Validation

# CARD 8: Add Integration Tests for Incremental Sync Flow

**Phase:** 2 - Auto-Incremental Sync
**Priority:** Medium
**Estimated Effort:** 45 minutes
**Dependencies:** CARD_5, CARD_6, CARD_7

---

## Objective

Create comprehensive integration tests for the complete incremental sync flow, covering API endpoint, service layer, job execution, and UI interaction. These tests verify the feature works end-to-end.

---

## Test Files to Create/Update

### 1. API Endpoint Tests

**File:** `web/app/api/strava/sync/route.test.ts` (create new)

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { POST } from './route'
import { createMockRequest, createMockUser } from '@/lib/test-utils'

describe('POST /api/strava/sync - Incremental Sync', () => {
  let mockUser: any
  let mockConnection: any

  beforeEach(() => {
    mockUser = createMockUser()
    mockConnection = {
      user_id: mockUser.id,
      strava_athlete_id: 12345,
      last_sync_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    }
  })

  describe('Incremental parameter handling', () => {
    it('should calculate after timestamp from last_sync_at with 1-hour buffer', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/strava/sync?incremental=true',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(202)
      expect(data.jobId).toBeDefined()

      // Verify job created with correct parameters
      const job = await getJob(data.jobId)
      expect(job.payload.syncOptions.after).toBeDefined()

      const expectedAfter = Math.floor(
        (mockConnection.last_sync_at.getTime() - 3600000) / 1000
      )
      expect(job.payload.syncOptions.after).toBe(expectedAfter)
    })

    it('should perform full sync when incremental=true but no last_sync_at', async () => {
      mockConnection.last_sync_at = null

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/strava/sync?incremental=true',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(202)

      const job = await getJob(data.jobId)
      expect(job.payload.syncOptions.after).toBeUndefined()
    })

    it('should prioritize explicit after param over incremental flag', async () => {
      const explicitAfter = 1704715200

      const request = createMockRequest({
        method: 'POST',
        url: `http://localhost:3000/api/strava/sync?incremental=true&after=${explicitAfter}`,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(202)

      const job = await getJob(data.jobId)
      expect(job.payload.syncOptions.after).toBe(explicitAfter)
    })
  })

  describe('Rate limiting', () => {
    it('should allow incremental sync within rate limit', async () => {
      const requests = []
      for (let i = 0; i < 3; i++) {
        requests.push(
          POST(
            createMockRequest({
              method: 'POST',
              url: 'http://localhost:3000/api/strava/sync?incremental=true',
            })
          )
        )
      }

      const responses = await Promise.all(requests)
      responses.forEach((response) => {
        expect(response.status).toBe(202)
      })
    })
  })
})
```

### 2. Service Layer Tests

**File:** `web/lib/services/strava-sync-service.test.ts` (update existing)

```typescript
describe('StravaSyncService - Incremental Sync', () => {
  describe('Sync metadata tracking', () => {
    it('should return full sync type when no after parameter', async () => {
      const result = await syncService.syncActivities(userId, {
        perPage: 30,
      })

      expect(result.success).toBe(true)
      expect(result.syncType).toBe('full')
      expect(result.syncedFrom).toBeUndefined()
    })

    it('should return incremental sync type with syncedFrom date', async () => {
      const afterTimestamp = 1704715200
      const result = await syncService.syncActivities(userId, {
        after: afterTimestamp,
      })

      expect(result.success).toBe(true)
      expect(result.syncType).toBe('incremental')
      expect(result.syncedFrom).toEqual(new Date('2024-01-08T10:00:00Z'))
    })
  })

  describe('Incremental sync behavior', () => {
    it('should fetch only activities after timestamp', async () => {
      const afterTimestamp = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60 // 7 days ago

      const result = await syncService.syncActivities(userId, {
        after: afterTimestamp,
        perPage: 30,
      })

      expect(result.success).toBe(true)
      expect(result.activitiesSynced).toBeLessThan(50) // Should only get recent activities

      // Verify Strava API called with after parameter
      expect(mockStravaService.getActivitiesWithRefresh).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          after: afterTimestamp,
        })
      )
    })
  })
})
```

### 3. End-to-End Integration Tests

**File:** `web/__tests__/integration/strava-incremental-sync.test.ts` (create new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { createTestUser, deleteTestUser, setLastSyncTime } from '@/lib/test-helpers'

describe('Strava Incremental Sync - End-to-End', () => {
  let testUser: any
  let authToken: string

  beforeAll(async () => {
    testUser = await createTestUser()
    authToken = await getAuthToken(testUser)
  })

  afterAll(async () => {
    await deleteTestUser(testUser.id)
  })

  it('should complete incremental sync workflow', async () => {
    // Step 1: Set last_sync_at to 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    await setLastSyncTime(testUser.id, sevenDaysAgo)

    // Step 2: Trigger incremental sync
    const syncResponse = await fetch('http://localhost:3000/api/strava/sync?incremental=true', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    expect(syncResponse.status).toBe(202)
    const syncData = await syncResponse.json()
    expect(syncData.jobId).toBeDefined()

    // Step 3: Poll job status until completion
    let job = null
    let attempts = 0
    while (attempts < 30) {
      const statusResponse = await fetch(
        `http://localhost:3000/api/strava/sync/status/${syncData.jobId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      )

      job = await statusResponse.json()

      if (job.status === 'completed' || job.status === 'failed') {
        break
      }

      await sleep(1000)
      attempts++
    }

    // Step 4: Verify job completed successfully
    expect(job.status).toBe('completed')
    expect(job.result).toBeDefined()
    expect(job.result.success).toBe(true)
    expect(job.result.syncType).toBe('incremental')
    expect(job.result.syncedFrom).toBeDefined()
    expect(job.result.activitiesSynced).toBeGreaterThanOrEqual(0)

    // Step 5: Verify last_sync_at was updated
    const connection = await getConnection(testUser.id)
    expect(new Date(connection.last_sync_at)).toBeAfter(sevenDaysAgo)

    // Step 6: Verify activities were stored
    if (job.result.activitiesSynced > 0) {
      const activities = await getActivities(testUser.id)
      expect(activities.length).toBeGreaterThan(0)
    }
  })

  it('should perform full sync when no last_sync_at exists', async () => {
    // Clear last_sync_at
    await clearLastSyncTime(testUser.id)

    const syncResponse = await fetch('http://localhost:3000/api/strava/sync?incremental=true', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    expect(syncResponse.status).toBe(202)
    const syncData = await syncResponse.json()

    const job = await pollJobUntilComplete(syncData.jobId, authToken)

    expect(job.status).toBe('completed')
    expect(job.result.syncType).toBe('full')
    expect(job.result.syncedFrom).toBeUndefined()
  })
})

// Helper functions
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollJobUntilComplete(jobId: string, authToken: string): Promise<any> {
  let attempts = 0
  while (attempts < 30) {
    const response = await fetch(`http://localhost:3000/api/strava/sync/status/${jobId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })

    const job = await response.json()

    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }

    await sleep(1000)
    attempts++
  }

  throw new Error('Job did not complete within timeout')
}
```

---

## Test Coverage Goals

### API Endpoint Tests
- [ ] Incremental parameter parsing
- [ ] `after` timestamp calculation with buffer
- [ ] Full sync fallback when no `last_sync_at`
- [ ] Explicit `after` parameter precedence
- [ ] Rate limiting with incremental sync

### Service Layer Tests
- [ ] Sync type detection (full vs incremental)
- [ ] `syncedFrom` timestamp conversion
- [ ] Metadata included in success result
- [ ] Metadata included in error result

### Integration Tests
- [ ] Complete incremental sync workflow
- [ ] Job creation and execution
- [ ] Job status polling
- [ ] `last_sync_at` update after sync
- [ ] Activities stored correctly
- [ ] Full sync fallback scenario

---

## Test Data Setup

### Test Fixtures

```typescript
// test-fixtures/strava.ts

export const mockStravaConnection = {
  user_id: 'test-user-123',
  strava_athlete_id: 12345,
  access_token: 'mock_access_token',
  refresh_token: 'mock_refresh_token',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  last_sync_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
}

export const mockStravaActivities = [
  {
    id: 1001,
    name: 'Morning Ride',
    type: 'Ride',
    sport_type: 'Ride',
    start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    moving_time: 3600,
    distance: 25000,
    weighted_average_watts: 200,
  },
  // ... more activities
]
```

---

## Running the Tests

```bash
# Run all tests
pnpm test

# Run integration tests only
pnpm test:integration

# Run specific test file
pnpm test web/app/api/strava/sync/route.test.ts

# Run with coverage
pnpm test --coverage
```

---

## Acceptance Criteria

- [ ] API endpoint tests created and passing
- [ ] Service layer tests updated and passing
- [ ] End-to-end integration tests created and passing
- [ ] Test coverage for incremental sync > 80%
- [ ] All edge cases covered (no `last_sync_at`, explicit `after`, etc.)
- [ ] Tests run successfully in CI/CD pipeline
- [ ] Test fixtures created for reusability

---

## Next Steps

After completing this card, **Phase 2 is complete**. The implementation is ready for:

1. **Code review** - Review all changes across 8 cards
2. **Manual QA testing** - Test on staging environment
3. **Merge to main** - Deploy to production
4. **Monitor metrics** - Track sync performance, API usage, TSS calculation success rate

---

## Future Test Enhancements (Out of Scope)

- Performance tests for large datasets (1000+ activities)
- Load tests for concurrent sync requests
- Webhook + incremental sync interaction tests
- UI component snapshot tests

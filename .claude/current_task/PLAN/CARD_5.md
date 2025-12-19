# CARD 5: Update Sync API Endpoint for Incremental Sync

**Phase:** 2 - Auto-Incremental Sync
**Priority:** High
**Estimated Effort:** 45 minutes
**Dependencies:** None (independent of Phase 1)

---

## Objective

Add `incremental` query parameter support to the sync API endpoint. When `incremental=true`, automatically calculate the `after` timestamp from `last_sync_at - 1 hour buffer` to sync only new activities.

---

## Changes Required

### File: `web/app/api/strava/sync/route.ts`

**Add incremental parameter handling (after line 112, in the parameter parsing section):**

**Current code:**

```typescript
const syncOptions: {
  after?: number
  perPage?: number
  maxPages?: number
} = {}

const afterParam = searchParams.get('after')
if (afterParam) {
  const after = parseInt(afterParam, 10)
  if (isNaN(after) || after < 0) {
    return NextResponse.json(
      { error: 'after must be a positive Unix timestamp' },
      { status: 400 }
    )
  }
  syncOptions.after = after
}
```

**New code:**

```typescript
const syncOptions: {
  after?: number
  perPage?: number
  maxPages?: number
} = {}

// NEW: Handle incremental sync parameter
const incrementalParam = searchParams.get('incremental')
const isIncremental = incrementalParam === 'true'

const afterParam = searchParams.get('after')
if (afterParam) {
  // Explicit 'after' parameter takes precedence
  const after = parseInt(afterParam, 10)
  if (isNaN(after) || after < 0) {
    return NextResponse.json(
      { error: 'after must be a positive Unix timestamp' },
      { status: 400 }
    )
  }
  syncOptions.after = after
} else if (isIncremental) {
  // NEW: Auto-calculate 'after' from last_sync_at
  const syncService = new StravaSyncService()
  const lastSync = await syncService.getLastSyncTime(user.id)

  if (lastSync) {
    // Subtract 1 hour buffer to catch edge cases (late uploads, clock skew, etc.)
    const bufferMs = 60 * 60 * 1000 // 1 hour in milliseconds
    syncOptions.after = Math.floor((lastSync.getTime() - bufferMs) / 1000)

    errorLogger.logInfo('Incremental sync from last_sync_at', {
      userId: user.id,
      metadata: {
        lastSyncAt: lastSync.toISOString(),
        afterTimestamp: syncOptions.after,
        bufferHours: 1,
      },
    })
  } else {
    // No previous sync, perform full sync
    errorLogger.logInfo('No previous sync found, performing full sync', {
      userId: user.id,
    })
  }
  // If no lastSync, syncOptions.after remains undefined (full sync)
}
```

---

## Implementation Notes

### Parameter Precedence

1. **Explicit `after` parameter** - Highest priority, overrides everything
2. **Incremental flag** - Uses `last_sync_at - 1 hour` if available
3. **Default behavior** - Full sync (no `after` parameter)

### Buffer Rationale

The 1-hour buffer ensures we don't miss activities due to:
- **Late uploads** - Athletes upload activities hours/days after completion
- **Clock skew** - Slight differences between server clocks
- **Processing delays** - Edge cases where `last_sync_at` was updated before all activities processed

This slight overlap is acceptable because:
- Duplicate activities are handled by `UNIQUE(strava_activity_id)` constraint
- Upsert operation updates existing activities
- Minimal performance impact (1 hour of activities is usually 0-5 activities)

### Sync Type Logic

| Scenario | `incremental` param | `last_sync_at` | Result |
|----------|-------------------|---------------|--------|
| First sync | true | NULL | Full sync (no `after`) |
| Subsequent sync | true | 2024-01-15 10:00 | Incremental (after = 2024-01-15 09:00) |
| Explicit after | false | any | Uses explicit `after` timestamp |
| Default | false | any | Full sync (no `after`) |

### Logging Strategy

- **Info** - Incremental sync with `last_sync_at` details
- **Info** - No previous sync found (fallback to full)

---

## Testing

### Unit Tests

```typescript
describe('Incremental Sync Parameter Handling', () => {
  it('should calculate after from last_sync_at with 1-hour buffer', async () => {
    const lastSync = new Date('2024-01-15T10:00:00Z')
    const expectedAfter = Math.floor((lastSync.getTime() - 3600000) / 1000)

    mockSyncService.getLastSyncTime.mockResolvedValue(lastSync)

    const response = await POST('/api/strava/sync?incremental=true')

    expect(response.status).toBe(202)
    expect(mockSyncService.syncActivities).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        after: expectedAfter,
      })
    )
  })

  it('should perform full sync when incremental=true but no last_sync_at', async () => {
    mockSyncService.getLastSyncTime.mockResolvedValue(null)

    const response = await POST('/api/strava/sync?incremental=true')

    expect(response.status).toBe(202)
    expect(mockSyncService.syncActivities).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        after: expect.anything(),
      })
    )
  })

  it('should prioritize explicit after param over incremental', async () => {
    const explicitAfter = 1234567890

    const response = await POST('/api/strava/sync?incremental=true&after=1234567890')

    expect(response.status).toBe(202)
    expect(mockSyncService.syncActivities).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        after: explicitAfter,
      })
    )
  })

  it('should perform full sync when incremental is not specified', async () => {
    const response = await POST('/api/strava/sync')

    expect(response.status).toBe(202)
    expect(mockSyncService.syncActivities).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        after: expect.anything(),
      })
    )
  })
})
```

### Integration Tests

```typescript
describe('Incremental Sync Integration', () => {
  beforeEach(async () => {
    // Set last_sync_at to 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    await setLastSyncTime(userId, sevenDaysAgo)
  })

  it('should sync only recent activities with incremental flag', async () => {
    const response = await POST('/api/strava/sync?incremental=true')

    expect(response.status).toBe(202)

    // Poll job status until completion
    const job = await pollJobStatus(response.data.jobId)

    expect(job.status).toBe('completed')
    expect(job.result.activitiesSynced).toBeLessThan(50) // Only recent activities
  })

  it('should sync all activities without incremental flag', async () => {
    const response = await POST('/api/strava/sync')

    expect(response.status).toBe(202)

    const job = await pollJobStatus(response.data.jobId)

    expect(job.status).toBe('completed')
    expect(job.result.activitiesSynced).toBeGreaterThan(100) // All activities
  })
})
```

### Manual Testing

1. **First sync (no last_sync_at):**
   ```bash
   curl -X POST "http://localhost:3000/api/strava/sync?incremental=true"
   # Should perform full sync (no after param)
   ```

2. **Subsequent incremental sync:**
   ```bash
   # After first sync completes, run again
   curl -X POST "http://localhost:3000/api/strava/sync?incremental=true"
   # Should sync from last_sync_at - 1 hour
   ```

3. **Explicit after param:**
   ```bash
   curl -X POST "http://localhost:3000/api/strava/sync?after=1704715200"
   # Should use exact timestamp
   ```

4. **Verify logs:**
   ```
   Check app.log for:
   - "Incremental sync from last_sync_at" with timestamp details
   - "No previous sync found, performing full sync"
   ```

---

## Acceptance Criteria

- [ ] `incremental` query parameter parsed correctly
- [ ] `last_sync_at` fetched from database when `incremental=true`
- [ ] `after` timestamp calculated with 1-hour buffer
- [ ] Explicit `after` param takes precedence over incremental
- [ ] Full sync performed when `incremental=true` but no `last_sync_at`
- [ ] Logging added for incremental sync details
- [ ] TypeScript compilation passes
- [ ] No linting errors
- [ ] Existing sync tests still pass

---

## Edge Cases

| Edge Case | Behavior |
|-----------|----------|
| `incremental=false` | Ignored, performs full sync |
| `incremental=true&after=123` | Uses explicit `after`, ignores incremental logic |
| `last_sync_at` in future | Calculates negative `after`, API returns no activities |
| `last_sync_at` = now | Uses (now - 1 hour), syncs recent activities |

---

## Next Steps

After completing this card, proceed to **CARD_6** to update the `StravaSyncService` to track sync type metadata in the `SyncResult` interface.

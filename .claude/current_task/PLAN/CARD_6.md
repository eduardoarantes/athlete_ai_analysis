# CARD 6: Update StravaSyncService to Track Sync Type Metadata

**Phase:** 2 - Auto-Incremental Sync
**Priority:** Medium
**Estimated Effort:** 30 minutes
**Dependencies:** CARD_5

---

## Objective

Update the `SyncResult` interface and `StravaSyncService.syncActivities()` method to track whether a sync was incremental or full, and include the sync start timestamp. This metadata helps with debugging, monitoring, and displaying sync information to users.

---

## Changes Required

### File: `web/lib/services/strava-sync-service.ts`

**Update SyncResult interface (lines 15-19):**

**Current code:**

```typescript
export interface SyncResult {
  success: boolean
  activitiesSynced: number
  error?: string
}
```

**New code:**

```typescript
export interface SyncResult {
  success: boolean
  activitiesSynced: number
  error?: string
  // NEW: Sync metadata
  syncType: 'full' | 'incremental'
  syncedFrom?: Date // Only for incremental syncs
}
```

**Update syncActivities method (lines 38-96):**

**Add sync type tracking at the beginning of the method (after line 45):**

```typescript
async syncActivities(
  userId: string,
  options?: {
    after?: number
    perPage?: number
    maxPages?: number
  }
): Promise<SyncResult> {
  // NEW: Determine sync type based on 'after' parameter
  const syncType: 'full' | 'incremental' = options?.after ? 'incremental' : 'full'
  const syncedFrom = options?.after ? new Date(options.after * 1000) : undefined

  try {
    // NOTE: sync_status is already set to 'syncing' atomically by the API endpoint
    // to prevent race conditions. We don't set it here.
```

**Update success return (line 91):**

**Current code:**

```typescript
return {
  success: true,
  activitiesSynced: totalSynced,
}
```

**New code:**

```typescript
return {
  success: true,
  activitiesSynced: totalSynced,
  syncType,
  syncedFrom,
}
```

**Update error return (line 111):**

**Current code:**

```typescript
return {
  success: false,
  activitiesSynced: 0,
  error: errorMessage,
}
```

**New code:**

```typescript
return {
  success: false,
  activitiesSynced: 0,
  error: errorMessage,
  syncType,
  syncedFrom,
}
```

---

## Implementation Notes

### Sync Type Detection

```typescript
// Full sync (no 'after' parameter)
options = undefined
→ syncType = 'full', syncedFrom = undefined

// Full sync (explicit, no 'after')
options = { perPage: 50 }
→ syncType = 'full', syncedFrom = undefined

// Incremental sync
options = { after: 1704715200 }
→ syncType = 'incremental', syncedFrom = new Date('2024-01-08T10:00:00Z')
```

### Type Safety

The `SyncResult` interface is used by:
- `executeStravaSyncJob` in `web/lib/jobs/strava-sync-job.ts`
- Job result storage in `sync_jobs` table
- UI components displaying sync status

Adding optional fields (`syncType`, `syncedFrom?`) maintains backward compatibility.

### Timestamp Conversion

```typescript
// Unix timestamp (seconds) → JavaScript Date
const syncedFrom = new Date(options.after * 1000)
```

This converts the Strava API format (Unix timestamp in seconds) to JavaScript Date for easier handling in the UI.

---

## Testing

### Unit Tests

```typescript
describe('StravaSyncService - Sync Metadata', () => {
  it('should return full sync type when no after parameter', async () => {
    const result = await syncService.syncActivities(userId, {
      perPage: 30,
    })

    expect(result.syncType).toBe('full')
    expect(result.syncedFrom).toBeUndefined()
  })

  it('should return incremental sync type with syncedFrom', async () => {
    const afterTimestamp = 1704715200 // 2024-01-08 10:00:00 UTC
    const result = await syncService.syncActivities(userId, {
      after: afterTimestamp,
      perPage: 30,
    })

    expect(result.syncType).toBe('incremental')
    expect(result.syncedFrom).toEqual(new Date('2024-01-08T10:00:00Z'))
  })

  it('should include sync metadata on error', async () => {
    // Mock Strava API failure
    mockStravaService.getActivitiesWithRefresh.mockRejectedValue(
      new Error('API error')
    )

    const result = await syncService.syncActivities(userId, {
      after: 1704715200,
    })

    expect(result.success).toBe(false)
    expect(result.syncType).toBe('incremental')
    expect(result.syncedFrom).toBeDefined()
  })
})
```

### Integration Tests

```typescript
describe('Sync Metadata End-to-End', () => {
  it('should store sync metadata in job result', async () => {
    const response = await POST('/api/strava/sync?incremental=true')
    const jobId = response.data.jobId

    // Wait for job completion
    const job = await pollJobStatus(jobId)

    expect(job.result.syncType).toMatch(/full|incremental/)
    if (job.result.syncType === 'incremental') {
      expect(job.result.syncedFrom).toBeDefined()
    }
  })
})
```

### Manual Testing

1. **Full sync:**
   ```bash
   curl -X POST "http://localhost:3000/api/strava/sync"
   # Check job result: syncType = 'full', syncedFrom = undefined
   ```

2. **Incremental sync:**
   ```bash
   curl -X POST "http://localhost:3000/api/strava/sync?incremental=true"
   # Check job result: syncType = 'incremental', syncedFrom = <timestamp>
   ```

3. **Verify job result:**
   ```sql
   SELECT result FROM sync_jobs
   WHERE type = 'strava_sync'
   ORDER BY created_at DESC LIMIT 1;

   -- Expected:
   {
     "success": true,
     "activitiesSynced": 10,
     "syncType": "incremental",
     "syncedFrom": "2024-01-08T10:00:00.000Z"
   }
   ```

---

## Acceptance Criteria

- [ ] `SyncResult` interface updated with `syncType` and `syncedFrom?`
- [ ] `syncType` determined based on `options?.after` parameter
- [ ] `syncedFrom` converted from Unix timestamp to JavaScript Date
- [ ] Success result includes sync metadata
- [ ] Error result includes sync metadata
- [ ] TypeScript compilation passes
- [ ] No linting errors
- [ ] Existing sync tests updated and pass
- [ ] Job results store sync metadata correctly

---

## Impact Analysis

### Files Affected

1. **`web/lib/services/strava-sync-service.ts`** - Interface and method updates
2. **`web/lib/jobs/strava-sync-job.ts`** - No changes (backward compatible)
3. **Job result storage** - Automatically includes new fields
4. **UI components** - Can now display sync type to users (CARD_7)

### Backward Compatibility

The changes are **backward compatible** because:
- `syncType` has a default value (always set)
- `syncedFrom` is optional (`?`)
- Existing code that doesn't use these fields continues to work

---

## Next Steps

After completing this card, proceed to **CARD_7** to update the UI component to display sync options and use the new sync metadata.

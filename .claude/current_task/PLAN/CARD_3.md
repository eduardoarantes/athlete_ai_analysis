# CARD 3: Add TSS Calculation to Webhook Activity Upsert

**Phase:** 1 - Fix Webhook Processing
**Priority:** High
**Estimated Effort:** 30 minutes
**Dependencies:** CARD_1, CARD_2

---

## Objective

Integrate TSS calculation into the webhook activity upsert logic using the helper functions from CARD_1. This ensures all activities synced via webhooks include TSS data for training load tracking.

---

## Changes Required

### File: `web/app/api/webhooks/strava/route.ts`

**Replace lines 197-220 (activity upsert block in `processWebhookEvent`):**

**Current code:**

```typescript
// Upsert activity to database
await supabase.from('strava_activities').upsert(
  {
    user_id: connection.user_id,
    strava_activity_id: activity.id,
    name: activity.name,
    type: activity.type,
    sport_type: activity.sport_type,
    start_date: activity.start_date,
    distance: activity.distance,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    total_elevation_gain: activity.total_elevation_gain,
    average_watts: activity.average_watts,
    max_watts: activity.max_watts,
    weighted_average_watts: activity.weighted_average_watts,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    raw_data: activity,
  } as never,
  {
    onConflict: 'strava_activity_id',
  }
)
```

**New code:**

```typescript
// Fetch athlete data for TSS calculation
const athleteData = await getAthleteDataForWebhook(connection.user_id)

// Calculate TSS using helper function from CARD_1
const tssResult = calculateWebhookActivityTSS(activity, athleteData)

// Upsert activity to database WITH TSS data
await supabase.from('strava_activities').upsert(
  {
    user_id: connection.user_id,
    strava_activity_id: activity.id,
    name: activity.name,
    type: activity.type,
    sport_type: activity.sport_type,
    start_date: activity.start_date,
    distance: activity.distance,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    total_elevation_gain: activity.total_elevation_gain,
    average_watts: activity.average_watts,
    max_watts: activity.max_watts,
    weighted_average_watts: activity.weighted_average_watts,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    raw_data: activity,
    // NEW: TSS fields
    tss: tssResult?.tss ?? null,
    tss_method: tssResult?.method ?? null,
  } as never,
  {
    onConflict: 'strava_activity_id',
  }
)
```

**Update log message (line 222):**

**Current code:**

```typescript
errorLogger.logInfo('Webhook synced activity', {
  userId: connection.user_id,
  metadata: { activityId: event.object_id, aspectType: event.aspect_type },
})
```

**New code:**

```typescript
errorLogger.logInfo('Webhook synced activity with TSS', {
  userId: connection.user_id,
  metadata: {
    activityId: event.object_id,
    aspectType: event.aspect_type,
    tss: tssResult?.tss ?? null,
    tssMethod: tssResult?.method ?? null,
    tssConfidence: tssResult?.confidence ?? null,
  },
})
```

---

## Implementation Notes

### TSS Calculation Flow

```
1. Fetch athlete profile (getAthleteDataForWebhook)
   ↓
2. Calculate TSS (calculateWebhookActivityTSS)
   ↓
3. Upsert activity with TSS fields
   ↓
4. Log result with TSS metadata
```

### Graceful Degradation

- If athlete profile not found → `athleteData = null`
- If TSS calculation fails → `tssResult = null`
- Activity is still stored with `tss: null, tss_method: null`
- No errors thrown, webhook processing continues

### TSS Methods

The `tss_method` field will be one of:
- `'power'` - Calculated from power data (most accurate)
- `'heart_rate'` - Calculated from HR data (fallback)
- `'estimated'` - Estimated from other metrics (lowest accuracy)
- `null` - Insufficient data for calculation

### Database Fields

The `strava_activities` table already has these fields (from migration `20251215000004_add_tss_fields.sql`):
- `tss NUMERIC`
- `tss_method TEXT CHECK (tss_method IN ('power', 'heart_rate', 'estimated'))`

---

## Testing

### Unit Tests

```typescript
describe('Webhook TSS Integration', () => {
  it('should store activity with TSS from power data', async () => {
    const activity = {
      id: 123456,
      moving_time: 3600,
      weighted_average_watts: 200,
      // ... other fields
    }

    const athleteData = { ftp: 250 }

    await processWebhookEvent(mockEvent)

    const stored = await getStoredActivity(123456)
    expect(stored.tss).toBeGreaterThan(0)
    expect(stored.tss_method).toBe('power')
  })

  it('should store activity with null TSS when no athlete profile', async () => {
    // Mock missing athlete profile
    mockGetAthleteDataForWebhook.mockResolvedValue(null)

    await processWebhookEvent(mockEvent)

    const stored = await getStoredActivity(123456)
    expect(stored.tss).toBeNull()
    expect(stored.tss_method).toBeNull()
  })

  it('should store activity with hrTSS when no power data', async () => {
    const activity = {
      id: 123456,
      moving_time: 3600,
      average_heartrate: 150,
      // No power data
    }

    const athleteData = { maxHr: 186, restingHr: 55 }

    await processWebhookEvent(mockEvent)

    const stored = await getStoredActivity(123456)
    expect(stored.tss).toBeGreaterThan(0)
    expect(stored.tss_method).toBe('heart_rate')
  })
})
```

### Integration Tests

```typescript
describe('Webhook TSS End-to-End', () => {
  it('should sync activity with TSS via webhook', async () => {
    // Create athlete profile with FTP
    await createAthleteProfile(userId, { ftp: 265, max_hr: 186 })

    // Trigger webhook
    const response = await POST('/api/webhooks/strava', {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 123456,
      owner_id: athleteId,
    })

    expect(response.status).toBe(200)

    // Wait for processing
    await sleep(1000)

    // Verify activity stored with TSS
    const activity = await db.strava_activities.findOne({
      strava_activity_id: 123456,
    })

    expect(activity).not.toBeNull()
    expect(activity.tss).toBeGreaterThan(0)
    expect(activity.tss_method).toMatch(/power|heart_rate/)
  })
})
```

### Manual Testing

1. Create athlete profile with FTP and max HR
2. Create activity on Strava (ensure it has power or HR data)
3. Webhook triggers automatically
4. Check database:
   ```sql
   SELECT strava_activity_id, name, tss, tss_method
   FROM strava_activities
   ORDER BY created_at DESC
   LIMIT 5;
   ```
5. Verify TSS values are populated
6. Check logs for TSS calculation details

---

## Acceptance Criteria

- [ ] Athlete profile fetched before TSS calculation
- [ ] TSS calculated using `calculateWebhookActivityTSS`
- [ ] Activity upserted with `tss` and `tss_method` fields
- [ ] Log message includes TSS metadata
- [ ] Graceful handling when athlete profile missing
- [ ] TypeScript compilation passes
- [ ] No linting errors
- [ ] Database stores TSS values correctly

---

## Rollback Plan

If this change causes issues:

1. Remove the three new lines:
   ```typescript
   const athleteData = await getAthleteDataForWebhook(connection.user_id)
   const tssResult = calculateWebhookActivityTSS(activity, athleteData)
   // Remove tss fields from upsert
   ```

2. Restore original upsert without TSS fields

3. Database will accept NULL values for TSS fields (no schema changes needed)

---

## Next Steps

After completing this card, proceed to **CARD_4** to add comprehensive error handling and logging for TSS calculation failures.

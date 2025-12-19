# CARD 4: Add Error Handling and Logging for Webhook TSS

**Phase:** 1 - Fix Webhook Processing
**Priority:** Medium
**Estimated Effort:** 20 minutes
**Dependencies:** CARD_3

---

## Objective

Add comprehensive error handling and logging for TSS calculation failures in the webhook handler. This ensures visibility into TSS calculation issues and provides graceful degradation when TSS cannot be calculated.

---

## Changes Required

### File: `web/app/api/webhooks/strava/route.ts`

**Wrap TSS calculation in try-catch (in `processWebhookEvent`):**

**Current code (from CARD_3):**

```typescript
// Fetch athlete data for TSS calculation
const athleteData = await getAthleteDataForWebhook(connection.user_id)

// Calculate TSS using helper function from CARD_1
const tssResult = calculateWebhookActivityTSS(activity, athleteData)
```

**New code:**

```typescript
// Fetch athlete data for TSS calculation
let tssResult: TSSResult | null = null
try {
  const athleteData = await getAthleteDataForWebhook(connection.user_id)
  tssResult = calculateWebhookActivityTSS(activity, athleteData)

  if (tssResult) {
    errorLogger.logInfo('TSS calculated for webhook activity', {
      userId: connection.user_id,
      metadata: {
        activityId: event.object_id,
        tss: tssResult.tss,
        method: tssResult.method,
        confidence: tssResult.confidence,
      },
    })
  } else {
    errorLogger.logWarning('TSS calculation returned null', {
      userId: connection.user_id,
      metadata: {
        activityId: event.object_id,
        reason: athleteData ? 'Insufficient activity data' : 'Missing athlete profile',
        hasAthleteData: !!athleteData,
        hasPowerData: !!(activity.weighted_average_watts || activity.average_watts),
        hasHRData: !!activity.average_heartrate,
      },
    })
  }
} catch (tssError) {
  // Don't fail the entire webhook processing if TSS calculation fails
  errorLogger.logWarning('TSS calculation failed for webhook activity', {
    userId: connection.user_id,
    metadata: {
      activityId: event.object_id,
      error: tssError instanceof Error ? tssError.message : 'Unknown error',
      activityType: activity.type,
    },
  })
  // tssResult remains null, activity will be stored without TSS
}
```

---

## Implementation Notes

### Error Handling Strategy

1. **Non-blocking failures** - TSS calculation errors don't stop webhook processing
2. **Detailed logging** - Log why TSS calculation failed for debugging
3. **Graceful degradation** - Store activity with `tss: null` if calculation fails
4. **Visibility** - Use warning logs for missing data (not errors)

### Log Levels

- **Info** - TSS calculated successfully
- **Warning** - TSS calculation returned null (missing data, not an error)
- **Warning** - TSS calculation threw exception (unexpected error)

### Diagnostic Metadata

The warning log includes diagnostic information:
- `reason` - Why TSS calculation failed
- `hasAthleteData` - Whether athlete profile was found
- `hasPowerData` - Whether activity has power metrics
- `hasHRData` - Whether activity has heart rate data

This helps diagnose issues like:
- Missing athlete profile
- Activity without power or HR data
- Incomplete athlete profile (missing FTP or max HR)

### Expected Scenarios

| Scenario | Log Level | TSS Result |
|----------|-----------|------------|
| FTP + Power data available | Info | TSS calculated (power method) |
| Max HR + HR data available | Info | TSS calculated (heart_rate method) |
| No athlete profile | Warning | null (stored without TSS) |
| Athlete profile without FTP/HR | Warning | null (stored without TSS) |
| Activity without metrics | Warning | null (stored without TSS) |
| Unexpected exception | Warning | null (stored without TSS) |

---

## Testing

### Unit Tests

```typescript
describe('Webhook TSS Error Handling', () => {
  it('should log warning when athlete profile missing', async () => {
    mockGetAthleteDataForWebhook.mockResolvedValue(null)

    await processWebhookEvent(mockEvent)

    expect(errorLogger.logWarning).toHaveBeenCalledWith(
      'TSS calculation returned null',
      expect.objectContaining({
        metadata: expect.objectContaining({
          reason: 'Missing athlete profile',
          hasAthleteData: false,
        }),
      })
    )
  })

  it('should log warning when activity has no power or HR data', async () => {
    const activity = {
      id: 123456,
      moving_time: 3600,
      // No power or HR data
    }

    mockGetAthleteDataForWebhook.mockResolvedValue({ ftp: 265 })

    await processWebhookEvent(mockEvent)

    expect(errorLogger.logWarning).toHaveBeenCalledWith(
      'TSS calculation returned null',
      expect.objectContaining({
        metadata: expect.objectContaining({
          reason: 'Insufficient activity data',
          hasAthleteData: true,
          hasPowerData: false,
          hasHRData: false,
        }),
      })
    )
  })

  it('should continue webhook processing when TSS fails', async () => {
    mockCalculateWebhookActivityTSS.mockImplementation(() => {
      throw new Error('TSS calculation error')
    })

    await processWebhookEvent(mockEvent)

    // Webhook should still succeed
    expect(mockUpsert).toHaveBeenCalled()

    // Error should be logged
    expect(errorLogger.logWarning).toHaveBeenCalledWith(
      'TSS calculation failed for webhook activity',
      expect.any(Object)
    )
  })

  it('should log success when TSS calculated', async () => {
    const tssResult = { tss: 85.5, method: 'power', confidence: 'high' }
    mockCalculateWebhookActivityTSS.mockReturnValue(tssResult)

    await processWebhookEvent(mockEvent)

    expect(errorLogger.logInfo).toHaveBeenCalledWith(
      'TSS calculated for webhook activity',
      expect.objectContaining({
        metadata: expect.objectContaining({
          tss: 85.5,
          method: 'power',
          confidence: 'high',
        }),
      })
    )
  })
})
```

### Manual Testing

1. **Test successful TSS calculation:**
   - Create activity with power data on Strava
   - Check logs for "TSS calculated for webhook activity"

2. **Test missing athlete profile:**
   - Delete athlete profile
   - Create activity on Strava
   - Check logs for "TSS calculation returned null" with reason "Missing athlete profile"

3. **Test activity without metrics:**
   - Create activity without power or HR data (e.g., manual entry)
   - Check logs for "Insufficient activity data"

4. **Test TSS calculation exception:**
   - Simulate database error in athlete profile fetch
   - Verify webhook still processes and logs warning

---

## Acceptance Criteria

- [ ] TSS calculation wrapped in try-catch block
- [ ] Success logged with TSS details (info level)
- [ ] Null result logged with diagnostic data (warning level)
- [ ] Exceptions logged with error message (warning level)
- [ ] Webhook processing continues even if TSS fails
- [ ] Activity stored with `tss: null` on TSS failure
- [ ] TypeScript compilation passes
- [ ] No linting errors

---

## Monitoring

After deployment, monitor logs for:

```typescript
// Expected INFO logs (successful TSS)
"TSS calculated for webhook activity" - userId: abc123, tss: 85.5, method: power

// Expected WARNING logs (missing data)
"TSS calculation returned null" - reason: Missing athlete profile
"TSS calculation returned null" - reason: Insufficient activity data

// Unexpected WARNING logs (need investigation)
"TSS calculation failed for webhook activity" - error: <exception message>
```

If you see frequent warnings, it may indicate:
- Users not completing athlete profiles
- Strava activities without required metrics
- Bug in TSS calculation logic

---

## Next Steps

After completing this card, **Phase 1 is complete**. Proceed to **Phase 2** starting with **CARD_5** to implement auto-incremental sync in the sync API endpoint.

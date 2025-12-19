# CARD 2: Update Webhook Event Processor with Token Refresh

**Phase:** 1 - Fix Webhook Processing
**Priority:** High
**Estimated Effort:** 45 minutes
**Dependencies:** CARD_1

---

## Objective

Update the `processWebhookEvent` function to use `StravaService.getValidAccessToken()` for automatic token refresh before fetching activity details from the Strava API. This ensures webhook processing doesn't fail due to expired tokens.

---

## Changes Required

### File: `web/app/api/webhooks/strava/route.ts`

**Replace lines 180-195 (the create/update block in `processWebhookEvent`):**

**Current code:**

```typescript
} else {
  // For create/update: fetch activity details from Strava
  const activityResponse = await fetch(
    `https://www.strava.com/api/v3/activities/${event.object_id}`,
    {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,  // ← PROBLEM: No token refresh
      },
    }
  )

  if (!activityResponse.ok) {
    throw new Error(`Strava API error: ${activityResponse.statusText}`)
  }

  const activity = await activityResponse.json()
```

**New code:**

```typescript
} else {
  // For create/update: fetch activity details from Strava
  const stravaService = new StravaService()
  
  // Get valid access token (refreshes automatically if expired)
  const accessToken = await stravaService.getValidAccessToken(connection.user_id)

  const activityResponse = await fetch(
    `https://www.strava.com/api/v3/activities/${event.object_id}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,  // ← FIXED: Uses refreshed token
      },
    }
  )

  if (!activityResponse.ok) {
    throw new Error(`Strava API error: ${activityResponse.statusText}`)
  }

  const activity = await activityResponse.json()

  errorLogger.logInfo('Fetched activity from Strava API', {
    userId: connection.user_id,
    metadata: {
      activityId: event.object_id,
      activityType: activity.type,
      activityName: activity.name,
    },
  })
```

---

## Implementation Notes

### Why This Change Matters

**Before:**
- Uses `connection.access_token` directly from database
- Token may be expired (tokens expire after 6 hours)
- API call fails with 401 Unauthorized
- Webhook event marked as failed, never retried

**After:**
- Calls `getValidAccessToken(userId)` which checks `expires_at`
- If token expires within 5 minutes, automatically refreshes it
- Updates database with new tokens
- API call succeeds even with expired tokens

### Token Refresh Flow

```
getValidAccessToken(userId)
  ↓
Check expires_at from database
  ↓
Is token expired or expiring soon?
  ↓ YES
Refresh token via Strava API
  ↓
Update database with new access_token, refresh_token, expires_at
  ↓
Return new access_token
```

### Error Handling

If token refresh fails:
- `getValidAccessToken()` throws an error
- Caught by outer try/catch in `processWebhookEvent`
- Event marked as failed with error message
- Can be retried later

---

## Testing

### Unit Tests

```typescript
describe('Webhook Token Refresh', () => {
  it('should refresh expired token before fetching activity', async () => {
    // Mock expired token
    mockConnection.expires_at = new Date(Date.now() - 3600000) // 1 hour ago

    // Mock Strava API refresh response
    mockStravaService.refreshAccessToken.mockResolvedValue({
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      expires_at: Math.floor(Date.now() / 1000) + 21600,
    })

    await processWebhookEvent(mockEvent)

    // Verify token was refreshed
    expect(mockStravaService.refreshAccessToken).toHaveBeenCalled()
    
    // Verify activity fetch used new token
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer new_token' }
      })
    )
  })

  it('should use existing token if not expired', async () => {
    // Mock valid token
    mockConnection.expires_at = new Date(Date.now() + 3600000) // 1 hour from now

    await processWebhookEvent(mockEvent)

    // Verify token was NOT refreshed
    expect(mockStravaService.refreshAccessToken).not.toHaveBeenCalled()
    
    // Verify activity fetch used existing token
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${mockConnection.access_token}` }
      })
    )
  })
})
```

### Integration Tests

```typescript
describe('Webhook Integration - Token Refresh', () => {
  it('should handle webhook with expired token', async () => {
    // Set connection token to expired
    await setTokenExpired(userId)

    // Send webhook event
    const response = await POST('/api/webhooks/strava', {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 123456,
      owner_id: athleteId,
    })

    expect(response.status).toBe(200)

    // Verify activity was synced
    const activity = await getActivity(123456)
    expect(activity).not.toBeNull()

    // Verify token was refreshed in database
    const connection = await getConnection(userId)
    expect(new Date(connection.expires_at)).toBeAfter(new Date())
  })
})
```

### Manual Testing

1. Create test Strava connection with expired token
2. Trigger webhook by creating activity on Strava
3. Check logs for token refresh message
4. Verify activity synced successfully
5. Verify database has updated `access_token` and `expires_at`

---

## Acceptance Criteria

- [ ] `processWebhookEvent` calls `stravaService.getValidAccessToken()`
- [ ] Token is refreshed automatically if expired
- [ ] Activity fetch uses refreshed token
- [ ] Log message added for successful activity fetch
- [ ] Error handling preserves existing behavior
- [ ] TypeScript compilation passes
- [ ] No linting errors
- [ ] Existing webhook tests still pass

---

## Rollback Plan

If this change causes issues:

1. Revert the change to restore original code:
   ```typescript
   Authorization: `Bearer ${connection.access_token}`
   ```

2. The database schema is unchanged, so no data migration needed

3. Re-deploy previous version

---

## Next Steps

After completing this card, proceed to **CARD_3** to add TSS calculation to the activity upsert logic.

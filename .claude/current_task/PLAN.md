# Strava Incremental Sync Implementation Plan

**Created:** 2025-12-19
**Status:** Ready for Execution
**Priority:** High
**Estimated Effort:** 5-7 hours

---

## Executive Summary

This implementation plan covers **Phase 1** (Fix Webhook Processing) and **Phase 2** (Auto-Incremental Sync) of the Strava Incremental Sync feature. These two phases provide the highest value with reasonable effort and are independent of Phase 3 (Webhook Auto-Registration) and Phase 4 (Background Sync).

### Current State Problems

1. **Webhook handler doesn't calculate TSS** - Activities synced via webhooks have `tss: null`, leading to incomplete training load data
2. **Webhook handler doesn't refresh tokens** - Uses stored `access_token` directly, causing sync failures when tokens expire
3. **Manual sync doesn't use `last_sync_at` automatically** - Users must manually specify `after` parameter, causing UX friction and wasted API calls
4. **No incremental sync option in UI** - Users only have a full sync button, no way to sync just new activities

### Solution Overview

**Phase 1: Fix Webhook Processing**
- Add token refresh to webhook handler using existing `StravaService.getValidAccessToken()`
- Add TSS calculation to webhook handler using existing `calculateTSS()` function
- Fetch athlete profile data for TSS calculation
- Update activity upsert to include TSS fields

**Phase 2: Auto-Incremental Sync**
- Add `incremental` query parameter to sync API endpoint
- Auto-calculate `after` timestamp from `last_sync_at - 1 hour buffer`
- Update `SyncResult` interface to include sync metadata
- Update UI to show dropdown with "Sync New Activities" vs "Full Re-sync" options

### Success Criteria

- [ ] Webhook-synced activities have TSS calculated and stored
- [ ] Webhook handler refreshes tokens automatically
- [ ] Incremental sync works with `?incremental=true` parameter
- [ ] UI shows sync options dropdown for users with existing syncs
- [ ] First-time sync still performs full sync (no `last_sync_at` yet)
- [ ] All existing tests pass
- [ ] New integration tests validate incremental sync behavior

---

## Architecture Overview

### Current Flow (Webhook)

```
Strava Webhook Event
  ↓
POST /api/webhooks/strava
  ↓
Store event in strava_webhook_events
  ↓
processWebhookEvent()
  ↓
Fetch activity from Strava API (using raw access_token)  ← PROBLEM: No token refresh
  ↓
Upsert to strava_activities (WITHOUT TSS)  ← PROBLEM: Missing TSS
```

### New Flow (Webhook with TSS + Token Refresh)

```
Strava Webhook Event
  ↓
POST /api/webhooks/strava
  ↓
Store event in strava_webhook_events
  ↓
processWebhookEvent()
  ↓
Get valid access token (StravaService.getValidAccessToken)  ← NEW: Auto-refresh
  ↓
Fetch activity from Strava API (using refreshed token)
  ↓
Fetch athlete profile (for TSS calculation)  ← NEW
  ↓
Calculate TSS (calculateWebhookActivityTSS)  ← NEW
  ↓
Upsert to strava_activities (WITH TSS)  ← UPDATED
```

### Current Flow (Manual Sync)

```
User clicks "Sync Activities"
  ↓
POST /api/strava/sync (no parameters)
  ↓
StravaSyncService.syncActivities() - fetches ALL activities
  ↓
Strava API: GET /athlete/activities (no after param)
  ↓
1000 activities returned, 34 API calls
```

### New Flow (Incremental Sync)

```
User clicks "Sync New Activities" (or default sync with last_sync_at)
  ↓
POST /api/strava/sync?incremental=true
  ↓
Get last_sync_at from strava_connections
  ↓
Calculate after = last_sync_at - 1 hour buffer
  ↓
StravaSyncService.syncActivities(after: timestamp)
  ↓
Strava API: GET /athlete/activities?after=<timestamp>
  ↓
10 new activities returned, 1 API call
```

---

## Implementation Cards

The implementation is broken down into 8 sequential cards:

### Phase 1: Fix Webhook Processing
1. **CARD_1**: Add helper functions for TSS calculation in webhook handler
2. **CARD_2**: Update webhook event processor with token refresh
3. **CARD_3**: Add TSS calculation to webhook activity upsert
4. **CARD_4**: Add error handling and logging for webhook TSS failures

### Phase 2: Auto-Incremental Sync
5. **CARD_5**: Update sync API endpoint to support incremental parameter
6. **CARD_6**: Update StravaSyncService to track sync type metadata
7. **CARD_7**: Update UI component with sync options dropdown
8. **CARD_8**: Add integration tests for incremental sync flow

---

## References

- [Strava API Documentation](https://developers.strava.com/docs/reference/)
- [Strava Webhooks Guide](https://developers.strava.com/docs/webhooks/)
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- Project Implementation Plan: `web/docs/STRAVA_INCREMENTAL_SYNC_PLAN.md`
- Current webhook handler: `web/app/api/webhooks/strava/route.ts`
- Current sync service: `web/lib/services/strava-sync-service.ts`
- TSS calculation service: `web/lib/services/tss-calculation-service.ts`

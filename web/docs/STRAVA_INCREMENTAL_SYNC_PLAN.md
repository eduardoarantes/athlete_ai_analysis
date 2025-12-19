# Strava Incremental Sync Implementation Plan

**Created:** 2025-12-19
**Status:** Planning
**Priority:** High

---

## Executive Summary

This document outlines the plan to implement incremental syncing for Strava activities. Currently, syncing requires fetching all activities each time. The goal is to:

1. Fix webhook processing to include TSS calculation and token refresh
2. Enable automatic incremental sync using `last_sync_at` timestamp
3. Auto-register webhooks for real-time updates
4. Optionally add background sync for stale data

---

## Current State Analysis

### What's Working

| Feature                            | Location                                  | Status  |
| ---------------------------------- | ----------------------------------------- | ------- |
| Manual sync with `after` parameter | `lib/services/strava-sync-service.ts`     | Working |
| Webhook verification               | `app/api/webhooks/strava/route.ts`        | Working |
| Webhook event storage              | `strava_webhook_events` table             | Working |
| Webhook activity sync              | `processWebhookEvent()`                   | Partial |
| Token refresh                      | `lib/services/strava-service.ts`          | Working |
| TSS calculation                    | `lib/services/tss-calculation-service.ts` | Working |
| `last_sync_at` tracking            | `strava_connections` table                | Working |

### Identified Gaps

| Gap                                         | Current Behavior                                       | Impact                        | Priority   |
| ------------------------------------------- | ------------------------------------------------------ | ----------------------------- | ---------- |
| Manual sync doesn't auto-use `last_sync_at` | Users must manually specify `after` param or full-sync | UX friction, wasted API calls | **High**   |
| Webhook doesn't calculate TSS               | Activities synced via webhook have `tss: null`         | Incomplete training load data | **High**   |
| Webhook doesn't refresh tokens              | Uses stored `access_token` directly                    | Sync fails when token expires | **High**   |
| No auto-incremental sync option             | UI only offers full sync                               | Poor UX, rate limit waste     | **Medium** |
| Webhook subscription is manual              | Requires manual API call to register                   | Setup complexity              | **Medium** |
| No background incremental sync              | Data gets stale between manual syncs                   | Data freshness                | **Lower**  |

---

## Strava API Reference

### Activities Endpoint

```
GET https://www.strava.com/api/v3/athlete/activities
```

**Parameters for Incremental Sync:**

- `after` - Unix timestamp, only return activities after this time
- `before` - Unix timestamp, only return activities before this time
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 30, max: 200)

### Rate Limits

| Limit Type | 15-minute    | Daily          |
| ---------- | ------------ | -------------- |
| Overall    | 200 requests | 2,000 requests |
| Read-only  | 100 requests | 1,000 requests |

**Headers returned:**

- `X-RateLimit-Limit` - 15-min and daily limits
- `X-RateLimit-Usage` - Current usage
- `X-ReadRateLimit-Limit` - Read-specific limits
- `X-ReadRateLimit-Usage` - Read-specific usage

### Webhooks

**Event Types:** `create`, `update`, `delete`
**Object Types:** `activity`, `athlete`

**Payload Structure:**

```json
{
  "object_type": "activity",
  "object_id": 1234567890,
  "aspect_type": "create",
  "updates": {},
  "owner_id": 12345,
  "subscription_id": 123456,
  "event_time": 1234567890
}
```

**Best Practices:**

- Respond with HTTP 200 within 2 seconds
- Process events asynchronously
- One subscription serves all authorized athletes

---

## Implementation Plan

### Phase 1: Fix Webhook Processing

**Priority:** High
**Effort:** 2-3 hours
**Dependencies:** None

#### 1.1 Add TSS Calculation to Webhook Handler

**File:** `app/api/webhooks/strava/route.ts`

**Current Code (lines 181-225):**

```typescript
// For create/update: fetch activity details from Strava
const activityResponse = await fetch(
  `https://www.strava.com/api/v3/activities/${event.object_id}`,
  {
    headers: {
      Authorization: `Bearer ${connection.access_token}`, // Uses raw token
    },
  }
)
// ... activity stored WITHOUT TSS calculation
```

**Required Changes:**

```typescript
import { StravaService } from '@/lib/services/strava-service'
import {
  calculateTSS,
  type ActivityData,
  type AthleteData,
} from '@/lib/services/tss-calculation-service'

async function processWebhookEvent(event: StravaWebhookEvent): Promise<void> {
  // ... existing connection lookup ...

  const stravaService = new StravaService()

  try {
    if (event.aspect_type === 'delete') {
      // ... existing delete logic ...
    } else {
      // 1. Get valid access token (with automatic refresh)
      const accessToken = await stravaService.getValidAccessToken(connection.user_id)

      // 2. Fetch activity with refreshed token
      const activityResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${event.object_id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (!activityResponse.ok) {
        throw new Error(`Strava API error: ${activityResponse.statusText}`)
      }

      const activity = await activityResponse.json()

      // 3. Fetch athlete data for TSS calculation
      const athleteData = await getAthleteDataForWebhook(connection.user_id)

      // 4. Calculate TSS
      const tssResult = calculateWebhookActivityTSS(activity, athleteData)

      // 5. Upsert activity WITH TSS
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
          // NEW: Include TSS data
          tss: tssResult?.tss ?? null,
          tss_method: tssResult?.method ?? null,
        } as never,
        { onConflict: 'strava_activity_id' }
      )

      errorLogger.logInfo('Webhook synced activity with TSS', {
        userId: connection.user_id,
        metadata: {
          activityId: event.object_id,
          aspectType: event.aspect_type,
          tss: tssResult?.tss,
          tssMethod: tssResult?.method,
        },
      })
    }

    // ... existing event marking logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}

// Helper function to get athlete data for TSS calculation
async function getAthleteDataForWebhook(userId: string): Promise<AthleteData | null> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('athlete_profiles')
    .select('ftp, max_hr, resting_hr, gender')
    .eq('user_id', userId)
    .single<{
      ftp: number | null
      max_hr: number | null
      resting_hr: number | null
      gender: string | null
    }>()

  if (error || !profile) {
    return null
  }

  return {
    ftp: profile.ftp ?? undefined,
    maxHr: profile.max_hr ?? undefined,
    restingHr: profile.resting_hr ?? undefined,
    gender: (profile.gender as AthleteData['gender']) ?? undefined,
  }
}

// Helper function to calculate TSS for webhook activity
function calculateWebhookActivityTSS(
  activity: Record<string, unknown>,
  athleteData: AthleteData | null
): { tss: number; method: string } | null {
  if (!athleteData) {
    return null
  }

  const activityData: ActivityData = {
    movingTimeSeconds: activity.moving_time as number,
    normalizedPower: (activity.weighted_average_watts as number) ?? undefined,
    averageWatts: (activity.average_watts as number) ?? undefined,
    averageHeartRate: (activity.average_heartrate as number) ?? undefined,
    maxHeartRate: (activity.max_heartrate as number) ?? undefined,
  }

  return calculateTSS(activityData, athleteData)
}
```

#### 1.2 Testing Checklist

- [ ] Create activity on Strava → webhook receives event → activity stored with TSS
- [ ] Update activity title → webhook updates activity (TSS preserved)
- [ ] Delete activity → webhook removes activity
- [ ] Test with expired token → token refreshes automatically
- [ ] Test with missing athlete profile → TSS is null (graceful fallback)

---

### Phase 2: Auto-Incremental Sync

**Priority:** High
**Effort:** 3-4 hours
**Dependencies:** None

#### 2.1 Update Sync API Endpoint

**File:** `app/api/strava/sync/route.ts`

**Add incremental parameter handling after line 113:**

```typescript
// Parse and validate query parameters
const { searchParams } = new URL(request.url)

const syncOptions: {
  after?: number
  perPage?: number
  maxPages?: number
} = {}

// NEW: Handle incremental sync
const incrementalParam = searchParams.get('incremental')
const isIncremental = incrementalParam === 'true'

const afterParam = searchParams.get('after')
if (afterParam) {
  const after = parseInt(afterParam, 10)
  if (isNaN(after) || after < 0) {
    return NextResponse.json({ error: 'after must be a positive Unix timestamp' }, { status: 400 })
  }
  syncOptions.after = after
} else if (isIncremental) {
  // NEW: Auto-calculate "after" from last_sync_at
  const syncService = new StravaSyncService()
  const lastSync = await syncService.getLastSyncTime(user.id)

  if (lastSync) {
    // Subtract 1 hour buffer to catch edge cases (activities uploaded late, etc.)
    const bufferMs = 60 * 60 * 1000 // 1 hour
    syncOptions.after = Math.floor((lastSync.getTime() - bufferMs) / 1000)

    errorLogger.logInfo('Incremental sync from last_sync_at', {
      userId: user.id,
      metadata: {
        lastSyncAt: lastSync.toISOString(),
        afterTimestamp: syncOptions.after,
      },
    })
  }
  // If no lastSync, this becomes a full sync (no after param)
}

// ... rest of existing code ...
```

#### 2.2 Update Sync Service to Report Sync Type

**File:** `lib/services/strava-sync-service.ts`

**Update SyncResult interface:**

```typescript
export interface SyncResult {
  success: boolean
  activitiesSynced: number
  error?: string
  // NEW: Sync metadata
  syncType: 'full' | 'incremental'
  syncedFrom?: Date // Only for incremental
}
```

**Update syncActivities method:**

```typescript
async syncActivities(
  userId: string,
  options?: {
    after?: number
    perPage?: number
    maxPages?: number
  }
): Promise<SyncResult> {
  const syncType = options?.after ? 'incremental' : 'full'
  const syncedFrom = options?.after ? new Date(options.after * 1000) : undefined

  try {
    // ... existing sync logic ...

    return {
      success: true,
      activitiesSynced: totalSynced,
      syncType,
      syncedFrom,
    }
  } catch (error) {
    // ... existing error handling ...
    return {
      success: false,
      activitiesSynced: 0,
      error: errorMessage,
      syncType,
      syncedFrom,
    }
  }
}
```

#### 2.3 Update UI for Incremental Sync

**File:** `components/strava/strava-connection.tsx`

**Add sync type selection:**

```typescript
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, RefreshCw, RotateCcw } from 'lucide-react'

// In the component:
const [isSyncing, setIsSyncing] = useState(false)

const handleSync = async (fullSync = false) => {
  setIsSyncing(true)

  try {
    const params = new URLSearchParams()

    // Default to incremental if we have a last sync time
    if (!fullSync && lastSyncAt) {
      params.set('incremental', 'true')
    }

    const response = await fetch(`/api/strava/sync?${params}`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Sync failed')
    }

    const data = await response.json()
    // Start polling for job status...

  } catch (error) {
    console.error('Sync error:', error)
  } finally {
    setIsSyncing(false)
  }
}

// In the JSX:
{lastSyncAt ? (
  // Show dropdown with sync options
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button disabled={isSyncing}>
        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
        Sync Activities
        <ChevronDown className="h-4 w-4 ml-2" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => handleSync(false)}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Sync New Activities
        <span className="text-xs text-muted-foreground ml-2">
          (since {formatDate(lastSyncAt)})
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleSync(true)}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Full Re-sync
        <span className="text-xs text-muted-foreground ml-2">
          (all activities)
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  // First sync - just show simple button
  <Button onClick={() => handleSync(true)} disabled={isSyncing}>
    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
    Sync Activities
  </Button>
)}
```

#### 2.4 Testing Checklist

- [ ] First sync (no lastSyncAt) → full sync executed
- [ ] Subsequent sync with default → incremental sync from lastSyncAt - 1 hour
- [ ] Sync with explicit `after` param → uses provided timestamp
- [ ] UI shows "Sync New Activities" vs "Full Re-sync" options
- [ ] Incremental sync fetches only recent activities
- [ ] lastSyncAt updates correctly after sync

---

### Phase 3: Webhook Auto-Registration

**Priority:** Medium
**Effort:** 2-3 hours
**Dependencies:** Phase 1

#### 3.1 Create Webhook Registration Service

**File:** `lib/services/strava-webhook-service.ts` (new file)

```typescript
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'

const STRAVA_API_BASE = 'https://www.strava.com/api/v3'

export class StravaWebhookService {
  /**
   * Check if a webhook subscription exists
   */
  async getSubscription(): Promise<{ id: number; callbackUrl: string } | null> {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Strava credentials not configured')
    }

    const response = await fetch(
      `${STRAVA_API_BASE}/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
    )

    if (!response.ok) {
      throw new Error(`Failed to get subscriptions: ${response.statusText}`)
    }

    const subscriptions = await response.json()

    if (subscriptions.length === 0) {
      return null
    }

    return {
      id: subscriptions[0].id,
      callbackUrl: subscriptions[0].callback_url,
    }
  }

  /**
   * Create a new webhook subscription
   */
  async createSubscription(): Promise<{ id: number }> {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!clientId || !clientSecret || !verifyToken || !appUrl) {
      throw new Error('Strava webhook configuration incomplete')
    }

    const callbackUrl = `${appUrl}/api/webhooks/strava`

    const response = await fetch(`${STRAVA_API_BASE}/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create subscription: ${error}`)
    }

    const subscription = await response.json()

    // Store subscription in database
    const supabase = await createClient()
    await supabase.from('strava_webhook_subscriptions').upsert({
      subscription_id: subscription.id,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    } as never)

    errorLogger.logInfo('Webhook subscription created', {
      metadata: { subscriptionId: subscription.id, callbackUrl },
    })

    return { id: subscription.id }
  }

  /**
   * Ensure webhook subscription exists, create if not
   */
  async ensureSubscription(): Promise<{ id: number; created: boolean }> {
    const existing = await this.getSubscription()

    if (existing) {
      return { id: existing.id, created: false }
    }

    const newSub = await this.createSubscription()
    return { id: newSub.id, created: true }
  }
}
```

#### 3.2 Auto-Register on OAuth Callback

**File:** `app/api/auth/strava/callback/route.ts`

**Add after storing connection (around line 80+):**

```typescript
import { StravaWebhookService } from '@/lib/services/strava-webhook-service'

// After successfully storing the connection...

// Auto-register webhook subscription (fire and forget)
const webhookService = new StravaWebhookService()
webhookService.ensureSubscription().catch((error) => {
  // Don't fail the OAuth flow if webhook registration fails
  errorLogger.logWarning('Failed to auto-register webhook', {
    userId: user.id,
    metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
  })
})
```

#### 3.3 Add Webhook Status to UI

**File:** `components/strava/strava-connection.tsx`

```typescript
// Add webhook status display
interface ConnectionStatus {
  connected: boolean
  syncStatus: string
  lastSyncAt: string | null
  activityCount: number
  webhookActive: boolean  // NEW
}

// In the component JSX:
{status.webhookActive ? (
  <Badge variant="outline" className="text-green-600">
    <Zap className="h-3 w-3 mr-1" />
    Real-time sync active
  </Badge>
) : (
  <Badge variant="outline" className="text-yellow-600">
    <AlertCircle className="h-3 w-3 mr-1" />
    Manual sync only
  </Badge>
)}
```

#### 3.4 Testing Checklist

- [ ] New Strava connection → webhook auto-registered
- [ ] Existing connection without webhook → can manually enable
- [ ] UI shows webhook status correctly
- [ ] Webhook registration failure doesn't block OAuth

---

### Phase 4: Background Incremental Sync (Optional)

**Priority:** Lower
**Effort:** 4-6 hours
**Dependencies:** Phase 2

#### 4.1 Smart Sync on Dashboard Load

**File:** `app/(dashboard)/dashboard/page.tsx` or dedicated hook

```typescript
// Hook: useSmartSync
export function useSmartSync() {
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const checkAndSync = async () => {
      const status = await fetch('/api/strava/sync').then((r) => r.json())

      // If last sync was more than 1 hour ago, trigger background sync
      if (status.lastSyncAt) {
        const lastSync = new Date(status.lastSyncAt)
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

        if (lastSync < hourAgo && status.syncStatus !== 'syncing') {
          setIsSyncing(true)

          // Trigger background incremental sync
          fetch('/api/strava/sync?incremental=true', { method: 'POST' }).finally(() =>
            setIsSyncing(false)
          )
        }
      }
    }

    checkAndSync()
  }, [])

  return { isSyncing }
}
```

#### 4.2 Vercel Cron Job (Advanced)

**File:** `app/api/cron/strava-sync/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Cron job to sync stale Strava connections
 * Runs every 6 hours via Vercel Cron
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/strava-sync",
 *     "schedule": "0 */6 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Find connections that haven't synced in 6+ hours
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  const { data: staleConnections } = await supabase
    .from('strava_connections')
    .select('user_id')
    .lt('last_sync_at', sixHoursAgo)
    .neq('sync_status', 'syncing')
    .limit(10) // Process in batches to respect rate limits

  if (!staleConnections || staleConnections.length === 0) {
    return NextResponse.json({ message: 'No stale connections' })
  }

  // Queue sync jobs for each stale connection
  // Implementation depends on your job queue system

  return NextResponse.json({
    queued: staleConnections.length,
    userIds: staleConnections.map(c => c.user_id),
  })
}
```

---

## Rate Limit Impact Analysis

| Sync Type                                 | Activities | API Calls           | Rate Impact                          |
| ----------------------------------------- | ---------- | ------------------- | ------------------------------------ |
| Full Sync (1000 activities)               | 1000       | ~34 calls (30/page) | **High** - uses 34% of 15-min limit  |
| Full Sync (200 activities)                | 200        | ~7 calls            | **Medium** - uses 7% of 15-min limit |
| Incremental (last 7 days, ~10 activities) | 10         | 1 call              | **Minimal**                          |
| Webhook (single activity)                 | 1          | 1 call              | **Minimal**                          |

**Recommendations:**

1. Default to incremental sync after initial sync
2. Show warning before full re-sync: "This will fetch all activities and may take longer"
3. Webhooks are the most efficient for real-time updates
4. Consider rate limit headers in sync service and back off when approaching limits

---

## Database Schema Reference

### Existing Tables Used

```sql
-- strava_connections
CREATE TABLE strava_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  strava_athlete_id BIGINT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,
  last_sync_at TIMESTAMPTZ,  -- Key field for incremental sync
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- strava_activities
CREATE TABLE strava_activities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  strava_activity_id BIGINT UNIQUE,
  name TEXT,
  type TEXT,
  sport_type TEXT,
  start_date TIMESTAMPTZ,
  distance NUMERIC,
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain NUMERIC,
  average_watts NUMERIC,
  max_watts NUMERIC,
  weighted_average_watts NUMERIC,
  average_heartrate NUMERIC,
  max_heartrate NUMERIC,
  tss NUMERIC,           -- Needs to be populated by webhook
  tss_method TEXT,       -- Needs to be populated by webhook
  raw_data JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- strava_webhook_events
CREATE TABLE strava_webhook_events (
  id UUID PRIMARY KEY,
  subscription_id BIGINT,
  object_id BIGINT,
  event_time TIMESTAMPTZ,
  object_type TEXT,
  aspect_type TEXT,
  owner_id BIGINT,
  raw_data JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ
);

-- strava_webhook_subscriptions
CREATE TABLE strava_webhook_subscriptions (
  id UUID PRIMARY KEY,
  subscription_id BIGINT UNIQUE,
  callback_url TEXT,
  verify_token TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## Migration Path

### Deployment Order

1. **Phase 1** (Webhook Fix)
   - No database changes required
   - Backward compatible
   - Can deploy independently

2. **Phase 2** (Auto-Incremental)
   - No database changes required
   - Backward compatible (new parameter, defaults to current behavior)
   - Can deploy independently

3. **Phase 3** (Webhook Auto-Reg)
   - No database changes required
   - Depends on Phase 1 being deployed
   - Non-breaking change

4. **Phase 4** (Background Sync)
   - May require Vercel Pro for cron jobs
   - Optional enhancement
   - Depends on Phase 2

### Rollback Plan

Each phase is isolated and can be rolled back independently:

- Phase 1: Revert webhook route.ts
- Phase 2: Revert sync route.ts and UI component
- Phase 3: Revert callback route.ts and remove webhook service
- Phase 4: Remove cron job configuration

---

## Testing Strategy

### Unit Tests

```typescript
// Test incremental sync timestamp calculation
describe('StravaSyncService', () => {
  it('should use last_sync_at minus 1 hour for incremental sync', async () => {
    const lastSync = new Date('2024-01-15T10:00:00Z')
    const expectedAfter = Math.floor((lastSync.getTime() - 3600000) / 1000)

    // Mock and verify
  })
})

// Test TSS calculation in webhook
describe('Webhook TSS Calculation', () => {
  it('should calculate TSS for activity with power data', () => {
    const activity = { moving_time: 3600, weighted_average_watts: 200 }
    const athlete = { ftp: 250 }

    const result = calculateWebhookActivityTSS(activity, athlete)
    expect(result.tss).toBeGreaterThan(0)
    expect(result.method).toBe('power')
  })
})
```

### Integration Tests

- [ ] Full OAuth flow → webhook auto-registration
- [ ] Manual sync → incremental from last_sync_at
- [ ] Webhook event → activity stored with TSS
- [ ] Token expiry → automatic refresh during webhook processing

### Manual Testing Checklist

- [ ] Connect new Strava account
- [ ] Run initial full sync
- [ ] Create activity on Strava → verify webhook syncs it with TSS
- [ ] Run incremental sync → verify only new activities fetched
- [ ] Check rate limit headers are respected
- [ ] Verify UI shows correct sync options

---

## Monitoring & Observability

### Key Metrics to Track

1. **Sync Performance**
   - Sync duration (full vs incremental)
   - Activities synced per job
   - Sync failures by type

2. **Webhook Health**
   - Events received per hour
   - Processing success rate
   - Average processing time

3. **Rate Limit Usage**
   - API calls per 15-minute window
   - Daily API call usage
   - Rate limit errors

### Log Events

```typescript
// Sync events
errorLogger.logInfo('Sync started', { userId, syncType: 'incremental', after })
errorLogger.logInfo('Sync completed', { userId, activitiesSynced, duration })

// Webhook events
errorLogger.logInfo('Webhook processed', { activityId, tss, processingTime })
errorLogger.logWarning('Webhook TSS calculation failed', { activityId, reason })

// Rate limit events
errorLogger.logWarning('Approaching rate limit', { usage, limit, resetAt })
```

---

## Summary

| Phase                     | Effort    | Value  | Status      |
| ------------------------- | --------- | ------ | ----------- |
| Phase 1: Webhook Fix      | 2-3 hours | High   | Not Started |
| Phase 2: Auto-Incremental | 3-4 hours | High   | Not Started |
| Phase 3: Webhook Auto-Reg | 2-3 hours | Medium | Not Started |
| Phase 4: Background Sync  | 4-6 hours | Lower  | Not Started |

**Recommended Implementation Order:** Phase 1 + Phase 2 together provides the most immediate value with 5-7 hours of effort.

---

## References

- [Strava API Documentation](https://developers.strava.com/docs/reference/)
- [Strava Webhooks Guide](https://developers.strava.com/docs/webhooks/)
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- Current implementation: `lib/services/strava-sync-service.ts`
- Webhook handler: `app/api/webhooks/strava/route.ts`

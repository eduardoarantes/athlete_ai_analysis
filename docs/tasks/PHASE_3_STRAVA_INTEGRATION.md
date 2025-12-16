# Phase 3: Strava Integration - Task Breakdown

**Duration:** Weeks 5-6  
**Goal:** Enable Strava OAuth and automatic activity synchronization  
**Status:** Pending Phase 2 Completion

---

## Overview

Phase 3 integrates with Strava API to automatically sync cycling activities, download FIT files, and auto-detect performance metrics like FTP.

### Key Deliverables

- ✅ Strava OAuth flow
- ✅ Initial activity sync (6 months)
- ✅ Incremental sync via webhooks + polling
- ✅ FIT file download and storage
- ✅ FTP/max HR auto-detection

### Prerequisites

- Strava API application created
- Supabase Storage bucket configured
- Profile system working

---

## Task Breakdown

### Week 5: OAuth & Initial Sync

#### P3-T1: Register Strava API Application

**Estimated Effort:** 1 hour

**Steps:**
1. Create Strava API application at https://www.strava.com/settings/api
2. Set authorization callback URL
3. Note Client ID and Client Secret
4. Add to environment variables

**Environment Variables:**
```bash
STRAVA_CLIENT_ID=xxx
STRAVA_CLIENT_SECRET=xxx
STRAVA_WEBHOOK_VERIFY_TOKEN=xxx (generate random string)
```

**Acceptance Criteria:**
- [ ] Strava app created
- [ ] Callback URL configured
- [ ] Credentials in .env.local

---

#### P3-T2: Implement Strava OAuth Flow

**Estimated Effort:** 4 hours

**Files to Create:**
- `app/api/auth/strava/connect/route.ts` - Initiate OAuth
- `app/api/auth/strava/callback/route.ts` - Handle callback
- `lib/services/strava-service.ts` - Strava API wrapper

**OAuth Connect:**
```typescript
// app/api/auth/strava/connect/route.ts
import { redirect } from 'next/navigation'

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/strava/callback`
  const scope = 'read,activity:read_all,profile:read_all'

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&approval_prompt=force`

  redirect(stravaAuthUrl)
}
```

**OAuth Callback:**
```typescript
// app/api/auth/strava/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect('/dashboard?error=strava_auth_failed')
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()

  // Store tokens in database
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('strava_connections').upsert({
    user_id: user!.id,
    strava_athlete_id: tokens.athlete.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    scope: tokens.scope,
  })

  if (error) {
    console.error('Failed to store Strava connection:', error)
    return NextResponse.redirect('/dashboard?error=strava_connection_failed')
  }

  // Trigger initial sync
  await fetch('/api/strava/sync', {
    method: 'POST',
    body: JSON.stringify({ userId: user!.id }),
  })

  return NextResponse.redirect('/dashboard?success=strava_connected')
}
```

**Acceptance Criteria:**
- [ ] OAuth flow redirects to Strava
- [ ] User authorizes app
- [ ] Tokens stored in database
- [ ] Connection visible in settings

---

#### P3-T3: Implement Token Refresh Logic

**Estimated Effort:** 2 hours

**Files:**
- `lib/services/strava-service.ts`

**Token Refresh Function:**
```typescript
export async function refreshStravaToken(connectionId: string) {
  const supabase = createAdminClient()

  // Get connection
  const { data: connection } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  // Check if expired
  const expiresAt = new Date(connection.expires_at)
  if (expiresAt > new Date()) {
    return connection.access_token // Still valid
  }

  // Refresh
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await response.json()

  // Update in database
  await supabase.from('strava_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
  }).eq('id', connectionId)

  return tokens.access_token
}
```

**Acceptance Criteria:**
- [ ] Expired tokens automatically refreshed
- [ ] New tokens stored in database
- [ ] API calls use fresh tokens

---

#### P3-T4: Implement Initial Activity Sync

**Estimated Effort:** 4 hours

**Files:**
- `app/api/strava/sync/route.ts`

**Features:**
- Fetch last 6 months of activities
- Store in activities table
- Deduplicate by strava_activity_id
- Download FIT files

**Sync Logic:**
```typescript
export async function POST(request: Request) {
  const { userId } = await request.json()
  const supabase = createAdminClient()

  // Get connection
  const { data: connection } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get fresh token
  const accessToken = await refreshStravaToken(connection.id)

  // Calculate 6 months ago
  const sixMonthsAgo = Math.floor(Date.now() / 1000) - (6 * 30 * 24 * 60 * 60)

  // Fetch activities
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${sixMonthsAgo}&page=${page}&per_page=200`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    const activities = await response.json()

    if (activities.length === 0) {
      hasMore = false
      break
    }

    // Store activities
    for (const activity of activities) {
      await supabase.from('activities').upsert({
        user_id: userId,
        strava_activity_id: activity.id,
        name: activity.name,
        type: activity.type,
        sport_type: activity.sport_type,
        start_date: activity.start_date,
        distance_meters: activity.distance,
        moving_time_seconds: activity.moving_time,
        elapsed_time_seconds: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        average_watts: activity.average_watts,
        max_watts: activity.max_watts,
        weighted_average_watts: activity.weighted_average_watts,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
      })
    }

    page++
  }

  // Update sync status
  await supabase.from('strava_connections').update({
    last_sync_at: new Date().toISOString(),
    sync_status: 'success',
  }).eq('id', connection.id)

  return NextResponse.json({ success: true })
}
```

**Acceptance Criteria:**
- [ ] Fetches all activities from last 6 months
- [ ] Stores in database without duplicates
- [ ] Handles pagination correctly
- [ ] Updates sync status
- [ ] Rate limits respected

---

#### P3-T5: Set Up Supabase Storage for FIT Files

**Estimated Effort:** 2 hours

**Steps:**
1. Create Supabase Storage bucket: `fit-files`
2. Set up RLS policies for bucket
3. Create upload utility function

**Bucket Policies:**
```sql
-- Users can only access their own FIT files
CREATE POLICY "Users can upload their own FIT files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fit-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own FIT files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fit-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Upload Utility:**
```typescript
export async function uploadFitFile(
  userId: string,
  activityId: string,
  fileBuffer: Buffer
) {
  const supabase = createAdminClient()

  const filePath = `${userId}/${activityId}.fit`

  const { data, error } = await supabase.storage
    .from('fit-files')
    .upload(filePath, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    })

  if (error) throw error

  return data.path
}
```

**Acceptance Criteria:**
- [ ] Bucket created
- [ ] RLS policies working
- [ ] Files organized by user_id/activity_id
- [ ] Upload function working

---

### Week 6: Webhooks & Auto-Detection

#### P3-T6: Implement Strava Webhook Subscription

**Estimated Effort:** 4 hours

**Files:**
- `supabase/functions/strava-webhook/index.ts` (Edge Function)

**Webhook Setup:**
1. Create Edge Function for webhook handler
2. Subscribe to Strava webhook events
3. Handle create/update/delete events

**Edge Function:**
```typescript
import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  // Verify subscription (during setup)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN')) {
      return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Forbidden', { status: 403 })
  }

  // Handle webhook events
  if (req.method === 'POST') {
    const event = await req.json()

    if (event.object_type === 'activity' && event.aspect_type === 'create') {
      // Fetch full activity from Strava
      // Store in database
      // Download FIT file if available
    }

    return new Response('OK', { status: 200 })
  }

  return new Response('Method Not Allowed', { status: 405 })
})
```

**Subscribe to Webhook:**
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID \
  -F client_secret=$STRAVA_CLIENT_SECRET \
  -F 'callback_url=https://your-project.supabase.co/functions/v1/strava-webhook' \
  -F 'verify_token=your_verify_token'
```

**Acceptance Criteria:**
- [ ] Webhook subscription created
- [ ] Verification endpoint working
- [ ] New activities automatically synced
- [ ] Updated activities refreshed
- [ ] Deleted activities handled

---

#### P3-T7: Implement FTP Auto-Detection

**Estimated Effort:** 3 hours

**Algorithm:**
1. Find activities with power data
2. Calculate best 20-minute power
3. Apply 95% factor for FTP estimate
4. Update athlete profile

**Files:**
- `lib/services/ftp-detection.ts`

**FTP Detection:**
```typescript
export async function detectFTP(userId: string): Promise<number | null> {
  const supabase = createAdminClient()

  // Get activities with power data from last 3 months
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: activities } = await supabase
    .from('activities')
    .select('average_watts, moving_time_seconds')
    .eq('user_id', userId)
    .gte('start_date', threeMonthsAgo.toISOString())
    .not('average_watts', 'is', null)
    .order('average_watts', { ascending: false })

  if (!activities || activities.length === 0) {
    return null
  }

  // Find best 20-minute power approximation
  // (using activities between 20-60 minutes)
  const validActivities = activities.filter(
    (a) => a.moving_time_seconds >= 1200 && a.moving_time_seconds <= 3600
  )

  if (validActivities.length === 0) {
    return null
  }

  const best20MinPower = validActivities[0].average_watts

  // FTP = 95% of 20-minute power
  const estimatedFTP = Math.round(best20MinPower * 0.95)

  return estimatedFTP
}
```

**Acceptance Criteria:**
- [ ] FTP detected from power activities
- [ ] Profile auto-updated if no FTP set
- [ ] User notified of detected FTP
- [ ] Detection runs after sync

---

#### P3-T8: Build Strava Connection UI

**Estimated Effort:** 3 hours

**Files:**
- `components/strava/connect-button.tsx`
- `components/strava/connection-status.tsx`
- `components/strava/sync-progress.tsx`

**Features:**
- "Connect Strava" button
- Connection status card
- Sync progress indicator
- Manual sync trigger
- Disconnect option

**Acceptance Criteria:**
- [ ] Button triggers OAuth flow
- [ ] Status shows connected/disconnected
- [ ] Sync progress visible
- [ ] Manual sync button working
- [ ] Disconnect clears connection

---

#### P3-T9: Implement Polling Fallback for Sync

**Estimated Effort:** 2 hours

**Features:**
- Supabase pg_cron job
- Runs every 15 minutes
- Syncs activities for all connected users
- Respects rate limits

**Cron Job (SQL):**
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule sync job (every 15 minutes)
SELECT cron.schedule(
  'strava-sync-fallback',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/strava-sync-all',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

**Acceptance Criteria:**
- [ ] Cron job scheduled
- [ ] Syncs all users with connections
- [ ] Rate limiting implemented
- [ ] Errors logged

---

#### P3-T10: Add Activity List Page

**Estimated Effort:** 3 hours

**Files:**
- `app/[locale]/(dashboard)/activities/page.tsx`
- `components/activities/activity-list.tsx`
- `components/activities/activity-card.tsx`

**Features:**
- Paginated list of activities
- Filter by type (Ride, Run, etc.)
- Sort by date/distance/duration
- View activity details

**Acceptance Criteria:**
- [ ] List loads activities from database
- [ ] Pagination working (50 per page)
- [ ] Filters working
- [ ] Mobile responsive
- [ ] Loading states

---

## Phase Completion Checklist

### Strava Integration
- [ ] OAuth flow working
- [ ] Token refresh automatic
- [ ] Initial sync completes successfully
- [ ] Webhook subscription active
- [ ] Polling fallback working

### Data & Storage
- [ ] Activities stored in database
- [ ] FIT files in Supabase Storage
- [ ] No duplicate activities
- [ ] RLS policies enforced

### Auto-Detection
- [ ] FTP detected from activities
- [ ] Max HR detected
- [ ] Profile auto-updated
- [ ] User notified

### UI
- [ ] Connect button working
- [ ] Connection status clear
- [ ] Sync progress visible
- [ ] Activity list functional

---

## Success Criteria

1. User connects Strava in < 30 seconds
2. Initial sync completes in < 2 minutes (100 activities)
3. Webhooks deliver new activities within 1 minute
4. FTP auto-detected with 90%+ accuracy
5. No rate limit errors
6. All data secure with RLS

**Handoff to Phase 4:**
- Activities data available for AI analysis
- Profile enriched with auto-detected metrics
- Ready for report generation

---

**Phase 3 Task Breakdown - v1.0**  
**Last Updated:** 2025-12-03

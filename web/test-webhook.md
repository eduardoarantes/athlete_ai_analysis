# Strava Webhook Testing Guide

## Overview

Strava webhooks allow real-time activity sync. When a user creates, updates, or deletes an activity on Strava, Strava sends an event to our webhook endpoint, and we automatically sync the change.

## Prerequisites

1. **Supabase running**: `supabase start`
2. **Dev server running**: `pnpm dev`
3. **Logged in to app**: http://localhost:3000
4. **Webhook verify token** in `.env.local`:
   ```
   STRAVA_WEBHOOK_VERIFY_TOKEN=CYCLING_AI
   ```
5. **Public URL** for webhook callback (use ngrok or similar for local testing)

## Setup for Local Testing

### 1. Expose Local Server with ngrok

Since Strava needs to reach your webhook endpoint, you need a public URL:

```bash
# Install ngrok if needed: https://ngrok.com/download
ngrok http 3000
```

This gives you a public URL like: `https://abc123.ngrok.io`

### 2. Update Environment Variables

Add to `.env.local`:

```
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
STRAVA_WEBHOOK_VERIFY_TOKEN=CYCLING_AI
```

Restart dev server: `pnpm dev`

## Test Flow

### 1. Create Webhook Subscription

**Create subscription** (tells Strava to send events to our endpoint):

```bash
# While logged in, copy session cookie from browser DevTools
curl -X POST http://localhost:3000/api/webhooks/strava/subscription \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN" \
  -v
```

**Expected Response:**

```json
{
  "success": true,
  "subscription": {
    "id": 123456,
    "resource_state": 2,
    "application_id": 181018,
    "callback_url": "https://abc123.ngrok.io/api/webhooks/strava",
    "created_at": "2025-12-15T12:34:56Z",
    "updated_at": "2025-12-15T12:34:56Z"
  }
}
```

**Note:** During subscription creation, Strava will send a verification GET request to your callback URL. Check logs to verify it succeeded.

### 2. Verify Subscription

```bash
curl http://localhost:3000/api/webhooks/strava/subscription \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "subscriptions": [
    {
      "id": 123456,
      "callback_url": "https://abc123.ngrok.io/api/webhooks/strava",
      ...
    }
  ],
  "callback_url": "https://abc123.ngrok.io/api/webhooks/strava"
}
```

### 3. Test Webhook Events

Now when you create, update, or delete activities on Strava, events will be sent to your webhook endpoint.

**Test by:**

1. Go to Strava.com
2. Create a new activity (manual entry or upload)
3. Check your app logs for webhook event

**Expected Log Output:**

```
[Webhook] Received event: {
  object_type: 'activity',
  object_id: 12345678,
  aspect_type: 'create',
  owner_id: 87654321,
  subscription_id: 123456,
  event_time: 1702654321
}
[Webhook] Event stored successfully
[Webhook] Synced activity: 12345678
```

### 4. Verify Event in Database

```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- Check webhook events
SELECT
  object_type,
  aspect_type,
  object_id,
  owner_id,
  processed,
  event_time,
  created_at
FROM public.strava_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Output:**

```
 object_type | aspect_type | object_id | owner_id  | processed |       event_time        |         created_at
-------------+-------------+-----------+-----------+-----------+-------------------------+-------------------------
 activity    | create      | 12345678  | 87654321  | t         | 2025-12-15 12:34:56+00  | 2025-12-15 12:34:57+00
```

### 5. Verify Activity Synced

```sql
-- Check that activity was synced to strava_activities
SELECT
  strava_activity_id,
  name,
  type,
  sport_type,
  distance,
  moving_time,
  created_at
FROM public.strava_activities
WHERE strava_activity_id = 12345678;
```

### 6. Test Update Event

1. Edit the activity on Strava (change name, description, etc.)
2. Check logs for webhook event with `aspect_type: 'update'`
3. Verify activity was updated in database

### 7. Test Delete Event

1. Delete the activity on Strava
2. Check logs for webhook event with `aspect_type: 'delete'`
3. Verify activity was deleted from database

### 8. Delete Webhook Subscription (Optional)

```bash
# Get subscription ID from step 2
SUBSCRIPTION_ID=123456

curl -X DELETE "http://localhost:3000/api/webhooks/strava/subscription?id=${SUBSCRIPTION_ID}" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "success": true
}
```

## Troubleshooting

### Verification Failed

**Symptom:** Subscription creation fails with "verification failed"

**Causes:**

1. Callback URL not publicly accessible
2. `STRAVA_WEBHOOK_VERIFY_TOKEN` mismatch
3. Webhook endpoint not responding to GET requests

**Fix:**

1. Ensure ngrok is running and URL is correct
2. Check `.env.local` has correct verify token
3. Test verification manually:
   ```bash
   curl "https://abc123.ngrok.io/api/webhooks/strava?hub.mode=subscribe&hub.verify_token=CYCLING_AI&hub.challenge=test123"
   # Should return: {"hub.challenge":"test123"}
   ```

### Events Not Received

**Symptom:** No webhook events in logs after creating activity

**Causes:**

1. Subscription not active
2. Activity created by different Strava account
3. Webhook endpoint down

**Fix:**

1. Verify subscription exists (step 2)
2. Ensure you're creating activity on the same Strava account that's connected
3. Check ngrok is still running, dev server is up

### Events Received But Not Processed

**Symptom:** Events appear in `strava_webhook_events` with `processed=false`

**Causes:**

1. Access token expired
2. Activity fetch failed
3. Database error

**Fix:**

1. Check `error` column in `strava_webhook_events` table
2. Verify user's Strava connection is still valid
3. Check application logs for processing errors

## Production Deployment

For production, you'll need to:

1. **Set up production webhook URL** in environment variables
2. **Secure subscription management** (admin-only access)
3. **Implement background job queue** (current implementation processes events synchronously)
4. **Add retry logic** for failed event processing
5. **Monitor webhook failures** and alert on errors

## Environment Variables Summary

```bash
# Required
STRAVA_CLIENT_ID=181018
STRAVA_CLIENT_SECRET=321d506f0fbc15feec4dda84e22464ca758bf2c3
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# Optional
STRAVA_WEBHOOK_VERIFY_TOKEN=CYCLING_AI  # Defaults to "CYCLING_AI" if not set
```

## Success Indicators

✅ Subscription created successfully
✅ Verification GET request returns challenge
✅ Webhook events received and logged
✅ Events stored in `strava_webhook_events` table
✅ Activities synced to `strava_activities` table
✅ Updates and deletes processed correctly
✅ Processed events marked with `processed=true`

## Next Steps

After successful webhook setup:

- Build UI for viewing webhook event log
- Implement error notification system
- Add retry mechanism for failed events
- Set up monitoring and alerting

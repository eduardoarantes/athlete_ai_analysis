# Strava OAuth Testing Guide

## Prerequisites

1. Supabase running: `supabase start`
2. Dev server running: `pnpm dev`
3. Logged in to the app at `http://localhost:3000`

## Test Flow

### 1. Connect to Strava

**URL:** http://localhost:3000/api/auth/strava/connect

**Expected:**

- Redirects to Strava authorization page
- Shows scope: `read,activity:read_all,profile:read_all`

### 2. Authorize on Strava

**Action:** Click "Authorize" on Strava

**Expected:**

- Redirects back to: `http://localhost:3000/api/auth/strava/callback?code=...`
- Then redirects to: `http://localhost:3000/dashboard?strava_connected=true`

### 3. Verify in Database

```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- Check connection
SELECT
  user_id,
  strava_athlete_id,
  scope,
  sync_status,
  expires_at > now() as token_valid,
  created_at
FROM public.strava_connections;

-- Expected output:
-- user_id               | strava_athlete_id | scope                                    | sync_status | token_valid | created_at
-- <your-uuid>          | 12345678         | read,activity:read_all,profile:read_all | pending     | t           | 2025-12-15...
```

### 4. Check Status

**URL:** http://localhost:3000/api/auth/strava/status

**Expected Response:**

```json
{
  "connected": true,
  "athlete_id": 12345678,
  "token_expired": false,
  "sync_status": "pending",
  "last_sync_at": null
}
```

### 5. Disconnect (Optional)

**URL:** `POST http://localhost:3000/api/auth/strava/disconnect`

**Using curl:**

```bash
# While logged in, copy session cookie from browser DevTools
curl -X POST http://localhost:3000/api/auth/strava/disconnect \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN" \
  -v
```

**Expected:**

- Returns: `{"success": true}`
- Database connection deleted
- Strava access revoked

### 6. Verify Disconnect

**URL:** http://localhost:3000/api/auth/strava/status

**Expected Response:**

```json
{
  "connected": false
}
```

## Troubleshooting

### Error: "invalid_state"

- **Cause:** CSRF token mismatch
- **Fix:** Clear cookies and try again

### Error: "access_denied"

- **Cause:** User clicked "Cancel" on Strava
- **Expected:** Redirects to `/dashboard?strava_error=access_denied`

### Error: "Unauthorized"

- **Cause:** Not logged in to the app
- **Fix:** Log in at `http://localhost:3000` first

### Database Connection Not Created

- **Check:** Look at browser DevTools → Network tab for error responses
- **Check:** Verify environment variables in `.env.local`:
  - `STRAVA_CLIENT_ID=181018`
  - `STRAVA_CLIENT_SECRET=321d506f0fbc15feec4dda84e22464ca758bf2c3`

## Success Indicators

✅ Redirected to Strava authorization page
✅ Successfully authorized on Strava
✅ Redirected back to dashboard with `?strava_connected=true`
✅ Connection exists in database
✅ Status endpoint returns `connected: true`
✅ Token is not expired
✅ Disconnect works and returns success

## 7. Test Activity Sync

**URL:** `POST http://localhost:3000/api/strava/sync`

**Using curl:**

```bash
# While logged in, copy session cookie from browser DevTools
curl -X POST http://localhost:3000/api/strava/sync \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN" \
  -v
```

**Expected Response:**

```json
{
  "success": true,
  "activitiesSynced": 42
}
```

**Check Activities in Database:**

```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- View synced activities
SELECT
  strava_activity_id,
  name,
  type,
  sport_type,
  start_date,
  distance,
  moving_time
FROM public.strava_activities
ORDER BY start_date DESC
LIMIT 10;

-- Check total activity count
SELECT COUNT(*) as total_activities
FROM public.strava_activities;
```

**Check Sync Status:**

```bash
# GET sync status
curl http://localhost:3000/api/strava/sync \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "syncStatus": "success",
  "syncError": null,
  "lastSyncAt": "2025-12-15T12:34:56.789Z",
  "activityCount": 42
}
```

**Sync with Options:**

```bash
# Sync only recent activities (last 30 days)
# after = Unix timestamp (e.g., 30 days ago)
THIRTY_DAYS_AGO=$(date -u -v-30d +%s)
curl -X POST "http://localhost:3000/api/strava/sync?after=${THIRTY_DAYS_AGO}&perPage=50" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"

# Sync with pagination limit (only first 2 pages)
curl -X POST "http://localhost:3000/api/strava/sync?maxPages=2&perPage=30" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

## Troubleshooting Sync

### Sync already in progress

- **Error:** `{"error": "Sync already in progress"}`
- **Fix:** Wait for current sync to complete, or reset status in database:
  ```sql
  UPDATE public.strava_connections
  SET sync_status = 'pending'
  WHERE user_id = '<your-uuid>';
  ```

### No activities synced

- **Check:** Token is valid and not expired
- **Check:** User has activities in Strava account
- **Check:** `after` parameter is not filtering out all activities

### Sync fails with error

- **Check:** Database logs for specific error
- **Check:** `strava_connections.sync_error` column for error message
  ```sql
  SELECT sync_error
  FROM public.strava_connections
  WHERE user_id = '<your-uuid>';
  ```

## Next Steps

After successful connection and sync:

- Implement FIT file storage (P3-T5)
- Implement webhook subscription (P3-T6)
- Build UI for connection status (P3-T8)

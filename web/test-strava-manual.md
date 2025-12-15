# Manual Strava Connection Test

## Prerequisites
- Supabase running: `supabase status` (should show "Running")
- Dev server running: `pnpm dev` (on http://localhost:3000)

## Step 1: Create an Account / Log In

1. Open browser: http://localhost:3000
2. If not logged in:
   - Click "Sign Up" or "Log In"
   - Enter email: `test@example.com`
   - Enter password: `testpassword123`
   - Click "Sign Up" or "Log In"
3. You should be redirected to the dashboard or home page

## Step 2: Connect to Strava

**While still logged in**, navigate to:
```
http://localhost:3000/api/auth/strava/connect
```

**Expected:**
- Browser redirects to Strava authorization page
- URL should be: `https://www.strava.com/oauth/authorize?client_id=181018&redirect_uri=...`
- Page shows: "Authorize Cycling AI"
- Shows permissions: "View data about your activities"

## Step 3: Authorize on Strava

1. If not logged in to Strava, log in first
2. Click "Authorize" button
3. Wait for redirect back to app

**Expected:**
- Redirects to: `http://localhost:3000/dashboard?strava_connected=true`
- You should see the dashboard with a success message

## Step 4: Verify Connection in Database

```bash
# Connect to Supabase database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Check connection
SELECT
  user_id,
  strava_athlete_id,
  scope,
  sync_status,
  expires_at > now() as token_valid,
  created_at
FROM public.strava_connections;
```

**Expected:**
- One row with your user_id
- `token_valid` should be `t` (true)
- `sync_status` should be `pending`

## Troubleshooting

### "Unauthorized" Error

**Symptom:** Browser shows `{"error":"Unauthorized"}`

**Cause:** Not logged in to the app

**Fix:**
1. Go back to http://localhost:3000
2. Log in or create an account
3. Then try http://localhost:3000/api/auth/strava/connect again

### "invalid_state" Error

**Symptom:** Redirected to `?strava_error=invalid_state`

**Cause:** CSRF token mismatch (cookies expired)

**Fix:**
1. Clear browser cookies for localhost:3000
2. Log in again
3. Try connecting again

### Supabase Not Running

**Symptom:** Connection errors, 500 errors

**Fix:**
```bash
supabase status  # Check if running
supabase start   # Start if not running
```

### Environment Variables Missing

**Check:**
```bash
cat .env.local
```

**Should contain:**
```
STRAVA_CLIENT_ID=181018
STRAVA_CLIENT_SECRET=321d506f0fbc15feec4dda84e22464ca758bf2c3
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Testing with curl (Advanced)

If you want to use curl, you need to extract the session cookie first:

1. Log in via browser
2. Open DevTools → Application → Cookies
3. Find cookie named like `sb-127-auth-token`
4. Copy the value
5. Use in curl:

```bash
curl http://localhost:3000/api/auth/strava/connect \
  -H "Cookie: sb-127-auth-token=YOUR_COOKIE_VALUE" \
  -v
```

This should redirect to Strava.

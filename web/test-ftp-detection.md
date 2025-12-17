# FTP Auto-Detection Testing Guide

## Overview

The FTP (Functional Threshold Power) auto-detection analyzes power data from synced Strava activities to estimate the user's current FTP. This provides an automated alternative to manual FTP testing.

## Prerequisites

1. **Supabase running**: `supabase start`
2. **Dev server running**: `pnpm dev`
3. **Logged in to app**: http://localhost:3000
4. **Strava connected** with activities synced
5. **Activities with power data** (at least 5 recommended)

## Estimation Methods

The service uses weighted average power from activities to estimate FTP:

1. **Weighted Average Method** (Primary):
   - Analyzes `weighted_average_watts` from all activities
   - Assumes max weighted average is ~90% of FTP
   - Most reliable with Strava's summary data

2. **Average Watts Method** (Fallback):
   - Uses `average_watts` if weighted average not available
   - Assumes max average is ~80% of FTP
   - Less accurate but better than nothing

## Confidence Levels

- **High**: 20+ activities in last 90 days
- **Medium**: 10-19 activities in last 180 days
- **Low**: < 10 activities or longer period

## Test Flow

### 1. Detect FTP (Read-Only)

**URL:** `POST /api/profile/ftp/detect`

**Basic detection** (90 days, 5 min activities):

```bash
curl -X POST http://localhost:3000/api/profile/ftp/detect \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "estimate": {
    "estimatedFTP": 265,
    "method": "weighted_average_watts",
    "confidence": "high",
    "dataPoints": 42,
    "periodDays": 90,
    "maxPowers": {
      "maxWeightedAverage": 238
    },
    "reasoning": "Estimated from max weighted average power (238W) across 42 activities. Weighted average is typically 90% of FTP for hard efforts."
  },
  "updated": false
}
```

### 2. Detect FTP with Custom Parameters

**Custom lookback period** (30 days, 10 min activities):

```bash
curl -X POST "http://localhost:3000/api/profile/ftp/detect?periodDays=30&minActivities=10" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

### 3. Detect and Update Profile

**Auto-update profile** with detected FTP:

```bash
curl -X POST "http://localhost:3000/api/profile/ftp/detect?updateProfile=true" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "estimate": {
    "estimatedFTP": 265,
    "method": "weighted_average_watts",
    "confidence": "high",
    ...
  },
  "updated": true
}
```

### 4. Get Current FTP from Profile

**URL:** `GET /api/profile/ftp/detect`

```bash
curl http://localhost:3000/api/profile/ftp/detect \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "ftp": 265
}
```

### 5. Verify in Database

```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- Check profile FTP
SELECT
  user_id,
  first_name,
  last_name,
  ftp,
  updated_at
FROM public.profiles
WHERE user_id = '<your-user-id>';
```

### 6. Check Power Data Quality

**View activities with power data:**

```sql
-- Check how many activities have power data
SELECT
  COUNT(*) as total_activities,
  COUNT(weighted_average_watts) as with_weighted_watts,
  COUNT(average_watts) as with_average_watts,
  MAX(weighted_average_watts) as max_weighted,
  MAX(average_watts) as max_average
FROM public.strava_activities
WHERE user_id = '<your-user-id>'
  AND start_date >= NOW() - INTERVAL '90 days';
```

**Expected Output:**

```
 total_activities | with_weighted_watts | with_average_watts | max_weighted | max_average
------------------+---------------------+--------------------+--------------+-------------
              42  |                 42  |                 42 |          238 |         220
```

### 7. Test with Insufficient Data

If you don't have enough activities with power data:

```bash
curl -X POST "http://localhost:3000/api/profile/ftp/detect?minActivities=100" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**

```json
{
  "estimate": {
    "estimatedFTP": 0,
    "method": "no_data",
    "confidence": "low",
    "dataPoints": 42,
    "periodDays": 90,
    "maxPowers": {},
    "reasoning": "Insufficient data: Found 42 activities with power data in the last 90 days. Need at least 100 activities."
  },
  "updated": false
}
```

## Troubleshooting

### No Power Data Found

**Symptom:** `estimatedFTP: 0`, `method: "no_data"`

**Causes:**

1. No activities with power meter data synced
2. All activities are older than `periodDays`
3. Power data not populated in Strava activities

**Fix:**

1. Ensure activities have power meter data on Strava
2. Sync activities: `POST /api/strava/sync`
3. Check database for power data (see step 6)
4. Try longer period: `?periodDays=180`

### FTP Estimate Seems Too Low/High

**Causes:**

1. Not enough hard efforts in recent data
2. Recent training load doesn't match fitness
3. Weighted average estimation method less accurate

**Fix:**

1. Do a structured FTP test (20-min or ramp test)
2. Manually set FTP in profile if you know your actual FTP
3. Wait for more activities with hard efforts to accumulate
4. Use custom period focusing on peak fitness period

### Profile Not Updated

**Symptom:** `updated: false` when using `updateProfile=true`

**Causes:**

1. FTP estimate is 0 (no data)
2. Database update failed

**Fix:**

1. Check response for `error` field
2. Verify profile exists in database
3. Check application logs for errors

## Expected Accuracy

FTP detection accuracy depends on data quality:

- **Best case** (high confidence): ±5-10W
  - 20+ activities with hard efforts
  - Recent data (< 90 days)
  - Mix of interval and tempo rides

- **Medium case** (medium confidence): ±10-20W
  - 10-19 activities
  - Moderate efforts
  - Longer period (90-180 days)

- **Worst case** (low confidence): ±20-40W
  - < 10 activities
  - No structured efforts
  - Old data or long periods

**Recommendation:** For best accuracy, complement auto-detection with periodic structured FTP tests (20-min test or ramp test).

## Integration with Onboarding

When building the UI, consider:

1. Offering FTP detection during onboarding after Strava sync
2. Showing confidence level to user
3. Allowing user to accept/reject detected FTP
4. Prompting for manual FTP test if confidence is low

## Next Steps

After successful FTP detection:

- Build UI for FTP detection and profile update
- Add periodic re-detection (monthly suggested)
- Integrate with training plan generation (uses FTP for zones)
- Add FTP history tracking over time

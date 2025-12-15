# Testing Calendar Month Navigation

## Bug Fixed
Calendar now properly fetches and displays activities when navigating between months.

## Manual Test Steps

### Prerequisites
1. Dev server running: `pnpm dev`
2. Supabase running: `supabase start`
3. User logged in with synced Strava activities from multiple months

### Test 1: Navigate to Previous Month

1. Navigate to http://localhost:3000/app/activities
2. Click the "Calendar" button to switch to calendar view
3. Verify you see activities for the current month
4. Click the "Previous month" button (left arrow)
5. ✅ **Expected**: Activities from the previous month should appear on the calendar
6. ✅ **Expected**: Month/year label should update to show previous month

### Test 2: Navigate to Next Month

1. From the previous month view, click the "Next month" button (right arrow)
2. ✅ **Expected**: Calendar returns to current month
3. ✅ **Expected**: Activities from current month are displayed again

### Test 3: Today Button

1. Navigate to a different month (previous or next)
2. Click the "Today" button
3. ✅ **Expected**: Calendar jumps back to the current month
4. ✅ **Expected**: Current date is highlighted with a ring border
5. ✅ **Expected**: Activities for current month are displayed

### Test 4: Sport Type Filter with Calendar

1. Switch to calendar view
2. Select a sport type from the dropdown (e.g., "Ride")
3. ✅ **Expected**: Only activities of that sport type are shown
4. Navigate to previous/next month
5. ✅ **Expected**: Filter persists across month navigation
6. ✅ **Expected**: Only filtered activities are shown in the new month

### Test 5: Loading States

1. Navigate to a different month
2. ✅ **Expected**: Brief "Loading calendar..." message appears
3. ✅ **Expected**: Activities load and display correctly

## API Verification

You can verify the API calls are correct by checking the Network tab in browser DevTools:

1. Open DevTools (F12)
2. Go to Network tab
3. Navigate between months in calendar view
4. Look for requests to `/api/activities`
5. ✅ **Expected**: Each month navigation makes a new request with:
   - `startDate`: First day of the month at 00:00:00
   - `endDate`: Last day of the month at 23:59:59
   - `limit`: 1000
   - `sortBy`: start_date
   - `sortOrder`: asc

Example request:
```
/api/activities?startDate=2024-11-01T00:00:00.000Z&endDate=2024-11-30T23:59:59.000Z&sortBy=start_date&sortOrder=asc&limit=1000
```

## What Changed

### Before (Bug)
- Calendar component received activities as a prop
- Activities were from current paginated dataset (20 activities)
- Navigating to different months showed empty calendar or wrong activities

### After (Fixed)
- Calendar component fetches its own data
- `useEffect` triggers on `currentDate` change
- Fetches all activities for the selected month
- Sport type filter properly integrated

## Files Modified

1. `components/activities/activities-calendar.tsx`
   - Added `useEffect` to fetch activities on month change
   - Added `loadActivitiesForMonth()` function
   - Changed prop from `activities: Activity[]` to `sportTypeFilter?: string`
   - Added loading state management
   - Added aria-labels to navigation buttons

2. `app/(dashboard)/activities/page.tsx`
   - Changed calendar component prop from `activities={activities}` to `sportTypeFilter={sportTypeFilter}`

## Edge Cases Tested

- ✅ Months with no activities (displays empty calendar)
- ✅ Months with many activities (> 30 on one day)
- ✅ Sport type filtering across months
- ✅ Loading states during navigation
- ✅ Today button from any month

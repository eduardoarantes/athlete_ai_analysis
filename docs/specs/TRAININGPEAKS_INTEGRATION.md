# TrainingPeaks Integration Specification

**Status:** Planned (Not Yet Implemented)
**Created:** 2025-12-22
**Target:** Web App (Next.js frontend)
**User Type:** Athletes syncing to their own calendar

---

## Overview

Enable users to sync their AI-generated training plans to their TrainingPeaks calendar. After connecting their TrainingPeaks account via OAuth, users can push scheduled plan instances to their TP calendar with a single click.

---

## Prerequisites

### TrainingPeaks API Access
- **Apply at:** https://api.trainingpeaks.com/request-access
- **Response time:** 7-10 business days
- **Required scopes:** `athlete:profile workouts:plan`
- **Limitations:**
  - API not available for personal use (must be commercial application)
  - Only Premium TP athletes can have planned workouts (basic accounts get 403)

### Environment Variables Required
```bash
TRAININGPEAKS_CLIENT_ID=your_client_id
TRAININGPEAKS_CLIENT_SECRET=your_client_secret
TRAININGPEAKS_ENV=sandbox  # or 'production'
```

---

## Architecture

### High-Level Flow

```
User clicks "Sync to TrainingPeaks"
         │
         v
  TP Connected? ──NO──> OAuth Flow ──> Store tokens in DB
         │                                    │
        YES                                   │
         │                                    │
         v                                    v
  Get PlanInstance data <─────────────────────┘
         │
         v
  Convert workouts to TP format
         │
         v
  POST each workout to TP API
         │
         v
  Track sync status in DB
         │
         v
  Show success/error to user
```

### Design Principles
- Follow existing Strava OAuth pattern exactly
- Sync scheduled `PlanInstance` (not template) because instances have concrete dates
- Track individual workout sync status for incremental updates
- One-way push (to TP), pull functionality can be added later

---

## Database Schema

### Table 1: `trainingpeaks_connections`

Stores OAuth tokens per user (follows `strava_connections` pattern).

```sql
CREATE TABLE IF NOT EXISTS public.trainingpeaks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tp_athlete_id TEXT NOT NULL,           -- TrainingPeaks athlete ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,                   -- e.g., "athlete:profile workouts:plan"
  is_premium BOOLEAN DEFAULT false,      -- Track if user has Premium (can sync)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(tp_athlete_id)
);

-- RLS Policies
ALTER TABLE public.trainingpeaks_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own TP connection"
  ON public.trainingpeaks_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TP connection"
  ON public.trainingpeaks_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TP connection"
  ON public.trainingpeaks_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TP connection"
  ON public.trainingpeaks_connections FOR DELETE
  USING (auth.uid() = user_id);
```

### Table 2: `trainingpeaks_workout_syncs`

Tracks sync status for each workout within a plan instance.

```sql
CREATE TABLE IF NOT EXISTS public.trainingpeaks_workout_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_instance_id UUID NOT NULL REFERENCES plan_instances(id) ON DELETE CASCADE,

  -- Workout identification within the plan
  week_number INTEGER NOT NULL,
  workout_index INTEGER NOT NULL,          -- Index within week's workouts array
  workout_date DATE NOT NULL,              -- Calculated workout date

  -- TrainingPeaks identifiers
  tp_workout_id TEXT,                      -- TrainingPeaks workout ID (returned after creation)

  -- Sync status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted')),
  sync_error TEXT,
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one sync record per workout per instance
  UNIQUE(plan_instance_id, week_number, workout_index)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tp_workout_syncs_user_id ON public.trainingpeaks_workout_syncs(user_id);
CREATE INDEX IF NOT EXISTS idx_tp_workout_syncs_instance ON public.trainingpeaks_workout_syncs(plan_instance_id);
CREATE INDEX IF NOT EXISTS idx_tp_workout_syncs_status ON public.trainingpeaks_workout_syncs(sync_status);

-- RLS Policies
ALTER TABLE public.trainingpeaks_workout_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout syncs"
  ON public.trainingpeaks_workout_syncs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own workout syncs"
  ON public.trainingpeaks_workout_syncs FOR ALL
  USING (auth.uid() = user_id);
```

---

## Files to Create

### Backend Services

#### `web/lib/services/trainingpeaks-service.ts`

OAuth handling and TrainingPeaks API calls (follows `strava-service.ts` pattern).

```typescript
/**
 * TrainingPeaks API Service
 * Handles OAuth flow and API interactions with TrainingPeaks
 */

export interface TPTokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

export interface TPAthleteProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  isPremium: boolean
}

export interface TPWorkoutCreateRequest {
  AthleteId: string
  WorkoutDay: string           // yyyy-MM-dd format
  WorkoutType: 'bike' | 'run' | 'swim' | 'strength' | 'x-train' | 'other'
  Title?: string
  Description?: string
  TotalTimePlanned?: number    // Hours as decimal
  TSSPlanned?: number
  Structure?: string           // JSON string of structured workout
  Tags?: string[]
}

export interface TPWorkoutResponse {
  Id: string
  AthleteId: string
  WorkoutDay: string
  Title: string
}

export class TrainingPeaksService {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private readonly isProduction: boolean

  private get oauthBaseUrl(): string {
    return this.isProduction
      ? 'https://oauth.trainingpeaks.com'
      : 'https://oauth.sandbox.trainingpeaks.com'
  }

  private get apiBaseUrl(): string {
    return this.isProduction
      ? 'https://api.trainingpeaks.com'
      : 'https://api.sandbox.trainingpeaks.com'
  }

  constructor() {
    this.clientId = process.env.TRAININGPEAKS_CLIENT_ID!
    this.clientSecret = process.env.TRAININGPEAKS_CLIENT_SECRET!
    this.redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/trainingpeaks/callback`
    this.isProduction = process.env.TRAININGPEAKS_ENV === 'production'
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'athlete:profile workouts:plan',
      state,
    })
    return `${this.oauthBaseUrl}/OAuth/Authorize?${params.toString()}`
  }

  async exchangeCodeForToken(code: string): Promise<TPTokenResponse> {
    const response = await fetch(`${this.oauthBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${await response.text()}`)
    }
    return response.json()
  }

  async refreshAccessToken(refreshToken: string): Promise<TPTokenResponse> {
    const response = await fetch(`${this.oauthBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${await response.text()}`)
    }
    return response.json()
  }

  async getAthlete(accessToken: string): Promise<TPAthleteProfile> {
    const response = await fetch(`${this.apiBaseUrl}/v1/athlete/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to get athlete: ${await response.text()}`)
    }
    return response.json()
  }

  async createPlannedWorkout(
    accessToken: string,
    workout: TPWorkoutCreateRequest
  ): Promise<TPWorkoutResponse> {
    const response = await fetch(`${this.apiBaseUrl}/v2/workouts/plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workout),
    })

    if (!response.ok) {
      throw new Error(`Failed to create workout: ${await response.text()}`)
    }
    return response.json()
  }

  async deletePlannedWorkout(accessToken: string, workoutId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/v2/workouts/plan/${workoutId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete workout: ${await response.text()}`)
    }
  }

  async getValidAccessToken(userId: string): Promise<string> {
    // Implementation follows strava-service.ts pattern:
    // 1. Fetch connection from database
    // 2. Check if token expired
    // 3. If expired, refresh and update database
    // 4. Return valid access token
  }
}
```

#### `web/lib/services/trainingpeaks-sync-service.ts`

Workout format conversion and sync orchestration.

```typescript
/**
 * TrainingPeaks Sync Service
 * Converts internal training plan format to TrainingPeaks format
 */

import type { PlanInstance, Workout, WorkoutSegment } from '@/lib/types/training-plan'
import type { TPWorkoutCreateRequest } from './trainingpeaks-service'

export interface SyncResult {
  success: boolean
  totalWorkouts: number
  syncedWorkouts: number
  failedWorkouts: number
  errors: { workout: string; error: string }[]
}

export class TrainingPeaksSyncService {

  /**
   * Map internal segment type to TrainingPeaks IntensityClass
   */
  private mapSegmentTypeToIntensityClass(
    type: string,
    powerPct?: number
  ): string {
    const mapping: Record<string, string> = {
      'warmup': 'WarmUp',
      'cooldown': 'Cooldown',
      'recovery': 'Active Recovery',
      'steady': 'Endurance',
      'tempo': 'Tempo',
      'work': 'Threshold',
    }

    // For intervals, check power to determine VO2 Max vs Threshold
    if (type === 'interval') {
      return powerPct && powerPct > 105 ? 'VO2 Max' : 'Threshold'
    }

    return mapping[type] || 'Active Recovery'
  }

  /**
   * Convert internal workout to TrainingPeaks Structure JSON
   */
  convertWorkoutToTPStructure(workout: Workout): string {
    if (!workout.segments || workout.segments.length === 0) {
      return ''
    }

    const steps = workout.segments.map((segment) => {
      const avgPower = segment.power_high_pct
        ? (segment.power_low_pct! + segment.power_high_pct) / 2
        : segment.power_low_pct

      const step: Record<string, unknown> = {
        Type: 'Step',
        IntensityClass: this.mapSegmentTypeToIntensityClass(
          segment.type,
          avgPower
        ),
        Name: segment.description || segment.type,
        Length: {
          Unit: 'Second',
          Value: Math.round(segment.duration_min * 60),
        },
      }

      if (segment.power_low_pct !== undefined) {
        step.IntensityTarget = {
          Unit: 'PercentOfFtp',
          MinValue: segment.power_low_pct,
          MaxValue: segment.power_high_pct ?? segment.power_low_pct,
          Value: Math.round(avgPower ?? segment.power_low_pct),
        }
      }

      return step
    })

    return JSON.stringify({ Steps: steps })
  }

  /**
   * Convert workout to TrainingPeaks API request format
   */
  convertWorkoutToTPRequest(
    workout: Workout,
    workoutDate: string,
    athleteId: string
  ): TPWorkoutCreateRequest {
    const structure = this.convertWorkoutToTPStructure(workout)

    const totalMinutes = workout.segments?.reduce(
      (sum, seg) => sum + (seg.duration_min || 0),
      0
    ) ?? 0

    return {
      AthleteId: athleteId,
      WorkoutDay: workoutDate,
      WorkoutType: 'bike',
      Title: workout.name,
      Description: workout.detailed_description || workout.description || '',
      TotalTimePlanned: totalMinutes / 60,
      TSSPlanned: workout.tss,
      Structure: structure || undefined,
    }
  }

  /**
   * Calculate actual date for a workout based on plan start date
   */
  calculateWorkoutDate(
    planStartDate: string,
    weekNumber: number,
    weekday: string
  ): string {
    const dayMap: Record<string, number> = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
      'Friday': 5, 'Saturday': 6, 'Sunday': 0,
    }

    const startDate = new Date(planStartDate)
    const startDay = startDate.getDay()

    // Find the Monday of the start week
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay
    const firstMonday = new Date(startDate)
    firstMonday.setDate(firstMonday.getDate() + mondayOffset)

    // Calculate target date
    const weeksToAdd = weekNumber - 1
    const targetDay = dayMap[weekday] ?? 1
    const targetDate = new Date(firstMonday)
    targetDate.setDate(targetDate.getDate() + (weeksToAdd * 7) + (targetDay - 1))

    return targetDate.toISOString().split('T')[0]
  }

  /**
   * Sync a complete plan instance to TrainingPeaks
   */
  async syncPlanInstance(
    userId: string,
    planInstance: PlanInstance,
    accessToken: string,
    tpAthleteId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      totalWorkouts: 0,
      syncedWorkouts: 0,
      failedWorkouts: 0,
      errors: [],
    }

    for (const week of planInstance.plan_data.weekly_plan) {
      for (let i = 0; i < week.workouts.length; i++) {
        const workout = week.workouts[i]
        result.totalWorkouts++

        try {
          const workoutDate = this.calculateWorkoutDate(
            planInstance.start_date,
            week.week_number,
            workout.weekday
          )

          const tpRequest = this.convertWorkoutToTPRequest(
            workout,
            workoutDate,
            tpAthleteId
          )

          // Call TP API to create workout
          // Update sync tracking in database

          result.syncedWorkouts++
        } catch (error) {
          result.failedWorkouts++
          result.errors.push({
            workout: `Week ${week.week_number} - ${workout.name}`,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    result.success = result.failedWorkouts === 0
    return result
  }
}
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/trainingpeaks/connect` | GET | Initiate OAuth flow |
| `/api/auth/trainingpeaks/callback` | GET | Handle OAuth callback |
| `/api/auth/trainingpeaks/disconnect` | POST | Revoke connection |
| `/api/auth/trainingpeaks/status` | GET | Check connection status |
| `/api/trainingpeaks/sync` | POST | Sync a plan instance |
| `/api/trainingpeaks/sync/[instanceId]` | GET | Get sync status |
| `/api/trainingpeaks/sync/[instanceId]` | DELETE | Remove synced workouts |

### Frontend Components

#### `web/components/trainingpeaks/trainingpeaks-connection.tsx`

Connection UI component (follows `strava-connection.tsx` pattern):
- Show connection status
- Connect button with OAuth redirect
- Disconnect button
- Premium status indicator
- Error handling

#### `web/components/trainingpeaks/sync-to-trainingpeaks-button.tsx`

```typescript
interface SyncToTrainingPeaksButtonProps {
  planInstanceId: string
  disabled?: boolean
  onSyncComplete?: (result: SyncResult) => void
}

// States: idle | connecting | syncing | success | error
// If not connected, redirects to OAuth
// Shows progress during sync
// Displays results when complete
```

#### `web/components/trainingpeaks/sync-status-badge.tsx`

```typescript
interface SyncStatusBadgeProps {
  instanceId: string
  size?: 'sm' | 'md'
}

// Displays: "Not synced" | "Synced" | "Partial" | "Error"
// Click to open sync details dialog
```

---

## Files to Modify

### `web/components/settings/integrations-settings.tsx`

Change TrainingPeaks from 'coming-soon' to 'available':

```typescript
{
  id: 'trainingpeaks',
  nameKey: 'trainingpeaks',
  descriptionKey: 'trainingpeaksDescription',
  icon: <Activity className="h-6 w-6" />,
  status: 'available',  // Changed from 'coming-soon'
  category: 'training-platforms',
  component: TrainingPeaksConnection,  // Added
},
```

### `web/messages/en.json`

Add TrainingPeaks i18n strings:

```json
{
  "settings": {
    "integrations": {
      "trainingpeaks": "TrainingPeaks",
      "trainingpeaksDescription": "Sync your training plans to TrainingPeaks calendar",
      "trainingpeaksConnected": "Connected to TrainingPeaks",
      "trainingpeaksPremiumRequired": "Premium TrainingPeaks account required for workout sync",
      "syncToTrainingPeaks": "Sync to TrainingPeaks",
      "syncing": "Syncing...",
      "syncComplete": "Sync complete",
      "syncFailed": "Sync failed"
    }
  }
}
```

### `.env.example`

Add TrainingPeaks variables:

```bash
# TrainingPeaks OAuth (Partner API)
TRAININGPEAKS_CLIENT_ID=
TRAININGPEAKS_CLIENT_SECRET=
TRAININGPEAKS_ENV=sandbox
```

---

## Workout Format Mapping

### Segment Type → IntensityClass

| Internal Type | Power Range | TP IntensityClass |
|--------------|-------------|-------------------|
| warmup | Any | WarmUp |
| cooldown | Any | Cooldown |
| recovery | Any | Active Recovery |
| steady | <75% | Endurance |
| tempo | 76-90% | Tempo |
| work | 91-105% | Threshold |
| interval | >105% | VO2 Max |
| interval | ≤105% | Threshold |

### TrainingPeaks Structure JSON Example

```json
{
  "Steps": [
    {
      "Type": "Step",
      "IntensityClass": "WarmUp",
      "Name": "Easy spin",
      "Length": { "Unit": "Second", "Value": 600 },
      "IntensityTarget": {
        "Unit": "PercentOfFtp",
        "Value": 60,
        "MinValue": 55,
        "MaxValue": 65
      }
    },
    {
      "Type": "Step",
      "IntensityClass": "Threshold",
      "Name": "Threshold interval",
      "Length": { "Unit": "Second", "Value": 480 },
      "IntensityTarget": {
        "Unit": "PercentOfFtp",
        "Value": 100,
        "MinValue": 95,
        "MaxValue": 105
      }
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Apply for TrainingPeaks API access
- [ ] Create database migration for both tables
- [ ] Implement `TrainingPeaksService` with OAuth methods
- [ ] Add environment variables

### Phase 2: OAuth Flow
- [ ] Create connect/callback/disconnect/status API routes
- [ ] Implement `TrainingPeaksConnection` component
- [ ] Update integrations settings page
- [ ] Add i18n translations
- [ ] Test with sandbox environment

### Phase 3: Workout Sync
- [ ] Implement `TrainingPeaksSyncService` with format conversion
- [ ] Create sync API routes
- [ ] Implement `SyncToTrainingPeaksButton` component
- [ ] Add `SyncStatusBadge` component
- [ ] Add sync button to plan instance view

### Phase 4: Polish
- [ ] Handle Premium account check (show message for basic users)
- [ ] Implement error handling and retry logic
- [ ] Add rate limiting with exponential backoff
- [ ] Write unit tests for format conversion
- [ ] Write integration tests for OAuth flow
- [ ] Documentation and user guide

---

## Technical Notes

### Token Management
- TrainingPeaks access tokens expire quickly (~10 min)
- Always call `getValidAccessToken()` before API calls
- Refresh token is long-lived, store securely

### Premium Account Requirement
- Basic TP accounts cannot have planned workouts (API returns 403)
- Check `isPremium` flag from athlete profile
- Show clear message to non-Premium users

### Rate Limiting
- TrainingPeaks has undocumented rate limits
- Implement exponential backoff on 429 responses
- Consider queuing large sync operations

### Date Calculation
- `PlanInstance.start_date` is the plan start
- Calculate actual workout date from start + week number + weekday
- Handle edge cases (plans starting mid-week)

### Sandbox vs Production
- Development: `*.sandbox.trainingpeaks.com`
- Production: `*.trainingpeaks.com`
- Control via `TRAININGPEAKS_ENV` environment variable

---

## Reference Files

| Purpose | File Path |
|---------|-----------|
| OAuth pattern | `web/lib/services/strava-service.ts` |
| Training plan types | `web/lib/types/training-plan.ts` |
| Integrations UI | `web/components/settings/integrations-settings.tsx` |
| Connection component | `web/components/strava/strava-connection.tsx` |
| OAuth callback | `web/app/api/auth/strava/callback/route.ts` |
| Plan instance service | `web/lib/services/plan-instance-service.ts` |

---

## External Resources

- [TrainingPeaks API Help](https://help.trainingpeaks.com/hc/en-us/articles/234441128-TrainingPeaks-API)
- [TrainingPeaks Partner API Update](https://www.trainingpeaks.com/blog/an-update-on-trainingpeaks-partner-api/)
- [API Access Request](https://api.trainingpeaks.com/request-access)
- [Structured Workout Export](https://help.trainingpeaks.com/hc/en-us/articles/115001844087-Structured-Workout-Export-FAQs)
- [Structured Workout Builder](https://help.trainingpeaks.com/hc/en-us/articles/235164967-Structured-Workout-Builder)

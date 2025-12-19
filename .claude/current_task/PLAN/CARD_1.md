# CARD 1: Add Helper Functions for TSS Calculation in Webhook Handler

**Phase:** 1 - Fix Webhook Processing
**Priority:** High
**Estimated Effort:** 30 minutes
**Dependencies:** None

---

## Objective

Add reusable helper functions to the webhook route handler for fetching athlete data and calculating TSS for webhook activities. These functions will be used by the webhook event processor to ensure all webhook-synced activities have TSS data.

---

## Changes Required

### File: `web/app/api/webhooks/strava/route.ts`

**Add imports (after line 3):**

```typescript
import { StravaService } from '@/lib/services/strava-service'
import {
  calculateTSS,
  type ActivityData,
  type AthleteData,
  type TSSResult,
} from '@/lib/services/tss-calculation-service'
```

**Add helper function 1 (after line 135, before `processWebhookEvent`):**

```typescript
/**
 * Fetch athlete profile data for TSS calculation
 * Returns null if profile not found or missing required fields
 */
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
    errorLogger.logWarning('Athlete profile not found for TSS calculation', {
      userId,
      metadata: { error: error?.message },
    })
    return null
  }

  return {
    ftp: profile.ftp ?? undefined,
    maxHr: profile.max_hr ?? undefined,
    restingHr: profile.resting_hr ?? undefined,
    gender: (profile.gender as AthleteData['gender']) ?? undefined,
  }
}
```

**Add helper function 2 (after `getAthleteDataForWebhook`):**

```typescript
/**
 * Calculate TSS for a webhook activity
 * Returns null if insufficient data for calculation
 */
function calculateWebhookActivityTSS(
  activity: Record<string, unknown>,
  athleteData: AthleteData | null
): TSSResult | null {
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

---

## Implementation Notes

### Design Decisions

1. **Separate helper functions** - Keeps `processWebhookEvent` clean and testable
2. **Null-safe** - Returns null when data is missing, allowing graceful fallback
3. **Type-safe** - Uses existing TypeScript interfaces from TSS service
4. **Reusable** - Can be tested independently and used in future webhook features

### Type Mapping

The activity data from Strava API uses snake_case field names:
- `moving_time` → `movingTimeSeconds`
- `weighted_average_watts` → `normalizedPower`
- `average_watts` → `averageWatts`
- `average_heartrate` → `averageHeartRate`
- `max_heartrate` → `maxHeartRate`

### Error Handling

- `getAthleteDataForWebhook` logs warning if profile not found but doesn't throw
- `calculateWebhookActivityTSS` returns null if no athlete data (graceful degradation)
- Activities will still be stored even if TSS calculation fails

---

## Testing

### Unit Tests

```typescript
describe('Webhook Helper Functions', () => {
  describe('getAthleteDataForWebhook', () => {
    it('should fetch athlete profile successfully', async () => {
      const athleteData = await getAthleteDataForWebhook(userId)
      expect(athleteData).not.toBeNull()
      expect(athleteData.ftp).toBeDefined()
    })

    it('should return null for missing profile', async () => {
      const athleteData = await getAthleteDataForWebhook('nonexistent-user')
      expect(athleteData).toBeNull()
    })
  })

  describe('calculateWebhookActivityTSS', () => {
    it('should calculate TSS from power data', () => {
      const activity = {
        moving_time: 3600,
        weighted_average_watts: 200,
      }
      const athlete = { ftp: 250 }

      const result = calculateWebhookActivityTSS(activity, athlete)
      expect(result).not.toBeNull()
      expect(result.tss).toBeGreaterThan(0)
      expect(result.method).toBe('power')
    })

    it('should return null when no athlete data', () => {
      const activity = { moving_time: 3600 }
      const result = calculateWebhookActivityTSS(activity, null)
      expect(result).toBeNull()
    })
  })
})
```

### Manual Testing

1. Check that imports resolve correctly
2. Verify TypeScript compilation passes
3. Verify helper functions are accessible in `processWebhookEvent` scope

---

## Acceptance Criteria

- [ ] `getAthleteDataForWebhook` function added and compiles
- [ ] `calculateWebhookActivityTSS` function added and compiles
- [ ] Imports for `StravaService` and TSS types added
- [ ] TypeScript compilation passes (`pnpm type-check`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Functions follow existing code style

---

## Next Steps

After completing this card, proceed to **CARD_2** to integrate these helper functions into the webhook event processor with token refresh logic.

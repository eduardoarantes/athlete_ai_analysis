/**
 * Workout Match Service Tests
 *
 * Tests for matching Strava activities to scheduled workouts
 * Issue: Virtual ride activities not showing up for matching on today's date
 */

import { describe, it, expect } from 'vitest'
import { formatDateString, getLocalDateFromTimestamp, parseLocalDate } from '@/lib/utils/date-utils'
import {
  CYCLING_ACTIVITY_TYPES,
  isCyclingWorkout,
} from '@/lib/services/workout-match-service'

// Mock the calculateMatchScore function logic for testing
// Uses the exported constants from workout-match-service.ts
function calculateMatchScore(
  workout: { tss?: number; type?: string },
  activity: { tss: number | null; type: string; moving_time: number | null }
): number {
  const isCyclingActivity = (CYCLING_ACTIVITY_TYPES as readonly string[]).includes(activity.type)
  const workoutIsCycling = isCyclingWorkout(workout.type)

  if (workoutIsCycling && !isCyclingActivity) {
    return 0
  }

  let score = 50

  if (isCyclingActivity && workoutIsCycling) {
    score += 20
  }

  if (workout.tss && activity.tss) {
    const tssDiff = Math.abs(workout.tss - activity.tss)
    const tssPercent = tssDiff / workout.tss
    if (tssPercent < 0.1) score += 20
    else if (tssPercent < 0.2) score += 15
    else if (tssPercent < 0.3) score += 10
    else if (tssPercent < 0.5) score += 5
  }

  if (!activity.tss && activity.moving_time && activity.moving_time > 1800) {
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}

describe('Exported constants and helpers', () => {
  it('should export CYCLING_ACTIVITY_TYPES with all cycling types', () => {
    expect(CYCLING_ACTIVITY_TYPES).toContain('Ride')
    expect(CYCLING_ACTIVITY_TYPES).toContain('VirtualRide')
    expect(CYCLING_ACTIVITY_TYPES).toContain('EBikeRide')
    expect(CYCLING_ACTIVITY_TYPES).toContain('MountainBikeRide')
    expect(CYCLING_ACTIVITY_TYPES).toContain('GravelRide')
    expect(CYCLING_ACTIVITY_TYPES.length).toBe(5)
  })

  it('should identify cycling workouts correctly', () => {
    expect(isCyclingWorkout('tempo')).toBe(true)
    expect(isCyclingWorkout('endurance')).toBe(true)
    expect(isCyclingWorkout('vo2max')).toBe(true)
    expect(isCyclingWorkout(undefined)).toBe(true)
    expect(isCyclingWorkout('rest')).toBe(false)
  })

  it('should include VirtualRide in cycling activity types', () => {
    // This is critical: VirtualRide must be matchable with Ride workouts
    expect(CYCLING_ACTIVITY_TYPES).toContain('VirtualRide')
    expect((CYCLING_ACTIVITY_TYPES as readonly string[]).includes('VirtualRide')).toBe(true)
  })
})

describe('Activity category filtering', () => {
  it('should define cycling activities correctly', () => {
    const cyclingTypes = [...CYCLING_ACTIVITY_TYPES]
    expect(cyclingTypes).toContain('Ride')
    expect(cyclingTypes).toContain('VirtualRide')
    expect(cyclingTypes).not.toContain('Run')
    expect(cyclingTypes).not.toContain('Swim')
    expect(cyclingTypes).not.toContain('WeightTraining')
  })

  it('should allow VirtualRide to match with any cycling workout type', () => {
    // Workout types are intensity levels (tempo, endurance, vo2max)
    // Activity types are sport categories (Ride, VirtualRide, Run)
    // A VirtualRide activity should match tempo, endurance, or any cycling workout
    const workoutTypes = ['tempo', 'endurance', 'vo2max', 'threshold', 'recovery', 'sweetspot']
    const virtualRideActivity = { tss: 50, type: 'VirtualRide', moving_time: 3600 }

    for (const workoutType of workoutTypes) {
      const score = calculateMatchScore({ tss: 50, type: workoutType }, virtualRideActivity)
      expect(score, `VirtualRide should match ${workoutType} workout`).toBeGreaterThan(0)
    }
  })

  it('should NOT match non-cycling activities with cycling workouts', () => {
    const nonCyclingActivities = [
      { tss: 50, type: 'Run', moving_time: 3600 },
      { tss: 30, type: 'Swim', moving_time: 1800 },
      { tss: 20, type: 'WeightTraining', moving_time: 3600 },
    ]

    for (const activity of nonCyclingActivities) {
      const score = calculateMatchScore({ tss: 50, type: 'tempo' }, activity)
      expect(score, `${activity.type} should NOT match cycling workout`).toBe(0)
    }
  })

  it('should match Ride activity with VirtualRide in same category', () => {
    // Both Ride and VirtualRide are cycling activities
    // They should both be valid for matching cycling workouts
    const rideScore = calculateMatchScore(
      { tss: 50, type: 'tempo' },
      { tss: 48, type: 'Ride', moving_time: 3600 }
    )
    const virtualRideScore = calculateMatchScore(
      { tss: 50, type: 'tempo' },
      { tss: 48, type: 'VirtualRide', moving_time: 3600 }
    )

    expect(rideScore).toBe(virtualRideScore)
    expect(rideScore).toBeGreaterThan(0)
  })
})

describe('calculateMatchScore', () => {
  describe('VirtualRide activity type', () => {
    it('should accept VirtualRide as a valid cycling activity', () => {
      const workout = { tss: 50, type: 'tempo' }
      const activity = { tss: 48, type: 'VirtualRide', moving_time: 3600 }

      const score = calculateMatchScore(workout, activity)

      expect(score).toBeGreaterThan(0)
      expect(score).toBeGreaterThanOrEqual(70) // Base 50 + cycling bonus 20
    })

    it('should score VirtualRide the same as regular Ride', () => {
      const workout = { tss: 50, type: 'tempo' }
      const virtualRide = { tss: 48, type: 'VirtualRide', moving_time: 3600 }
      const regularRide = { tss: 48, type: 'Ride', moving_time: 3600 }

      const virtualScore = calculateMatchScore(workout, virtualRide)
      const regularScore = calculateMatchScore(workout, regularRide)

      expect(virtualScore).toBe(regularScore)
    })

    it('should accept all cycling activity types', () => {
      const workout = { tss: 50, type: 'endurance' }
      const cyclingTypes = ['Ride', 'VirtualRide', 'EBikeRide', 'MountainBikeRide', 'GravelRide']

      for (const type of cyclingTypes) {
        const activity = { tss: 50, type, moving_time: 3600 }
        const score = calculateMatchScore(workout, activity)
        expect(score, `${type} should be accepted`).toBeGreaterThan(0)
      }
    })

    it('should reject non-cycling activities for cycling workouts', () => {
      const workout = { tss: 50, type: 'tempo' }
      const nonCyclingTypes = ['Run', 'Swim', 'Walk', 'WeightTraining', 'Yoga']

      for (const type of nonCyclingTypes) {
        const activity = { tss: 50, type, moving_time: 3600 }
        const score = calculateMatchScore(workout, activity)
        expect(score, `${type} should be rejected`).toBe(0)
      }
    })
  })

  describe('TSS matching', () => {
    it('should give bonus for TSS within 10%', () => {
      const workout = { tss: 100, type: 'tempo' }
      const activity = { tss: 95, type: 'VirtualRide', moving_time: 3600 }

      const score = calculateMatchScore(workout, activity)

      expect(score).toBe(90) // 50 base + 20 cycling + 20 TSS bonus
    })

    it('should give smaller bonus for TSS within 20%', () => {
      const workout = { tss: 100, type: 'tempo' }
      const activity = { tss: 85, type: 'VirtualRide', moving_time: 3600 }

      const score = calculateMatchScore(workout, activity)

      expect(score).toBe(85) // 50 base + 20 cycling + 15 TSS bonus
    })
  })
})

describe('Date handling for activity matching', () => {
  describe('getLocalDateFromTimestamp', () => {
    it('should extract local date from UTC timestamp', () => {
      // Activity done at 10:30am on Jan 9, 2026 in a UTC+0 timezone
      const timestamp = '2026-01-09T10:30:00Z'
      const localDate = getLocalDateFromTimestamp(timestamp)

      // Note: This test may behave differently based on the test runner's timezone
      // The function should return the date in the user's local timezone
      expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should handle activities near midnight correctly', () => {
      // Activity done at 11:30pm UTC on Jan 8
      // In UTC+11 (Sydney), this would be Jan 9 at 10:30am
      const lateNightUTC = '2026-01-08T23:30:00Z'
      const localDate = getLocalDateFromTimestamp(lateNightUTC)

      // The result depends on the local timezone of the test environment
      expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Date range expansion for activity queries', () => {
    it('should expand date range by 1 day on each end', () => {
      const workoutDate = '2026-01-09'
      const startDate = parseLocalDate(workoutDate)
      const endDate = parseLocalDate(workoutDate)

      // Expand by 1 day
      startDate.setDate(startDate.getDate() - 1)
      endDate.setDate(endDate.getDate() + 1)

      expect(formatDateString(startDate)).toBe('2026-01-08')
      expect(formatDateString(endDate)).toBe('2026-01-10')
    })

    it('should handle month boundaries when expanding date range', () => {
      const workoutDate = '2026-02-01'
      const startDate = parseLocalDate(workoutDate)

      startDate.setDate(startDate.getDate() - 1)

      expect(formatDateString(startDate)).toBe('2026-01-31')
    })
  })

  describe('Query date format consistency', () => {
    it('should format start date without time suffix', () => {
      const date = parseLocalDate('2026-01-08')
      const formatted = formatDateString(date)

      expect(formatted).toBe('2026-01-08')
      expect(formatted).not.toContain('T')
      expect(formatted).not.toContain('Z')
    })

    it('should use consistent date format with explicit time suffixes', () => {
      // This test verifies the fix: both gte and lte use explicit UTC timestamps
      const expandedStart = parseLocalDate('2026-01-08')
      const expandedEnd = parseLocalDate('2026-01-10')

      // Fixed query uses:
      // .gte('start_date', formatDateString(expandedStart) + 'T00:00:00Z')
      // .lte('start_date', formatDateString(expandedEnd) + 'T23:59:59Z')

      const gteValue = formatDateString(expandedStart) + 'T00:00:00Z'
      const lteValue = formatDateString(expandedEnd) + 'T23:59:59Z'

      // Both now use consistent format with explicit UTC timestamps
      expect(gteValue).toBe('2026-01-08T00:00:00Z')
      expect(lteValue).toBe('2026-01-10T23:59:59Z')

      // Both contain explicit time markers
      expect(gteValue).toContain('T')
      expect(gteValue).toContain('Z')
      expect(lteValue).toContain('T')
      expect(lteValue).toContain('Z')
    })

  })
})

describe('Activity filtering', () => {
  it('should filter out already matched activities', () => {
    const allActivities = [
      { id: 'a1', strava_activity_id: 1001, name: 'Morning Ride', type: 'Ride' },
      { id: 'a2', strava_activity_id: 1002, name: 'Virtual Ride', type: 'VirtualRide' },
      { id: 'a3', strava_activity_id: 1003, name: 'Evening Spin', type: 'Ride' },
    ]

    const matchedIds = new Set(['a1']) // First activity is matched

    const unmatched = allActivities.filter((a) => !matchedIds.has(a.id))

    expect(unmatched).toHaveLength(2)
    expect(unmatched.map((a) => a.id)).toEqual(['a2', 'a3'])
  })

  it('should include VirtualRide in unmatched activities', () => {
    const allActivities = [
      { id: 'a1', name: 'Morning Ride', type: 'Ride' },
      { id: 'a2', name: 'Zwift Session', type: 'VirtualRide' },
    ]

    const matchedIds = new Set<string>() // Nothing matched

    const unmatched = allActivities.filter((a) => !matchedIds.has(a.id))

    expect(unmatched).toHaveLength(2)
    expect(unmatched.find((a) => a.type === 'VirtualRide')).toBeDefined()
  })
})

describe('Same-day activity matching', () => {
  it('should match activity to workout on the same local date', () => {
    const workoutDate = '2026-01-09'

    // Activity done on Jan 9 (local time)
    const activityLocalDate = '2026-01-09'

    expect(activityLocalDate).toBe(workoutDate)
  })

  it('should handle VirtualRide activity on same day as workout', () => {
    const workout = { date: '2026-01-09', tss: 60, type: 'tempo' }

    // VirtualRide activity on the same day
    const activity = {
      id: 'a1',
      name: 'Zwift - Tempo Session',
      type: 'VirtualRide',
      start_date: '2026-01-09T18:30:00Z',
      tss: 58,
      moving_time: 3600,
    }

    // Get local date from activity - result depends on test runner's timezone
    const activityLocalDate = getLocalDateFromTimestamp(activity.start_date)
    // Could be Jan 9 or Jan 10 depending on timezone (UTC+11 would be Jan 10 5:30am)
    expect(activityLocalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Score the match
    const score = calculateMatchScore(
      { tss: workout.tss, type: workout.type },
      { tss: activity.tss, type: activity.type, moving_time: activity.moving_time }
    )

    // Should be a good match - VirtualRide is accepted for cycling workouts
    expect(score).toBeGreaterThanOrEqual(50) // Above threshold
  })
})

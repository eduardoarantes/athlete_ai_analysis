/**
 * Activity Styles Library Tests
 *
 * Unit tests for the activity-styles helper functions.
 * Tests cover boundary cases, fallback behavior, and type safety.
 *
 * Part of Issue #91: Migrate remaining components to use Activity Styles Library
 */

import { describe, it, expect } from 'vitest'
import {
  getPowerZoneColor,
  getSegmentTypeColor,
  getIntensityBadgeColors,
  getWorkoutBorderColor,
  getWorkoutIntensityColors,
  getActivityColors,
  getComplianceStatus,
  getComplianceColors,
  POWER_ZONE_COLORS,
  SEGMENT_TYPE_COLORS,
  INTENSITY_BADGE_COLORS,
  WORKOUT_BORDER_COLORS,
  WORKOUT_INTENSITY_COLORS,
} from '../activity-styles'

// ============================================================================
// getPowerZoneColor Tests
// ============================================================================

describe('getPowerZoneColor', () => {
  it('returns correct color for zone 1 (Active Recovery)', () => {
    expect(getPowerZoneColor(1)).toBe('bg-blue-400')
  })

  it('returns correct color for zone 2 (Endurance)', () => {
    expect(getPowerZoneColor(2)).toBe('bg-green-400')
  })

  it('returns correct color for zone 3 (Tempo)', () => {
    expect(getPowerZoneColor(3)).toBe('bg-yellow-400')
  })

  it('returns correct color for zone 4 (Threshold)', () => {
    expect(getPowerZoneColor(4)).toBe('bg-orange-400')
  })

  it('returns correct color for zone 5 (VO2max)', () => {
    expect(getPowerZoneColor(5)).toBe('bg-red-400')
  })

  it('returns default gray for zone 0 (invalid)', () => {
    expect(getPowerZoneColor(0)).toBe('bg-gray-400')
  })

  it('returns default gray for zone 6 (out of range)', () => {
    expect(getPowerZoneColor(6)).toBe('bg-gray-400')
  })

  it('returns default gray for negative zone', () => {
    expect(getPowerZoneColor(-1)).toBe('bg-gray-400')
  })
})

// ============================================================================
// getSegmentTypeColor Tests
// ============================================================================

describe('getSegmentTypeColor', () => {
  it('returns correct color for warmup segment', () => {
    expect(getSegmentTypeColor('warmup')).toBe('bg-blue-500')
  })

  it('returns correct color for work segment', () => {
    expect(getSegmentTypeColor('work')).toBe('bg-red-500')
  })

  it('returns correct color for interval segment', () => {
    expect(getSegmentTypeColor('interval')).toBe('bg-red-500')
  })

  it('returns correct color for recovery segment', () => {
    expect(getSegmentTypeColor('recovery')).toBe('bg-green-500')
  })

  it('returns correct color for cooldown segment', () => {
    expect(getSegmentTypeColor('cooldown')).toBe('bg-blue-500')
  })

  it('returns correct color for steady segment', () => {
    expect(getSegmentTypeColor('steady')).toBe('bg-yellow-500')
  })

  it('returns correct color for tempo segment', () => {
    expect(getSegmentTypeColor('tempo')).toBe('bg-orange-500')
  })

  it('returns default gray for unknown segment type', () => {
    expect(getSegmentTypeColor('unknown')).toBe('bg-gray-400')
  })

  it('returns default gray for empty string', () => {
    expect(getSegmentTypeColor('')).toBe('bg-gray-400')
  })
})

// ============================================================================
// getIntensityBadgeColors Tests
// ============================================================================

describe('getIntensityBadgeColors', () => {
  it('returns correct colors for easy intensity', () => {
    const colors = getIntensityBadgeColors('easy')
    expect(colors).toContain('bg-green-100')
    expect(colors).toContain('text-green-800')
    expect(colors).toContain('dark:bg-green-900')
  })

  it('returns correct colors for moderate intensity', () => {
    const colors = getIntensityBadgeColors('moderate')
    expect(colors).toContain('bg-yellow-100')
    expect(colors).toContain('text-yellow-800')
  })

  it('returns correct colors for hard intensity', () => {
    const colors = getIntensityBadgeColors('hard')
    expect(colors).toContain('bg-orange-100')
    expect(colors).toContain('text-orange-800')
  })

  it('returns correct colors for very_hard intensity', () => {
    const colors = getIntensityBadgeColors('very_hard')
    expect(colors).toContain('bg-red-100')
    expect(colors).toContain('text-red-800')
  })

  it('returns moderate colors as fallback for unknown intensity', () => {
    const colors = getIntensityBadgeColors('unknown')
    expect(colors).toBe(INTENSITY_BADGE_COLORS.moderate)
  })

  it('returns moderate colors as fallback for empty string', () => {
    const colors = getIntensityBadgeColors('')
    expect(colors).toBe(INTENSITY_BADGE_COLORS.moderate)
  })
})

// ============================================================================
// getWorkoutBorderColor Tests
// ============================================================================

describe('getWorkoutBorderColor', () => {
  it('returns correct border color for endurance', () => {
    expect(getWorkoutBorderColor('endurance')).toBe('border-l-green-500')
  })

  it('returns correct border color for tempo', () => {
    expect(getWorkoutBorderColor('tempo')).toBe('border-l-yellow-500')
  })

  it('returns correct border color for sweet_spot', () => {
    expect(getWorkoutBorderColor('sweet_spot')).toBe('border-l-amber-500')
  })

  it('returns correct border color for threshold', () => {
    expect(getWorkoutBorderColor('threshold')).toBe('border-l-orange-500')
  })

  it('returns correct border color for vo2max', () => {
    expect(getWorkoutBorderColor('vo2max')).toBe('border-l-red-500')
  })

  it('returns correct border color for recovery', () => {
    expect(getWorkoutBorderColor('recovery')).toBe('border-l-blue-500')
  })

  it('returns correct border color for rest', () => {
    expect(getWorkoutBorderColor('rest')).toBe('border-l-gray-500')
  })

  it('returns correct border color for mixed', () => {
    expect(getWorkoutBorderColor('mixed')).toBe('border-l-purple-500')
  })

  it('returns mixed color as fallback for unknown type', () => {
    expect(getWorkoutBorderColor('unknown')).toBe(WORKOUT_BORDER_COLORS.mixed)
  })

  it('returns mixed color as fallback for empty string', () => {
    expect(getWorkoutBorderColor('')).toBe(WORKOUT_BORDER_COLORS.mixed)
  })
})

// ============================================================================
// getWorkoutIntensityColors Tests
// ============================================================================

describe('getWorkoutIntensityColors', () => {
  it('returns correct colors for endurance', () => {
    const colors = getWorkoutIntensityColors('endurance')
    expect(colors).toContain('bg-green-100/80')
    expect(colors).toContain('dark:bg-green-900/30')
  })

  it('returns correct colors for tempo', () => {
    const colors = getWorkoutIntensityColors('tempo')
    expect(colors).toContain('bg-yellow-100/80')
  })

  it('returns correct colors for threshold', () => {
    const colors = getWorkoutIntensityColors('threshold')
    expect(colors).toContain('bg-orange-100/80')
  })

  it('returns correct colors for vo2max', () => {
    const colors = getWorkoutIntensityColors('vo2max')
    expect(colors).toContain('bg-red-100/80')
  })

  it('returns correct colors for recovery', () => {
    const colors = getWorkoutIntensityColors('recovery')
    expect(colors).toContain('bg-blue-100/80')
  })

  it('returns mixed colors as fallback for unknown type', () => {
    expect(getWorkoutIntensityColors('unknown')).toBe(WORKOUT_INTENSITY_COLORS.mixed)
  })
})

// ============================================================================
// getActivityColors Tests
// ============================================================================

describe('getActivityColors', () => {
  it('returns correct colors for Ride activity', () => {
    const colors = getActivityColors('Ride')
    expect(colors).toContain('bg-blue-100/80')
  })

  it('returns correct colors for Run activity', () => {
    const colors = getActivityColors('Run')
    expect(colors).toContain('bg-orange-100/80')
  })

  it('returns correct colors for Swim activity', () => {
    const colors = getActivityColors('Swim')
    expect(colors).toContain('bg-cyan-100/80')
  })

  it('returns default gray for unknown activity', () => {
    const colors = getActivityColors('Unknown')
    expect(colors).toContain('bg-gray-100/80')
  })
})

// ============================================================================
// getComplianceStatus Tests
// ============================================================================

describe('getComplianceStatus', () => {
  it('returns future for future workouts', () => {
    expect(getComplianceStatus(null, true)).toBe('future')
  })

  it('returns missed for null percentage (past workout)', () => {
    expect(getComplianceStatus(null, false)).toBe('missed')
    expect(getComplianceStatus(null)).toBe('missed')
  })

  it('returns on_target for 90-110% range', () => {
    expect(getComplianceStatus(90)).toBe('on_target')
    expect(getComplianceStatus(100)).toBe('on_target')
    expect(getComplianceStatus(110)).toBe('on_target')
  })

  it('returns slightly_under for 75-89% range', () => {
    expect(getComplianceStatus(75)).toBe('slightly_under')
    expect(getComplianceStatus(89)).toBe('slightly_under')
  })

  it('returns slightly_over for 110-130% range', () => {
    expect(getComplianceStatus(111)).toBe('slightly_over')
    expect(getComplianceStatus(130)).toBe('slightly_over')
  })

  it('returns significantly_under for <75%', () => {
    expect(getComplianceStatus(74)).toBe('significantly_under')
    expect(getComplianceStatus(50)).toBe('significantly_under')
    expect(getComplianceStatus(0)).toBe('significantly_under')
  })

  it('returns significantly_over for >130%', () => {
    expect(getComplianceStatus(131)).toBe('significantly_over')
    expect(getComplianceStatus(200)).toBe('significantly_over')
  })
})

// ============================================================================
// getComplianceColors Tests
// ============================================================================

describe('getComplianceColors', () => {
  it('returns green colors for on_target', () => {
    const colors = getComplianceColors(100)
    expect(colors).toContain('bg-green-50')
    expect(colors).toContain('border-green-400')
  })

  it('returns yellow colors for slightly_under', () => {
    const colors = getComplianceColors(80)
    expect(colors).toContain('bg-yellow-50')
    expect(colors).toContain('border-yellow-400')
  })

  it('returns red colors for missed', () => {
    const colors = getComplianceColors(null)
    expect(colors).toContain('bg-red-100')
    expect(colors).toContain('border-red-500')
  })

  it('returns gray colors for future', () => {
    const colors = getComplianceColors(null, true)
    expect(colors).toContain('bg-gray-50')
    expect(colors).toContain('border-gray-300')
  })
})

// ============================================================================
// Constants Exports Tests
// ============================================================================

describe('Constants Exports', () => {
  it('exports POWER_ZONE_COLORS with all 5 zones', () => {
    expect(Object.keys(POWER_ZONE_COLORS)).toHaveLength(5)
    expect(POWER_ZONE_COLORS[1]).toBeDefined()
    expect(POWER_ZONE_COLORS[5]).toBeDefined()
  })

  it('exports SEGMENT_TYPE_COLORS with all segment types', () => {
    const expectedTypes = ['warmup', 'work', 'interval', 'recovery', 'cooldown', 'steady', 'tempo']
    expectedTypes.forEach((type) => {
      expect(SEGMENT_TYPE_COLORS[type as keyof typeof SEGMENT_TYPE_COLORS]).toBeDefined()
    })
  })

  it('exports INTENSITY_BADGE_COLORS with all intensity levels', () => {
    const expectedLevels = ['easy', 'moderate', 'hard', 'very_hard']
    expectedLevels.forEach((level) => {
      expect(INTENSITY_BADGE_COLORS[level as keyof typeof INTENSITY_BADGE_COLORS]).toBeDefined()
    })
  })

  it('exports WORKOUT_BORDER_COLORS with all workout types', () => {
    const expectedTypes = [
      'endurance',
      'tempo',
      'sweet_spot',
      'threshold',
      'vo2max',
      'recovery',
      'rest',
      'mixed',
    ]
    expectedTypes.forEach((type) => {
      expect(WORKOUT_BORDER_COLORS[type as keyof typeof WORKOUT_BORDER_COLORS]).toBeDefined()
    })
  })
})

/**
 * PowerProfileSVG Component Tests
 *
 * Tests for expandSegments function which supports both legacy and new WorkoutStructure formats.
 */

import { describe, it, expect } from 'vitest'
import { expandSegments } from '../power-profile-svg'
import type { WorkoutSegmentInput, StructuredWorkoutInput } from '../power-profile-svg'

describe('expandSegments', () => {
  describe('Legacy format handling', () => {
    it('expands simple segments', () => {
      const segments: WorkoutSegmentInput[] = [
        { type: 'warmup', duration_min: 10, power_low_pct: 50, power_high_pct: 60 },
        { type: 'steady', duration_min: 20, power_low_pct: 70, power_high_pct: 80 },
        { type: 'cooldown', duration_min: 10, power_low_pct: 40, power_high_pct: 50 },
      ]

      const result = expandSegments(segments)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        type: 'warmup',
        duration_min: 10,
        power_low_pct: 50,
        power_high_pct: 60,
        description: undefined,
      })
    })

    it('expands interval sets into work/recovery pairs', () => {
      const segments: WorkoutSegmentInput[] = [
        {
          type: 'interval',
          sets: 3,
          work: { duration_min: 2, power_low_pct: 105, power_high_pct: 110 },
          recovery: { duration_min: 2, power_low_pct: 50, power_high_pct: 60 },
        },
      ]

      const result = expandSegments(segments)

      // 3 sets = 6 segments (3 work + 3 recovery)
      expect(result).toHaveLength(6)
      expect(result[0]!.type).toBe('work')
      expect(result[0]!.power_low_pct).toBe(105)
      expect(result[1]!.type).toBe('recovery')
      expect(result[1]!.power_low_pct).toBe(50)
    })

    it('handles missing power values with defaults', () => {
      const segments: WorkoutSegmentInput[] = [{ type: 'steady', duration_min: 10 }]

      const result = expandSegments(segments)

      expect(result[0]!.power_low_pct).toBe(50)
      expect(result[0]!.power_high_pct).toBe(60)
    })
  })

  describe('New WorkoutStructure format handling', () => {
    it('expands single step segments', () => {
      const structure: StructuredWorkoutInput = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Warm Up',
                intensityClass: 'warmUp',
                length: { unit: 'minute', value: 15 },
                targets: [{ type: 'power', minValue: 56, maxValue: 66, unit: 'percentOfFtp' }],
              },
            ],
          },
        ],
      }

      const result = expandSegments(undefined, structure)

      expect(result).toHaveLength(1)
      expect(result[0]!.type).toBe('warmUp')
      expect(result[0]!.duration_min).toBe(15)
      expect(result[0]!.power_low_pct).toBe(56)
      expect(result[0]!.power_high_pct).toBe(66)
    })

    it('expands 2-step intervals with repetitions', () => {
      const structure: StructuredWorkoutInput = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 3 },
            steps: [
              {
                name: 'Work',
                intensityClass: 'active',
                length: { unit: 'minute', value: 3 },
                targets: [{ type: 'power', minValue: 105, maxValue: 110, unit: 'percentOfFtp' }],
              },
              {
                name: 'Recovery',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 2 },
                targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
              },
            ],
          },
        ],
      }

      const result = expandSegments(undefined, structure)

      // 3 reps x 2 steps = 6 segments
      expect(result).toHaveLength(6)
      expect(result[0]!.type).toBe('active')
      expect(result[0]!.duration_min).toBe(3)
      expect(result[1]!.type).toBe('rest')
      expect(result[1]!.duration_min).toBe(2)
    })

    it('expands 3-step intervals (Above and Below Threshold)', () => {
      const structure: StructuredWorkoutInput = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 2 },
            steps: [
              {
                name: 'Z3 Hard',
                intensityClass: 'active',
                length: { unit: 'second', value: 90 },
                targets: [{ type: 'power', minValue: 84, maxValue: 90, unit: 'percentOfFtp' }],
              },
              {
                name: 'Z5 Harder',
                intensityClass: 'active',
                length: { unit: 'second', value: 30 },
                targets: [{ type: 'power', minValue: 105, maxValue: 110, unit: 'percentOfFtp' }],
              },
              {
                name: 'Z2 Recovery',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 1 },
                targets: [{ type: 'power', minValue: 56, maxValue: 65, unit: 'percentOfFtp' }],
              },
            ],
          },
        ],
      }

      const result = expandSegments(undefined, structure)

      // 2 reps x 3 steps = 6 segments
      expect(result).toHaveLength(6)
      expect(result[0]!.type).toBe('active')
      expect(result[0]!.duration_min).toBe(1.5) // 90 seconds = 1.5 minutes
      expect(result[0]!.power_low_pct).toBe(84)
      expect(result[1]!.type).toBe('active')
      expect(result[1]!.duration_min).toBe(0.5) // 30 seconds = 0.5 minutes
      expect(result[1]!.power_low_pct).toBe(105)
      expect(result[2]!.type).toBe('rest')
      expect(result[2]!.duration_min).toBe(1)
    })

    it('handles complete workout with multiple segment types', () => {
      const structure: StructuredWorkoutInput = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Warm Up',
                intensityClass: 'warmUp',
                length: { unit: 'minute', value: 10 },
                targets: [{ type: 'power', minValue: 50, maxValue: 60, unit: 'percentOfFtp' }],
              },
            ],
          },
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 3 },
            steps: [
              {
                name: 'On',
                intensityClass: 'active',
                length: { unit: 'minute', value: 4 },
                targets: [{ type: 'power', minValue: 100, maxValue: 105, unit: 'percentOfFtp' }],
              },
              {
                name: 'Off',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 4 },
                targets: [{ type: 'power', minValue: 50, maxValue: 55, unit: 'percentOfFtp' }],
              },
            ],
          },
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Cool Down',
                intensityClass: 'coolDown',
                length: { unit: 'minute', value: 10 },
                targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
              },
            ],
          },
        ],
      }

      const result = expandSegments(undefined, structure)

      // 1 warmup + (3 * 2 intervals) + 1 cooldown = 8 segments
      expect(result).toHaveLength(8)
      expect(result[0]!.type).toBe('warmUp')
      expect(result[1]!.type).toBe('active')
      expect(result[7]!.type).toBe('coolDown')
    })

    it('handles steps without power targets', () => {
      const structure: StructuredWorkoutInput = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Easy Spin',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 5 },
                targets: [],
              },
            ],
          },
        ],
      }

      const result = expandSegments(undefined, structure)

      expect(result).toHaveLength(1)
      expect(result[0]!.power_low_pct).toBe(50) // default
      expect(result[0]!.power_high_pct).toBe(60) // default
    })

    it('prefers structure over legacy segments when both provided', () => {
      const legacySegments: WorkoutSegmentInput[] = [
        { type: 'warmup', duration_min: 10, power_low_pct: 50, power_high_pct: 60 },
      ]

      const structure: StructuredWorkoutInput = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Different Warmup',
                intensityClass: 'warmUp',
                length: { unit: 'minute', value: 15 },
                targets: [{ type: 'power', minValue: 40, maxValue: 50, unit: 'percentOfFtp' }],
              },
            ],
          },
        ],
      }

      const result = expandSegments(legacySegments, structure)

      // Should use structure, not legacy segments
      expect(result).toHaveLength(1)
      expect(result[0]!.duration_min).toBe(15)
      expect(result[0]!.power_low_pct).toBe(40)
    })
  })
})

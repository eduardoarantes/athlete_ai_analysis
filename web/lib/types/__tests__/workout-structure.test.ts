/**
 * WorkoutStructure Type Tests
 *
 * Tests for the new multi-step interval data model (Issue #96)
 * These tests verify type contracts and helper functions for the new WorkoutStructure.
 */

import { describe, it, expect } from 'vitest'
import type {
  StepLength,
  StepTarget,
  WorkoutStep,
  SegmentLength,
  StructuredWorkoutSegment,
  WorkoutStructure,
} from '../training-plan'
import {
  convertStepLengthToMinutes,
  convertStepLengthToSeconds,
  calculateStructureDuration,
} from '../training-plan'

// ============================================================================
// Type Structure Tests (compile-time validation)
// ============================================================================

describe('WorkoutStructure Types', () => {
  describe('StepLength', () => {
    it('accepts valid duration units', () => {
      const secondLength: StepLength = { unit: 'second', value: 30 }
      const minuteLength: StepLength = { unit: 'minute', value: 5 }
      const hourLength: StepLength = { unit: 'hour', value: 1 }

      expect(secondLength.unit).toBe('second')
      expect(minuteLength.unit).toBe('minute')
      expect(hourLength.unit).toBe('hour')
    })

    it('accepts valid distance units', () => {
      const meterLength: StepLength = { unit: 'meter', value: 400 }
      const kmLength: StepLength = { unit: 'kilometer', value: 5 }
      const mileLength: StepLength = { unit: 'mile', value: 3 }

      expect(meterLength.unit).toBe('meter')
      expect(kmLength.unit).toBe('kilometer')
      expect(mileLength.unit).toBe('mile')
    })
  })

  describe('StepTarget', () => {
    it('accepts power targets with percentOfFtp unit', () => {
      const powerTarget: StepTarget = {
        type: 'power',
        minValue: 88,
        maxValue: 93,
        unit: 'percentOfFtp',
      }

      expect(powerTarget.type).toBe('power')
      expect(powerTarget.unit).toBe('percentOfFtp')
    })

    it('accepts power targets with watts unit', () => {
      const powerTarget: StepTarget = {
        type: 'power',
        minValue: 220,
        maxValue: 240,
        unit: 'watts',
      }

      expect(powerTarget.type).toBe('power')
      expect(powerTarget.unit).toBe('watts')
    })

    it('accepts heart rate targets', () => {
      const hrTarget: StepTarget = {
        type: 'heartrate',
        minValue: 140,
        maxValue: 155,
        unit: 'bpm',
      }

      expect(hrTarget.type).toBe('heartrate')
      expect(hrTarget.unit).toBe('bpm')
    })

    it('accepts cadence targets', () => {
      const cadenceTarget: StepTarget = {
        type: 'cadence',
        minValue: 85,
        maxValue: 95,
        unit: 'rpm',
      }

      expect(cadenceTarget.type).toBe('cadence')
      expect(cadenceTarget.unit).toBe('rpm')
    })

    it('allows unit to be optional', () => {
      const targetNoUnit: StepTarget = {
        type: 'power',
        minValue: 88,
        maxValue: 93,
      }

      expect(targetNoUnit.unit).toBeUndefined()
    })
  })

  describe('WorkoutStep', () => {
    it('accepts valid intensity classes', () => {
      const warmUp: WorkoutStep = {
        name: 'Warm Up',
        intensityClass: 'warmUp',
        length: { unit: 'minute', value: 10 },
        targets: [],
      }

      const active: WorkoutStep = {
        name: 'Main Set',
        intensityClass: 'active',
        length: { unit: 'minute', value: 20 },
        targets: [],
      }

      const rest: WorkoutStep = {
        name: 'Recovery',
        intensityClass: 'rest',
        length: { unit: 'minute', value: 3 },
        targets: [],
      }

      const coolDown: WorkoutStep = {
        name: 'Cool Down',
        intensityClass: 'coolDown',
        length: { unit: 'minute', value: 10 },
        targets: [],
      }

      expect(warmUp.intensityClass).toBe('warmUp')
      expect(active.intensityClass).toBe('active')
      expect(rest.intensityClass).toBe('rest')
      expect(coolDown.intensityClass).toBe('coolDown')
    })

    it('supports multiple targets', () => {
      const stepWithMultipleTargets: WorkoutStep = {
        name: 'Tempo with Cadence',
        intensityClass: 'active',
        length: { unit: 'minute', value: 20 },
        targets: [
          { type: 'power', minValue: 76, maxValue: 90, unit: 'percentOfFtp' },
          { type: 'cadence', minValue: 90, maxValue: 100, unit: 'rpm' },
        ],
      }

      expect(stepWithMultipleTargets.targets).toHaveLength(2)
      expect(stepWithMultipleTargets.targets[0]!.type).toBe('power')
      expect(stepWithMultipleTargets.targets[1]!.type).toBe('cadence')
    })

    it('supports openDuration flag', () => {
      const openStep: WorkoutStep = {
        name: 'Lap Button Recovery',
        intensityClass: 'rest',
        length: { unit: 'minute', value: 3 },
        openDuration: true,
        targets: [],
      }

      expect(openStep.openDuration).toBe(true)
    })
  })

  describe('SegmentLength', () => {
    it('only accepts repetition unit', () => {
      const segmentLength: SegmentLength = { unit: 'repetition', value: 5 }

      expect(segmentLength.unit).toBe('repetition')
      expect(segmentLength.value).toBe(5)
    })
  })

  describe('StructuredWorkoutSegment', () => {
    it('represents a single step segment', () => {
      const singleStep: StructuredWorkoutSegment = {
        type: 'step',
        length: { unit: 'repetition', value: 1 },
        steps: [
          {
            name: 'Warm Up',
            intensityClass: 'warmUp',
            length: { unit: 'minute', value: 15 },
            targets: [{ type: 'power', minValue: 56, maxValue: 75, unit: 'percentOfFtp' }],
          },
        ],
      }

      expect(singleStep.type).toBe('step')
      expect(singleStep.length.value).toBe(1)
      expect(singleStep.steps).toHaveLength(1)
    })

    it('represents a 2-step interval (work + recovery)', () => {
      const twoStepInterval: StructuredWorkoutSegment = {
        type: 'repetition',
        length: { unit: 'repetition', value: 5 },
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
            length: { unit: 'minute', value: 3 },
            targets: [{ type: 'power', minValue: 56, maxValue: 65, unit: 'percentOfFtp' }],
          },
        ],
      }

      expect(twoStepInterval.type).toBe('repetition')
      expect(twoStepInterval.length.value).toBe(5)
      expect(twoStepInterval.steps).toHaveLength(2)
    })

    it('represents a 3-step interval (Above and Below Threshold)', () => {
      const threeStepInterval: StructuredWorkoutSegment = {
        type: 'repetition',
        length: { unit: 'repetition', value: 10 },
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
      }

      expect(threeStepInterval.type).toBe('repetition')
      expect(threeStepInterval.length.value).toBe(10)
      expect(threeStepInterval.steps).toHaveLength(3)
    })
  })

  describe('WorkoutStructure', () => {
    it('represents a complete workout with warm up, intervals, and cool down', () => {
      const structure: WorkoutStructure = {
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
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 5 },
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
                targets: [{ type: 'power', minValue: 56, maxValue: 65, unit: 'percentOfFtp' }],
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
                targets: [{ type: 'power', minValue: 56, maxValue: 66, unit: 'percentOfFtp' }],
              },
            ],
          },
        ],
      }

      expect(structure.primaryIntensityMetric).toBe('percentOfFtp')
      expect(structure.primaryLengthMetric).toBe('duration')
      expect(structure.structure).toHaveLength(3)
    })

    it('supports optional polyline', () => {
      const structureWithPolyline: WorkoutStructure = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [],
        polyline: [
          [0, 0.5],
          [0.1, 0.6],
          [0.5, 1.0],
          [0.9, 0.5],
          [1.0, 0.4],
        ],
      }

      expect(structureWithPolyline.polyline).toBeDefined()
      expect(structureWithPolyline.polyline).toHaveLength(5)
    })
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Step Length Conversion Functions', () => {
  describe('convertStepLengthToSeconds', () => {
    it('converts seconds correctly', () => {
      const length: StepLength = { unit: 'second', value: 30 }
      expect(convertStepLengthToSeconds(length)).toBe(30)
    })

    it('converts minutes to seconds', () => {
      const length: StepLength = { unit: 'minute', value: 5 }
      expect(convertStepLengthToSeconds(length)).toBe(300)
    })

    it('converts hours to seconds', () => {
      const length: StepLength = { unit: 'hour', value: 1 }
      expect(convertStepLengthToSeconds(length)).toBe(3600)
    })

    it('returns value for distance-based lengths', () => {
      const meterLength: StepLength = { unit: 'meter', value: 400 }
      expect(convertStepLengthToSeconds(meterLength)).toBe(400)

      const kmLength: StepLength = { unit: 'kilometer', value: 5 }
      expect(convertStepLengthToSeconds(kmLength)).toBe(5)

      const mileLength: StepLength = { unit: 'mile', value: 3 }
      expect(convertStepLengthToSeconds(mileLength)).toBe(3)
    })
  })

  describe('convertStepLengthToMinutes', () => {
    it('converts seconds to minutes', () => {
      const length: StepLength = { unit: 'second', value: 90 }
      expect(convertStepLengthToMinutes(length)).toBe(1.5)
    })

    it('returns minutes directly', () => {
      const length: StepLength = { unit: 'minute', value: 5 }
      expect(convertStepLengthToMinutes(length)).toBe(5)
    })

    it('converts hours to minutes', () => {
      const length: StepLength = { unit: 'hour', value: 1.5 }
      expect(convertStepLengthToMinutes(length)).toBe(90)
    })

    it('returns seconds/60 for distance-based lengths', () => {
      const meterLength: StepLength = { unit: 'meter', value: 120 }
      expect(convertStepLengthToMinutes(meterLength)).toBe(2)
    })
  })

  describe('calculateStructureDuration', () => {
    it('calculates duration of empty structure', () => {
      const structure: WorkoutStructure = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [],
      }

      expect(calculateStructureDuration(structure)).toBe(0)
    })

    it('calculates duration of single step segment', () => {
      const structure: WorkoutStructure = {
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
                targets: [],
              },
            ],
          },
        ],
      }

      expect(calculateStructureDuration(structure)).toBe(15)
    })

    it('calculates duration of 2-step intervals with repetitions', () => {
      const structure: WorkoutStructure = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 5 },
            steps: [
              {
                name: 'Work',
                intensityClass: 'active',
                length: { unit: 'minute', value: 3 },
                targets: [],
              },
              {
                name: 'Recovery',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 2 },
                targets: [],
              },
            ],
          },
        ],
      }

      // 5 reps x (3 min + 2 min) = 5 x 5 = 25 min
      expect(calculateStructureDuration(structure)).toBe(25)
    })

    it('calculates duration of 3-step intervals (Above and Below Threshold)', () => {
      const structure: WorkoutStructure = {
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
                targets: [],
              },
            ],
          },
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 10 },
            steps: [
              {
                name: 'Z3 Hard',
                intensityClass: 'active',
                length: { unit: 'second', value: 90 }, // 1.5 min
                targets: [],
              },
              {
                name: 'Z5 Harder',
                intensityClass: 'active',
                length: { unit: 'second', value: 30 }, // 0.5 min
                targets: [],
              },
              {
                name: 'Z2 Recovery',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 1 }, // 1 min
                targets: [],
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
                targets: [],
              },
            ],
          },
        ],
      }

      // Warm up: 15 min
      // Intervals: 10 reps x (1.5 + 0.5 + 1) min = 10 x 3 = 30 min
      // Cool down: 10 min
      // Total: 15 + 30 + 10 = 55 min
      expect(calculateStructureDuration(structure)).toBe(55)
    })

    it('calculates complex workout structure with mixed segments', () => {
      const structure: WorkoutStructure = {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Progressive Warmup',
                intensityClass: 'warmUp',
                length: { unit: 'minute', value: 10 },
                targets: [],
              },
            ],
          },
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 3 },
            steps: [
              {
                name: 'Sprint',
                intensityClass: 'active',
                length: { unit: 'second', value: 30 },
                targets: [],
              },
              {
                name: 'Recovery',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 4 },
                targets: [],
              },
            ],
          },
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
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 4 },
            steps: [
              {
                name: 'Sprint',
                intensityClass: 'active',
                length: { unit: 'second', value: 30 },
                targets: [],
              },
              {
                name: 'Recovery',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 4 },
                targets: [],
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
                targets: [],
              },
            ],
          },
        ],
      }

      // Warmup: 10 min
      // First intervals: 3 x (0.5 + 4) = 3 x 4.5 = 13.5 min
      // Easy spin: 5 min
      // Second intervals: 4 x (0.5 + 4) = 4 x 4.5 = 18 min
      // Cool down: 10 min
      // Total: 10 + 13.5 + 5 + 18 + 10 = 56.5 min
      expect(calculateStructureDuration(structure)).toBe(56.5)
    })
  })
})

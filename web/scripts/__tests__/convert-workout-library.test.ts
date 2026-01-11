/**
 * Tests for Workout Library Conversion Script
 *
 * Tests for converting source workout JSON files to the new WorkoutStructure format.
 * Part of Issue #97: Recreate Workout Library
 */

import { describe, it, expect } from 'vitest'
import {
  inferTargetType,
  convertSourceTarget,
  convertSourceStep,
  convertSourceSegment,
  convertSourceWorkout,
  generateSignature,
  deduplicateWorkouts,
  calculateTSS,
  inferWorkoutType,
  inferWorkoutIntensity,
} from '../convert-workout-library'
import type {
  SourceWorkout,
  SourceSegment,
  SourceStep,
  SourceTarget,
} from '../convert-workout-library'

// ============================================================================
// Target Type Inference Tests
// ============================================================================

describe('inferTargetType', () => {
  it('infers power for first target in array', () => {
    const target: SourceTarget = { minValue: 65, maxValue: 75 }
    expect(inferTargetType(target, 0)).toBe('power')
  })

  it('infers cadence for second target with typical cadence range (60-120)', () => {
    const target: SourceTarget = { minValue: 85, maxValue: 95 }
    expect(inferTargetType(target, 1)).toBe('cadence')
  })

  it('infers power for second target outside cadence range', () => {
    // Values like 85-95 could be either, but 150+ is clearly power
    const target: SourceTarget = { minValue: 100, maxValue: 150 }
    expect(inferTargetType(target, 1)).toBe('power')
  })

  it('handles edge case of cadence at boundary (60-120)', () => {
    const lowerBoundary: SourceTarget = { minValue: 60, maxValue: 70 }
    expect(inferTargetType(lowerBoundary, 1)).toBe('cadence')

    const upperBoundary: SourceTarget = { minValue: 110, maxValue: 120 }
    expect(inferTargetType(upperBoundary, 1)).toBe('cadence')
  })
})

describe('convertSourceTarget', () => {
  it('converts first target to power with percentOfFtp unit', () => {
    const source: SourceTarget = { minValue: 65, maxValue: 75 }
    const result = convertSourceTarget(source, 0)

    expect(result).toEqual({
      type: 'power',
      minValue: 65,
      maxValue: 75,
      unit: 'percentOfFtp',
    })
  })

  it('converts second target to cadence with rpm unit', () => {
    const source: SourceTarget = { minValue: 85, maxValue: 95 }
    const result = convertSourceTarget(source, 1)

    expect(result).toEqual({
      type: 'cadence',
      minValue: 85,
      maxValue: 95,
      unit: 'rpm',
    })
  })
})

// ============================================================================
// Step Conversion Tests
// ============================================================================

describe('convertSourceStep', () => {
  it('converts a simple warmup step', () => {
    const source: SourceStep = {
      name: 'Warm up',
      intensityClass: 'warmUp',
      length: { unit: 'second', value: 300 },
      openDuration: false,
      targets: [{ minValue: 45, maxValue: 55 }],
    }

    const result = convertSourceStep(source)

    expect(result.name).toBe('Warm up')
    expect(result.intensityClass).toBe('warmUp')
    expect(result.length).toEqual({ unit: 'second', value: 300 })
    expect(result.targets).toHaveLength(1)
    expect(result.targets[0]).toEqual({
      type: 'power',
      minValue: 45,
      maxValue: 55,
      unit: 'percentOfFtp',
    })
  })

  it('converts a step with multiple targets (power + cadence)', () => {
    const source: SourceStep = {
      name: 'Tempo with Cadence',
      intensityClass: 'active',
      length: { unit: 'second', value: 720 },
      openDuration: false,
      targets: [
        { minValue: 85, maxValue: 90 },
        { minValue: 85, maxValue: 95 },
      ],
    }

    const result = convertSourceStep(source)

    expect(result.targets).toHaveLength(2)
    expect(result.targets[0]).toEqual({
      type: 'power',
      minValue: 85,
      maxValue: 90,
      unit: 'percentOfFtp',
    })
    expect(result.targets[1]).toEqual({
      type: 'cadence',
      minValue: 85,
      maxValue: 95,
      unit: 'rpm',
    })
  })

  it('handles step with empty name', () => {
    const source: SourceStep = {
      name: '',
      intensityClass: 'active',
      length: { unit: 'second', value: 180 },
      openDuration: false,
      targets: [{ minValue: 55, maxValue: 65 }],
    }

    const result = convertSourceStep(source)
    expect(result.name).toBe('Active') // Default name based on intensityClass
  })

  it('handles step with null-ish values', () => {
    const source: SourceStep = {
      name: 'Test',
      intensityClass: 'active',
      length: { unit: 'second', value: 60 },
      targets: [],
    }

    const result = convertSourceStep(source)
    expect(result.openDuration).toBeUndefined()
    expect(result.targets).toEqual([])
  })
})

// ============================================================================
// Segment Conversion Tests
// ============================================================================

describe('convertSourceSegment', () => {
  it('converts a step segment (single step, no repetition)', () => {
    const source: SourceSegment = {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Warm up',
          intensityClass: 'warmUp',
          length: { unit: 'second', value: 300 },
          openDuration: false,
          targets: [{ minValue: 45, maxValue: 55 }],
        },
      ],
    }

    const result = convertSourceSegment(source)

    expect(result.type).toBe('step')
    expect(result.length).toEqual({ unit: 'repetition', value: 1 })
    expect(result.steps).toHaveLength(1)
  })

  it('converts a repetition segment (interval)', () => {
    const source: SourceSegment = {
      type: 'repetition',
      length: { unit: 'repetition', value: 5 },
      steps: [
        {
          name: 'Hard',
          intensityClass: 'active',
          length: { unit: 'second', value: 180 },
          openDuration: false,
          targets: [{ minValue: 105, maxValue: 110 }],
        },
        {
          name: 'Easy',
          intensityClass: 'rest',
          length: { unit: 'second', value: 120 },
          openDuration: false,
          targets: [{ minValue: 50, maxValue: 60 }],
        },
      ],
    }

    const result = convertSourceSegment(source)

    expect(result.type).toBe('repetition')
    expect(result.length.value).toBe(5)
    expect(result.steps).toHaveLength(2)
  })

  it('converts rampUp segment to step type', () => {
    const source: SourceSegment = {
      type: 'rampUp',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: '',
          intensityClass: 'active',
          length: { unit: 'second', value: 180 },
          openDuration: false,
          targets: [{ minValue: 55, maxValue: 65 }],
        },
        {
          name: '',
          intensityClass: 'active',
          length: { unit: 'second', value: 180 },
          openDuration: false,
          targets: [{ minValue: 65, maxValue: 75 }],
        },
      ],
    }

    const result = convertSourceSegment(source)

    // rampUp should be converted to 'step' type with same structure
    expect(result.type).toBe('step')
    expect(result.length.value).toBe(1)
    expect(result.steps).toHaveLength(2)
  })
})

// ============================================================================
// Full Workout Conversion Tests
// ============================================================================

describe('convertSourceWorkout', () => {
  it('converts a simple workout with warmup, main, cooldown', () => {
    const source: SourceWorkout = {
      title: 'Cardio Drift Test',
      description: 'Ride for one hour at ~70% threshold.',
      userTags: 'Cycling,Virtual',
      coachComments: null,
      workout_structure: [
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp',
              length: { unit: 'second', value: 300 },
              openDuration: false,
              targets: [{ minValue: 45, maxValue: 55 }],
            },
          ],
        },
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Active',
              intensityClass: 'active',
              length: { unit: 'second', value: 3600 },
              openDuration: false,
              targets: [{ minValue: 70, maxValue: 70 }],
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
              length: { unit: 'second', value: 300 },
              openDuration: false,
              targets: [{ minValue: 45, maxValue: 55 }],
            },
          ],
        },
      ],
    }

    const result = convertSourceWorkout(source, 'workout_123.json')

    expect(result.name).toBe('Cardio Drift Test')
    expect(result.detailed_description).toBe('Ride for one hour at ~70% threshold.')
    expect(result.source_file).toBe('workout_123.json')
    expect(result.source_format).toBe('json')
    expect(result.structure).toBeDefined()
    expect(result.structure!.primaryIntensityMetric).toBe('percentOfFtp')
    expect(result.structure!.primaryLengthMetric).toBe('duration')
    expect(result.structure!.structure).toHaveLength(3)
  })

  it('generates unique NanoID for id', () => {
    const source: SourceWorkout = {
      title: 'Test Workout',
      description: 'Test description',
      userTags: null,
      coachComments: null,
      workout_structure: [
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Test',
              intensityClass: 'active',
              length: { unit: 'second', value: 600 },
              openDuration: false,
              targets: [{ minValue: 70, maxValue: 70 }],
            },
          ],
        },
      ],
    }

    const result1 = convertSourceWorkout(source, 'test1.json')
    const result2 = convertSourceWorkout(source, 'test2.json')

    expect(result1.id).toHaveLength(10)
    expect(result2.id).toHaveLength(10)
    expect(result1.id).not.toBe(result2.id)
  })

  it('handles null description', () => {
    const source: SourceWorkout = {
      title: 'Test Workout',
      description: null,
      userTags: null,
      coachComments: null,
      workout_structure: [
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Test',
              intensityClass: 'active',
              length: { unit: 'second', value: 600 },
              openDuration: false,
              targets: [{ minValue: 70, maxValue: 70 }],
            },
          ],
        },
      ],
    }

    const result = convertSourceWorkout(source, 'test.json')
    expect(result.detailed_description).toBeUndefined()
  })
})

// ============================================================================
// Signature Generation Tests
// ============================================================================

describe('generateSignature', () => {
  it('generates consistent signature for same structure', () => {
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp' as const,
              length: { unit: 'second' as const, value: 300 },
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const sig1 = generateSignature(structure)
    const sig2 = generateSignature(structure)

    expect(sig1).toBe(sig2)
    expect(sig1).toHaveLength(16) // First 16 chars of SHA-256
  })

  it('generates different signatures for different structures', () => {
    const structure1 = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp' as const,
              length: { unit: 'second' as const, value: 300 },
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const structure2 = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp' as const,
              length: { unit: 'second' as const, value: 600 }, // Different duration
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const sig1 = generateSignature(structure1)
    const sig2 = generateSignature(structure2)

    expect(sig1).not.toBe(sig2)
  })

  it('signature is independent of step name', () => {
    const structure1 = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp' as const,
              length: { unit: 'second' as const, value: 300 },
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const structure2 = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Different Name', // Different name
              intensityClass: 'warmUp' as const,
              length: { unit: 'second' as const, value: 300 },
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const sig1 = generateSignature(structure1)
    const sig2 = generateSignature(structure2)

    // Signature should be the same since only name differs
    expect(sig1).toBe(sig2)
  })
})

// ============================================================================
// Deduplication Tests
// ============================================================================

describe('deduplicateWorkouts', () => {
  it('removes duplicates by signature', () => {
    const workouts = [
      {
        id: 'workout1',
        name: 'Workout A',
        detailed_description: 'Short description',
        signature: 'abc123',
        source_file: 'file1.json',
        structure: { primaryIntensityMetric: 'percentOfFtp' as const, primaryLengthMetric: 'duration' as const, structure: [] },
        segments: [],
        type: 'endurance' as const,
        intensity: 'moderate' as const,
        base_duration_min: 60,
        base_tss: 50,
      },
      {
        id: 'workout2',
        name: 'Workout A Duplicate',
        detailed_description: 'This is a longer description that should be preferred',
        signature: 'abc123', // Same signature
        source_file: 'file2.json',
        structure: { primaryIntensityMetric: 'percentOfFtp' as const, primaryLengthMetric: 'duration' as const, structure: [] },
        segments: [],
        type: 'endurance' as const,
        intensity: 'moderate' as const,
        base_duration_min: 60,
        base_tss: 50,
      },
      {
        id: 'workout3',
        name: 'Workout B',
        detailed_description: 'Different workout',
        signature: 'def456', // Different signature
        source_file: 'file3.json',
        structure: { primaryIntensityMetric: 'percentOfFtp' as const, primaryLengthMetric: 'duration' as const, structure: [] },
        segments: [],
        type: 'threshold' as const,
        intensity: 'hard' as const,
        base_duration_min: 90,
        base_tss: 75,
      },
    ]

    const result = deduplicateWorkouts(workouts)

    expect(result.workouts).toHaveLength(2)
    expect(result.duplicates).toHaveLength(1)
    // Should keep the one with longer description
    const keptWorkout = result.workouts.find((w) => w.signature === 'abc123')
    expect(keptWorkout?.detailed_description).toBe('This is a longer description that should be preferred')
  })

  it('handles empty array', () => {
    const result = deduplicateWorkouts([])
    expect(result.workouts).toHaveLength(0)
    expect(result.duplicates).toHaveLength(0)
  })

  it('returns all workouts when no duplicates', () => {
    const workouts = [
      {
        id: 'workout1',
        name: 'Workout A',
        signature: 'abc123',
        source_file: 'file1.json',
        structure: { primaryIntensityMetric: 'percentOfFtp' as const, primaryLengthMetric: 'duration' as const, structure: [] },
        segments: [],
        type: 'endurance' as const,
        intensity: 'moderate' as const,
        base_duration_min: 60,
        base_tss: 50,
      },
      {
        id: 'workout2',
        name: 'Workout B',
        signature: 'def456',
        source_file: 'file2.json',
        structure: { primaryIntensityMetric: 'percentOfFtp' as const, primaryLengthMetric: 'duration' as const, structure: [] },
        segments: [],
        type: 'threshold' as const,
        intensity: 'hard' as const,
        base_duration_min: 90,
        base_tss: 75,
      },
    ]

    const result = deduplicateWorkouts(workouts)
    expect(result.workouts).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
  })
})

// ============================================================================
// TSS Calculation Tests
// ============================================================================

describe('calculateTSS', () => {
  it('calculates TSS for steady-state workout', () => {
    // 1 hour at 70% FTP = 100 * (3600 / 3600) * 0.70^2 = 49 TSS
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Steady',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 3600 },
              targets: [{ type: 'power' as const, minValue: 70, maxValue: 70, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const tss = calculateTSS(structure)
    expect(tss).toBeCloseTo(49, 0)
  })

  it('calculates TSS for interval workout', () => {
    // 5 x (3min @ 105% + 2min @ 55%)
    // Work: 5 * 180 = 900s at 105% = 100 * (900/3600) * 1.05^2 = 27.56
    // Rest: 5 * 120 = 600s at 55% = 100 * (600/3600) * 0.55^2 = 5.04
    // Total = ~32.6
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'repetition' as const,
          length: { unit: 'repetition' as const, value: 5 },
          steps: [
            {
              name: 'Work',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 180 },
              targets: [{ type: 'power' as const, minValue: 105, maxValue: 105, unit: 'percentOfFtp' as const }],
            },
            {
              name: 'Rest',
              intensityClass: 'rest' as const,
              length: { unit: 'second' as const, value: 120 },
              targets: [{ type: 'power' as const, minValue: 55, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    const tss = calculateTSS(structure)
    expect(tss).toBeCloseTo(32.6, 0)
  })
})

// ============================================================================
// Workout Type Inference Tests
// ============================================================================

describe('inferWorkoutType', () => {
  it('infers recovery type for low power workouts', () => {
    // Average power < 60%
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Easy',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 3600 },
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutType(structure, null)).toBe('recovery')
  })

  it('infers endurance type for Zone 2 power', () => {
    // Average power 60-75%
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Endurance',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 7200 },
              targets: [{ type: 'power' as const, minValue: 65, maxValue: 70, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutType(structure, null)).toBe('endurance')
  })

  it('infers tempo type for Zone 3 power', () => {
    // Average power 76-87%
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Tempo',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 3600 },
              targets: [{ type: 'power' as const, minValue: 80, maxValue: 85, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutType(structure, null)).toBe('tempo')
  })

  it('infers threshold type for Zone 4 power', () => {
    // Average power 88-94%
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Threshold',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 1200 },
              targets: [{ type: 'power' as const, minValue: 90, maxValue: 95, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutType(structure, null)).toBe('threshold')
  })

  it('infers vo2max type for high power intervals', () => {
    // Has intervals with power > 105%
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'repetition' as const,
          length: { unit: 'repetition' as const, value: 5 },
          steps: [
            {
              name: 'VO2max',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 180 },
              targets: [{ type: 'power' as const, minValue: 110, maxValue: 120, unit: 'percentOfFtp' as const }],
            },
            {
              name: 'Recovery',
              intensityClass: 'rest' as const,
              length: { unit: 'second' as const, value: 180 },
              targets: [{ type: 'power' as const, minValue: 50, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutType(structure, null)).toBe('vo2max')
  })

  it('uses description keywords when available', () => {
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Main',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 3600 },
              targets: [{ type: 'power' as const, minValue: 70, maxValue: 75, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    // Description mentions "sweet spot"
    expect(inferWorkoutType(structure, 'Sweet spot training session')).toBe('sweet_spot')
  })
})

// ============================================================================
// Workout Intensity Inference Tests
// ============================================================================

describe('inferWorkoutIntensity', () => {
  it('infers easy intensity for low average power', () => {
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Recovery',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 3600 },
              targets: [{ type: 'power' as const, minValue: 45, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutIntensity(structure)).toBe('easy')
  })

  it('infers moderate intensity for Zone 2-3 power', () => {
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Endurance',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 3600 },
              targets: [{ type: 'power' as const, minValue: 65, maxValue: 75, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutIntensity(structure)).toBe('moderate')
  })

  it('infers hard intensity for threshold work', () => {
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'step' as const,
          length: { unit: 'repetition' as const, value: 1 },
          steps: [
            {
              name: 'Threshold',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 1200 },
              // Threshold zone typically 88-94%, average 91% should be 'hard'
              targets: [{ type: 'power' as const, minValue: 88, maxValue: 94, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutIntensity(structure)).toBe('hard')
  })

  it('infers very_hard intensity for VO2max work', () => {
    const structure = {
      primaryIntensityMetric: 'percentOfFtp' as const,
      primaryLengthMetric: 'duration' as const,
      structure: [
        {
          type: 'repetition' as const,
          length: { unit: 'repetition' as const, value: 5 },
          steps: [
            {
              name: 'VO2max',
              intensityClass: 'active' as const,
              length: { unit: 'second' as const, value: 180 },
              targets: [{ type: 'power' as const, minValue: 115, maxValue: 125, unit: 'percentOfFtp' as const }],
            },
            {
              name: 'Recovery',
              intensityClass: 'rest' as const,
              length: { unit: 'second' as const, value: 180 },
              targets: [{ type: 'power' as const, minValue: 50, maxValue: 55, unit: 'percentOfFtp' as const }],
            },
          ],
        },
      ],
    }

    expect(inferWorkoutIntensity(structure)).toBe('very_hard')
  })
})

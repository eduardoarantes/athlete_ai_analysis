/**
 * Workout Filters Validation Tests
 *
 * Part of Issue #21: Plan Builder Phase 1 - Foundation
 */

import { describe, it, expect } from 'vitest'
import { validateWorkoutFilters, buildPythonArgs } from '../workout-filters'

describe('validateWorkoutFilters', () => {
  const createSearchParams = (params: Record<string, string | string[]>): URLSearchParams => {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, v)
        }
      } else {
        searchParams.set(key, value)
      }
    }
    return searchParams
  }

  describe('type validation', () => {
    it('accepts valid workout types', () => {
      const validTypes = [
        'endurance',
        'tempo',
        'sweet_spot',
        'threshold',
        'vo2max',
        'recovery',
        'mixed',
      ]

      for (const type of validTypes) {
        const result = validateWorkoutFilters(createSearchParams({ type }))
        expect(result.valid).toBe(true)
        expect(result.filters.type).toEqual([type])
      }
    })

    it('rejects invalid workout types', () => {
      const result = validateWorkoutFilters(createSearchParams({ type: 'invalid_type' }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid type(s): invalid_type')
    })

    it('accepts multiple valid types', () => {
      const result = validateWorkoutFilters(createSearchParams({ type: ['endurance', 'tempo'] }))
      expect(result.valid).toBe(true)
      expect(result.filters.type).toEqual(['endurance', 'tempo'])
    })

    it('reports multiple invalid types', () => {
      const result = validateWorkoutFilters(createSearchParams({ type: ['invalid1', 'invalid2'] }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid type(s): invalid1, invalid2')
    })
  })

  describe('intensity validation', () => {
    it('accepts valid intensities', () => {
      const validIntensities = ['easy', 'moderate', 'hard', 'very_hard']

      for (const intensity of validIntensities) {
        const result = validateWorkoutFilters(createSearchParams({ intensity }))
        expect(result.valid).toBe(true)
        expect(result.filters.intensity).toEqual([intensity])
      }
    })

    it('rejects invalid intensities', () => {
      const result = validateWorkoutFilters(createSearchParams({ intensity: 'super_hard' }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid intensity(ies): super_hard')
    })
  })

  describe('phase validation', () => {
    it('accepts valid phases', () => {
      const validPhases = ['Base', 'Build', 'Peak', 'Recovery', 'Taper', 'Foundation']

      for (const phase of validPhases) {
        const result = validateWorkoutFilters(createSearchParams({ phase }))
        expect(result.valid).toBe(true)
        expect(result.filters.phase).toEqual([phase])
      }
    })

    it('rejects invalid phases', () => {
      const result = validateWorkoutFilters(createSearchParams({ phase: 'InvalidPhase' }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid phase(s): InvalidPhase')
    })
  })

  describe('duration validation', () => {
    it('accepts valid minDuration', () => {
      const result = validateWorkoutFilters(createSearchParams({ minDuration: '60' }))
      expect(result.valid).toBe(true)
      expect(result.filters.minDuration).toBe(60)
    })

    it('accepts valid maxDuration', () => {
      const result = validateWorkoutFilters(createSearchParams({ maxDuration: '120' }))
      expect(result.valid).toBe(true)
      expect(result.filters.maxDuration).toBe(120)
    })

    it('rejects negative minDuration', () => {
      const result = validateWorkoutFilters(createSearchParams({ minDuration: '-10' }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('minDuration must be a non-negative integer')
    })

    it('rejects non-numeric minDuration', () => {
      const result = validateWorkoutFilters(createSearchParams({ minDuration: 'abc' }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('minDuration must be a non-negative integer')
    })

    it('rejects minDuration > maxDuration', () => {
      const result = validateWorkoutFilters(
        createSearchParams({ minDuration: '120', maxDuration: '60' })
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('minDuration cannot be greater than maxDuration')
    })

    it('accepts valid duration range', () => {
      const result = validateWorkoutFilters(
        createSearchParams({ minDuration: '60', maxDuration: '120' })
      )
      expect(result.valid).toBe(true)
      expect(result.filters.minDuration).toBe(60)
      expect(result.filters.maxDuration).toBe(120)
    })
  })

  describe('search validation', () => {
    it('accepts search term', () => {
      const result = validateWorkoutFilters(createSearchParams({ search: 'zone 2' }))
      expect(result.valid).toBe(true)
      expect(result.filters.search).toBe('zone 2')
    })

    it('trims search term', () => {
      const result = validateWorkoutFilters(createSearchParams({ search: '  zone 2  ' }))
      expect(result.valid).toBe(true)
      expect(result.filters.search).toBe('zone 2')
    })
  })

  describe('empty params', () => {
    it('returns valid with empty filters for no params', () => {
      const result = validateWorkoutFilters(new URLSearchParams())
      expect(result.valid).toBe(true)
      expect(result.filters).toEqual({})
    })
  })
})

describe('buildPythonArgs', () => {
  it('returns empty array for empty filters', () => {
    const args = buildPythonArgs({})
    expect(args).toEqual([])
  })

  it('builds args for single type', () => {
    const args = buildPythonArgs({ type: ['endurance'] })
    expect(args).toEqual(['--type', 'endurance'])
  })

  it('builds args for multiple types', () => {
    const args = buildPythonArgs({ type: ['endurance', 'tempo'] })
    expect(args).toEqual(['--type', 'endurance', '--type', 'tempo'])
  })

  it('builds args for intensity', () => {
    const args = buildPythonArgs({ intensity: ['easy'] })
    expect(args).toEqual(['--intensity', 'easy'])
  })

  it('builds args for phase', () => {
    const args = buildPythonArgs({ phase: ['Base'] })
    expect(args).toEqual(['--phase', 'Base'])
  })

  it('builds args for duration range', () => {
    const args = buildPythonArgs({ minDuration: 60, maxDuration: 120 })
    expect(args).toEqual(['--min-duration', '60', '--max-duration', '120'])
  })

  it('builds args for search', () => {
    const args = buildPythonArgs({ search: 'zone 2' })
    expect(args).toEqual(['--search', "'zone 2'"])
  })

  it('escapes single quotes in search', () => {
    const args = buildPythonArgs({ search: "it's a test" })
    expect(args).toEqual(['--search', "'it'\\''s a test'"])
  })

  it('builds combined args', () => {
    const args = buildPythonArgs({
      type: ['endurance'],
      phase: ['Base'],
      minDuration: 60,
      maxDuration: 120,
      search: 'zone 2',
    })

    expect(args).toContain('--type')
    expect(args).toContain('endurance')
    expect(args).toContain('--phase')
    expect(args).toContain('Base')
    expect(args).toContain('--min-duration')
    expect(args).toContain('60')
    expect(args).toContain('--max-duration')
    expect(args).toContain('120')
    expect(args).toContain('--search')
  })
})

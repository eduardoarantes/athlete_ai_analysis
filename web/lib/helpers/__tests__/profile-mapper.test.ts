import { describe, it, expect } from 'vitest'
import { mapProfileUpdates } from '../profile-mapper'

describe('mapProfileUpdates', () => {
  it('should map camelCase fields to snake_case', () => {
    const updates = {
      firstName: 'John',
      lastName: 'Doe',
      age: 35,
      ftp: 265,
    }

    const result = mapProfileUpdates(updates)

    expect(result).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      age: 35,
      ftp: 265,
    })
  })

  it('should only include defined fields', () => {
    const updates = {
      firstName: 'John',
      ftp: undefined,
    }

    const result = mapProfileUpdates(updates)

    expect(result).toEqual({
      first_name: 'John',
    })
    expect(result).not.toHaveProperty('ftp')
  })

  it('should handle all profile fields', () => {
    const updates = {
      firstName: 'John',
      lastName: 'Doe',
      age: 35,
      gender: 'male',
      ftp: 265,
      maxHr: 186,
      restingHr: 52,
      weightKg: 70,
      goals: ['Improve FTP', 'Race'],
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      unitsSystem: 'metric',
    }

    const result = mapProfileUpdates(updates)

    expect(result).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      age: 35,
      gender: 'male',
      ftp: 265,
      max_hr: 186,
      resting_hr: 52,
      weight_kg: 70,
      goals: ['Improve FTP', 'Race'],
      preferred_language: 'en',
      timezone: 'America/New_York',
      units_system: 'metric',
    })
  })

  it('should handle empty updates', () => {
    const updates = {}

    const result = mapProfileUpdates(updates)

    expect(result).toEqual({})
  })

  it('should preserve array values', () => {
    const updates = {
      goals: ['Goal 1', 'Goal 2', 'Goal 3'],
    }

    const result = mapProfileUpdates(updates)

    expect(result.goals).toEqual(['Goal 1', 'Goal 2', 'Goal 3'])
    expect(Array.isArray(result.goals)).toBe(true)
  })
})

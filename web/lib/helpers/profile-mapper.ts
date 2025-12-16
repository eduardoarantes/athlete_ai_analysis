/**
 * Profile field mapping helpers
 * Converts between camelCase API format and snake_case database format
 */

import type { Database } from '@/lib/types/database'

type ProfileUpdate = Database['public']['Tables']['athlete_profiles']['Update']

/**
 * Maps camelCase profile updates to snake_case database format
 * Only includes fields that are defined in the updates object
 */
export function mapProfileUpdates(updates: {
  firstName?: string
  lastName?: string
  age?: number
  gender?: string
  ftp?: number
  maxHr?: number
  restingHr?: number
  weightKg?: number
  goals?: string[]
  preferredLanguage?: string
  timezone?: string
  unitsSystem?: string
}): ProfileUpdate {
  const updateData: ProfileUpdate = {}

  if (updates.firstName !== undefined) updateData.first_name = updates.firstName
  if (updates.lastName !== undefined) updateData.last_name = updates.lastName
  if (updates.age !== undefined) updateData.age = updates.age
  if (updates.gender !== undefined) updateData.gender = updates.gender
  if (updates.ftp !== undefined) updateData.ftp = updates.ftp
  if (updates.maxHr !== undefined) updateData.max_hr = updates.maxHr
  if (updates.restingHr !== undefined) updateData.resting_hr = updates.restingHr
  if (updates.weightKg !== undefined) updateData.weight_kg = updates.weightKg
  if (updates.goals !== undefined) updateData.goals = updates.goals
  if (updates.preferredLanguage !== undefined)
    updateData.preferred_language = updates.preferredLanguage
  if (updates.timezone !== undefined) updateData.timezone = updates.timezone
  if (updates.unitsSystem !== undefined) updateData.units_system = updates.unitsSystem

  return updateData
}

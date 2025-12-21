/**
 * Formatting utilities for display labels with i18n support
 */

// Goal keys that can appear in plan names and descriptions
export const GOAL_KEYS = [
  'improve-ftp',
  'build-endurance',
  'race-prep',
  'weight-loss',
  'general-fitness',
] as const

export type GoalKey = (typeof GOAL_KEYS)[number]

/**
 * Translation function type for goals
 * Compatible with next-intl's useTranslations('goals') or getTranslations('goals')
 */
type GoalTranslator = (key: string) => string

/**
 * Format plan name/description by replacing goal keys with translated labels
 * @param text - The text containing goal keys (e.g., "Training plan for race-prep")
 * @param t - Translation function from useTranslations('goals') or getTranslations('goals')
 * @returns Formatted text with translated goal labels
 *
 * @example
 * // In a client component:
 * const t = useTranslations('goals')
 * formatWithGoalLabels("race-prep - 12 weeks", t) // "Race Preparation - 12 weeks"
 *
 * @example
 * // In a server component:
 * const t = await getTranslations('goals')
 * formatWithGoalLabels("Training plan for race-prep", t) // "Training plan for Race Preparation"
 */
export function formatWithGoalLabels(text: string, t: GoalTranslator): string {
  let formatted = text
  for (const key of GOAL_KEYS) {
    formatted = formatted.replace(key, t(key))
  }
  return formatted
}

/**
 * Get the translated label for a goal key
 * @param goalKey - The goal key (e.g., "race-prep")
 * @param t - Translation function from useTranslations('goals') or getTranslations('goals')
 * @returns Translated label or the original key if not found
 */
export function getGoalLabel(goalKey: string, t: GoalTranslator): string {
  if (GOAL_KEYS.includes(goalKey as GoalKey)) {
    return t(goalKey)
  }
  return goalKey
}

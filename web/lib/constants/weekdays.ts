/**
 * Weekday Constants
 *
 * Common weekday definitions used throughout the application for consistent
 * day-of-week handling across scheduling, calendar, and training plan features.
 */

/**
 * Weekday names in order starting from Sunday (matches JavaScript Date.getDay())
 */
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/**
 * Weekday type derived from the names array
 */
export type Weekday = (typeof WEEKDAY_NAMES)[number]

/**
 * Map weekday names to JavaScript day indices (0 = Sunday, 6 = Saturday)
 * This matches the standard JavaScript Date.getDay() return values
 */
export const WEEKDAY_TO_JS_DAY: Record<Weekday, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

/**
 * Get weekday name from JavaScript day index (0 = Sunday, 6 = Saturday)
 */
export function getWeekdayName(dayIndex: number): Weekday {
  const normalizedIndex = ((dayIndex % 7) + 7) % 7 // Handle negative indices
  return WEEKDAY_NAMES[normalizedIndex]!
}

/**
 * Get JavaScript day index from weekday name
 */
export function getWeekdayIndex(weekdayName: Weekday): number {
  return WEEKDAY_TO_JS_DAY[weekdayName]
}

/**
 * Calculate day offset from a start day to a target weekday
 * Used when calculating workout dates from week number and weekday
 *
 * @param targetWeekday - The weekday to calculate offset for
 * @param startDayOfWeek - The day of week the plan/week starts on (0 = Sunday, 6 = Saturday)
 * @returns Number of days to add to get from start day to target weekday
 *
 * @example
 * // Plan starts on Tuesday (2), workout is on Thursday (4)
 * getDayOffsetInWeek('Thursday', 2) // Returns 2
 *
 * // Plan starts on Thursday (4), workout is on Tuesday (2) - wraps to next week
 * getDayOffsetInWeek('Tuesday', 4) // Returns 5 (Thu→Fri→Sat→Sun→Mon→Tue)
 */
export function getDayOffsetInWeek(targetWeekday: Weekday, startDayOfWeek: number): number {
  const targetDayOfWeek = WEEKDAY_TO_JS_DAY[targetWeekday]
  let offset = targetDayOfWeek - startDayOfWeek

  // If target comes before start day in the week, wrap to next week
  if (offset < 0) {
    offset += 7
  }

  return offset
}

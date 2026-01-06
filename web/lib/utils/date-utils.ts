/**
 * Date utilities for handling dates consistently across the application.
 *
 * Key principle: Date strings in YYYY-MM-DD format represent calendar dates,
 * not specific moments in time. We parse them as local dates to avoid
 * timezone-related off-by-one errors.
 */

/**
 * Parse a date string (YYYY-MM-DD) as a local date, avoiding timezone issues.
 * When you parse "2025-01-06" with new Date(), it's interpreted as UTC midnight,
 * which can appear as a different day in local time. This function ensures
 * the date is always interpreted in local time.
 */
export function parseLocalDate(dateString: string): Date {
  // Split the date string and create a date using local time components
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateString}`)
  }
  // Month is 0-indexed in JavaScript
  return new Date(year, month - 1, day)
}

/**
 * Format a Date object as YYYY-MM-DD string (local date)
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate end date by adding weeks to a start date
 * @param startDate - Start date string in YYYY-MM-DD format
 * @param weeks - Number of weeks to add
 * @returns End date string in YYYY-MM-DD format
 */
export function calculateEndDate(startDate: string, weeks: number): string {
  const start = parseLocalDate(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  return formatDateString(end)
}

/**
 * Get tomorrow's date as YYYY-MM-DD string
 */
export function getTomorrowDateString(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return formatDateString(tomorrow)
}

/**
 * Check if a date string represents today
 */
export function isToday(dateString: string): boolean {
  const date = parseLocalDate(dateString)
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

/**
 * Check if a date is in the past (before today)
 */
export function isPastDate(dateString: string): boolean {
  const date = parseLocalDate(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/**
 * Extract local date string from an ISO timestamp.
 * Converts UTC timestamp to local timezone date.
 *
 * Example: "2025-12-28T20:36:07+00:00" in UTC+11 becomes "2025-12-29"
 */
export function getLocalDateFromTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  return formatDateString(date)
}

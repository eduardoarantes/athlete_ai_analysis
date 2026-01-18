/**
 * Input Sanitization Utilities
 *
 * Provides functions for sanitizing user input to prevent injection attacks
 * and ensure data integrity.
 */

/**
 * Sanitizes search input by removing special characters that could be used
 * for PostgREST operator injection or SQL injection attacks.
 *
 * Allowed characters:
 * - Letters (a-zA-Z)
 * - Numbers (0-9)
 * - Email symbols (@, .)
 * - Hyphens (-)
 * - Whitespace
 *
 * Removed characters include:
 * - PostgREST operators: %, ,, =, |, &, <, >, etc.
 * - SQL injection chars: ', ", ;, --, etc.
 * - Function calls: (, ), {, }
 *
 * @param input - The user input string to sanitize
 * @returns Sanitized string with only safe characters
 *
 * @example
 * ```typescript
 * // Safe input - unchanged
 * sanitizeSearchInput('john.doe@example.com')
 * // => 'john.doe@example.com'
 *
 * // Malicious input - special chars removed
 * sanitizeSearchInput("test%';DROP TABLE users;--")
 * // => 'testDROP TABLE users--'
 *
 * // PostgREST injection attempt - operators removed
 * sanitizeSearchInput('admin%,email.eq.admin@example.com')
 * // => 'adminemail.eq.admin@example.com'
 * ```
 */
export function sanitizeSearchInput(input: string): string {
  // Remove all characters except:
  // - a-zA-Z (letters)
  // - 0-9 (numbers)
  // - @ (email at symbol)
  // - . (dot for emails and names)
  // - - (hyphen for names)
  // - \s (whitespace)
  return input.replace(/[^a-zA-Z0-9@.\-\s]/g, '')
}

/**
 * Sanitizes a UUID string to ensure it matches the expected format.
 * Returns the input if valid, or throws an error if invalid.
 *
 * @param input - The UUID string to validate
 * @returns The validated UUID string
 * @throws Error if the input is not a valid UUID format
 *
 * @example
 * ```typescript
 * // Valid UUID
 * sanitizeUUID('123e4567-e89b-12d3-a456-426614174000')
 * // => '123e4567-e89b-12d3-a456-426614174000'
 *
 * // Invalid UUID
 * sanitizeUUID('not-a-uuid')
 * // => throws Error
 * ```
 */
export function sanitizeUUID(input: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(input)) {
    throw new Error('Invalid UUID format')
  }
  return input
}

/**
 * Sanitizes a date string to ensure it matches YYYY-MM-DD format.
 * Returns the input if valid, or throws an error if invalid.
 *
 * @param input - The date string to validate
 * @returns The validated date string
 * @throws Error if the input is not in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * // Valid date
 * sanitizeDateString('2026-01-17')
 * // => '2026-01-17'
 *
 * // Invalid date
 * sanitizeDateString('01/17/2026')
 * // => throws Error
 * ```
 */
export function sanitizeDateString(input: string): string {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(input)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD')
  }
  return input
}

/**
 * Google OAuth Metadata Extraction
 *
 * Utilities for extracting user metadata from Google OAuth responses.
 * Handles variations in metadata field names across different OAuth flows.
 */

import type { User } from '@supabase/supabase-js'

/**
 * Extracted Google user metadata
 */
export interface GoogleUserMetadata {
  /** Full name from Google profile */
  fullName: string | null
  /** Avatar/profile picture URL */
  avatarUrl: string | null
  /** Email address */
  email: string | null
}

/**
 * Extract Google metadata from Supabase User object
 *
 * Google OAuth can return metadata in different field names:
 * - full_name or name
 * - avatar_url or picture
 *
 * This function normalizes these variations into a consistent format.
 *
 * @param user - Supabase User object from OAuth authentication
 * @returns Normalized Google user metadata
 *
 * @example
 * ```typescript
 * const { data: { user } } = await supabase.auth.getUser()
 * if (user) {
 *   const metadata = extractGoogleMetadata(user)
 *   console.log(metadata.fullName) // "John Doe"
 * }
 * ```
 */
export function extractGoogleMetadata(user: User): GoogleUserMetadata {
  const userMetadata = user.user_metadata || {}

  // Extract full name (try full_name first, fallback to name)
  const fullName =
    typeof userMetadata.full_name === 'string' && userMetadata.full_name.trim() !== ''
      ? userMetadata.full_name
      : typeof userMetadata.name === 'string' && userMetadata.name.trim() !== ''
        ? userMetadata.name
        : null

  // Extract avatar URL (try avatar_url first, fallback to picture)
  const avatarUrl =
    typeof userMetadata.avatar_url === 'string' && userMetadata.avatar_url.trim() !== ''
      ? userMetadata.avatar_url
      : typeof userMetadata.picture === 'string' && userMetadata.picture.trim() !== ''
        ? userMetadata.picture
        : null

  // Extract email (from user.email)
  const email = typeof user.email === 'string' && user.email.trim() !== '' ? user.email : null

  return {
    fullName,
    avatarUrl,
    email,
  }
}

# CARD 2: Create Google Metadata Helper

**Task:** Create helper utility to extract metadata from Google OAuth users
**File:** `web/lib/services/google-metadata.ts` (NEW)
**Dependencies:** CARD_1 (optional, can be implemented independently)
**Estimated Time:** 30 minutes

---

## Objective

Create a type-safe utility function that extracts useful metadata from Google OAuth user objects. This metadata can be used to pre-fill the onboarding form, improving user experience for new Google login users.

**What we extract:**
- Full name (from `user_metadata.full_name` or `user_metadata.name`)
- Avatar URL (from `user_metadata.avatar_url` or `user_metadata.picture`)
- Email (from `user.email`)

**What we DON'T extract:**
- No sensitive data
- No tokens or credentials
- No data from athlete_profiles

---

## Implementation Steps

### Step 1: Create Directory (if needed)

```bash
mkdir -p web/lib/services
```

### Step 2: Create Type Definitions

Define the return type for extracted metadata:

```typescript
/**
 * Extracted metadata from Google OAuth user
 */
export interface GoogleUserMetadata {
  /** User's full name from Google (may be null) */
  fullName: string | null
  /** User's avatar URL from Google (may be null) */
  avatarUrl: string | null
  /** User's email address */
  email: string | null
}
```

### Step 3: Implement Extraction Function

Create the main extraction function:

```typescript
import type { User } from '@supabase/supabase-js'

/**
 * Extract useful metadata from Google OAuth user for profile pre-filling
 *
 * @param user - Supabase user object (from auth.getUser())
 * @returns Extracted metadata (fullName, avatarUrl, email)
 *
 * @example
 * ```typescript
 * const { data: { user } } = await supabase.auth.getUser()
 * const metadata = extractGoogleMetadata(user)
 *
 * if (metadata.fullName) {
 *   // Pre-fill name field in onboarding
 * }
 * ```
 */
export function extractGoogleMetadata(user: User): GoogleUserMetadata {
  const metadata = user.user_metadata || {}

  return {
    // Google provides either 'full_name' or 'name'
    fullName: metadata.full_name || metadata.name || null,

    // Google provides either 'avatar_url' or 'picture'
    avatarUrl: metadata.avatar_url || metadata.picture || null,

    // Email from top-level user object
    email: user.email || null,
  }
}
```

### Step 4: Add Helper Function to Split Name (Optional)

Add a helper to split full name into first/last:

```typescript
/**
 * Split full name into first and last name
 *
 * @param fullName - Full name string (e.g., "John Doe")
 * @returns Object with firstName and lastName
 *
 * @example
 * ```typescript
 * const { firstName, lastName } = splitFullName("John Doe")
 * // firstName = "John", lastName = "Doe"
 * ```
 */
export function splitFullName(fullName: string | null): {
  firstName: string | null
  lastName: string | null
} {
  if (!fullName || fullName.trim() === '') {
    return { firstName: null, lastName: null }
  }

  const parts = fullName.trim().split(/\s+/)

  if (parts.length === 1) {
    // Single name (e.g., "John")
    return { firstName: parts[0], lastName: null }
  }

  // Multiple parts: first word is firstName, rest is lastName
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return { firstName, lastName }
}
```

---

## Complete Implementation

Here is the complete file:

```typescript
/**
 * Google OAuth Metadata Extraction
 *
 * Utilities for extracting useful metadata from Google OAuth users
 * to pre-fill profile information during onboarding.
 */

import type { User } from '@supabase/supabase-js'

/**
 * Extracted metadata from Google OAuth user
 */
export interface GoogleUserMetadata {
  /** User's full name from Google (may be null) */
  fullName: string | null
  /** User's avatar URL from Google (may be null) */
  avatarUrl: string | null
  /** User's email address */
  email: string | null
}

/**
 * Extract useful metadata from Google OAuth user for profile pre-filling
 *
 * @param user - Supabase user object (from auth.getUser())
 * @returns Extracted metadata (fullName, avatarUrl, email)
 *
 * @example
 * ```typescript
 * const { data: { user } } = await supabase.auth.getUser()
 * const metadata = extractGoogleMetadata(user)
 *
 * if (metadata.fullName) {
 *   // Pre-fill name field in onboarding
 *   const { firstName, lastName } = splitFullName(metadata.fullName)
 * }
 * ```
 */
export function extractGoogleMetadata(user: User): GoogleUserMetadata {
  const metadata = user.user_metadata || {}

  return {
    // Google provides either 'full_name' or 'name'
    fullName: metadata.full_name || metadata.name || null,

    // Google provides either 'avatar_url' or 'picture'
    avatarUrl: metadata.avatar_url || metadata.picture || null,

    // Email from top-level user object
    email: user.email || null,
  }
}

/**
 * Split full name into first and last name
 *
 * Handles various name formats:
 * - Single name: "John" → { firstName: "John", lastName: null }
 * - Two names: "John Doe" → { firstName: "John", lastName: "Doe" }
 * - Multiple names: "John Paul Doe" → { firstName: "John", lastName: "Paul Doe" }
 *
 * @param fullName - Full name string (e.g., "John Doe")
 * @returns Object with firstName and lastName
 *
 * @example
 * ```typescript
 * const { firstName, lastName } = splitFullName("John Doe")
 * // firstName = "John", lastName = "Doe"
 *
 * const { firstName, lastName } = splitFullName("John")
 * // firstName = "John", lastName = null
 * ```
 */
export function splitFullName(fullName: string | null): {
  firstName: string | null
  lastName: string | null
} {
  if (!fullName || fullName.trim() === '') {
    return { firstName: null, lastName: null }
  }

  const parts = fullName.trim().split(/\s+/)

  if (parts.length === 1) {
    // Single name (e.g., "John")
    return { firstName: parts[0], lastName: null }
  }

  // Multiple parts: first word is firstName, rest is lastName
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return { firstName, lastName }
}
```

---

## Usage Example

### In Onboarding Component

```typescript
// web/app/(dashboard)/onboarding/page.tsx (future enhancement)

import { createClient } from '@/lib/supabase/server'
import { extractGoogleMetadata, splitFullName } from '@/lib/services/google-metadata'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Extract metadata from Google OAuth
  const metadata = extractGoogleMetadata(user)
  const { firstName, lastName } = splitFullName(metadata.fullName)

  // Pass to client component for pre-filling
  return (
    <OnboardingForm
      defaultValues={{
        email: metadata.email,
        firstName: firstName,
        lastName: lastName,
        avatarUrl: metadata.avatarUrl,
      }}
    />
  )
}
```

### In API Route

```typescript
// web/app/api/profile/create/route.ts (if needed)

import { extractGoogleMetadata } from '@/lib/services/google-metadata'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const metadata = extractGoogleMetadata(user!)

  // Use metadata for profile creation
  // ...
}
```

---

## Testing Instructions

### Test 1: Extract Metadata from Google User

Create a test file: `web/lib/services/__tests__/google-metadata.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { extractGoogleMetadata, splitFullName } from '../google-metadata'
import type { User } from '@supabase/supabase-js'

describe('extractGoogleMetadata', () => {
  it('should extract full metadata from Google user', () => {
    const mockUser = {
      id: '123',
      email: 'john.doe@example.com',
      user_metadata: {
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    } as User

    const result = extractGoogleMetadata(mockUser)

    expect(result.fullName).toBe('John Doe')
    expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    expect(result.email).toBe('john.doe@example.com')
  })

  it('should handle missing metadata gracefully', () => {
    const mockUser = {
      id: '123',
      email: 'john.doe@example.com',
      user_metadata: {},
    } as User

    const result = extractGoogleMetadata(mockUser)

    expect(result.fullName).toBeNull()
    expect(result.avatarUrl).toBeNull()
    expect(result.email).toBe('john.doe@example.com')
  })

  it('should fallback to alternative field names', () => {
    const mockUser = {
      id: '123',
      email: 'john.doe@example.com',
      user_metadata: {
        name: 'John Doe', // Alternative field
        picture: 'https://example.com/pic.jpg', // Alternative field
      },
    } as User

    const result = extractGoogleMetadata(mockUser)

    expect(result.fullName).toBe('John Doe')
    expect(result.avatarUrl).toBe('https://example.com/pic.jpg')
  })
})

describe('splitFullName', () => {
  it('should split two-part name correctly', () => {
    const result = splitFullName('John Doe')
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Doe')
  })

  it('should handle single name', () => {
    const result = splitFullName('John')
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBeNull()
  })

  it('should handle multi-part last name', () => {
    const result = splitFullName('John Paul Doe')
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Paul Doe')
  })

  it('should handle empty/null names', () => {
    expect(splitFullName(null)).toEqual({ firstName: null, lastName: null })
    expect(splitFullName('')).toEqual({ firstName: null, lastName: null })
    expect(splitFullName('   ')).toEqual({ firstName: null, lastName: null })
  })

  it('should handle extra whitespace', () => {
    const result = splitFullName('  John   Doe  ')
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Doe')
  })
})
```

Run tests:
```bash
cd web
pnpm test:unit:run lib/services/__tests__/google-metadata.test.ts
```

### Test 2: Manual Testing with Real OAuth User

```bash
# 1. Sign in with Google
# 2. In browser console or API route, log user object:

const { data: { user } } = await supabase.auth.getUser()
console.log('User metadata:', user.user_metadata)

# 3. Verify fields present:
# - full_name or name
# - avatar_url or picture
```

---

## Acceptance Criteria

- [ ] `web/lib/services/google-metadata.ts` created
- [ ] `GoogleUserMetadata` type defined
- [ ] `extractGoogleMetadata()` function implemented
- [ ] `splitFullName()` helper function implemented
- [ ] All functions handle null/missing data gracefully
- [ ] TypeScript strict mode passes
- [ ] Unit tests pass (if created)
- [ ] Functions exported for use in other files

---

## Type Safety Verification

```bash
cd web
pnpm type-check
```

Expected: No errors

---

## Integration Points

### Depends On
- ✅ Supabase Auth types (`@supabase/supabase-js`)
- ✅ Google OAuth configured (already done)

### Enables
- Future: Pre-fill onboarding form with Google data
- Future: Display user avatar from Google
- Future: Reduce friction for new OAuth users

---

## Future Enhancements (Not in This Task)

1. **Use in Onboarding**
   - Extract metadata in onboarding page
   - Pre-fill name and email fields
   - Display Google avatar

2. **Support Other OAuth Providers**
   - GitHub metadata extraction
   - Apple metadata extraction
   - Unified extraction interface

3. **Avatar Upload**
   - Download Google avatar
   - Upload to Supabase Storage
   - Store URL in athlete_profiles

---

## Next Steps

After completing CARD_2:

1. ✅ Run unit tests
2. ✅ Verify TypeScript compilation
3. ✅ Mark task as complete
4. Optional: Integrate into onboarding (future enhancement)

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-25

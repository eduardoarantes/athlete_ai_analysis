# CARD 6: Admin Guard Utility

**Task:** Create server-side admin authorization guard
**File:** `web/lib/guards/admin-guard.ts`
**Dependencies:** CARD_3 (is_admin function), CARD_5 (TypeScript types)
**Estimated Time:** 1 hour

---

## Objective

Create a reusable server-side utility that:
1. Checks if the current user has admin role
2. Returns authorization result with user info
3. Logs all admin checks for security audit
4. Can be used in API routes and server components

---

## Implementation Steps

### Step 1: Create `web/lib/guards/` Directory

```bash
mkdir -p web/lib/guards
```

### Step 2: Create `web/lib/guards/admin-guard.ts`

```typescript
/**
 * Admin Guard Utility
 *
 * Server-side authorization check for admin routes.
 * Uses Supabase is_admin() function to check user role from JWT.
 *
 * Usage:
 *   import { requireAdmin } from '@/lib/guards/admin-guard'
 *
 *   export async function GET(request: Request) {
 *     const supabase = createClient()
 *     const auth = await requireAdmin(supabase)
 *
 *     if (!auth.authorized) {
 *       return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
 *     }
 *
 *     // Admin-only logic here
 *   }
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { errorLogger } from '@/lib/monitoring/error-logger'

/**
 * Admin authorization result
 */
export interface AdminAuthResult {
  /** Whether user is authorized as admin */
  authorized: boolean
  /** User ID (if authenticated) */
  userId: string | null
  /** User role from JWT */
  role: string | null
  /** Error message (if not authorized) */
  error?: string
}

/**
 * Check if current user has admin role
 *
 * This function:
 * 1. Checks if user is authenticated
 * 2. Calls Supabase is_admin() function to check role
 * 3. Logs the authorization attempt
 * 4. Returns authorization result
 *
 * @param supabase - Supabase client (server-side)
 * @returns Authorization result
 *
 * @example
 * ```typescript
 * const auth = await requireAdmin(supabase)
 * if (!auth.authorized) {
 *   return NextResponse.json({ error: auth.error }, { status: 403 })
 * }
 * ```
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<AdminAuthResult> {
  try {
    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      errorLogger.logWarning('Admin check: User not authenticated', {
        metadata: { authError: authError?.message },
      })

      return {
        authorized: false,
        userId: null,
        role: null,
        error: 'Authentication required',
      }
    }

    // Call Supabase is_admin() function
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')

    if (roleError) {
      errorLogger.logError(roleError as Error, {
        userId: user.id,
        path: '/lib/guards/admin-guard',
        metadata: { function: 'is_admin' },
      })

      return {
        authorized: false,
        userId: user.id,
        role: null,
        error: 'Failed to check admin role',
      }
    }

    // Get role from JWT metadata
    const role = (user.user_metadata?.role as string) || 'user'

    // Log authorization attempt
    if (isAdmin) {
      errorLogger.logInfo('Admin access granted', {
        userId: user.id,
        metadata: { role, email: user.email },
      })
    } else {
      errorLogger.logWarning('Admin access denied', {
        userId: user.id,
        metadata: { role, email: user.email },
      })
    }

    return {
      authorized: isAdmin === true,
      userId: user.id,
      role,
      error: isAdmin ? undefined : 'Admin role required',
    }
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/lib/guards/admin-guard',
      metadata: { function: 'requireAdmin' },
    })

    return {
      authorized: false,
      userId: null,
      role: null,
      error: 'Authorization check failed',
    }
  }
}

/**
 * Check if current user has admin role (boolean only)
 *
 * Simplified version that returns only boolean result.
 * Use requireAdmin() if you need detailed authorization info.
 *
 * @param supabase - Supabase client (server-side)
 * @returns True if user is admin, false otherwise
 *
 * @example
 * ```typescript
 * const isAdmin = await checkAdmin(supabase)
 * if (!isAdmin) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 * }
 * ```
 */
export async function checkAdmin(supabase: SupabaseClient): Promise<boolean> {
  const result = await requireAdmin(supabase)
  return result.authorized
}
```

### Step 3: Create Example Usage File (Optional)

Create `web/app/api/admin/example/route.ts`:

```typescript
/**
 * Example admin API route
 * Demonstrates usage of requireAdmin guard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards/admin-guard'
import { errorLogger } from '@/lib/monitoring/error-logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin authorization
    const auth = await requireAdmin(supabase)

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 403 }
      )
    }

    // Admin-only logic here
    errorLogger.logInfo('Admin endpoint accessed', {
      userId: auth.userId!,
      path: '/api/admin/example',
      metadata: { role: auth.role },
    })

    return NextResponse.json({
      message: 'Admin access granted',
      userId: auth.userId,
      role: auth.role,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/admin/example',
      method: 'GET',
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Step 4: Verify Types Compile

```bash
cd web
pnpm type-check
```

### Step 5: Test Admin Guard (Manual)

1. Create test admin user:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-test-email@example.com';
```

2. Test API route:
```bash
# As admin user (should return 200)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:3000/api/admin/example

# As regular user (should return 403)
curl -H "Authorization: Bearer YOUR_USER_TOKEN" http://localhost:3000/api/admin/example
```

---

## Acceptance Criteria

- [ ] `web/lib/guards/` directory created
- [ ] `web/lib/guards/admin-guard.ts` created
- [ ] `requireAdmin()` function implemented
- [ ] `checkAdmin()` helper implemented
- [ ] Types compile without errors
- [ ] Error logging integrated (uses errorLogger)
- [ ] Admin checks logged for audit trail
- [ ] Example usage documented
- [ ] Works with Supabase server client

---

## Verification Commands

```bash
# Type check
cd web
pnpm type-check

# Build (ensure no errors)
pnpm build

# Test imports
npx tsx -e "import { requireAdmin } from './web/lib/guards/admin-guard'; console.log('Import successful')"
```

---

## Integration Points

### Depends On
- ✅ CARD_3: is_admin() database function
- ✅ CARD_5: AdminAuthResult type
- ✅ Existing: errorLogger utility
- ✅ Existing: Supabase server client

### Enables
- Future: Admin API routes (e.g., /api/admin/users)
- Future: Admin server components
- Future: Admin middleware

---

## Usage Examples

### API Route with Admin Guard

```typescript
import { requireAdmin } from '@/lib/guards/admin-guard'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)

  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Admin-only logic
  const data = await getAdminData()
  return Response.json(data)
}
```

### Server Component with Admin Guard

```typescript
import { requireAdmin } from '@/lib/guards/admin-guard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)

  if (!auth.authorized) {
    redirect('/unauthorized')
  }

  return <div>Admin dashboard</div>
}
```

### Boolean Check

```typescript
import { checkAdmin } from '@/lib/guards/admin-guard'

const isAdmin = await checkAdmin(supabase)
if (!isAdmin) {
  return <div>Access denied</div>
}
```

---

## Security Notes

**Audit Logging:**
- All admin checks logged via errorLogger
- Logs include user ID, role, and timestamp
- Failed authorization attempts logged as warnings
- Successful grants logged as info

**Defense in Depth:**
- Database-level enforcement (is_admin() function)
- Application-level check (this guard)
- RLS policies as fallback
- JWT validation via Supabase

**Best Practices:**
- Always use server-side client (not browser client)
- Check authorization on every admin route
- Log all admin actions for compliance
- Use type-safe result (AdminAuthResult)

---

## Next Steps

After completing CARD_6:

1. ✅ Proceed to **CARD_7**: Update Database Types
2. Test admin guard with real user
3. Create admin API routes using guard
4. Update this card if any issues found

---

**Status:** Ready for Implementation
**Last Updated:** 2025-12-16

# Admin Services

TypeScript services to replace PostgreSQL stored procedures for admin functionality.

## Overview

This module implements admin user management services that query the `admin_user_view` directly using the Supabase query builder, replacing the PostgreSQL RPC functions.

## Files

- `admin-user-service.ts` - Main service implementation
- `index.ts` - Barrel export
- `__tests__/admin-user-service.test.ts` - Comprehensive test suite (27 tests, 90%+ coverage)

## AdminUserService

### Methods

#### `queryUsers(params: AdminUserQueryParams): Promise<AdminUser[]>`

Query users with filters and pagination.

**Replaces:** `get_admin_users(search_query, role_filter, subscription_filter, strava_filter, limit_count, offset_count)`

**Parameters:**
- `search` - Search by email, first name, or last name (case-insensitive)
- `role` - Filter by user role ('user' | 'admin')
- `subscription` - Filter by subscription plan name
- `strava` - Filter by Strava connection status (boolean)
- `limit` - Maximum number of results (default: 50)
- `offset` - Number of results to skip (default: 0)

**Returns:** Array of `AdminUser` objects with nested structure

**Example:**
```typescript
import { adminUserService } from '@/lib/services/admin'

// Query all users with pagination
const users = await adminUserService.queryUsers({ limit: 25, offset: 0 })

// Search by email or name
const searchResults = await adminUserService.queryUsers({ search: 'john' })

// Filter by role and subscription
const proAdmins = await adminUserService.queryUsers({
  role: 'admin',
  subscription: 'pro',
})

// Combined filters
const stravaUsers = await adminUserService.queryUsers({
  search: 'test',
  strava: true,
  limit: 10,
})
```

---

#### `getUserById(userId: string): Promise<AdminUser | null>`

Get a single user by ID.

**Replaces:** `get_admin_user_by_id(target_user_id)`

**Parameters:**
- `userId` - User ID to query

**Returns:** `AdminUser` object or `null` if not found

**Example:**
```typescript
import { adminUserService } from '@/lib/services/admin'

const user = await adminUserService.getUserById('user-123')

if (user) {
  console.log(`User: ${user.email}`)
  console.log(`Plan: ${user.subscription.plan_name}`)
  console.log(`Strava: ${user.strava.connected}`)
}
```

---

#### `countUsers(params: AdminUserFilters): Promise<number>`

Count users matching filters (for pagination).

**Replaces:** `get_admin_users_count(search_query, role_filter, subscription_filter, strava_filter)`

**Parameters:**
- `search` - Search by email, first name, or last name (case-insensitive)
- `role` - Filter by user role
- `subscription` - Filter by subscription plan name
- `strava` - Filter by Strava connection status

**Returns:** Total count of users matching filters

**Example:**
```typescript
import { adminUserService } from '@/lib/services/admin'

// Count all users
const totalUsers = await adminUserService.countUsers({})

// Count users with filters
const proUsersCount = await adminUserService.countUsers({
  subscription: 'pro',
})

// Calculate pagination
const PAGE_SIZE = 25
const totalPages = Math.ceil(totalUsers / PAGE_SIZE)
```

---

## Types

### AdminUser

Nested structure with better DX:

```typescript
interface AdminUser {
  user_id: string
  email: string
  role: 'user' | 'admin'
  account_created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null

  subscription: {
    plan_id: string | null
    plan_name: string | null
    plan_display_name: string | null
    status: SubscriptionStatus | null
    started_at: string | null
    ends_at: string | null
  }

  strava: {
    connected: boolean
    last_sync_at: string | null
    sync_status: string | null
    sync_error: string | null
  }

  profile: {
    exists: boolean
    first_name: string | null
    last_name: string | null
    preferred_language: string | null
    timezone: string | null
    units_system: string | null
  }

  counts: {
    total_activities: number
    total_training_plans: number
    total_reports: number
  }
}
```

### AdminUserQueryParams

```typescript
interface AdminUserQueryParams {
  search?: string // Email or name search
  role?: 'user' | 'admin'
  subscription?: string // Plan name (e.g., 'free', 'pro')
  strava?: boolean // Has Strava connection
  limit?: number // Default: 50
  offset?: number // Default: 0
}
```

### AdminUserFilters

```typescript
interface AdminUserFilters {
  search?: string
  role?: 'user' | 'admin'
  subscription?: string
  strava?: boolean
}
```

---

## Testing

Comprehensive test suite with 27 tests covering:

- ✅ Query all users without filters
- ✅ Empty results
- ✅ Search filter (email, first name, last name - case-insensitive)
- ✅ Role filter
- ✅ Subscription filter
- ✅ Strava connection filter (true/false)
- ✅ Pagination (limit, offset, defaults)
- ✅ Combined filters
- ✅ Get user by ID (exists)
- ✅ Get user by ID (not found)
- ✅ Count users with filters
- ✅ Error handling

**Run tests:**
```bash
pnpm test:unit:run lib/services/admin/__tests__/admin-user-service.test.ts
```

---

## Implementation Notes

### Query Logic

The service queries the `admin_user_view` directly using Supabase's query builder:

1. **Search filter:** Uses `.or()` with `ilike` for case-insensitive search across email, first_name, and last_name
2. **Role filter:** Uses `.eq('role', role)` for exact match
3. **Subscription filter:** Uses `.eq('plan_name', subscription)` for exact match
4. **Strava filter:** Uses `.eq('strava_connected', strava)` for boolean match
5. **Ordering:** DESC by `account_created_at` (most recent first)
6. **Pagination:** Uses `.range(offset, offset + limit - 1)` for efficient pagination

### Error Handling

- Database errors are logged with `errorLogger` and thrown as user-friendly errors
- Not found errors (PGRST116) are handled gracefully (return null)
- All errors include context (path, metadata) for debugging

### Type Safety

- Fully type-safe with TypeScript
- Uses type transformers from `@/lib/types/admin` to convert flat database rows to nested structures
- No `any` types
- All parameters and return types are explicitly typed

---

## Migration from RPC Functions

**Before (PostgreSQL RPC):**
```typescript
const { data } = await supabase.rpc('get_admin_users', {
  search_query: 'john',
  role_filter: 'admin',
  subscription_filter: 'pro',
  strava_filter: true,
  limit_count: 25,
  offset_count: 0,
})
```

**After (TypeScript Service):**
```typescript
const users = await adminUserService.queryUsers({
  search: 'john',
  role: 'admin',
  subscription: 'pro',
  strava: true,
  limit: 25,
  offset: 0,
})
```

**Benefits:**
1. ✅ Type-safe parameters and return types
2. ✅ Better error messages and debugging
3. ✅ Easier to test (no database required)
4. ✅ Cleaner API with nested structures
5. ✅ Visible in codebase (not hidden in database)
6. ✅ Can be tracked with git
7. ✅ Easier to refactor and maintain

---

## Next Steps

To complete the migration:

1. ✅ Create `AdminUserService` with comprehensive tests (DONE)
2. Update API routes to use `adminUserService` instead of RPC calls
3. Update components to use the new service
4. Verify functionality in production
5. Delete PostgreSQL stored procedures once migration is complete

# Code Review Action Plan - PR #7

**Created:** 2024-12-16
**PR:** #7 - Complete Phase 1-3 Foundation
**Status:** Ready for Implementation

---

## Overview

This document outlines the action plan to address issues identified in the code review for PR #7. Issues are organized by priority: Critical (must fix before production), High Priority (should fix soon), and Enhancement (nice to have).

---

## 🔴 Critical Issues (MUST FIX BEFORE PRODUCTION)

### 1. Implement Background Job Queue for Sync Operations

**Priority:** CRITICAL
**Estimated Effort:** 4-6 hours
**Files Affected:**

- `web/app/api/strava/sync/route.ts`
- `web/app/api/webhooks/strava/route.ts`
- `web/lib/services/strava-sync-service.ts`

**Problem:**
Strava sync operations run synchronously in API routes, causing timeouts for users with many activities (100+ activities = 30+ seconds).

**Solution Options:**

**Option A: Vercel Background Functions (Recommended for Vercel deployment)**

```typescript
// Use Vercel's waitUntil for background processing
import { waitUntil } from '@vercel/functions'

export async function POST(request: NextRequest) {
  // ... auth checks ...

  // Start background job
  waitUntil(syncService.syncActivities(user.id, syncOptions))

  // Return immediately
  return NextResponse.json({
    success: true,
    message: 'Sync started in background',
  })
}
```

**Option B: Trigger.dev (Recommended for complex workflows)**

- Install Trigger.dev SDK
- Create sync job definition
- Trigger from API route
- Poll job status endpoint

**Option C: Inngest (Alternative)**

- Similar to Trigger.dev
- Good developer experience
- Built-in retry logic

**Implementation Steps:**

1. [ ] Choose job queue solution (Vercel/Trigger/Inngest)
2. [ ] Install dependencies
3. [ ] Create background job for activity sync
4. [ ] Update `/api/strava/sync` to trigger job and return job ID
5. [ ] Create `/api/strava/sync/status/[jobId]` endpoint
6. [ ] Update frontend to poll for completion
7. [ ] Add job status UI in Strava connection component
8. [ ] Test with large activity sets (100+ activities)
9. [ ] Update documentation

**Success Criteria:**

- API responds in < 1 second
- Sync continues in background
- User can check status via polling
- Frontend shows progress indicator

---

### 2. Fix Hardcoded Webhook Token Security Issue

**Priority:** CRITICAL
**Estimated Effort:** 15 minutes
**Files Affected:**

- `web/app/api/webhooks/strava/route.ts:4`

**Problem:**

```typescript
const WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'CYCLING_AI'
```

Hardcoded fallback creates security vulnerability.

**Solution:**

```typescript
const WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

if (!WEBHOOK_VERIFY_TOKEN) {
  throw new Error(
    'STRAVA_WEBHOOK_VERIFY_TOKEN environment variable is required. ' +
      'Set it in your .env.local file or deployment environment.'
  )
}
```

**Implementation Steps:**

1. [ ] Update `web/app/api/webhooks/strava/route.ts`
2. [ ] Add to `.env.example`
3. [ ] Update `SUPABASE_SETUP.md` documentation
4. [ ] Verify in local development
5. [ ] Ensure set in production environment

**Success Criteria:**

- App fails to start if token not set
- Clear error message guides developers
- No hardcoded fallback values

---

### 3. Fix Webhook Event ID Generation

**Priority:** CRITICAL
**Estimated Effort:** 1 hour
**Files Affected:**

- `web/app/api/webhooks/strava/route.ts:70-72, 196-198, 211-213`
- `supabase/migrations/20251215000002_create_webhook_events.sql`

**Problem:**

```typescript
const eventId = parseInt(`${event.subscription_id}${event.object_id}${event.event_time}`.slice(-15))
```

Truncation can cause collisions, leading to lost events.

**Solution:**
Use composite primary key or UUID.

**Option A: Composite Primary Key (Recommended)**

```typescript
// Migration
ALTER TABLE strava_webhook_events
  DROP CONSTRAINT strava_webhook_events_pkey,
  ADD PRIMARY KEY (subscription_id, object_id, event_time);

// Code - no event_id needed
const { error } = await supabase
  .from('strava_webhook_events')
  .insert({
    subscription_id: event.subscription_id,
    object_id: event.object_id,
    event_time: new Date(event.event_time * 1000).toISOString(),
    // ... other fields
  })
```

**Option B: Use UUID**

```typescript
import { randomUUID } from 'crypto'

const eventId = randomUUID()
```

**Implementation Steps:**

1. [ ] Create new migration file
2. [ ] Update primary key to composite or add UUID
3. [ ] Update all queries to use new key structure
4. [ ] Update webhook processing function
5. [ ] Test duplicate event handling
6. [ ] Run migration in staging
7. [ ] Verify no data loss

**Success Criteria:**

- No event collisions possible
- Duplicate events handled gracefully
- All webhook events stored correctly

---

## 🟡 High Priority Issues (SHOULD FIX SOON)

### 4. Add Database Indexes for Performance

**Priority:** HIGH
**Estimated Effort:** 1 hour
**Files Affected:**

- New migration file

**Problem:**
Missing indexes on frequently queried columns will cause slow queries as data grows.

**Solution:**

```sql
-- Migration: 20241216_add_performance_indexes.sql

-- Activity queries by user and date (calendar view)
CREATE INDEX idx_strava_activities_user_date
  ON strava_activities(user_id, start_date DESC);

-- Activity filtering by type
CREATE INDEX idx_strava_activities_type
  ON strava_activities(user_id, type);

-- Webhook processing queue
CREATE INDEX idx_webhook_unprocessed
  ON strava_webhook_events(processed)
  WHERE processed = false;

-- User's Strava connection lookup
CREATE INDEX idx_strava_connections_athlete
  ON strava_connections(strava_athlete_id);

-- Activity count queries
CREATE INDEX idx_strava_activities_user_count
  ON strava_activities(user_id)
  INCLUDE (id);
```

**Implementation Steps:**

1. [ ] Create migration file
2. [ ] Test query performance before/after
3. [ ] Run EXPLAIN ANALYZE on common queries
4. [ ] Apply in staging
5. [ ] Monitor performance improvements
6. [ ] Apply in production

**Success Criteria:**

- Calendar queries < 100ms for 1000+ activities
- Activity list queries < 50ms
- No full table scans on common queries

---

### 5. Fix Race Condition in Sync Status Check

**Priority:** HIGH
**Estimated Effort:** 2 hours
**Files Affected:**

- `web/app/api/strava/sync/route.ts:27-46`

**Problem:**
Time gap between checking sync status and starting sync allows concurrent requests.

**Solution:**

```typescript
// Use database transaction with SELECT FOR UPDATE
const { data: connection } = await supabase
  .from('strava_connections')
  .select('id, sync_status')
  .eq('user_id', user.id)
  .single()

if (!connection) {
  return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
}

// Try to acquire lock by updating status
const { data: updated, error } = await supabase
  .from('strava_connections')
  .update({ sync_status: 'in_progress' })
  .eq('user_id', user.id)
  .eq('sync_status', 'idle') // Only update if idle
  .select()
  .single()

if (error || !updated) {
  return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 })
}

// Now safe to start sync
```

**Implementation Steps:**

1. [ ] Update sync route with optimistic locking
2. [ ] Add test for concurrent requests
3. [ ] Verify only one sync runs at a time
4. [ ] Update error messages
5. [ ] Test edge cases

**Success Criteria:**

- Only one sync can run per user at a time
- No race conditions with concurrent requests
- Clear error message when sync already running

---

### 6. Remove TypeScript Type Ignores

**Priority:** HIGH
**Estimated Effort:** 2-3 hours
**Files Affected:**

- `web/app/api/profile/route.ts:101`
- `web/lib/services/strava-sync-service.ts:207, 245`
- `web/app/api/webhooks/strava/route.ts:84, 188, 202, 221`

**Problem:**
Type ignores (`@ts-ignore`, `as never`) hide potential type errors.

**Solution:**
Define proper types for database operations.

**Example:**

```typescript
// Before
// @ts-ignore - Supabase typing issue
.update(updateData)

// After
type ProfileUpdate = Database['public']['Tables']['athlete_profiles']['Update']

const updateData: Partial<ProfileUpdate> = {}
if (updates.firstName !== undefined) {
  updateData.first_name = updates.firstName
}
// ... build update object with proper types

.update(updateData)
```

**Implementation Steps:**

1. [ ] Create type definitions for all database operations
2. [ ] Replace `as never` with proper types
3. [ ] Remove all `@ts-ignore` comments
4. [ ] Run `tsc --noEmit` to verify
5. [ ] Test all affected routes
6. [ ] Document type patterns for future reference

**Success Criteria:**

- Zero type ignores in codebase
- Full TypeScript type checking passes
- No runtime type errors

---

### 7. Add Input Validation to API Routes

**Priority:** HIGH
**Estimated Effort:** 2 hours
**Files Affected:**

- `web/app/api/strava/sync/route.ts:48-70`
- Other API routes with query parameters

**Problem:**
Missing validation for query parameters can cause runtime errors.

**Solution:**

```typescript
import { z } from 'zod'

const syncParamsSchema = z.object({
  after: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(parseInt(val)), { message: 'after must be a valid timestamp' }),
  perPage: z
    .string()
    .optional()
    .refine((val) => !val || (parseInt(val) > 0 && parseInt(val) <= 200), {
      message: 'perPage must be between 1 and 200',
    }),
  maxPages: z
    .string()
    .optional()
    .refine((val) => !val || parseInt(val) > 0, { message: 'maxPages must be positive' }),
})

// In route
const validation = syncParamsSchema.safeParse({
  after: searchParams.get('after'),
  perPage: searchParams.get('perPage'),
  maxPages: searchParams.get('maxPages'),
})

if (!validation.success) {
  return NextResponse.json(
    { error: 'Invalid parameters', details: validation.error.issues },
    { status: 400 }
  )
}
```

**Implementation Steps:**

1. [ ] Create validation schemas for all API routes
2. [ ] Add validation middleware or helper
3. [ ] Update error responses
4. [ ] Add tests for invalid inputs
5. [ ] Document expected parameters

**Success Criteria:**

- All query parameters validated
- Clear error messages for invalid inputs
- No runtime errors from malformed parameters

---

### 8. Fix Silent Error Handling

**Priority:** MEDIUM
**Estimated Effort:** 1 hour
**Files Affected:**

- `web/lib/services/strava-sync-service.ts:249`

**Problem:**
Errors logged but not propagated makes debugging difficult.

**Solution:**

```typescript
// Before
if (updateError) {
  console.error('Failed to update sync status:', updateError)
  // Continues silently
}

// After
if (updateError) {
  console.error('Failed to update sync status:', updateError)
  throw new Error(`Failed to update sync status: ${updateError.message}`)
}
```

**Implementation Steps:**

1. [ ] Review all error handling in service classes
2. [ ] Ensure errors are thrown or returned
3. [ ] Add error boundaries in React components
4. [ ] Log errors to monitoring service
5. [ ] Test error scenarios

**Success Criteria:**

- No silent failures
- All errors logged and visible
- Error boundaries catch React errors

---

## 🔵 Enhancement (NICE TO HAVE)

### 9. Add Unit Tests for Services

**Priority:** MEDIUM
**Estimated Effort:** 4-6 hours

**Files to Test:**

- `web/lib/services/strava-service.ts`
- `web/lib/services/strava-sync-service.ts`
- `web/lib/services/ftp-detection-service.ts`
- `web/lib/services/fit-file-storage-service.ts`

**Implementation Steps:**

1. [ ] Set up Vitest or Jest
2. [ ] Create mock Supabase client
3. [ ] Write unit tests for each service method
4. [ ] Aim for 80%+ coverage on services
5. [ ] Add to CI/CD pipeline

---

### 10. Add API Rate Limiting

**Priority:** MEDIUM
**Estimated Effort:** 2-3 hours

**Solution Options:**

- Vercel Rate Limiting (if on Vercel)
- Upstash Redis with rate limit library
- Simple in-memory rate limiting

**Implementation Steps:**

1. [ ] Choose rate limiting solution
2. [ ] Add middleware to API routes
3. [ ] Set appropriate limits (e.g., 100 requests/hour per user)
4. [ ] Return 429 status with retry-after header
5. [ ] Test with load testing tool
6. [ ] Document rate limits

---

### 11. Extract Magic Numbers to Constants

**Priority:** LOW
**Estimated Effort:** 1 hour

**Example:**

```typescript
// Before
Math.min(parseInt(perPageParam), 200)

// After
const MAX_ACTIVITIES_PER_PAGE = 200
const DEFAULT_ACTIVITIES_PER_PAGE = 30

Math.min(parseInt(perPageParam), MAX_ACTIVITIES_PER_PAGE)
```

**Implementation Steps:**

1. [ ] Create `web/lib/constants.ts`
2. [ ] Extract all magic numbers
3. [ ] Update all references
4. [ ] Document constants

---

### 12. Add API Documentation

**Priority:** LOW
**Estimated Effort:** 3-4 hours

**Options:**

- OpenAPI/Swagger specification
- Comprehensive JSDoc comments
- Dedicated API docs site

**Implementation Steps:**

1. [ ] Choose documentation approach
2. [ ] Document all API routes
3. [ ] Include request/response examples
4. [ ] Document error codes
5. [ ] Publish documentation

---

### 13. Refactor Long Functions

**Priority:** LOW
**Estimated Effort:** 2-3 hours

**Files:**

- `web/app/api/profile/route.ts` (100+ lines)
- `web/app/api/webhooks/strava/route.ts` (200+ lines)

**Implementation Steps:**

1. [ ] Extract validation logic to helpers
2. [ ] Extract business logic to service methods
3. [ ] Keep route handlers focused on HTTP concerns
4. [ ] Aim for < 50 lines per function

---

### 14. Add Monitoring and Alerting

**Priority:** MEDIUM
**Estimated Effort:** 3-4 hours

**Recommendations:**

- Sentry for error tracking
- Vercel Analytics for performance
- Custom webhook for critical errors

**Implementation Steps:**

1. [ ] Set up Sentry project
2. [ ] Add Sentry SDK to Next.js
3. [ ] Configure error boundaries
4. [ ] Set up alerts for:

- Sync failures
- Webhook processing errors
- API error rate > 5%

5. [ ] Add performance monitoring
6. [ ] Create dashboard

---

### 15. Implement Token Encryption at Rest

**Priority:** MEDIUM
**Estimated Effort:** 2-3 hours

**Problem:**
OAuth tokens stored in plaintext in database.

**Solution:**
Use Supabase Vault for encryption at rest.

**Implementation Steps:**

1. [ ] Enable Supabase Vault
2. [ ] Migrate tokens to encrypted storage
3. [ ] Update queries to decrypt
4. [ ] Rotate encryption keys
5. [ ] Document encryption approach

---

## 📅 Suggested Implementation Timeline

### Week 1: Critical Issues

- [ ] Day 1-2: Implement background job queue
- [ ] Day 3: Fix webhook token security
- [ ] Day 4-5: Fix webhook event ID generation

### Week 2: High Priority

- [ ] Day 1: Add database indexes
- [ ] Day 2: Fix race conditions
- [ ] Day 3-4: Remove TypeScript ignores
- [ ] Day 5: Add input validation

### Week 3: Testing & Enhancements

- [ ] Day 1-2: Add unit tests
- [ ] Day 3: Add rate limiting
- [ ] Day 4-5: Monitoring and documentation

---

## 🎯 Success Metrics

**Before Production:**

- [ ] All critical issues resolved
- [ ] All high priority issues resolved
- [ ] Test coverage > 70%
- [ ] No TypeScript errors
- [ ] Load tested with 1000+ activities

**Post-Launch Monitoring:**

- API response time < 200ms (p95)
- Error rate < 1%
- Sync success rate > 99%
- No timeout errors

---

## 📝 Notes

- This plan should be executed in order of priority
- Each fix should be in a separate PR for easier review
- All changes should include tests
- Update documentation as you go
- Consider creating GitHub issues for each task

---

**Last Updated:** 2024-12-16
**Maintained By:** Development Team

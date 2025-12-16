# Background Job Queue Solution Decision

**Date:** 2024-12-16
**Status:** Approved
**Context:** Free Tier Supabase Deployment

## Decision: Use Vercel `waitUntil()` for Background Jobs

### Problem
Strava activity sync operations can take 30+ seconds for users with many activities, causing API timeout errors. We need a background job solution that works with:
- Free tier Supabase (no pg_cron or background workers)
- Serverless architecture (Vercel deployment)
- No additional infrastructure costs

### Options Evaluated

#### Option 1: Vercel `waitUntil()` ✅ **SELECTED**
**Pros:**
- Built into Vercel Edge Runtime (no cost)
- Simple API - single function call
- Works perfectly with serverless functions
- Automatic cleanup after completion
- No additional infrastructure needed
- Compatible with free tier Supabase

**Cons:**
- Limited to Vercel platform
- No built-in retry logic (must implement ourselves)
- No job queue visualization
- Max execution time limited by Vercel plan (10s hobby, 300s pro)

**Cost:** $0 (included in Vercel)

#### Option 2: Trigger.dev
**Pros:**
- Full-featured job orchestration
- Built-in retries and error handling
- Nice dashboard for monitoring
- Supports long-running jobs

**Cons:**
- Requires external service
- Free tier: 50k runs/month, then $10/month
- Additional complexity
- Another service to maintain

**Cost:** $0-10/month

#### Option 3: Inngest
**Pros:**
- Event-driven architecture
- Good developer experience
- Built-in retry and error handling

**Cons:**
- External service dependency
- Free tier limitations
- Learning curve

**Cost:** $0-20/month

### Selected Solution: Vercel `waitUntil()`

**Rationale:**
1. **Zero cost** - Critical for free tier deployment
2. **Simplicity** - Minimal code changes required
3. **Supabase compatible** - Works perfectly with free tier
4. **Sufficient for our needs** - Sync operations complete in < 5 minutes

### Implementation Plan

```typescript
import { waitUntil } from '@vercel/functions'

export async function POST(request: NextRequest) {
  // Create job record
  const jobId = await createSyncJob(user.id)

  // Trigger background execution
  waitUntil(
    executeSyncJob(jobId).finally(() => {
      // Cleanup/update status
    })
  )

  // Return immediately
  return NextResponse.json({ jobId }, { status: 202 })
}
```

### Limitations & Mitigations

**Limitation 1: No built-in retries**
- **Mitigation:** Implement retry logic in sync service
- Store attempt count in job record
- Exponential backoff for failures

**Limitation 2: No job queue dashboard**
- **Mitigation:** Simple status API endpoint
- Database table tracks all jobs
- Can query Supabase directly for monitoring

**Limitation 3: Platform lock-in**
- **Mitigation:** Abstract behind job service interface
- Easy to swap implementation later if needed

### Database Schema

```sql
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'strava_sync',
  status TEXT NOT NULL DEFAULT 'pending',

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3
);
```

### Success Metrics

- ✅ API responds in < 1 second
- ✅ Sync completes successfully for 100+ activities
- ✅ No timeout errors
- ✅ Zero additional infrastructure costs
- ✅ Works on Vercel free tier

### Future Considerations

If we need more advanced features later:
- **Retry logic** - Can implement in current solution
- **Scheduled jobs** - Would require Trigger.dev or similar
- **Job priorities** - Not needed for current use case
- **Rate limiting** - Can implement at application level

### Approved By

- [x] Technical feasibility verified
- [x] Cost analysis completed
- [x] Free tier compatibility confirmed
- [x] Implementation plan reviewed

---

**Next Steps:**
1. Install `@vercel/functions` package
2. Create database migration for `sync_jobs` table
3. Implement background job service
4. Update sync API route
5. Add status polling endpoint

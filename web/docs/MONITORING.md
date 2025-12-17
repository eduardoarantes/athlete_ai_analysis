# Monitoring and Alerting Guide

## Overview

This document describes the monitoring and alerting infrastructure for the Cycling AI Analysis application.

## Error Logging

### Structured Error Logger

The application uses a structured error logging system (`lib/monitoring/error-logger.ts`) that provides:

- **Consistent error format** with context
- **Categorized errors** (API, database, auth, integration)
- **Easy integration** with monitoring services
- **Type-safe** error handling

### Usage Examples

#### API Route Errors

```typescript
import { errorLogger } from '@/lib/monitoring/error-logger'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Your code here
  } catch (error) {
    errorLogger.logApiError(error as Error, { path: '/api/strava/sync', method: 'POST' }, user?.id)

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### Database Errors

```typescript
try {
  await supabase.from('profiles').insert(data)
} catch (error) {
  errorLogger.logDatabaseError(error as Error, 'insert_profile', userId)
  throw error
}
```

#### Integration Errors

```typescript
try {
  await stravaService.syncActivities(userId)
} catch (error) {
  errorLogger.logIntegrationError(error as Error, 'strava', userId)
  throw error
}
```

#### Function Wrapper

```typescript
import { withErrorLogging } from '@/lib/monitoring/error-logger'

const syncActivities = withErrorLogging(
  async (userId: string) => {
    // Your code here
  },
  { metadata: { operation: 'strava_sync' } }
)
```

## Integration with Monitoring Services

### Sentry (Recommended)

**Installation:**

```bash
pnpm add @sentry/nextjs
```

**Setup:**

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  // Custom error handler
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies
    }
    return event
  },
})
```

**Update Error Logger:**

```typescript
// lib/monitoring/error-logger.ts
import * as Sentry from '@sentry/nextjs'

private async sendToMonitoring(error: StructuredError): Promise<void> {
  Sentry.captureException(new Error(error.message), {
    level: error.level,
    contexts: {
      error: {
        name: error.name,
        stack: error.stack,
      },
      user: error.context?.userId ? {
        id: error.context.userId
      } : undefined,
    },
    tags: {
      path: error.context?.path,
      method: error.context?.method,
    },
    extra: error.context?.metadata
  })
}
```

### Datadog

**Installation:**

```bash
pnpm add dd-trace
```

**Setup:**

```typescript
// instrumentation.ts
import tracer from 'dd-trace'

tracer.init({
  service: 'cycling-ai-web',
  env: process.env.NODE_ENV,
  logInjection: true,
})

export function register() {
  tracer.init()
}
```

### Vercel Analytics

**Built-in with Vercel deployment:**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }: { children: React.Node }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

## Metrics to Monitor

### Application Metrics

1. **Error Rate**
   - Target: < 1%
   - Alert: > 5% over 5 minutes

2. **API Response Time**
   - Target: p95 < 500ms
   - Alert: p95 > 2000ms

3. **Background Job Success Rate**
   - Target: > 99%
   - Alert: < 95% over 1 hour

4. **Rate Limit Hit Rate**
   - Target: < 0.1%
   - Alert: > 1% (may indicate abuse)

### Business Metrics

1. **Daily Active Users**
2. **Strava Sync Success Rate**
3. **FTP Detection Usage**
4. **API Usage per User**

### Infrastructure Metrics

1. **Database Connection Pool**
2. **Memory Usage**
3. **CPU Usage**
4. **Disk Space**

## Alerts

### Critical Alerts (Page immediately)

1. **Service Down** - 5xx errors > 10% for 2 minutes
2. **Database Unreachable** - Connection failures > 3 in 1 minute
3. **Critical Error Spike** - Error rate > 50x baseline

### High Priority Alerts (Notify within 15 minutes)

1. **Sync Failures** - > 20% failure rate for 10 minutes
2. **High API Latency** - p95 > 5 seconds for 5 minutes
3. **Rate Limit Abuse** - > 100 rate limit hits in 10 minutes

### Medium Priority Alerts (Notify within 1 hour)

1. **Gradual Performance Degradation** - p95 response time increasing >50% over 1 hour
2. **Webhook Processing Delays** - Unprocessed events > 100
3. **Auth Failures** - > 10% auth failure rate for 30 minutes

## Dashboards

### Operations Dashboard

**Metrics:**

- Request volume (requests/minute)
- Error rate (errors/minute)
- Response time distribution (p50, p95, p99)
- Active users
- Database query performance

### Business Dashboard

**Metrics:**

- New user registrations
- Strava connections created
- Activities synced (total, per user)
- FTP detections performed
- API usage by endpoint

### Error Dashboard

**Metrics:**

- Error breakdown by type
- Error rate by endpoint
- Top error messages
- Error trends over time

## Log Retention

- **Error Logs:** 90 days
- **Access Logs:** 30 days
- **Audit Logs:** 1 year

## On-Call Rotation

### Runbook

**Service Down:**

1. Check Vercel deployment status
2. Check Supabase status
3. Review recent deployments
4. Check error logs for root cause
5. Rollback if needed

**Database Issues:**

1. Check Supabase dashboard
2. Review slow query logs
3. Check connection pool stats
4. Scale up if needed

**High Error Rate:**

1. Identify error pattern
2. Check recent code changes
3. Review affected endpoints
4. Apply hotfix or rollback

## Future Enhancements

1. **Distributed Tracing**
   - Track requests across services
   - Identify bottlenecks

2. **Real User Monitoring (RUM)**
   - Frontend performance metrics
   - User experience tracking

3. **Synthetic Monitoring**
   - Proactive health checks
   - SLA compliance

4. **Anomaly Detection**
   - ML-based error detection
   - Automatic incident creation

5. **Log Analysis**
   - Pattern recognition
   - Security threat detection

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Supabase Monitoring](https://supabase.com/docs/guides/platform/metrics)

## Current Status

**Implemented:**

- ✅ Structured error logging
- ✅ Error context tracking
- ✅ Categorized error types

**Pending:**

- ❌ Monitoring service integration (Sentry/Datadog)
- ❌ Alert rules configuration
- ❌ Dashboard creation
- ❌ On-call rotation setup

**Recommended Next Steps:**

1. Set up Sentry for error tracking
2. Configure critical alerts
3. Create operations dashboard
4. Establish on-call rotation

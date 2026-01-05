# Strava Webhooks - Architecture & Implementation Plan

**Created:** 2026-01-01
**Updated:** 2026-01-05
**Status:** Production Ready ✅
**Subscription ID:** 323728

---

## Executive Summary

Strava webhooks are fully implemented and deployed to production. The system automatically syncs activities when users create, update, or delete them in Strava, including TSS calculation.

---

## 1. Current Implementation Status

### What's Already Implemented (and Working Well)

| Component                  | Status      | Location                                                |
| -------------------------- | ----------- | ------------------------------------------------------- |
| Webhook verification (GET) | ✅ Complete | `web/app/api/webhooks/strava/route.ts:50-73`            |
| Event receiver (POST)      | ✅ Complete | `web/app/api/webhooks/strava/route.ts:81-142`           |
| Durable event storage      | ✅ Complete | `strava_webhook_events` table                           |
| Duplicate prevention       | ✅ Complete | Composite PK `(subscription_id, object_id, event_time)` |
| Async processing           | ✅ Complete | Returns 200 before processing                           |
| Token refresh              | ✅ Complete | Uses `getValidAccessToken()`                            |
| TSS calculation            | ✅ Complete | Integrated in `processWebhookEvent()`                   |
| Subscription management    | ✅ Complete | `/api/webhooks/strava/subscription`                     |
| Error tracking             | ✅ Complete | Stores error in event record                            |
| RLS security               | ✅ Complete | Users only see their events                             |

### Architecture Diagram

```
┌─────────────────┐      ┌──────────────────────────────────────┐
│     Strava      │      │            Next.js API               │
│                 │      │                                      │
│  Webhook Push ──┼─────▶│  POST /api/webhooks/strava           │
│                 │      │    │                                 │
└─────────────────┘      │    ├── Validate payload (Zod)        │
                         │    ├── Store event in DB (sync)      │
                         │    │                                 │
                         │    ├── Return 200 OK immediately     │
                         │    │                                 │
                         │    └── processWebhookEvent() (async) │
                         │         │                            │
                         │         ├── Handle athlete deauth    │
                         │         ├── Refresh token if needed  │
                         │         ├── Fetch activity from API  │
                         │         ├── Calculate TSS            │
                         │         └── Upsert to activities     │
                         └──────────────────────────────────────┘
```

---

## 2. Strava Webhook Requirements

Based on [developers.strava.com/docs/webhooks/](https://developers.strava.com/docs/webhooks/):

| Requirement                          | Implementation                     | Status |
| ------------------------------------ | ---------------------------------- | ------ |
| Respond within 2 seconds             | Returns 200 before processing      | ✅     |
| Verify `hub.verify_token`            | Compares with env var              | ✅     |
| Return `hub.challenge` in JSON       | Returns `{"hub.challenge": value}` | ✅     |
| One subscription per app             | Stores single subscription         | ✅     |
| Handle activity create/update/delete | All three handled                  | ✅     |
| Handle athlete deauthorization       | Implemented                        | ✅     |
| Process asynchronously               | Fire-and-forget pattern            | ✅     |
| Validate payload schema              | Zod validation                     | ✅     |

---

## 3. Implementation Tasks

### P0 - Security (Critical)

- [x] Remove default verify token fallback in subscription route
- [x] Add verify token to SSM Parameter Store (Terraform)
- [x] Add Zod schema validation for webhook payloads

### P1 - Data Integrity

- [x] Handle athlete deauthorization events
- [x] Add retry_count column for failed event tracking

### P2 - Reliability

- [ ] Add retry logic for failed events (background job)
- [ ] Auto-register webhook on OAuth connect

### P3 - Observability

- [ ] Add webhook endpoint rate limiting
- [ ] Add webhook metrics table

---

## 4. Environment Configuration

### Development

```bash
# .env.local
STRAVA_CLIENT_ID=your-dev-client-id
STRAVA_CLIENT_SECRET=your-dev-client-secret
STRAVA_WEBHOOK_VERIFY_TOKEN=$(openssl rand -base64 32)
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
```

### Production (Amplify SSR)

Amplify SSR doesn't have access to `process.env` at runtime. Environment variables must be embedded at build time via Next.js `serverRuntimeConfig` in `next.config.ts`.

**Required Amplify Environment Variables:**

```bash
STRAVA_CLIENT_ID=<your-client-id>
STRAVA_CLIENT_SECRET=<your-client-secret>
STRAVA_WEBHOOK_VERIFY_TOKEN=<your-verify-token>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**Important:** The callback URL must include a trailing slash due to Next.js `trailingSlash: true`:

```
https://planmypeak.com/api/webhooks/strava/
```

### Local Development with ngrok

```bash
# 1. Start dev server
pnpm dev

# 2. Start ngrok tunnel
ngrok http 3000

# 3. Update .env.local with ngrok URL
# 4. Create webhook subscription (one-time)
curl -X POST https://your-ngrok-url.ngrok.io/api/webhooks/strava/subscription
```

---

## 5. Database Schema

### strava_webhook_events

```sql
CREATE TABLE strava_webhook_events (
  -- Composite primary key (prevents duplicates)
  subscription_id BIGINT NOT NULL,
  object_id BIGINT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,

  -- Event details
  object_type TEXT NOT NULL,  -- 'activity' or 'athlete'
  aspect_type TEXT NOT NULL,  -- 'create', 'update', 'delete'
  owner_id BIGINT NOT NULL,
  raw_data JSONB NOT NULL,

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (subscription_id, object_id, event_time)
);
```

---

## 6. Security Checklist

| Practice                | Status                |
| ----------------------- | --------------------- |
| HTTPS only for callback | ✅ Required by Strava |
| Verify token validation | ✅ Implemented        |
| No default verify token | ✅ Fixed              |
| Secrets in SSM          | ✅ Complete           |
| RLS on webhook tables   | ✅ Implemented        |
| Schema validation       | ✅ Zod added          |

---

## 7. References

- [Strava Webhooks Documentation](https://developers.strava.com/docs/webhooks/)
- [Strava API Rate Limits](https://developers.strava.com/docs/rate-limits/)

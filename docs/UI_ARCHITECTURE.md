# Cycling AI - UI Architecture Plan

## Executive Summary

A modern, intuitive web UI for Cycling AI Analysis that guides users through profile setup, integrates with Strava, and provides multilingual support.

**Stack:** Next.js + Supabase + Sentry + Statsig

---

## Technology Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
  - Server-side rendering for performance
  - React Server Components for reduced bundle size
  - API routes for backend logic
  - Built-in optimization (images, fonts, etc.)

- **UI Library:** shadcn/ui + Tailwind CSS
  - Accessible components (WCAG 2.1 AA compliant)
  - Customizable with Tailwind
  - Dark mode support out of the box

- **State Management:**
  - React Context for global state
  - Zustand for complex client state (if needed)
  - TanStack Query for server state

- **Internationalization:** next-intl
  - Type-safe translations
  - SSR-compatible
  - Dynamic locale switching

### Backend

- **Database:** PostgreSQL (via Supabase)
  - Relational data model
  - Row-level security (RLS)
  - Real-time subscriptions
  - Edge Functions for serverless logic

- **Authentication:** Supabase Auth
  - Email/password authentication
  - OAuth providers: Google, Strava
  - JWT-based sessions
  - Row-level security integration

- **API Layer:**
  - Next.js API routes for custom logic
  - Supabase Client for direct DB access (with RLS)
  - Edge Functions for compute-intensive tasks

### Third-Party Integrations

- **Strava API:**
  - OAuth 2.0 authentication
  - Webhook subscriptions for activity updates
  - Rate limiting: 100 requests/15min, 1000/day
  - Data sync strategy: incremental updates

- **AI/LLM Integration:**
  - Keep existing Python backend (`cycling-ai`)
  - Expose via REST API or gRPC
  - Consider containerization (Docker) for deployment

### Observability

- **Error Tracking:** Sentry
  - Frontend error tracking
  - Backend error tracking
  - Performance monitoring
  - Release tracking

- **Analytics & Experimentation:** Statsig
  - Feature flags for gradual rollouts
  - A/B testing (LLM providers, UI variations, prompts)
  - Product analytics (funnels, retention, custom events)
  - Dynamic configuration
  - 1M events/month free tier

- **Logging:**
  - Structured logging (Pino for Node.js)
  - Log aggregation in Supabase
  - Critical alerts via Sentry

---

## Database Schema

### Core Tables

```sql
-- Users (managed by Supabase Auth)
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Athlete Profiles
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile data
  ftp INTEGER,
  max_hr INTEGER,
  weight_kg DECIMAL(5,2),
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

  -- Goals
  goals JSONB DEFAULT '[]'::jsonb,

  -- Preferences
  preferred_language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  units_system TEXT DEFAULT 'metric' CHECK (units_system IN ('metric', 'imperial')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Strava Connections
CREATE TABLE public.strava_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Strava OAuth data
  strava_athlete_id BIGINT UNIQUE NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted
  refresh_token TEXT NOT NULL, -- Encrypted
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,

  -- Sync metadata
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Activities (synced from Strava)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Strava reference
  strava_activity_id BIGINT UNIQUE NOT NULL,

  -- Activity data
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sport_type TEXT,
  start_date TIMESTAMPTZ NOT NULL,

  -- Metrics
  distance_meters DECIMAL(10,2),
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  total_elevation_gain DECIMAL(10,2),

  -- Power data
  average_watts DECIMAL(10,2),
  max_watts DECIMAL(10,2),
  weighted_average_watts DECIMAL(10,2),

  -- Heart rate data
  average_heartrate DECIMAL(5,2),
  max_heartrate INTEGER,

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,

  -- FIT file reference
  fit_file_url TEXT,
  fit_file_processed BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_activities_user_date (user_id, start_date DESC),
  INDEX idx_activities_strava_id (strava_activity_id)
);

-- Training Plans
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan details
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Generated plan data
  plan_data JSONB NOT NULL, -- Structured plan from AI

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_training_plans_user (user_id, status)
);

-- Report Generation History
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Report details
  report_type TEXT NOT NULL CHECK (report_type IN ('performance', 'training_plan', 'comprehensive')),
  period_start DATE,
  period_end DATE,

  -- Generation data
  config JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Output
  report_url TEXT,
  report_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  INDEX idx_reports_user_date (user_id, created_at DESC)
);
```

### Row-Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.athlete_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.athlete_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.athlete_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Similar policies for other tables...
```

---

## User Flow Design

### 1. Onboarding Flow

```
Landing Page
    ↓
Sign Up / Sign In
    ↓ (new user)
Welcome Screen
    ↓
Connect to Strava (optional, can skip)
    ↓
Profile Setup Wizard
    │
    ├─ Step 1: Basic Info (name, age, gender)
    │
    ├─ Step 2: Performance Metrics (FTP, max HR, weight)
    │   ├─ Manual entry
    │   └─ Auto-detect from Strava (if connected)
    │
    ├─ Step 3: Goals (select from presets or custom)
    │
    └─ Step 4: Preferences (language, units, timezone)
    ↓
Dashboard (ready to use!)
```

### 2. Profile Setup Wizard UI

**Step 1: Basic Info**
```
┌─────────────────────────────────────┐
│  Let's get to know you              │
│                                     │
│  [First Name]         [Last Name]   │
│                                     │
│  Age: [35]  Gender: [Dropdown ▼]    │
│                                     │
│  [Skip] [Next →]                    │
└─────────────────────────────────────┘
```

**Step 2: Performance Metrics**
```
┌─────────────────────────────────────┐
│  Your performance baseline          │
│                                     │
│  ⚡ FTP (Functional Threshold Power) │
│     [265] watts                     │
│     └─ [Auto-detect from Strava]   │
│                                     │
│  ❤️  Max Heart Rate                 │
│     [186] bpm                       │
│                                     │
│  ⚖️  Weight                          │
│     [70] kg                         │
│                                     │
│  [← Back] [Next →]                  │
└─────────────────────────────────────┘
```

**Step 3: Goals**
```
┌─────────────────────────────────────┐
│  What are your cycling goals?       │
│                                     │
│  ☑ Improve FTP                      │
│  ☐ Complete a century ride          │
│  ☐ Train for a race                 │
│  ☐ Build endurance                  │
│  ☐ Weight loss                      │
│  ☐ Custom: [____________]           │
│                                     │
│  [← Back] [Next →]                  │
└─────────────────────────────────────┘
```

**Step 4: Preferences**
```
┌─────────────────────────────────────┐
│  Customize your experience          │
│                                     │
│  🌐 Language                         │
│     [English ▼]                     │
│                                     │
│  📏 Units                            │
│     ⚪ Metric  ⚫ Imperial            │
│                                     │
│  🕐 Timezone                         │
│     [America/New_York ▼]            │
│                                     │
│  [← Back] [Complete Setup 🎉]       │
└─────────────────────────────────────┘
```

### 3. Main Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] Cycling AI    [🔔]  [⚙️]  [Eduardo ▼]          │
├─────────────────────────────────────────────────────────┤
│  📊 Dashboard  📈 Performance  🎯 Training  📄 Reports   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │  Recent Activities      │  │  Quick Stats         │ │
│  │  ─────────────────────  │  │  ────────────────    │ │
│  │  • Morning Ride         │  │  🚴 15 rides/month   │ │
│  │    52.3 km, 265w avg    │  │  ⚡ 265 FTP          │ │
│  │  • Hill Repeats         │  │  📈 +5w this week    │ │
│  │    22.1 km, 289w avg    │  │  ⏱️  12.5h/week      │ │
│  └─────────────────────────┘  └──────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  AI Insights                                     │  │
│  │  ────────────────────────────────────────────   │  │
│  │  💡 Your power output is trending upward!       │  │
│  │     Consider a new FTP test.                    │  │
│  │                                                  │  │
│  │  🎯 You're 75% through your training plan.      │  │
│  │     Great consistency!                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [+ Generate New Report]  [🔄 Sync Strava]             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Internationalization Strategy

### Implementation with next-intl

**Directory Structure:**
```
src/
├── i18n/
│   ├── locales/
│   │   ├── en.json
│   │   ├── pt.json
│   │   ├── es.json
│   │   └── fr.json
│   ├── config.ts
│   └── request.ts
├── app/
│   └── [locale]/
│       ├── layout.tsx
│       ├── page.tsx
│       └── ...
```

**Translation Files (en.json):**
```json
{
  "common": {
    "appName": "Cycling AI",
    "next": "Next",
    "back": "Back",
    "skip": "Skip",
    "save": "Save"
  },
  "auth": {
    "signIn": "Sign In",
    "signUp": "Sign Up",
    "signInWithGoogle": "Sign in with Google",
    "signInWithStrava": "Sign in with Strava"
  },
  "onboarding": {
    "welcome": "Welcome to Cycling AI!",
    "step1Title": "Let's get to know you",
    "step2Title": "Your performance baseline",
    "step3Title": "What are your cycling goals?",
    "step4Title": "Customize your experience"
  },
  "dashboard": {
    "recentActivities": "Recent Activities",
    "quickStats": "Quick Stats",
    "aiInsights": "AI Insights"
  }
}
```

**Initial Language Support:**
- 🇬🇧 English (default)
- 🇵🇹 Portuguese (Brazilian)
- 🇪🇸 Spanish
- 🇫🇷 French

---

## Strava API Integration

### OAuth Flow

```
User clicks "Connect to Strava"
    ↓
Redirect to Strava authorization URL
    ↓
User grants permissions
    ↓
Strava redirects back with authorization code
    ↓
Exchange code for access_token + refresh_token
    ↓
Store tokens (encrypted) in database
    ↓
Fetch athlete profile + recent activities
    ↓
Background sync starts
```

### Data Sync Strategy

**Initial Sync:**
1. Fetch last 6 months of activities
2. Process and store in database
3. Download FIT files (if available)
4. Auto-detect FTP from recent activities

**Incremental Sync:**
- Webhook subscriptions for new activities
- Fallback: Poll every 15 minutes (respecting rate limits)
- Update only changed activities

**Sync Architecture:**
```typescript
// Background job (Supabase Edge Function)
export async function syncStravaActivities(userId: string) {
  // 1. Get connection from DB
  const connection = await getStravaConnection(userId)

  // 2. Refresh token if expired
  if (isTokenExpired(connection)) {
    await refreshStravaToken(connection)
  }

  // 3. Fetch new activities
  const activities = await fetchStravaActivities(connection, {
    after: connection.last_sync_at
  })

  // 4. Store in database
  await upsertActivities(activities)

  // 5. Update sync timestamp
  await updateSyncTimestamp(userId)
}
```

### Rate Limiting Strategy

Strava limits: 100 req/15min, 1000 req/day

- Use exponential backoff for retries
- Queue requests with priority system
- Cache athlete profile for 1 hour
- Batch activity fetches (200 per request)

---

## API Architecture

### Next.js API Routes

```
app/api/
├── auth/
│   └── strava/
│       ├── connect/route.ts      # Initiate OAuth
│       └── callback/route.ts     # Handle OAuth callback
│
├── profile/
│   ├── route.ts                  # GET/PUT profile
│   └── auto-detect/route.ts      # Auto-detect FTP/HR
│
├── activities/
│   ├── route.ts                  # GET activities (paginated)
│   └── sync/route.ts             # Trigger manual sync
│
├── reports/
│   ├── route.ts                  # GET reports list
│   ├── generate/route.ts         # POST create report
│   └── [reportId]/route.ts       # GET specific report
│
└── ai/
    ├── analyze/route.ts          # POST analyze performance
    └── chat/route.ts             # POST chat with AI
```

### Python Backend Integration

**Option 1: Direct Integration (Recommended)**
```typescript
// Next.js API route calls Python CLI
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  const { profilePath, csvPath, fitDir } = await request.json()

  const command = `cycling-ai generate \
    --profile ${profilePath} \
    --csv ${csvPath} \
    --fit-dir ${fitDir} \
    --provider anthropic \
    --output-dir /tmp/reports`

  const { stdout, stderr } = await execAsync(command)

  // Parse output and return report data
  return Response.json({ reportUrl: stdout })
}
```

**Option 2: REST API Wrapper**
```python
# FastAPI wrapper around cycling-ai
from fastapi import FastAPI
from cycling_ai.orchestration.workflows.full_report import FullReportWorkflow

app = FastAPI()

@app.post("/api/generate-report")
async def generate_report(config: WorkflowConfig):
    workflow = FullReportWorkflow(provider=provider)
    result = workflow.execute(config)
    return {"status": "success", "report_url": result.output_files[0]}
```

---

## Observability & Monitoring

### Sentry Configuration

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1,

  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Custom tags
  beforeSend(event) {
    event.tags = {
      ...event.tags,
      userId: getCurrentUserId(),
    }
    return event
  },
})
```

### Statsig Configuration

```typescript
// lib/statsig.ts
import { StatsigClient } from '@statsig/js-client'

export const statsig = new StatsigClient(
  process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY!,
  {
    environment: {
      tier: process.env.NODE_ENV,
    },
  }
)

// Initialize with user
export async function initStatsig(userId: string, userMetadata?: {
  email?: string
  country?: string
  locale?: string
}) {
  await statsig.initializeAsync({
    userID: userId,
    email: userMetadata?.email,
    country: userMetadata?.country,
    locale: userMetadata?.locale,
  })
}

// Example: Check feature flag
export function isFeatureEnabled(featureName: string): boolean {
  return statsig.checkGate(featureName)
}

// Example: Get dynamic config
export function getConfig(configName: string) {
  return statsig.getConfig(configName)
}

// Example: Track event
export function trackEvent(
  eventName: string,
  value?: string | number,
  metadata?: Record<string, any>
) {
  statsig.logEvent(eventName, value, metadata)
}
```

### Analytics Integration

```typescript
// lib/analytics.ts
import { trackEvent as statsigTrack } from '@/lib/statsig'
import * as Sentry from '@sentry/nextjs'

export const analytics = {
  // User lifecycle events
  userSignedUp(userId: string, method: 'email' | 'google' | 'strava') {
    statsigTrack('user_signed_up', method, { userId, method })
    Sentry.setUser({ id: userId })
  },

  userCompletedOnboarding(userId: string, profile: {
    hasFtp: boolean
    hasStravaConnection: boolean
    goalsCount: number
  }) {
    statsigTrack('onboarding_completed', undefined, {
      userId,
      ...profile,
    })
  },

  // Strava events
  stravaConnected(userId: string) {
    statsigTrack('strava_connected', undefined, { userId })
  },

  stravaSyncCompleted(userId: string, activitiesCount: number) {
    statsigTrack('strava_sync_completed', activitiesCount, {
      userId,
      activitiesCount,
    })
  },

  // Report generation events
  reportGenerationStarted(userId: string, reportType: string) {
    statsigTrack('report_generation_started', reportType, {
      userId,
      reportType,
    })
  },

  reportGenerationCompleted(
    userId: string,
    reportType: string,
    durationMs: number,
    provider: string
  ) {
    statsigTrack('report_generation_completed', durationMs, {
      userId,
      reportType,
      durationMs,
      provider,
    })
  },

  reportGenerationFailed(
    userId: string,
    reportType: string,
    error: string
  ) {
    statsigTrack('report_generation_failed', undefined, {
      userId,
      reportType,
      error,
    })

    Sentry.captureException(new Error(error), {
      tags: { reportType },
      user: { id: userId },
    })
  },

  // AI/LLM events
  llmProviderSelected(userId: string, provider: string) {
    statsigTrack('llm_provider_selected', provider, {
      userId,
      provider,
    })
  },

  // Feature usage
  featureUsed(userId: string, featureName: string) {
    statsigTrack('feature_used', featureName, {
      userId,
      featureName,
    })
  },
}
```

### Logging Strategy

```typescript
// lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  base: {
    env: process.env.NODE_ENV,
    revision: process.env.VERCEL_GIT_COMMIT_SHA,
  },
})

// Usage
logger.info({ userId, action: 'profile_update' }, 'Profile updated')
logger.error({ userId, error: err.message }, 'Failed to sync Strava')
```

### Key Metrics to Track with Statsig

**User Funnel (Statsig Funnel Charts):**
1. Landing page visit → Sign up
2. Sign up → Complete onboarding
3. Onboarding → Connect Strava
4. Connect Strava → First report generated
5. First report → Second report (activation)

**Feature Adoption (Statsig Events):**
- `user_signed_up` - Track signup method (email/google/strava)
- `onboarding_completed` - Track time to complete, profile completeness
- `strava_connected` - Strava adoption rate
- `strava_sync_completed` - Activity count per sync
- `report_generation_started/completed/failed` - Success rate, duration
- `llm_provider_selected` - Provider preference distribution
- `feature_used` - Individual feature usage

**A/B Tests (Statsig Experiments):**
- Different LLM providers (Claude vs GPT-4 vs Gemini)
- RAG enabled vs disabled (quality comparison)
- Onboarding flow variations (3-step vs 4-step)
- UI language (default English vs auto-detect)
- Training plan templates (different styles)

**Retention (Statsig Retention Charts):**
- Day 1, Day 7, Day 30 retention
- Weekly active users
- Monthly active users
- Cohort analysis by signup date

**Performance (Sentry):**
- Page load time (Core Web Vitals)
- API response time
- Database query time
- Python CLI execution time
- Error rates by endpoint

**Business KPIs:**
- User signups (daily/weekly/monthly)
- Strava connection rate
- Reports generated per user
- Average report generation time
- LLM provider cost per report

---

## Deployment Strategy

### Recommended: Vercel + Supabase

**Vercel (Frontend + API):**
- Automatic deployments from Git
- Preview deployments for PRs
- Edge functions for dynamic content
- Built-in analytics

**Supabase (Database + Auth):**
- Managed PostgreSQL
- Automatic backups
- Global CDN for static assets
- Free tier: 500MB database, 2GB bandwidth

**Python Backend:**
- **Option A:** Docker container on Railway/Fly.io
- **Option B:** AWS Lambda with Docker image
- **Option C:** Keep as CLI, call from Next.js API routes

### Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Strava
STRAVA_CLIENT_ID=xxx
STRAVA_CLIENT_SECRET=xxx
STRAVA_WEBHOOK_VERIFY_TOKEN=xxx

# LLM Providers
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=xxx
SENTRY_AUTH_TOKEN=xxx

# Statsig
NEXT_PUBLIC_STATSIG_CLIENT_KEY=xxx
STATSIG_SERVER_SECRET=xxx
```

---

## Security Considerations

### Data Protection

1. **Encryption at Rest:**
   - Strava tokens encrypted in database (using Supabase Vault)
   - FIT files stored in encrypted S3 bucket

2. **Encryption in Transit:**
   - HTTPS only (enforced by Vercel)
   - Database connections over SSL

3. **Authentication:**
   - JWT tokens with short expiration (1 hour)
   - Refresh tokens with rotation
   - MFA support (via Supabase)

4. **Authorization:**
   - Row-level security on all tables
   - API routes validate user ownership
   - Rate limiting on public endpoints

### GDPR Compliance

- **Data Retention:** User data deleted within 30 days of account deletion
- **Data Export:** Users can download all their data
- **Cookie Consent:** Cookie banner for EU users
- **Privacy Policy:** Clear explanation of data usage

---

## Development Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Next.js project with TypeScript
- [ ] Configure Supabase (database + auth)
- [ ] Implement authentication (email + Google)
- [ ] Basic dashboard layout

### Phase 2: Profile & Onboarding (Week 3-4)
- [ ] Profile setup wizard
- [ ] Form validation with Zod
- [ ] Internationalization setup
- [ ] Language switcher

### Phase 3: Strava Integration (Week 5-6)
- [ ] Strava OAuth flow
- [ ] Activity sync (initial + incremental)
- [ ] Webhook subscriptions
- [ ] Auto-detect FTP/HR from activities

### Phase 4: AI Integration (Week 7-8)
- [ ] Python backend API wrapper
- [ ] Report generation UI
- [ ] Progress tracking
- [ ] Report viewing

### Phase 5: Polish & Launch (Week 9-10)
- [ ] Error handling & monitoring
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Beta testing

---

## Open Questions

1. **FIT File Storage:** Where should we store FIT files?
   - Option A: Supabase Storage (simple, integrated)
   - Option B: S3 (more scalable, cheaper at scale)

2. **Real-time Updates:** Do we need real-time updates for activity sync?
   - If yes: Use Supabase Realtime subscriptions
   - If no: Standard polling is simpler

3. **Mobile App:** Future consideration?
   - React Native (reuse components)
   - Progressive Web App (simpler, works everywhere)

4. **Offline Support:** Should the app work offline?
   - Service workers + IndexedDB for caching
   - May complicate initial implementation

---

## Cost Estimation (Monthly)

### Free Tier (Up to 100 users)
- Vercel: Free
- Supabase: Free (500MB database)
- Sentry: Free (5k events/month)
- Statsig: Free (1M events/month)
- **Total:** $0/month

### Small Scale (100-1,000 users)
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- Sentry Team: $26/month
- Statsig: Free (still under 1M events)
- LLM API costs: ~$50/month (est. 20 reports/day)
- **Total:** ~$121/month

### Medium Scale (1,000-10,000 users)
- Vercel Team: $20/month per member
- Supabase Pro: $25/month (may need upgrade to Team at $599)
- Sentry Team: $89/month
- Statsig Pro: $150/month (10M events)
- LLM API costs: ~$500/month (est. 200 reports/day)
- **Total:** ~$784/month (or $1,363 with Supabase Team)

---

## Next Steps

1. **Review this plan** - Validate assumptions and technical choices
2. **Set up development environment** - Next.js + Supabase + Sentry
3. **Create wireframes** - Use Figma or similar for UI mockups
4. **Database migrations** - Implement schema in Supabase
5. **Start with authentication** - Get OAuth working first
6. **Iterative development** - Build in small, testable increments

---

## Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **shadcn/ui:** https://ui.shadcn.com
- **next-intl:** https://next-intl-docs.vercel.app
- **Strava API:** https://developers.strava.com
- **Sentry Docs:** https://docs.sentry.io/platforms/javascript/guides/nextjs
- **Statsig Docs:** https://docs.statsig.com

---

**Document Version:** 1.0
**Last Updated:** 2025-12-03
**Author:** Eduardo (with Claude Code assistance)

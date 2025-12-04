# Phase 5: Polish & Launch - Task Breakdown

**Duration:** Weeks 9-10  
**Goal:** Production-ready application with full observability and testing  
**Status:** Pending Phase 4 Completion

---

## Overview

Phase 5 polishes the application, adds comprehensive dashboard, implements full observability stack, and prepares for production launch.

### Key Deliverables

- ✅ Complete dashboard with widgets and charts
- ✅ Sentry error tracking
- ✅ Statsig analytics and A/B testing
- ✅ Mobile-optimized responsive design
- ✅ E2E testing with Playwright
- ✅ Performance optimization
- ✅ Production deployment

### Prerequisites

- All core features working
- Report generation functional
- Strava integration complete

---

## Task Breakdown

### Week 9: Dashboard & Observability

#### P5-T1: Set Up Sentry Error Tracking

**Estimated Effort:** 2 hours

**Steps:**
1. Create Sentry account and project
2. Install Sentry SDK
3. Configure for Next.js
4. Add error boundaries
5. Test error reporting

**Installation:**
```bash
pnpm add @sentry/nextjs
pnpx @sentry/wizard@latest -i nextjs
```

**Configuration:**
```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

**Acceptance Criteria:**
- [ ] Sentry configured for client and server
- [ ] Test error captured in Sentry
- [ ] Source maps uploaded
- [ ] User context tracked

---

#### P5-T2: Integrate Statsig Analytics

**Estimated Effort:** 3 hours

**Installation:**
```bash
pnpm add @statsig/js-client
```

**Files:**
- `lib/analytics/statsig.ts`
- `lib/analytics/events.ts`

**Statsig Setup:**
```typescript
// lib/analytics/statsig.ts
import { StatsigClient } from '@statsig/js-client'

export const statsig = new StatsigClient(
  process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY!,
  {
    environment: {
      tier: process.env.NODE_ENV,
    },
  }
)

export async function initStatsig(userId: string, metadata?: {
  email?: string
  locale?: string
}) {
  await statsig.initializeAsync({
    userID: userId,
    email: metadata?.email,
    locale: metadata?.locale,
  })
}

// lib/analytics/events.ts
export const trackEvent = {
  userSignedUp(userId: string, method: string) {
    statsig.logEvent('user_signed_up', method, { userId, method })
  },

  onboardingCompleted(userId: string, data: any) {
    statsig.logEvent('onboarding_completed', undefined, { userId, ...data })
  },

  stravaConnected(userId: string) {
    statsig.logEvent('strava_connected', undefined, { userId })
  },

  reportGenerated(userId: string, provider: string, duration: number) {
    statsig.logEvent('report_generated', duration, {
      userId,
      provider,
      duration,
    })
  },
}
```

**Acceptance Criteria:**
- [ ] Statsig initialized on app load
- [ ] Events tracked correctly
- [ ] Feature flags working
- [ ] User properties set

---

#### P5-T3: Build Recent Activities Widget

**Estimated Effort:** 3 hours

**Files:**
- `components/dashboard/recent-activities.tsx`

**Features:**
- Show last 5 activities
- Display key metrics (distance, time, power)
- Link to full activity list

**Acceptance Criteria:**
- [ ] Widget loads activities
- [ ] Metrics formatted correctly
- [ ] Loading state shown
- [ ] Mobile responsive

---

#### P5-T4: Build Quick Stats Widget

**Estimated Effort:** 3 hours

**Features:**
- Rides this month
- Current FTP
- Total hours this week
- Avg power trend

**Queries:**
```typescript
// Get rides this month
const { count } = await supabase
  .from('activities')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('start_date', startOfMonth.toISOString())

// Get current FTP
const { data: profile } = await supabase
  .from('athlete_profiles')
  .select('ftp')
  .eq('user_id', userId)
  .single()

// Get total hours this week
const { data: activities } = await supabase
  .from('activities')
  .select('moving_time_seconds')
  .eq('user_id', userId)
  .gte('start_date', startOfWeek.toISOString())

const totalHours = activities.reduce(
  (sum, a) => sum + a.moving_time_seconds / 3600,
  0
)
```

**Acceptance Criteria:**
- [ ] Stats calculated correctly
- [ ] Updates in real-time
- [ ] Handles no data gracefully

---

#### P5-T5: Build AI Insights Widget

**Estimated Effort:** 4 hours

**Features:**
- Show latest AI-generated insights
- Suggestions based on recent performance
- Link to full report

**AI Insights Generation:**
- Pull from latest report
- Highlight key findings
- Show as cards

**Acceptance Criteria:**
- [ ] Insights from reports shown
- [ ] Formatted nicely
- [ ] Click to view full report

---

#### P5-T6: Build Performance Trends Chart

**Estimated Effort:** 4 hours

**Installation:**
```bash
pnpm add recharts
```

**Files:**
- `components/dashboard/performance-chart.tsx`

**Features:**
- Line chart of power over time
- Toggle metrics (power, HR, pace)
- Last 3/6/12 months view

**Acceptance Criteria:**
- [ ] Chart renders correctly
- [ ] Data accurate
- [ ] Interactive (hover, zoom)
- [ ] Mobile responsive

---

#### P5-T7: Add Custom Error Pages

**Estimated Effort:** 2 hours

**Files:**
- `app/error.tsx` - Error boundary
- `app/not-found.tsx` - 404 page
- `app/global-error.tsx` - Global error

**Acceptance Criteria:**
- [ ] 404 page styled
- [ ] Error boundary catches errors
- [ ] User-friendly messages
- [ ] Link back to dashboard

---

### Week 10: Testing & Launch

#### P5-T8: Write E2E Tests with Playwright

**Estimated Effort:** 6 hours

**Installation:**
```bash
pnpm add -D @playwright/test
pnpx playwright install
```

**Test Files:**
- `e2e/auth.spec.ts` - Auth flows
- `e2e/onboarding.spec.ts` - Onboarding wizard
- `e2e/dashboard.spec.ts` - Dashboard functionality
- `e2e/reports.spec.ts` - Report generation

**Example Test:**
```typescript
// e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test'

test('complete onboarding flow', async ({ page }) => {
  // Signup
  await page.goto('/signup')
  await page.fill('[name=email]', 'test@example.com')
  await page.fill('[name=password]', 'SecurePass123!')
  await page.click('button[type=submit]')

  // Wait for onboarding
  await expect(page).toHaveURL(/\/onboarding/)

  // Step 1
  await page.fill('[name=firstName]', 'John')
  await page.fill('[name=lastName]', 'Doe')
  await page.click('text=Next')

  // Step 2
  await page.fill('[name=ftp]', '265')
  await page.click('text=Next')

  // Step 3
  await page.check('text=Improve FTP')
  await page.click('text=Next')

  // Step 4
  await page.click('text=Complete Setup')

  // Verify redirect
  await expect(page).toHaveURL('/dashboard')
})
```

**Acceptance Criteria:**
- [ ] All critical flows tested
- [ ] Tests pass locally
- [ ] Tests run in CI
- [ ] Coverage > 80% of user flows

---

#### P5-T9: Performance Optimization

**Estimated Effort:** 4 hours

**Tasks:**
1. Add image optimization
2. Lazy load components
3. Add loading skeletons
4. Optimize bundle size
5. Add caching headers

**Image Optimization:**
```typescript
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Cycling"
  width={800}
  height={600}
  priority
/>
```

**Lazy Loading:**
```typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <Skeleton />,
})
```

**Acceptance Criteria:**
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.5s

---

#### P5-T10: Mobile Optimization

**Estimated Effort:** 4 hours

**Tasks:**
1. Test all pages on mobile
2. Fix layout issues
3. Optimize touch targets
4. Test on real devices

**Mobile Testing:**
- iPhone 12/13/14
- Android (Pixel, Samsung)
- iPad

**Acceptance Criteria:**
- [ ] All pages work on mobile
- [ ] Touch targets > 44x44px
- [ ] No horizontal scroll
- [ ] Gestures work correctly

---

#### P5-T11: Set Up Production Monitoring

**Estimated Effort:** 2 hours

**Monitoring:**
- Sentry alerts for errors
- Statsig dashboards for metrics
- Supabase monitoring for DB
- Vercel Analytics for performance

**Alerts:**
- Error rate > 1%
- API latency > 500ms
- Database queries > 100ms

**Acceptance Criteria:**
- [ ] Alerts configured
- [ ] Dashboard created
- [ ] Team notified on critical issues

---

#### P5-T12: Production Deployment Checklist

**Estimated Effort:** 3 hours

**Pre-Deploy:**
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Sentry configured
- [ ] Statsig configured
- [ ] Domain configured
- [ ] SSL certificate active

**Deploy:**
1. Deploy backend (Railway/Fly.io)
2. Deploy frontend (Vercel)
3. Run smoke tests
4. Monitor for errors

**Post-Deploy:**
- [ ] Health check passes
- [ ] Can sign up
- [ ] Can log in
- [ ] Can generate report
- [ ] Strava connection works

---

## Phase Completion Checklist

### Dashboard
- [ ] All widgets functional
- [ ] Charts rendering
- [ ] Real-time updates
- [ ] Mobile responsive

### Observability
- [ ] Sentry tracking errors
- [ ] Statsig tracking events
- [ ] Alerts configured
- [ ] Dashboards created

### Testing
- [ ] E2E tests passing
- [ ] Performance optimized
- [ ] Mobile tested
- [ ] Load tested

### Production
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Domain configured
- [ ] Monitoring active

---

## Success Criteria

1. Lighthouse score > 90
2. 0 critical errors in Sentry for 7 days
3. < 100ms API response time (p95)
4. Mobile experience matches desktop
5. All E2E tests passing
6. Dashboard fully functional
7. Production deployment successful

---

## Launch Checklist

### Pre-Launch
- [ ] Beta testing completed
- [ ] All critical bugs fixed
- [ ] Documentation updated
- [ ] Support processes established
- [ ] Rollback plan documented

### Launch Day
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Announce launch
- [ ] Support team ready

### Post-Launch
- [ ] Monitor for 48 hours
- [ ] Gather user feedback
- [ ] Address urgent issues
- [ ] Plan next iteration

---

## Post-Launch Roadmap

**Week 11-12: Iteration Based on Feedback**
- Fix critical bugs
- Optimize based on real usage
- Implement quick wins

**Month 2: Feature Enhancements**
- Advanced analytics
- Custom training plans
- Social features

**Month 3: Scaling**
- Performance optimization at scale
- Cost optimization
- Infrastructure improvements

---

**Phase 5 Task Breakdown - v1.0**  
**Last Updated:** 2025-12-03

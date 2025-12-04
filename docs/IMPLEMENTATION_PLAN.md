# Cycling AI Web Application - Technical Implementation Plan

**Version:** 1.0
**Created:** 2025-12-03
**Status:** Draft - Ready for Implementation

---

## Executive Summary

This document provides a comprehensive technical architecture and implementation plan for building a modern web UI for the Cycling AI Analysis platform. The solution will create a Next.js-based web application that integrates with the existing production-ready Python backend while introducing Supabase for data persistence, Strava integration, and user management.

**Key Objectives:**
- Build a user-friendly web interface that makes the existing CLI capabilities accessible to non-technical users
- Integrate Strava API for automatic activity synchronization
- Implement authentication, profile management, and multi-language support
- Maintain the high-quality standards of the existing Python backend (type safety, testing, clean architecture)
- Enable AI-powered report generation through a web interface
- Establish observability and experimentation infrastructure (Sentry, Statsig)

**Timeline:** 10 weeks (5 phases)
**Tech Stack:** Next.js 14+ + Supabase + Statsig + FastAPI

---

## Table of Contents

1. [Requirements Analysis](#1-requirements-analysis)
2. [Technical Architecture](#2-technical-architecture)
3. [Implementation Strategy](#3-implementation-strategy)
4. [Risk Assessment](#4-risk-assessment)
5. [Development Workflow](#5-development-workflow)
6. [Success Metrics](#6-success-metrics)
7. [Next Steps](#7-next-steps)

---

## 1. Requirements Analysis

### 1.1 Functional Requirements

#### Core User Flows

**1. Authentication & Onboarding**
- User registration (email/password, Google OAuth, Strava OAuth)
- 4-step profile setup wizard (basic info, performance metrics, goals, preferences)
- Email verification and password recovery

**2. Strava Integration**
- OAuth connection flow
- Initial activity sync (6 months historical data)
- Incremental sync via webhooks + polling fallback
- FIT file download and processing
- Auto-detection of FTP and max HR from activities

**3. Profile Management**
- View and edit athlete profile (FTP, max HR, weight, age, goals)
- Manage preferences (language, units, timezone)
- Update Strava connection status

**4. Report Generation**
- Initiate AI-powered analysis through web UI
- Monitor report generation progress
- View generated reports in web interface
- Historical report access

**5. Dashboard**
- Recent activities summary
- Quick stats (rides/month, current FTP, training hours)
- AI-generated insights
- Training plan progress

#### Non-Functional Requirements

- **Performance**: Page load < 2s, API response < 500ms (p95)
- **Scalability**: Support 10K concurrent users
- **Availability**: 99.9% uptime
- **Security**: HTTPS, encrypted tokens, RLS policies
- **Accessibility**: WCAG 2.1 AA compliance
- **Internationalization**: Support 4 languages (EN, PT, ES, FR)
- **Mobile Responsiveness**: Full functionality on mobile devices

### 1.2 Technical Constraints

1. **Existing Python Backend**: Must integrate with production-ready `cycling-ai` CLI (253 passing tests, strict type safety)
2. **Strava API Limits**: 100 requests/15min, 1000 requests/day per application
3. **LLM Costs**: Monitor token usage, optimize for cost (~$0.25 per report)
4. **Data Privacy**: GDPR compliance, user data ownership
5. **Free Tier Budget**: Start with Vercel Free, Supabase Free (500MB DB)

---

## 2. Technical Architecture

### 2.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  Next.js 14+ (App Router) + React Server Components             │
│  shadcn/ui + Tailwind CSS + next-intl (i18n)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│   Next.js API       │         │   Supabase          │
│   Routes Layer      │◄────────┤   (PostgreSQL +     │
│                     │  Auth   │    Auth + Storage)  │
│  • /api/auth/*      │  JWT    │                     │
│  • /api/profile/*   │         │  RLS Policies       │
│  • /api/reports/*   │         │  Real-time          │
│  • /api/strava/*    │         └─────────────────────┘
└─────────┬───────────┘
          │
          │ HTTP/gRPC
          v
┌─────────────────────────────────────────────────────┐
│         Python Backend Integration Layer            │
│                                                      │
│  FastAPI Wrapper (Recommended)                      │
│  ┌────────────────────────────────────┐            │
│  │  FastAPI + Pydantic                │            │
│  │  POST /generate-report             │            │
│  │  POST /analyze-performance         │            │
│  │  POST /generate-training-plan      │            │
│  └────────────┬───────────────────────┘            │
│               │                                      │
│               v                                      │
│  ┌────────────────────────────────────┐            │
│  │  Existing cycling-ai Python CLI    │            │
│  │  • MultiAgentOrchestrator          │            │
│  │  • 4-Phase Report Generation       │            │
│  │  • Tool System (MCP)               │            │
│  │  • Provider Adapters               │            │
│  │  • RAG System                      │            │
│  └────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
          │
          v
┌─────────────────────────────────────────────────────┐
│            External Services                         │
│  • Strava API (OAuth + Webhooks)                    │
│  • Anthropic/OpenAI/Gemini (LLM Providers)          │
│  • Sentry (Error Tracking)                          │
│  • Statsig (Analytics + Feature Flags)              │
└─────────────────────────────────────────────────────┘
```

### 2.2 Database Schema

See `docs/UI_ARCHITECTURE.md` for complete schema definition.

**Key Tables:**
- `auth.users` - Managed by Supabase Auth
- `public.athlete_profiles` - User profiles with FTP, max HR, goals, preferences
- `public.strava_connections` - OAuth tokens and sync status
- `public.activities` - Synced Strava activities with metrics
- `public.training_plans` - AI-generated training plans
- `public.reports` - Report generation history and outputs

**Security:**
- Row-Level Security (RLS) on all tables
- Encrypted tokens using Supabase Vault
- HTTPS only, SSL database connections

### 2.3 Python Backend Integration

**Recommended: FastAPI Wrapper**

Provides RESTful API for Next.js, enables async processing, better error handling.

**Key Endpoints:**
- `POST /api/generate-report` - Initiate report generation
- `GET /api/report/{id}/status` - Check generation status
- `POST /api/analyze-performance` - Run performance analysis
- `POST /api/generate-training-plan` - Create training plan

**Alternative: Direct CLI Invocation**

For MVP, can call CLI directly from Next.js API routes using `child_process.exec()`.

---

## 3. Implementation Strategy

### Overview: 5 Phases, 10 Weeks

| Phase | Duration | Focus | Key Deliverables |
|-------|----------|-------|------------------|
| 1 | Weeks 1-2 | Foundation | Auth, DB schema, basic layout |
| 2 | Weeks 3-4 | Profile & Onboarding | 4-step wizard, i18n, profile CRUD |
| 3 | Weeks 5-6 | Strava Integration | OAuth, activity sync, webhooks |
| 4 | Weeks 7-8 | AI Integration | FastAPI wrapper, report generation |
| 5 | Weeks 9-10 | Polish & Launch | Dashboard, observability, testing |

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up infrastructure and core authentication

**Key Tasks:**
1. Project setup (Next.js 14+, TypeScript, Tailwind, shadcn/ui)
2. Supabase setup (database schema, RLS policies, auth)
3. Authentication flow (signup, login, email verification, password recovery)
4. Basic layout (navigation, dark mode, responsive design)

**Deliverables:**
- Working authentication system
- Database schema deployed with RLS
- Basic dashboard skeleton

**Success Criteria:**
- User can sign up, verify email, and log in
- RLS policies tested and working
- TypeScript strict mode with 0 errors

**See:** `docs/tasks/PHASE_1_FOUNDATION.md` for detailed task breakdown

---

### Phase 2: Profile & Onboarding (Weeks 3-4)

**Goal:** Complete profile setup wizard and preferences

**Key Tasks:**
1. Profile setup wizard (4 steps with validation)
2. Form validation (Zod schemas, client + server)
3. Internationalization (next-intl, 4 languages)
4. Profile management (view/edit with auto-save)

**Deliverables:**
- Complete onboarding flow
- Multi-language support
- Profile CRUD operations

**Success Criteria:**
- New user can complete onboarding in < 3 minutes
- All form fields validated with clear error messages
- Language switching works seamlessly
- 100% TypeScript coverage with Zod validation

**See:** `docs/tasks/PHASE_2_PROFILE_ONBOARDING.md` for detailed task breakdown

---

### Phase 3: Strava Integration (Weeks 5-6)

**Goal:** Enable Strava OAuth and activity synchronization

**Key Tasks:**
1. Strava OAuth flow (authorization code flow)
2. Activity sync - initial (6 months historical data)
3. Incremental sync (webhooks + polling fallback)
4. Sync status UI (connection status, progress, manual sync)

**Deliverables:**
- Working Strava integration
- Automatic activity sync
- FIT file storage

**Success Criteria:**
- User can connect Strava in < 30 seconds
- Initial sync completes in < 2 minutes for 100 activities
- Webhooks working with 100% reliability
- FTP auto-detected with 90%+ accuracy

**See:** `docs/tasks/PHASE_3_STRAVA_INTEGRATION.md` for detailed task breakdown

---

### Phase 4: AI Integration & Reports (Weeks 7-8)

**Goal:** Enable report generation through web UI

**Key Tasks:**
1. Python backend wrapper (FastAPI application)
2. Report generation UI (config form, provider selection)
3. Progress tracking (real-time updates via polling)
4. Report viewing (render HTML, download, share)

**Deliverables:**
- FastAPI wrapper for Python backend
- Report generation UI
- Report viewing and management

**Success Criteria:**
- Report generation completes in < 5 minutes
- Progress updates every 10 seconds
- User can view report immediately after completion
- FastAPI service deployed and monitored

**See:** `docs/tasks/PHASE_4_AI_INTEGRATION.md` for detailed task breakdown

---

### Phase 5: Dashboard & Polish (Weeks 9-10)

**Goal:** Build comprehensive dashboard and prepare for launch

**Key Tasks:**
1. Dashboard components (activities, stats, insights, charts)
2. Observability (Sentry setup, error boundaries, custom error pages)
3. Analytics & experimentation (Statsig integration, A/B tests)
4. Mobile optimization (responsive design, touch interactions)
5. Testing & QA (E2E tests, unit tests, load testing)

**Deliverables:**
- Production-ready dashboard
- Full observability stack
- Mobile-optimized experience

**Success Criteria:**
- Lighthouse score > 90 (Performance, Accessibility, Best Practices)
- 0 critical Sentry errors for 7 days
- < 100ms API response time (p95)
- Mobile experience matches desktop

**See:** `docs/tasks/PHASE_5_POLISH_LAUNCH.md` for detailed task breakdown

---

## 4. Risk Assessment

### 4.1 Technical Risks

#### Risk 1: Python Backend Integration Complexity

**Risk Level:** HIGH

**Mitigation:**
1. Start with FastAPI wrapper (well-defined REST API)
2. Use background tasks with status polling
3. Set 10-minute timeout for report generation
4. Deploy as Docker container (Railway, Fly.io)
5. Add detailed logging and Sentry error tracking

**Fallback:** Direct CLI invocation from Next.js API routes

---

#### Risk 2: Strava API Rate Limits

**Risk Level:** MEDIUM

**Mitigation:**
1. Use webhooks as primary sync mechanism (no rate limit impact)
2. Implement Redis-backed queue with rate limiting
3. Exponential backoff on errors
4. Cache athlete profiles for 1 hour
5. Batch operations (200 activities per request)

**Monitoring:** Track daily Strava API usage in Statsig

---

#### Risk 3: LLM Cost Overruns

**Risk Level:** MEDIUM

**Mitigation:**
1. Set max tokens per report (30K tokens = $0.30)
2. Use Gemini as default (best value)
3. Enable RAG by default to reduce context size
4. Limit users to 10 reports/month on free tier
5. Track token usage per user in Statsig

**Cost Projections:**
- 100 users × 10 reports/month × $0.25 = $250/month
- 1,000 users × 10 reports/month × $0.25 = $2,500/month

---

#### Risk 4: Database Performance (Supabase Free Tier)

**Risk Level:** LOW-MEDIUM

**Mitigation:**
1. Use composite indexes on `(user_id, date)`
2. Paginate activities list (50 per page)
3. Archive old activities (>12 months) to cold storage
4. Monitor database size and query performance
5. Upgrade to Supabase Pro ($25/mo) at 100+ users

**Trigger for Upgrade:**
- Database size > 400MB (80% of free tier)
- Query latency > 500ms (p95)

---

### 4.2 Product Risks

#### Risk 1: User Onboarding Friction

**Risk Level:** MEDIUM

**Mitigation:**
1. Allow skipping optional steps
2. Use Strava data to pre-fill FTP, max HR, weight
3. Clear progress indicator (Step 2 of 4)
4. Save & resume capability
5. A/B test 3-step vs 4-step onboarding

**Success Metrics:**
- Onboarding completion rate > 70%
- Time to first report < 10 minutes

---

#### Risk 2: Strava Connection Adoption

**Risk Level:** LOW-MEDIUM

**Mitigation:**
1. Clearly explain benefits (auto-sync, FTP detection)
2. Offer Strava connection after showing manual entry effort
3. Show "Connect Strava to unlock X insights" prompts
4. Support manual CSV upload for non-Strava users

**Success Metrics:**
- Strava connection rate > 60%

---

## 5. Development Workflow

### 5.1 Recommended Tech Stack

**Frontend:**
- Framework: Next.js 14+ (App Router, React Server Components)
- Language: TypeScript 5.0+ (strict mode)
- UI Library: shadcn/ui + Radix UI primitives
- Styling: Tailwind CSS 3.0+
- Forms: React Hook Form + Zod validation
- State: Zustand (client) + TanStack Query (server)
- i18n: next-intl
- Testing: Vitest + React Testing Library + Playwright

**Backend:**
- API Layer: Next.js API Routes
- Python Integration: FastAPI wrapper
- Database: Supabase (PostgreSQL + Auth + Storage)
- Serverless: Supabase Edge Functions (Deno)
- Background Jobs: Supabase Edge Functions + pg_cron

**Infrastructure:**
- Hosting: Vercel (Next.js), Railway/Fly.io (FastAPI)
- Database: Supabase (managed PostgreSQL)
- Storage: Supabase Storage (FIT files, reports)
- Observability: Sentry (errors), Statsig (analytics)
- CI/CD: GitHub Actions

### 5.2 Project Structure

```
cycling-ai-web/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   ├── app/
│   │   │   ├── [locale]/         # Internationalized routes
│   │   │   │   ├── (auth)/       # Auth pages
│   │   │   │   ├── (dashboard)/  # Protected pages
│   │   │   │   └── layout.tsx
│   │   │   └── api/              # API routes
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui
│   │   │   ├── forms/
│   │   │   ├── dashboard/
│   │   │   └── onboarding/
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   ├── analytics.ts
│   │   │   └── logger.ts
│   │   ├── i18n/
│   │   │   └── locales/
│   │   └── middleware.ts
│   │
│   └── backend/                  # FastAPI wrapper
│       ├── app/
│       │   ├── main.py
│       │   ├── routers/
│       │   ├── services/
│       │   └── models.py
│       ├── Dockerfile
│       └── requirements.txt
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── config.toml
│
├── docs/
│   ├── UI_ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── tasks/
│
└── .github/workflows/
```

### 5.3 Development Environment Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/cycling-ai-web.git
cd cycling-ai-web

# 2. Install dependencies (frontend)
cd apps/web
pnpm install

# 3. Install Python backend dependencies
cd ../backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Set up Supabase locally
cd ../..
supabase init
supabase start

# 5. Copy environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/backend/.env.example apps/backend/.env

# 6. Run database migrations
supabase db reset

# 7. Start development servers
# Terminal 1: Next.js
cd apps/web && pnpm dev

# Terminal 2: FastAPI
cd apps/backend && uvicorn app.main:app --reload
```

### 5.4 Testing Strategy

**Frontend:**
- Unit tests: Vitest + React Testing Library
- E2E tests: Playwright
- Coverage target: 80%+

**Backend:**
- Unit tests: pytest
- Integration tests: pytest with test database
- Coverage target: 90%+

**CI/CD:**
- GitHub Actions for automated testing
- Deploy preview for each PR (Vercel)
- Automated migrations on deploy

---

## 6. Success Metrics

### 6.1 User Engagement Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Signup conversion rate | > 20% | Statsig Funnel |
| Onboarding completion | > 70% | Statsig Funnel |
| Strava connection rate | > 60% | Statsig Event |
| Time to first report | < 10 min | Statsig Event |
| Report success rate | > 95% | Sentry + Statsig |
| Day 1 retention | > 40% | Statsig Retention |
| Day 7 retention | > 20% | Statsig Retention |
| Day 30 retention | > 10% | Statsig Retention |

### 6.2 Technical Performance Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Page load time (LCP) | < 2.5s | Sentry Performance |
| API response time (p95) | < 500ms | Sentry Performance |
| Report generation time | < 5 min | Custom tracking |
| Strava webhook reliability | > 99% | Sentry |
| Database query time (p95) | < 100ms | Supabase Analytics |
| Error rate | < 1% | Sentry |
| Uptime | > 99.9% | Vercel Analytics |

### 6.3 Business Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Active users (MAU) | 100 → 1,000 (6mo) | Statsig |
| Reports/user/month | > 3 | Supabase query |
| LLM cost per report | < $0.30 | Custom tracking |
| LLM cost per user/month | < $1.50 | Custom tracking |
| Strava API usage | < 800/day | Custom tracking |

---

## 7. Next Steps

### Week 1: Immediate Actions

**Repository Setup:**
- [ ] Create GitHub repository
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up monorepo structure (pnpm workspaces)
- [ ] Configure ESLint, Prettier, TypeScript
- [ ] Set up CI/CD pipeline (GitHub Actions)

**Supabase Setup:**
- [ ] Create Supabase project
- [ ] Implement database schema (migrations)
- [ ] Set up RLS policies
- [ ] Configure Supabase Auth providers
- [ ] Test local Supabase environment

**Development Environment:**
- [ ] Document setup in README
- [ ] Create `.env.example` files
- [ ] Set up local development workflow
- [ ] Test full stack locally

### Week 2: Authentication Foundation

**Authentication Flow:**
- [ ] Implement signup page
- [ ] Implement login page
- [ ] Email verification flow
- [ ] Password recovery
- [ ] Protected route middleware

**Basic UI Shell:**
- [ ] App layout with navigation
- [ ] Dark mode toggle
- [ ] Responsive breakpoints
- [ ] Loading states

---

## Appendices

### A. Environment Variables

See `docs/UI_ARCHITECTURE.md` for complete environment variables reference.

### B. Key Dependencies

See phase task documents for detailed dependency lists.

### C. Deployment Strategy

See `docs/UI_ARCHITECTURE.md` for deployment architecture (Vercel + Supabase).

---

## Document Metadata

- **Version**: 1.0
- **Created**: 2025-12-03
- **Author**: Claude Code (Architecture Planner Agent)
- **Review Status**: Draft - Ready for Implementation
- **Next Review**: After Phase 1 completion
- **Related Documents**:
  - `docs/UI_ARCHITECTURE.md` - Detailed technical architecture
  - `docs/tasks/PHASE_*` - Detailed phase task breakdowns

---

**END OF IMPLEMENTATION PLAN**

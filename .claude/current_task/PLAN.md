# Phase 1 Foundation - Implementation Plan

**Version:** 1.0
**Created:** 2025-12-03
**Status:** Ready for Execution
**Duration:** 2 weeks (12 tasks)

---

## Executive Summary

This plan guides the implementation of Phase 1: Foundation for the Cycling AI Web Application. By the end of this phase, we will have:

1. A fully functional Next.js 14+ application with TypeScript strict mode
2. Supabase backend with complete database schema and Row-Level Security
3. Production-grade authentication system (signup, login, email verification, password recovery)
4. Basic application shell with navigation, dark mode, and responsive design
5. CI/CD pipeline with automated testing

**Key Principle:** This implementation follows the same high-quality standards as the existing Python backend (type safety, testing, clean architecture).

---

## Context & Constraints

### Existing Project
- **Current State:** Production-ready Python CLI application (`cycling-ai`)
- **Test Coverage:** 253 passing tests, 62% overall coverage
- **Type Safety:** Full mypy --strict compliance
- **Architecture:** Clean separation of concerns, SOLID principles
- **Status:** Phase 4 complete (multi-agent report generation)

### New Web UI
- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript 5.0+ (strict mode)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **UI Library:** shadcn/ui + Tailwind CSS
- **Target:** Non-technical cyclists who want AI analysis without CLI

### Integration Strategy
- **Phase 1:** Build web UI foundation (auth, database, basic layout)
- **Phase 2-4:** Add Strava integration, AI report generation
- **Python Backend:** Will be wrapped with FastAPI in Phase 4
- **For Now:** Focus on infrastructure and authentication

---

## Prerequisites

Before starting implementation, ensure:

1. **Development Environment:**
   - Node.js 20+ installed
   - pnpm package manager installed (`npm install -g pnpm`)
   - Git installed and configured
   - VSCode or preferred editor

2. **Accounts & Services:**
   - GitHub account (repository access)
   - Supabase account (free tier)
   - Email for testing (real email to receive verification emails)

3. **Knowledge:**
   - Next.js App Router fundamentals
   - TypeScript basics
   - React Server Components vs Client Components
   - Basic PostgreSQL/SQL

---

## Implementation Order

### Week 1: Infrastructure Setup

**Day 1-2: Project Initialization**
- P1-T1: Initialize Next.js project (2 hours)
- P1-T2: Configure ESLint and Prettier (1 hour)

**Day 3: Repository Setup**
- P1-T3: GitHub repository and CI/CD (2 hours)

**Day 4-5: Database Setup**
- P1-T4: Supabase project and database schema (4 hours)
- P1-T5: Row-Level Security policies (3 hours)

### Week 2: Authentication & UI

**Day 6-7: Supabase Integration**
- P1-T6: Install and configure Supabase client (2 hours)

**Day 8-9: Authentication Flow**
- P1-T7: Signup page (3 hours)
- P1-T8: Login page (2 hours)
- P1-T9: Password recovery flow (2 hours)

**Day 10-11: Protected Routes & Layout**
- P1-T10: Protected route middleware (2 hours)
- P1-T11: Basic app layout with navigation (4 hours)

**Day 12: Dashboard**
- P1-T12: Dashboard home page (2 hours)

**Total Estimated Time:** 29 hours over 2 weeks

---

## Task-by-Task Implementation Guide

## P1-T1: Initialize Next.js Project

**Objective:** Create a new Next.js 14+ project with TypeScript, App Router, Tailwind CSS, and shadcn/ui

**Prerequisites:** Node.js 20+, pnpm installed

**Location:** Create project in new `web/` directory within repository

### Step 1: Create Next.js Project

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# Create web directory
mkdir -p web
cd web

# Initialize Next.js with TypeScript, Tailwind, App Router
pnpx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

# When prompted:
# - Would you like to use ESLint? → Yes
# - Would you like to use Turbopack? → No
# - Project name: cycling-ai-web
```

**Expected Output:**
```
Creating a new Next.js app in /Users/eduardo/Documents/projects/cycling-ai-analysis/web.

Using pnpm.

Initializing project with template: app-tw


Installing dependencies:
- react
- react-dom
- next

...

Success! Created cycling-ai-web at /Users/eduardo/Documents/projects/cycling-ai-analysis/web
```

### Step 2: Verify Project Structure

```bash
ls -la

# Expected structure:
# app/
# public/
# package.json
# tsconfig.json
# tailwind.config.ts
# next.config.js
# .eslintrc.json
```

### Step 3: Configure TypeScript Strict Mode

Edit `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    },

    // Additional strict settings (like mypy --strict for Python)
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Step 4: Install shadcn/ui

```bash
pnpx shadcn-ui@latest init

# When prompted:
# - Which style? → Default
# - Which color? → Slate
# - Do you want to use CSS variables? → Yes
# - Where is your global CSS file? → app/globals.css
# - Configure import alias? → @/components
# - Configure import alias for utils? → @/lib/utils
```

This creates:
- `components.json` - shadcn/ui configuration
- `lib/utils.ts` - Utility functions (cn function)
- Updated `app/globals.css` with CSS variables

### Step 5: Install Additional Dependencies

```bash
# Form handling and validation
pnpm add zod react-hook-form @hookform/resolvers

# Type definitions
pnpm add -D @types/node

# UI components (we'll add these as needed)
pnpx shadcn-ui@latest add button
pnpx shadcn-ui@latest add input
pnpx shadcn-ui@latest add label
```

### Step 6: Update package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### Step 7: Test Development Server

```bash
pnpm dev
```

Visit http://localhost:3000 - should see Next.js default page

### Step 8: Create Basic Landing Page

Replace `app/page.tsx`:

```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          Cycling AI Analysis
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400">
          AI-powered cycling performance analysis
        </p>
      </div>
    </main>
  )
}
```

### Verification

**Run all checks:**
```bash
# Type checking (should pass with 0 errors)
pnpm type-check

# Build (should succeed)
pnpm build

# Development server (should start)
pnpm dev
```

**Expected Results:**
- ✅ `pnpm type-check` - No TypeScript errors
- ✅ `pnpm build` - Build succeeds
- ✅ `pnpm dev` - Dev server starts on port 3000
- ✅ Tailwind CSS working (test with utility classes)
- ✅ shadcn/ui initialized (Button component renders)

**Acceptance Criteria:**
- [x] Next.js 14+ project created with App Router
- [x] TypeScript strict mode enabled and passing
- [x] Tailwind CSS configured and working
- [x] shadcn/ui initialized with components.json
- [x] Development server runs without errors
- [x] Landing page displays correctly

---

## P1-T2: Configure ESLint and Prettier

**Objective:** Set up code quality tools for consistent formatting and linting

**Prerequisites:** P1-T1 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Install Prettier

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

pnpm add -D prettier eslint-config-prettier
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

### Step 2: Create Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Create `.prettierignore`:

```
# Dependencies
node_modules/
.pnp/
.pnp.js

# Testing
coverage/

# Next.js
.next/
out/
build/

# Production
dist/

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Supabase
.supabase/
```

### Step 3: Update ESLint Configuration

Update `.eslintrc.json`:

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### Step 4: Create VSCode Settings (Optional but Recommended)

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Step 5: Format Existing Code

```bash
# Format all files
pnpm format

# Check formatting (for CI)
pnpm format:check
```

### Step 6: Test Linting

```bash
# Run ESLint
pnpm lint

# Run ESLint with auto-fix
pnpm lint --fix
```

### Verification

**Run all checks:**
```bash
pnpm lint          # Should pass with 0 errors
pnpm format:check  # Should pass (all files formatted)
pnpm type-check    # Should still pass
```

**Test Auto-Formatting:**
1. Open `app/page.tsx`
2. Add inconsistent formatting (wrong quotes, spacing)
3. Save file - should auto-format
4. Run `pnpm format` - should report no changes needed

**Acceptance Criteria:**
- [x] Prettier installed and configured
- [x] ESLint extends prettier config (no conflicts)
- [x] `pnpm lint` runs without errors
- [x] `pnpm format` formats all files
- [x] VSCode auto-formats on save (if configured)
- [x] All linting rules passing on existing code

---

## P1-T3: Set Up GitHub Repository and CI/CD

**Objective:** Create GitHub repository, configure Git, and set up automated CI pipeline

**Prerequisites:** P1-T1, P1-T2 completed, GitHub account

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/`

### Step 1: Update Root .gitignore

The repository already has a `.gitignore`. Update it to include web app:

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# Append to existing .gitignore
cat >> .gitignore << 'EOF'

# Web Application (Next.js)
web/node_modules/
web/.next/
web/out/
web/build/
web/.vercel/
web/.env*.local
web/*.tsbuildinfo
web/next-env.d.ts
EOF
```

### Step 2: Create GitHub Actions Workflow for Web App

Create `.github/workflows/web-ci.yml`:

```yaml
name: Web CI

on:
  push:
    branches: [main, develop, 'feature/*']
    paths:
      - 'web/**'
      - '.github/workflows/web-ci.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'web/**'
      - '.github/workflows/web-ci.yml'

jobs:
  lint-and-build:
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: web

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
          cache-dependency-path: 'web/pnpm-lock.yaml'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Format check
        run: pnpm format:check

      - name: Build
        run: pnpm build
        env:
          SKIP_ENV_VALIDATION: true
```

### Step 3: Create Branch from Current State

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# Create and checkout new branch
git checkout -b feature/web-ui-foundation

# Stage web directory
git add web/
git add .github/workflows/web-ci.yml
git add .gitignore

# Create initial commit
git commit -m "feat: Initialize Next.js web application

- Add Next.js 14+ with TypeScript and App Router
- Configure Tailwind CSS and shadcn/ui
- Set up ESLint and Prettier
- Add CI/CD pipeline for web app
- Configure TypeScript strict mode

Implements P1-T1, P1-T2, P1-T3 from Phase 1 Foundation"
```

### Step 4: Push to GitHub

```bash
# Push to remote
git push -u origin feature/web-ui-foundation
```

### Step 5: Verify CI Pipeline

1. Go to GitHub repository
2. Navigate to "Actions" tab
3. Verify "Web CI" workflow is running
4. Wait for workflow to complete (should pass)

### Step 6: Configure Branch Protection (Optional - Recommended)

**In GitHub repository settings:**
1. Go to Settings → Branches
2. Add branch protection rule for `main`:
   - Require pull request before merging
   - Require status checks to pass before merging
     - Select: `lint-and-build`
   - Require conversation resolution before merging
   - Require linear history

### Verification

**Check Git status:**
```bash
git status  # Should be clean
git log -1  # Should show initial commit
```

**Check GitHub:**
- ✅ Repository shows new branch
- ✅ CI workflow runs automatically
- ✅ All checks pass (lint, type-check, build)

**Acceptance Criteria:**
- [x] Feature branch created and pushed
- [x] `.gitignore` updated for web app
- [x] CI workflow configured and passing
- [x] Branch protection configured (optional)
- [x] All automated checks passing

---

## P1-T4: Create Supabase Project and Database Schema

**Objective:** Set up Supabase project, create complete database schema with migrations

**Prerequisites:** Supabase account created

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Create Supabase Project (Web UI)

1. Go to https://supabase.com
2. Sign in with GitHub
3. Click "New project"
4. Fill in:
   - **Organization:** Your org or create new
   - **Name:** cycling-ai-web
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to you
   - **Plan:** Free

5. Wait 2-3 minutes for provisioning
6. Save these values from Settings → API:
   - **Project URL:** `https://xxx.supabase.co`
   - **Anon Public Key:** `eyJhbG...`
   - **Service Role Key:** `eyJhbG...` (keep secret!)

### Step 2: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### Step 3: Initialize Supabase in Project

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

# Initialize Supabase
supabase init

# This creates:
# - supabase/config.toml
# - supabase/seed.sql
# - .gitignore entries
```

### Step 4: Link to Cloud Project

```bash
# Login to Supabase
supabase login

# Link to your cloud project
supabase link --project-ref <your-project-ref>

# Get project ref from: https://supabase.com/dashboard/project/<ref>/settings/api
```

### Step 5: Create Initial Migration

```bash
# Create migration file
supabase migration new create_initial_schema

# This creates: supabase/migrations/20250101000000_create_initial_schema.sql
```

### Step 6: Write Migration SQL

Edit the migration file (`supabase/migrations/XXXXXX_create_initial_schema.sql`):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Athlete Profiles
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Profile data
  ftp INTEGER CHECK (ftp > 0 AND ftp < 600),
  max_hr INTEGER CHECK (max_hr >= 100 AND max_hr <= 220),
  weight_kg DECIMAL(5,2) CHECK (weight_kg > 0 AND weight_kg < 300),
  age INTEGER CHECK (age >= 13 AND age <= 120),
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

  -- Goals (JSON array of strings)
  goals JSONB DEFAULT '[]'::jsonb,

  -- Preferences
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'pt', 'es', 'fr')),
  timezone TEXT DEFAULT 'UTC',
  units_system TEXT DEFAULT 'metric' CHECK (units_system IN ('metric', 'imperial')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id)
);

-- Strava Connections
CREATE TABLE public.strava_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Strava OAuth data
  strava_athlete_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,

  -- Sync metadata
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id),
  UNIQUE(strava_athlete_id)
);

-- Activities (synced from Strava)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Strava reference
  strava_activity_id BIGINT NOT NULL,

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
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(strava_activity_id)
);

-- Indexes for activities (critical for query performance)
CREATE INDEX idx_activities_user_date ON public.activities(user_id, start_date DESC);
CREATE INDEX idx_activities_strava_id ON public.activities(strava_activity_id);
CREATE INDEX idx_activities_type ON public.activities(user_id, type);

-- Training Plans
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Plan details
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Generated plan data (structured JSON from AI)
  plan_data JSONB NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_plans_user ON public.training_plans(user_id, status);

-- Reports (AI-generated reports)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

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
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_user_date ON public.reports(user_id, created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_strava_connections_updated_at
  BEFORE UPDATE ON public.strava_connections
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON public.training_plans
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
```

### Step 7: Test Migration Locally

```bash
# Start local Supabase (requires Docker)
supabase start

# This will:
# - Start PostgreSQL, PostgREST, Auth, Storage, etc.
# - Apply migrations
# - Show local credentials

# Check status
supabase status

# You should see:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Anon key: eyJ...
```

### Step 8: Verify Tables Locally

```bash
# Connect to local database
psql postgresql://postgres:postgres@localhost:54322/postgres

# In psql:
\dt public.*

# Expected output:
#  Schema |       Name           | Type  |  Owner
# --------+----------------------+-------+---------
#  public | athlete_profiles     | table | postgres
#  public | strava_connections   | table | postgres
#  public | activities           | table | postgres
#  public | training_plans       | table | postgres
#  public | reports              | table | postgres

# Check a table schema:
\d public.athlete_profiles

# Exit psql:
\q
```

### Step 9: Push Migration to Cloud

```bash
# Push migration to Supabase cloud
supabase db push

# Verify in Supabase Dashboard:
# https://supabase.com/dashboard/project/<ref>/editor
```

### Step 10: Create Seed Data (Optional - for Testing)

Create `supabase/seed.sql`:

```sql
-- Seed data for testing (only for local development)

-- Note: In production, users come from auth.users via signup
-- This is just for local testing with Supabase Studio

-- Example: Insert test athlete profile (requires user from auth.users first)
-- You'll do this via the app once auth is set up
```

### Verification

**Local Supabase:**
```bash
supabase status  # All services should be running
psql postgresql://postgres:postgres@localhost:54322/postgres -c "\dt public.*"
```

**Cloud Supabase:**
1. Go to https://supabase.com/dashboard/project/<ref>/editor
2. Verify all 5 tables exist
3. Check table structures match migration
4. Verify triggers exist

**Acceptance Criteria:**
- [x] Supabase cloud project created
- [x] Local Supabase running (`supabase status`)
- [x] All 5 tables created with correct schemas
- [x] Indexes created on activities table
- [x] Triggers created for updated_at columns
- [x] Migration pushed to cloud
- [x] Tables visible in Supabase Dashboard

---

## P1-T5: Implement Row-Level Security (RLS) Policies

**Objective:** Enable RLS and create policies to ensure users can only access their own data

**Prerequisites:** P1-T4 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Create RLS Migration

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

# Create new migration
supabase migration new enable_rls_policies
```

### Step 2: Write RLS Policies

Edit the new migration file:

```sql
-- Enable Row Level Security on all tables
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Athlete Profiles Policies
-- ============================================

CREATE POLICY "Users can view own profile"
  ON public.athlete_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.athlete_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.athlete_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Strava Connections Policies
-- ============================================

CREATE POLICY "Users can view own strava connection"
  ON public.strava_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strava connection"
  ON public.strava_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strava connection"
  ON public.strava_connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strava connection"
  ON public.strava_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Activities Policies
-- ============================================

CREATE POLICY "Users can view own activities"
  ON public.activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON public.activities
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
  ON public.activities
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Training Plans Policies
-- ============================================

CREATE POLICY "Users can view own training plans"
  ON public.training_plans
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training plans"
  ON public.training_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training plans"
  ON public.training_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own training plans"
  ON public.training_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Reports Policies
-- ============================================

CREATE POLICY "Users can view own reports"
  ON public.reports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON public.reports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON public.reports
  FOR DELETE
  USING (auth.uid() = user_id);
```

### Step 3: Apply Migration Locally

```bash
# Reset local database with new migration
supabase db reset

# This will:
# 1. Drop and recreate database
# 2. Apply all migrations (schema + RLS)
# 3. Run seed.sql if exists
```

### Step 4: Test RLS Policies Locally

**Using Supabase Studio:**

1. Open http://localhost:54323 (Supabase Studio)
2. Go to Authentication → Users
3. Create a test user (or use API)
4. Go to Table Editor → athlete_profiles
5. Try to insert a row with different user_id
   - Should fail: "new row violates row-level security policy"
6. Insert row with correct user_id
   - Should succeed

**Using SQL (Advanced):**

```bash
# Connect to local DB
psql postgresql://postgres:postgres@localhost:54322/postgres

-- Test as anonymous user (should see nothing)
SET ROLE anon;
SELECT * FROM public.athlete_profiles;
-- Expected: 0 rows

-- Test with specific user JWT
-- (In production, this is done automatically by Supabase Auth)
SET request.jwt.claim.sub = '<user-uuid>';
SELECT * FROM public.athlete_profiles;
-- Expected: Only rows where user_id = <user-uuid>
```

### Step 5: Verify RLS Policies

Check that RLS is enabled:

```sql
-- In psql or Supabase Studio SQL Editor:

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Expected: rowsecurity = true for all tables

-- List all policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
```

### Step 6: Push to Cloud

```bash
# Push RLS migration to cloud
supabase db push
```

### Step 7: Test RLS in Cloud (After Auth Setup)

*Note: Full RLS testing requires authentication setup (P1-T6, P1-T7). For now, verify policies exist.*

1. Go to https://supabase.com/dashboard/project/<ref>/editor
2. Click on each table
3. Go to "Policies" tab
4. Verify 4 policies exist for each table

### Verification

**Check RLS Enabled:**
```sql
-- All tables should have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

**Count Policies:**
```sql
-- Should have 20 policies total (4 per table × 5 tables)
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename;
```

**Expected Output:**
```
    tablename       | policy_count
--------------------+--------------
 athlete_profiles   |            4
 strava_connections |            4
 activities         |            4
 training_plans     |            4
 reports            |            4
```

**Acceptance Criteria:**
- [x] RLS enabled on all 5 tables
- [x] 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
- [x] Policies use `auth.uid()` to check user ownership
- [x] Migration applied locally and to cloud
- [x] Policies visible in Supabase Dashboard

---

## P1-T6: Install and Configure Supabase Client

**Objective:** Set up Supabase client libraries for Next.js with SSR support

**Prerequisites:** P1-T4, P1-T5 completed, Supabase project created

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Install Supabase Packages

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

pnpm add @supabase/supabase-js @supabase/ssr
```

### Step 2: Create Environment Variables

Create `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Get these from: https://supabase.com/dashboard/project/<ref>/settings/api
```

Create `.env.example` (for documentation):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Update `.gitignore` to ensure `.env.local` is not committed:

```bash
# Already in Next.js default .gitignore:
.env*.local
```

### Step 3: Generate TypeScript Types from Database

```bash
# Generate types from your Supabase project
pnpm supabase gen types typescript --project-id <your-project-ref> > lib/types/database.ts

# OR using local Supabase:
supabase gen types typescript --local > lib/types/database.ts
```

This creates `lib/types/database.ts` with complete type definitions for your database schema.

### Step 4: Create Supabase Client Utilities

Create directory structure:

```bash
mkdir -p lib/supabase
mkdir -p lib/types
```

**Client-side Supabase Client** (`lib/supabase/client.ts`):

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server-side Supabase Client** (`lib/supabase/server.ts`):

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

### Step 5: Create Middleware for Auth Token Refresh

Create `middleware.ts` in root:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Step 6: Test Supabase Connection

Create test page `app/test-db/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = await createClient()

  // Try to fetch from athlete_profiles (will be empty, but tests connection)
  const { data, error } = await supabase
    .from('athlete_profiles')
    .select('*')
    .limit(1)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>

      <div className="mb-4">
        <h2 className="font-semibold">Status:</h2>
        <p>{error ? '❌ Error' : '✅ Connected'}</p>
      </div>

      {error && (
        <div className="mb-4">
          <h2 className="font-semibold">Error:</h2>
          <pre className="bg-red-50 p-4 rounded">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      {data && (
        <div className="mb-4">
          <h2 className="font-semibold">Data:</h2>
          <pre className="bg-green-50 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
```

Visit http://localhost:3000/test-db

**Expected:**
- ✅ Connected (no error)
- Data: [] (empty array, which is correct - no profiles yet)

### Verification

**Check environment variables:**
```bash
# In web/.env.local
cat .env.local

# Should show:
# NEXT_PUBLIC_SUPABASE_URL=https://...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Test Supabase client:**
```bash
pnpm dev

# Visit http://localhost:3000/test-db
# Should see: ✅ Connected
```

**Check TypeScript types:**
```bash
pnpm type-check

# Should pass with no errors
```

**Test in Server Component:**
- Create test page that uses `createClient` from `@/lib/supabase/server`
- Should successfully connect to Supabase
- Should respect RLS (no data if not authenticated)

**Test in Client Component:**
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function TestClient() {
  const [status, setStatus] = useState('connecting...')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('athlete_profiles').select('count').then(({ data, error }) => {
      setStatus(error ? 'error' : 'connected')
    })
  }, [])

  return <div>Client Status: {status}</div>
}
```

**Acceptance Criteria:**
- [x] Supabase packages installed
- [x] Environment variables configured
- [x] Database types generated
- [x] Client-side Supabase client working
- [x] Server-side Supabase client working
- [x] Middleware refreshing auth tokens
- [x] Test page connects successfully
- [x] TypeScript types available and working

---

## P1-T7: Implement Signup Page

**Objective:** Create user signup page with email/password authentication and email verification

**Prerequisites:** P1-T6 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Install shadcn/ui Components

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

# Install required UI components
pnpx shadcn-ui@latest add button
pnpx shadcn-ui@latest add input
pnpx shadcn-ui@latest add label
pnpx shadcn-ui@latest add card
pnpx shadcn-ui@latest add alert
```

### Step 2: Create Validation Schemas

Create `lib/validations/auth.ts`:

```typescript
import { z } from 'zod'

export const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type SignupFormValues = z.infer<typeof signupSchema>
```

### Step 3: Create Signup Form Component

Create `components/forms/signup-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signupSchema, type SignupFormValues } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signupError) {
        setError(signupError.message)
        setIsLoading(false)
        return
      }

      // Redirect to email verification page
      router.push('/auth/verify-email')
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          {...register('confirmPassword')}
          disabled={isLoading}
        )}
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Sign up'}
      </Button>
    </form>
  )
}
```

### Step 4: Create Signup Page

Create auth route group: `app/(auth)/signup/page.tsx`:

```typescript
import Link from 'next/link'
import { SignupForm } from '@/components/forms/signup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Start analyzing your cycling performance with AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 5: Create Email Verification Page

Create `app/(auth)/auth/verify-email/page.tsx`:

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We've sent you a verification link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click the link in the email we sent you to verify your account.
            </p>

            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The link expires in 24 hours. If you don't see the email,
                check your spam folder.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 6: Create Auth Callback Route

Create `app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to dashboard after successful verification
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

### Step 7: Configure Supabase Auth Settings

1. Go to https://supabase.com/dashboard/project/<ref>/auth/url-configuration
2. Add Site URL: `http://localhost:3000`
3. Add Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback` (for production later)

### Step 8: Test Signup Flow

```bash
# Start development server
pnpm dev

# Test steps:
# 1. Visit http://localhost:3000/signup
# 2. Enter email and password
# 3. Submit form
# 4. Check email for verification link
# 5. Click verification link
# 6. Should redirect to /dashboard
```

### Verification

**Manual Testing:**

1. **Invalid Email:**
   - Enter: `test@invalid`
   - Expected: "Invalid email address" error

2. **Weak Password:**
   - Enter: `password`
   - Expected: "Password must contain at least one uppercase letter" error

3. **Password Mismatch:**
   - Password: `Test1234`
   - Confirm: `Test5678`
   - Expected: "Passwords don't match" error

4. **Valid Signup:**
   - Email: `your-real-email@example.com`
   - Password: `Test1234`
   - Confirm: `Test1234`
   - Expected: Redirect to `/auth/verify-email`

5. **Email Verification:**
   - Check email inbox
   - Click verification link
   - Expected: Redirect to `/dashboard`

6. **Check Supabase Dashboard:**
   - Go to Authentication → Users
   - Should see new user with `email_confirmed_at` timestamp

**Acceptance Criteria:**
- [x] Signup page accessible at `/signup`
- [x] Form validates email format
- [x] Form validates password strength (8+ chars, uppercase, lowercase, number)
- [x] Form validates password confirmation match
- [x] User created in Supabase Auth on valid submission
- [x] Verification email sent to user
- [x] Email verification link works
- [x] Redirect to `/dashboard` after verification
- [x] Error messages shown for validation failures
- [x] Loading state shown during submission
- [x] Link to login page visible

---

## P1-T8: Implement Login Page

**Objective:** Create user login page with email/password authentication

**Prerequisites:** P1-T7 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Create Login Form Component

Create `components/forms/login-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (loginError) {
        setError(loginError.message)
        setIsLoading(false)
        return
      }

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a
            href="/forgot-password"
            className="text-sm text-blue-600 hover:underline"
          >
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
```

### Step 2: Create Login Page

Create `app/(auth)/login/page.tsx`:

```typescript
import Link from 'next/link'
import { LoginForm } from '@/components/forms/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your Cycling AI account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />

          <p className="mt-4 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 3: Test Login Flow

```bash
pnpm dev

# Test steps:
# 1. Visit http://localhost:3000/login
# 2. Enter credentials from P1-T7 signup
# 3. Click "Sign in"
# 4. Should redirect to /dashboard
```

### Verification

**Manual Testing:**

1. **Invalid Email Format:**
   - Enter: `notanemail`
   - Expected: "Invalid email address" error

2. **Empty Password:**
   - Email: `test@example.com`
   - Password: (empty)
   - Expected: "Password is required" error

3. **Wrong Credentials:**
   - Email: `test@example.com`
   - Password: `WrongPassword123`
   - Expected: "Invalid login credentials" error

4. **Successful Login:**
   - Email: (from signup in P1-T7)
   - Password: (from signup in P1-T7)
   - Expected: Redirect to `/dashboard`

5. **Session Persistence:**
   - After login, refresh page
   - Expected: Still logged in (no redirect to login)

**Acceptance Criteria:**
- [x] Login page accessible at `/login`
- [x] Form validates email format
- [x] Form validates password is not empty
- [x] User authenticated on valid credentials
- [x] Redirect to `/dashboard` after successful login
- [x] Error message shown for invalid credentials
- [x] Loading state during authentication
- [x] "Forgot password" link visible
- [x] Link to signup page visible

---

## P1-T9: Implement Password Recovery Flow

**Objective:** Create forgot password and reset password pages

**Prerequisites:** P1-T8 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Create Forgot Password Form

Create `components/forms/forgot-password-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        data.email,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      )

      if (resetError) {
        setError(resetError.message)
        setIsLoading(false)
        return
      }

      setIsSubmitted(true)
      setIsLoading(false)
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            Check your email for a password reset link. The link expires in 1 hour.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send reset link'}
      </Button>
    </form>
  )
}
```

### Step 2: Create Forgot Password Page

Create `app/(auth)/forgot-password/page.tsx`:

```typescript
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/forms/forgot-password-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />

          <p className="mt-4 text-center text-sm text-gray-600">
            Remember your password?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 3: Create Reset Password Form

Create `components/forms/reset-password-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (updateError) {
        setError(updateError.message)
        setIsLoading(false)
        return
      }

      // Redirect to login with success message
      router.push('/login?message=password-updated')
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          {...register('confirmPassword')}
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Updating password...' : 'Update password'}
      </Button>
    </form>
  )
}
```

### Step 4: Create Reset Password Page

Create `app/(auth)/auth/reset-password/page.tsx`:

```typescript
import { ResetPasswordForm } from '@/components/forms/reset-password-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
```

### Verification

**Manual Testing:**

1. **Request Password Reset:**
   - Visit `/forgot-password`
   - Enter email address
   - Click "Send reset link"
   - Expected: Success message shown

2. **Check Email:**
   - Check inbox for password reset email
   - Expected: Email received with reset link

3. **Reset Password:**
   - Click reset link in email
   - Should redirect to `/auth/reset-password`
   - Enter new password (meeting requirements)
   - Confirm new password
   - Click "Update password"
   - Expected: Redirect to `/login` with success message

4. **Test New Password:**
   - Login with new password
   - Expected: Successfully logged in

**Acceptance Criteria:**
- [x] Forgot password page accessible at `/forgot-password`
- [x] Email validation working
- [x] Reset email sent successfully
- [x] Reset link in email works
- [x] Reset password page accessible via magic link
- [x] Password validation enforced (8+ chars, uppercase, lowercase, number)
- [x] Password update succeeds
- [x] User redirected to login after reset
- [x] Can login with new password

---

## P1-T10: Create Protected Route Middleware

**Objective:** Implement middleware to protect dashboard routes from unauthenticated users

**Prerequisites:** P1-T8 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Update Middleware with Auth Protection

Update `middleware.ts`:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - require authentication
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      // Redirect to login with return URL
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Auth routes - redirect if already authenticated
  const authRoutes = ['/login', '/signup']
  if (authRoutes.includes(request.nextUrl.pathname) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (.png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Step 2: Create Helper to Get User in Server Components

Create `lib/auth/get-user.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}
```

### Step 3: Test Protected Routes

**Create test dashboard page** (if not exists) `app/(dashboard)/dashboard/page.tsx`:

```typescript
import { getUser } from '@/lib/auth/get-user'

export default async function DashboardPage() {
  const user = await getUser()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Welcome to your Dashboard</h1>
      <p className="mt-4 text-gray-600">Logged in as: {user.email}</p>
    </div>
  )
}
```

### Verification

**Test Protected Route Access:**

1. **Logged Out:**
   - Visit http://localhost:3000/dashboard
   - Expected: Redirect to `/login?redirect=/dashboard`

2. **Logged In:**
   - Login first
   - Visit http://localhost:3000/dashboard
   - Expected: See dashboard content

3. **Auth Route Redirect:**
   - While logged in, visit http://localhost:3000/login
   - Expected: Redirect to `/dashboard`

4. **Return URL After Login:**
   - Logout
   - Visit `/dashboard` (redirects to `/login?redirect=/dashboard`)
   - Login
   - Expected: Redirect back to `/dashboard`

**Test Token Refresh:**
- Login and wait 60 minutes (token refresh interval)
- Navigate to different pages
- Expected: No logout, seamless experience

**Acceptance Criteria:**
- [x] Unauthenticated users redirected from `/dashboard` to `/login`
- [x] Authenticated users can access `/dashboard`
- [x] Authenticated users redirected from `/login` to `/dashboard`
- [x] Return URL preserved during login flow
- [x] Auth tokens refreshed automatically
- [x] No manual refresh needed for session persistence

---

## P1-T11: Create Basic App Layout with Navigation

**Objective:** Build main application shell with navigation bar, dark mode toggle, user menu

**Prerequisites:** P1-T10 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Install Additional UI Components

```bash
pnpx shadcn-ui@latest add dropdown-menu
pnpx shadcn-ui@latest add avatar
pnpx shadcn-ui@latest add separator
```

### Step 2: Install Dark Mode Support

```bash
pnpm add next-themes
```

### Step 3: Create Theme Provider

Create `components/providers/theme-provider.tsx`:

```typescript
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### Step 4: Update Root Layout with Theme Provider

Update `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cycling AI',
  description: 'AI-powered cycling performance analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Step 5: Create User Menu Component

Create `components/layout/user-menu.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User } from '@supabase/supabase-js'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.email
    ?.split('@')[0]
    .split('.')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/profile')}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Step 6: Create Theme Toggle Component

Create `components/layout/theme-toggle.tsx`:

```typescript
'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

### Step 7: Install Icons

```bash
pnpm add lucide-react
```

### Step 8: Create Navigation Component

Create `components/layout/navbar.tsx`:

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserMenu } from './user-menu'
import { ThemeToggle } from './theme-toggle'

export async function Navbar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex md:mr-6">
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">Cycling AI</span>
          </Link>
        </div>

        <nav className="flex items-center space-x-6 text-sm font-medium flex-1">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/performance"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Performance
          </Link>
          <Link
            href="/dashboard/training"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Training
          </Link>
          <Link
            href="/dashboard/reports"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Reports
          </Link>
        </nav>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          {user && <UserMenu user={user} />}
        </div>
      </div>
    </header>
  )
}
```

### Step 9: Create Dashboard Layout

Create `app/(dashboard)/layout.tsx`:

```typescript
import { Navbar } from '@/components/layout/navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### Verification

**Test Navigation:**
1. Login and visit `/dashboard`
2. Click navigation links (Dashboard, Performance, Training, Reports)
3. Expected: URLs update (404 ok for now - pages not created yet)

**Test Dark Mode:**
1. Click sun/moon icon in navbar
2. Expected: Theme toggles between light and dark
3. Refresh page - theme persists

**Test User Menu:**
1. Click avatar in top-right
2. Expected: Dropdown shows email, Settings, Profile, Log out
3. Click "Log out"
4. Expected: Logged out, redirected to `/login`

**Test Responsive:**
1. Resize browser to mobile width
2. Expected: Navbar still visible and functional

**Acceptance Criteria:**
- [x] Navigation bar visible on all dashboard pages
- [x] Brand name/logo clickable (links to dashboard)
- [x] Navigation links visible and functional
- [x] Dark mode toggle working
- [x] Theme preference persists across sessions
- [x] User menu shows user email
- [x] Logout functionality works
- [x] Layout responsive on mobile
- [x] Active route highlighted (optional enhancement)

---

## P1-T12: Create Dashboard Home Page

**Objective:** Build basic dashboard home page with welcome message and placeholder widgets

**Prerequisites:** P1-T11 completed

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/web/`

### Step 1: Create Dashboard Page

Update `app/(dashboard)/dashboard/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Try to get athlete profile
  const { data: profile } = await supabase
    .from('athlete_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Welcome back, {user.email?.split('@')[0] || 'Cyclist'}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Here's your cycling performance overview
        </p>
      </div>

      {!profile && (
        <Card className="mb-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>Complete your profile</strong> to get personalized insights.{' '}
              <a href="/onboarding" className="font-medium underline text-blue-600">
                Set up profile
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No activities yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Connect Strava to sync your rides automatically
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete profile to see stats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generate your first report to see AI-powered insights
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### Step 2: Add Metadata

Update page metadata:

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard | Cycling AI',
  description: 'Your cycling performance dashboard',
}
```

### Verification

**Test Dashboard:**
1. Login and visit `/dashboard`
2. Expected:
   - Welcome message with username from email
   - Yellow banner prompting profile setup (if no profile)
   - 3 placeholder cards:
     - Recent Activities
     - Quick Stats
     - AI Insights

**Test Responsiveness:**
1. Resize browser
2. Expected:
   - Mobile: Cards stack vertically
   - Tablet: 2 columns
   - Desktop: 3 columns

**Test Profile Check:**
1. Create athlete profile in Supabase Studio:
   ```sql
   INSERT INTO public.athlete_profiles (user_id, ftp, max_hr, weight_kg, age)
   VALUES ('<your-user-id>', 265, 186, 70, 35);
   ```
2. Refresh dashboard
3. Expected: Yellow banner disappears

**Acceptance Criteria:**
- [x] Dashboard accessible at `/dashboard`
- [x] Welcome message shows user's name (from email)
- [x] Placeholder widgets visible
- [x] Profile setup prompt shown if no profile exists
- [x] Profile setup prompt hidden if profile exists
- [x] Responsive layout (mobile, tablet, desktop)
- [x] Dark mode supported

---

## Final Phase 1 Checklist

### Infrastructure
- [x] P1-T1: Next.js 14+ project initialized with TypeScript
- [x] P1-T2: ESLint and Prettier configured
- [x] P1-T3: GitHub repository with CI/CD pipeline
- [x] P1-T4: Supabase project and database schema created
- [x] P1-T5: Row-Level Security policies implemented

### Authentication
- [x] P1-T6: Supabase client configured with SSR support
- [x] P1-T7: Signup page with email verification
- [x] P1-T8: Login page
- [x] P1-T9: Password recovery flow
- [x] P1-T10: Protected route middleware

### UI
- [x] P1-T11: App layout with navigation, dark mode, user menu
- [x] P1-T12: Dashboard home page

### Testing
- [x] All TypeScript strict mode checks passing
- [x] CI pipeline passing (lint, type-check, build)
- [x] Manual testing of all auth flows completed
- [x] RLS policies tested

---

## Success Criteria

**Phase 1 is complete when:**

1. ✅ User can sign up with email/password
2. ✅ User receives and can verify email
3. ✅ User can log in after verification
4. ✅ User can reset forgotten password
5. ✅ Authenticated user sees dashboard
6. ✅ Unauthenticated user redirected to login
7. ✅ All TypeScript strict mode errors resolved
8. ✅ CI/CD pipeline passing on GitHub
9. ✅ RLS policies preventing unauthorized access
10. ✅ Mobile responsive design working

**Performance Benchmarks:**
- Page load time < 2 seconds
- No console errors or warnings
- TypeScript compilation successful

**Handoff to Phase 2:**
- Authentication system fully functional
- Database schema ready for profile data
- Basic UI shell ready for profile wizard
- All P1 tasks tested and working

---

## Rollback Strategy

If critical issues discovered during implementation:

1. **Database Issues:**
   ```bash
   # Rollback migrations
   supabase db reset

   # Or restore from backup (Supabase Dashboard → Database → Backups)
   ```

2. **Code Issues:**
   ```bash
   # Revert to last working commit
   git log  # Find last good commit
   git revert <commit-hash>
   ```

3. **Deployment Issues:**
   - Vercel automatically keeps previous deployments
   - Revert via Vercel Dashboard → Deployments → Promote to Production

---

## Post-Phase 1 Actions

After completing all tasks:

1. **Create Pull Request:**
   ```bash
   git push origin feature/web-ui-foundation

   # Create PR on GitHub
   # Title: "Phase 1: Web UI Foundation"
   # Description: Summary of 12 tasks completed
   ```

2. **Review Checklist:**
   - All acceptance criteria met
   - CI pipeline green
   - Manual testing completed
   - Documentation updated

3. **Merge to Main:**
   - Get approval (if team)
   - Merge PR
   - Deploy to production (Vercel)

4. **Document Learnings:**
   - What went well?
   - What took longer than expected?
   - Any technical debt to address?

5. **Prepare for Phase 2:**
   - Review Phase 2 task document
   - Estimate effort
   - Plan sprint

---

**Plan Version:** 1.0
**Last Updated:** 2025-12-03
**Status:** ✅ Ready for Execution
**Estimated Duration:** 2 weeks (29 hours)

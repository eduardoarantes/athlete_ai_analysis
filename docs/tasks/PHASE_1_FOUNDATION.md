# Phase 1: Foundation - Task Breakdown

**Duration:** Weeks 1-2
**Goal:** Set up infrastructure and core authentication
**Status:** Ready to Start

---

## Overview

Phase 1 establishes the foundation for the Cycling AI Web Application. By the end of this phase, we'll have a working authentication system, deployed database schema with Row-Level Security, and a basic application shell.

### Key Deliverables

- ✅ Next.js 14+ project with TypeScript and Tailwind CSS
- ✅ Supabase database with complete schema and RLS policies
- ✅ Authentication flow (signup, login, email verification, password recovery)
- ✅ Basic app layout with navigation and dark mode
- ✅ CI/CD pipeline with GitHub Actions

### Prerequisites

- Node.js 20+ installed
- pnpm package manager installed
- Git installed
- Supabase account created
- GitHub repository access

---

## Task Breakdown

### Week 1: Project Setup & Infrastructure

#### P1-T1: Initialize Next.js Project

**Description:** Create new Next.js 14+ project with TypeScript, App Router, and Tailwind CSS

**Estimated Effort:** 2 hours

**Steps:**
1. Create new Next.js project with TypeScript
2. Configure App Router (delete pages/ directory if exists)
3. Set up Tailwind CSS with custom configuration
4. Install and configure shadcn/ui
5. Set up absolute imports with path aliases
6. Configure TypeScript strict mode

**Commands:**
```bash
# Create Next.js project
pnpx create-next-app@latest cycling-ai-web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd cycling-ai-web

# Install shadcn/ui
pnpx shadcn-ui@latest init

# Install additional dependencies
pnpm add zod react-hook-form @hookform/resolvers
pnpm add -D @types/node
```

**Files to Create:**
- `app/layout.tsx` - Root layout
- `app/page.tsx` - Landing page
- `tailwind.config.ts` - Tailwind configuration
- `tsconfig.json` - TypeScript configuration
- `components.json` - shadcn/ui configuration

**Acceptance Criteria:**
- [ ] `pnpm dev` starts development server on localhost:3000
- [ ] TypeScript strict mode enabled (`tsconfig.json`)
- [ ] Tailwind CSS working (test with utility classes)
- [ ] shadcn/ui initialized (components.json exists)
- [ ] No TypeScript errors on build (`pnpm build`)

**Testing:**
```bash
pnpm build
pnpm type-check
```

---

#### P1-T2: Configure ESLint and Prettier

**Description:** Set up code quality tools for consistent formatting and linting

**Estimated Effort:** 1 hour

**Dependencies:** P1-T1

**Steps:**
1. Install ESLint and Prettier dependencies
2. Create ESLint configuration with Next.js rules
3. Create Prettier configuration
4. Add lint scripts to package.json
5. Set up VSCode settings for auto-format on save

**Commands:**
```bash
pnpm add -D eslint-config-prettier prettier
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Files to Create:**
- `.eslintrc.json` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `.prettierignore` - Files to ignore
- `.vscode/settings.json` - VSCode settings (optional)

**ESLint Configuration (`.eslintrc.json`):**
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
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

**Prettier Configuration (`.prettierrc`):**
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Package.json scripts:**
```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit"
  }
}
```

**Acceptance Criteria:**
- [ ] `pnpm lint` runs without errors
- [ ] `pnpm format` formats all files
- [ ] VSCode auto-formats on save (if configured)
- [ ] No linting errors in app/ and components/

---

#### P1-T3: Set Up GitHub Repository and CI/CD

**Description:** Create GitHub repository and set up automated testing with GitHub Actions

**Estimated Effort:** 2 hours

**Dependencies:** P1-T1, P1-T2

**Steps:**
1. Initialize Git repository
2. Create `.gitignore` file
3. Create GitHub repository
4. Set up GitHub Actions workflow for CI
5. Add branch protection rules

**Files to Create:**
- `.gitignore` - Files to exclude from Git
- `.github/workflows/ci.yml` - CI pipeline
- `.github/workflows/preview.yml` - Preview deployments

**`.gitignore`:**
```
# dependencies
node_modules/
.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

**CI Workflow (`.github/workflows/ci.yml`):**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Build
        run: pnpm build
```

**Acceptance Criteria:**
- [ ] Repository created on GitHub
- [ ] Initial commit pushed to main branch
- [ ] CI workflow runs successfully on push
- [ ] Branch protection enabled on main (require CI to pass)

---

#### P1-T4: Create Supabase Project and Database Schema

**Description:** Set up Supabase project and implement complete database schema with migrations

**Estimated Effort:** 4 hours

**Dependencies:** None (can run in parallel with P1-T1)

**Steps:**
1. Create Supabase project at supabase.com
2. Install Supabase CLI
3. Initialize Supabase locally
4. Create migration for athlete_profiles table
5. Create migration for strava_connections table
6. Create migration for activities table
7. Create migration for training_plans table
8. Create migration for reports table
9. Test migrations locally
10. Push migrations to Supabase cloud

**Commands:**
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize Supabase
supabase init

# Start local Supabase
supabase start

# Create migration
supabase migration new create_schema

# Apply migrations
supabase db reset

# Push to cloud
supabase db push
```

**Files to Create:**
- `supabase/config.toml` - Supabase configuration
- `supabase/migrations/20250101000000_create_schema.sql` - Initial schema

**Migration SQL (`supabase/migrations/20250101000000_create_schema.sql`):**
```sql
-- Athlete Profiles
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Profile data
  ftp INTEGER CHECK (ftp > 0),
  max_hr INTEGER CHECK (max_hr >= 100 AND max_hr <= 220),
  weight_kg DECIMAL(5,2) CHECK (weight_kg > 0),
  age INTEGER CHECK (age >= 13 AND age <= 120),
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

  -- Goals
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes for activities (optimized for queries)
CREATE INDEX idx_activities_user_date ON public.activities(user_id, start_date DESC);
CREATE INDEX idx_activities_strava_id ON public.activities(strava_activity_id);

-- Training Plans
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Plan details
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Generated plan data
  plan_data JSONB NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_plans_user ON public.training_plans(user_id, status);

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_athlete_profiles_updated_at BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_strava_connections_updated_at BEFORE UPDATE ON public.strava_connections
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

**Acceptance Criteria:**
- [ ] Supabase project created and accessible
- [ ] Local Supabase running (`supabase status` shows all services)
- [ ] All tables created with correct schema
- [ ] Indexes created on activities table
- [ ] Triggers working (updated_at automatically updated)
- [ ] Migrations applied to cloud Supabase

**Testing:**
```bash
# Check local database
supabase db reset
psql postgresql://postgres:postgres@localhost:54322/postgres

# In psql:
\dt public.*
\d public.athlete_profiles
```

---

#### P1-T5: Implement Row-Level Security (RLS) Policies

**Description:** Set up RLS policies to ensure users can only access their own data

**Estimated Effort:** 3 hours

**Dependencies:** P1-T4

**Steps:**
1. Enable RLS on all tables
2. Create policies for athlete_profiles
3. Create policies for strava_connections
4. Create policies for activities
5. Create policies for training_plans
6. Create policies for reports
7. Test policies with different users

**Migration File:** `supabase/migrations/20250101000001_create_rls_policies.sql`

```sql
-- Enable RLS on all tables
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Athlete Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.athlete_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.athlete_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.athlete_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.athlete_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Strava Connections Policies
CREATE POLICY "Users can view own strava connection"
  ON public.strava_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strava connection"
  ON public.strava_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strava connection"
  ON public.strava_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strava connection"
  ON public.strava_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Activities Policies
CREATE POLICY "Users can view own activities"
  ON public.activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities"
  ON public.activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON public.activities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
  ON public.activities FOR DELETE
  USING (auth.uid() = user_id);

-- Training Plans Policies
CREATE POLICY "Users can view own training plans"
  ON public.training_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training plans"
  ON public.training_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training plans"
  ON public.training_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own training plans"
  ON public.training_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Reports Policies
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON public.reports FOR DELETE
  USING (auth.uid() = user_id);
```

**Acceptance Criteria:**
- [ ] RLS enabled on all 5 tables
- [ ] Policies created for all CRUD operations
- [ ] Test user A cannot read user B's data
- [ ] Test user can read/write their own data
- [ ] All policies working in Supabase dashboard

**Testing:**
```sql
-- Test RLS (run in Supabase SQL Editor)
-- 1. Create test user
-- 2. Insert test data with user_id
-- 3. Query as different user - should return 0 rows
-- 4. Query as same user - should return data
```

---

### Week 2: Authentication & Basic UI

#### P1-T6: Install and Configure Supabase Client

**Description:** Set up Supabase client for Next.js with SSR support

**Estimated Effort:** 2 hours

**Dependencies:** P1-T4, P1-T5

**Steps:**
1. Install Supabase packages
2. Create environment variables
3. Create Supabase client utilities (client, server, route handler)
4. Create type definitions from database schema
5. Test connection to Supabase

**Commands:**
```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D supabase
```

**Files to Create:**
- `.env.local` - Environment variables (gitignored)
- `.env.example` - Example environment variables
- `lib/supabase/client.ts` - Client-side Supabase client
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/supabase/middleware.ts` - Middleware for auth refresh
- `lib/types/database.ts` - Generated types from schema

**Environment Variables (`.env.local`):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Client-side Client (`lib/supabase/client.ts`):**
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

**Server-side Client (`lib/supabase/server.ts`):**
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export function createClient() {
  const cookieStore = cookies()

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
            // Handle middleware/server component cookie setting
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle middleware/server component cookie removal
          }
        },
      },
    }
  )
}
```

**Middleware (`middleware.ts`):**
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

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Generate Types:**
```bash
pnpm supabase gen types typescript --project-id <project-id> > lib/types/database.ts
```

**Acceptance Criteria:**
- [ ] Environment variables set correctly
- [ ] Supabase client works in client components
- [ ] Supabase client works in server components
- [ ] Middleware refreshes auth tokens automatically
- [ ] Type definitions generated from schema
- [ ] No TypeScript errors

**Testing:**
```typescript
// Test in a server component
import { createClient } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = createClient()
  const { data, error } = await supabase.from('athlete_profiles').select('*').limit(1)

  return <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
}
```

---

#### P1-T7: Implement Signup Page

**Description:** Create user signup page with email/password authentication

**Estimated Effort:** 3 hours

**Dependencies:** P1-T6

**Steps:**
1. Create signup page UI
2. Create signup form with validation (Zod)
3. Implement signup API route
4. Add email verification flow
5. Add error handling and loading states
6. Add link to login page

**Files to Create:**
- `app/(auth)/signup/page.tsx` - Signup page
- `components/forms/signup-form.tsx` - Signup form component
- `lib/validations/auth.ts` - Zod schemas for auth
- `app/api/auth/signup/route.ts` - Signup API route (optional)

**Validation Schema (`lib/validations/auth.ts`):**
```typescript
import { z } from 'zod'

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export type SignupFormValues = z.infer<typeof signupSchema>
```

**Signup Form (`components/forms/signup-form.tsx`):**
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

    const { error: signupError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsLoading(false)

    if (signupError) {
      setError(signupError.message)
      return
    }

    // Show success message
    router.push('/auth/verify-email')
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
        />
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

**Signup Page (`app/(auth)/signup/page.tsx`):**
```typescript
import Link from 'next/link'
import { SignupForm } from '@/components/forms/signup-form'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Create an account</h1>
          <p className="mt-2 text-gray-600">
            Start analyzing your cycling performance
          </p>
        </div>

        <SignupForm />

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Signup page accessible at `/signup`
- [ ] Form validates email format
- [ ] Form validates password strength
- [ ] Form validates password confirmation
- [ ] User created in Supabase Auth on submit
- [ ] Verification email sent to user
- [ ] Redirect to verify-email page after signup
- [ ] Error messages shown for validation failures
- [ ] Loading state shown during submission

**Testing:**
```bash
# Manual testing:
1. Navigate to /signup
2. Try invalid email - should show error
3. Try weak password - should show error
4. Try mismatched passwords - should show error
5. Try valid signup - should create user and send email
6. Check Supabase dashboard - user should exist
```

---

#### P1-T8: Implement Login Page

**Description:** Create user login page with email/password authentication

**Estimated Effort:** 2 hours

**Dependencies:** P1-T7

**Steps:**
1. Create login page UI
2. Create login form with validation
3. Implement login logic
4. Add "forgot password" link
5. Add error handling and loading states
6. Redirect to dashboard after login

**Files to Create:**
- `app/(auth)/login/page.tsx` - Login page
- `components/forms/login-form.tsx` - Login form component

**Login Form (`components/forms/login-form.tsx`):**
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

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    setIsLoading(false)

    if (loginError) {
      setError(loginError.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
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

**Acceptance Criteria:**
- [ ] Login page accessible at `/login`
- [ ] Form validates email and password
- [ ] User authenticated on valid credentials
- [ ] Redirect to dashboard after successful login
- [ ] Error shown for invalid credentials
- [ ] Loading state during authentication
- [ ] Link to forgot password page

---

#### P1-T9: Implement Password Recovery Flow

**Description:** Create forgot password and reset password pages

**Estimated Effort:** 2 hours

**Dependencies:** P1-T8

**Steps:**
1. Create forgot password page
2. Implement password reset request
3. Create reset password page
4. Implement password update logic
5. Test full recovery flow

**Files to Create:**
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `components/forms/forgot-password-form.tsx`
- `components/forms/reset-password-form.tsx`

**Acceptance Criteria:**
- [ ] User can request password reset
- [ ] Reset email sent with magic link
- [ ] User can set new password via magic link
- [ ] Password validated before reset
- [ ] User redirected to login after reset

---

#### P1-T10: Create Protected Route Middleware

**Description:** Implement middleware to protect dashboard routes from unauthenticated users

**Estimated Effort:** 2 hours

**Dependencies:** P1-T8

**Steps:**
1. Create auth helper functions
2. Update middleware to check authentication
3. Redirect unauthenticated users to login
4. Allow access to dashboard for authenticated users

**Update Middleware (`middleware.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Auth routes (redirect if already logged in)
  if (
    ['/login', '/signup'].includes(request.nextUrl.pathname) &&
    user
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Acceptance Criteria:**
- [ ] Unauthenticated users redirected from /dashboard to /login
- [ ] Authenticated users can access /dashboard
- [ ] Authenticated users redirected from /login to /dashboard
- [ ] Auth token refreshed automatically

---

#### P1-T11: Create Basic App Layout with Navigation

**Description:** Build main application shell with navigation bar, dark mode, and responsive design

**Estimated Effort:** 4 hours

**Dependencies:** P1-T10

**Steps:**
1. Install shadcn/ui components (Button, DropdownMenu)
2. Create navigation component
3. Create user menu dropdown
4. Add dark mode toggle
5. Create responsive mobile navigation
6. Add logout functionality

**Files to Create:**
- `components/layout/navbar.tsx` - Main navigation
- `components/layout/user-menu.tsx` - User dropdown menu
- `components/layout/mobile-nav.tsx` - Mobile navigation
- `app/(dashboard)/layout.tsx` - Dashboard layout

**Navbar (`components/layout/navbar.tsx`):**
```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserMenu } from './user-menu'
import { MobileNav } from './mobile-nav'

export async function Navbar() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              Cycling AI
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/performance">Performance</Link>
            <Link href="/dashboard/training">Training</Link>
            <Link href="/dashboard/reports">Reports</Link>
          </nav>
        </div>

        <MobileNav />

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none" />
          <nav className="flex items-center">
            <UserMenu user={user} />
          </nav>
        </div>
      </div>
    </header>
  )
}
```

**Dashboard Layout (`app/(dashboard)/layout.tsx`):**
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

**Acceptance Criteria:**
- [ ] Navigation bar visible on all dashboard pages
- [ ] User menu shows user email
- [ ] Logout functionality works
- [ ] Dark mode toggle works
- [ ] Mobile navigation works on small screens
- [ ] Active route highlighted in nav

---

#### P1-T12: Create Dashboard Home Page

**Description:** Build basic dashboard home page with placeholder content

**Estimated Effort:** 2 hours

**Dependencies:** P1-T11

**Steps:**
1. Create dashboard page
2. Add welcome message with user name
3. Add placeholder widgets
4. Style with Tailwind

**Files to Create:**
- `app/(dashboard)/dashboard/page.tsx`

**Dashboard Page:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Try to get profile
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
        <p className="text-gray-600">
          Here's your cycling performance overview
        </p>
      </div>

      {!profile && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            Complete your profile to get personalized insights.{' '}
            <a href="/onboarding" className="font-medium underline">
              Set up profile
            </a>
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Recent Activities</h3>
          <p className="text-gray-600">No activities yet</p>
        </div>

        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Quick Stats</h3>
          <p className="text-gray-600">Complete profile to see stats</p>
        </div>

        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">AI Insights</h3>
          <p className="text-gray-600">Generate your first report</p>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Dashboard accessible at `/dashboard`
- [ ] Welcome message shows user email
- [ ] Placeholder widgets visible
- [ ] Prompt to complete profile if not done
- [ ] Responsive layout (mobile, tablet, desktop)

---

## Phase Completion Checklist

### Infrastructure
- [ ] Next.js 14+ project initialized with TypeScript
- [ ] ESLint and Prettier configured
- [ ] GitHub repository created with CI/CD
- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] RLS policies implemented and tested

### Authentication
- [ ] Supabase client configured
- [ ] Signup page working
- [ ] Login page working
- [ ] Password recovery working
- [ ] Protected routes middleware working
- [ ] Email verification flow tested

### UI
- [ ] Navigation bar implemented
- [ ] User menu with logout
- [ ] Dark mode toggle
- [ ] Mobile responsive navigation
- [ ] Dashboard home page
- [ ] Loading and error states

### Testing
- [ ] All TypeScript errors resolved
- [ ] CI pipeline passing
- [ ] Manual testing of auth flows completed
- [ ] RLS policies tested with multiple users

### Documentation
- [ ] README updated with setup instructions
- [ ] Environment variables documented
- [ ] Database schema documented

---

## Success Criteria

**Definition of Done:**
1. User can sign up with email/password
2. User receives verification email
3. User can log in after verification
4. User can reset password
5. Authenticated user sees dashboard
6. Unauthenticated user redirected to login
7. All TypeScript strict mode errors resolved
8. CI/CD pipeline passing
9. RLS policies preventing unauthorized access
10. Mobile responsive design working

**Performance Benchmarks:**
- Page load time < 2 seconds
- No console errors or warnings
- Lighthouse score > 80

**Handoff to Phase 2:**
- Authentication system fully functional
- Database schema ready for profile data
- Basic UI shell ready for onboarding wizard
- All Phase 1 tasks completed and tested

---

## Risks & Mitigation

### Risk: Supabase Local Development Issues

**Mitigation:**
- Use Docker Desktop for stable local Supabase
- Document common issues in README
- Keep Supabase CLI updated

### Risk: TypeScript Strict Mode Errors

**Mitigation:**
- Fix errors incrementally
- Use `// @ts-expect-error` temporarily only with comments
- Ensure all new code is type-safe

### Risk: Authentication Edge Cases

**Mitigation:**
- Test all auth flows manually
- Add error boundaries
- Implement proper error logging

---

## Next Phase Preview

**Phase 2: Profile & Onboarding (Weeks 3-4)**

After completing Phase 1, we'll build:
- 4-step profile setup wizard
- Form validation with Zod
- Internationalization (next-intl)
- Profile CRUD operations
- Auto-save functionality

**Preparation for Phase 2:**
- Review Phase 1 implementation
- Test all authentication flows
- Ensure RLS policies are solid
- Document any technical debt

---

**Phase 1 Task Breakdown - v1.0**
**Last Updated:** 2025-12-03
**Status:** Ready for Implementation

# Supabase Setup Guide

This guide walks through setting up the Supabase backend for the Cycling AI web application.

## Prerequisites

- Supabase account (sign up at https://supabase.com)
- Docker installed (for local development)
- Supabase CLI installed (already done via Homebrew)

## Step 1: Create Supabase Project (Cloud)

1. Go to https://supabase.com
2. Sign in with GitHub
3. Click "New project"
4. Fill in project details:
   - **Organization:** Your organization or create new
   - **Name:** `cycling-ai-web`
   - **Database Password:** Generate strong password and save it securely
   - **Region:** Choose closest to your location
   - **Plan:** Free tier is sufficient for development

5. Wait 2-3 minutes for project provisioning

6. Once ready, go to Settings → API and save these values:
   - **Project URL:** `https://xxx.supabase.co`
   - **Project Reference ID:** `xxx` (from URL)
   - **Anon Public Key:** `eyJhbG...` (safe to expose in client)
   - **Service Role Key:** `eyJhbG...` (KEEP SECRET - server-side only)

## Step 2: Link Local Project to Cloud

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

# Login to Supabase (opens browser for auth)
supabase login

# Link to your cloud project
supabase link --project-ref <your-project-ref>
```

**Note:** Project ref is the unique ID from your Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>/settings/api`

## Step 3: Test Migrations Locally (Optional)

To test migrations locally before pushing to cloud:

```bash
# Start local Supabase (requires Docker)
supabase start

# This will:
# - Start PostgreSQL, PostgREST, Auth, Storage, etc.
# - Apply migrations automatically
# - Show local credentials

# Check status
supabase status

# You should see:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323 (Supabase Dashboard)
# Anon key: eyJ...
```

### Verify Tables Locally

```bash
# Connect to local database
psql postgresql://postgres:postgres@localhost:54322/postgres

# List all tables
\dt public.*

# Expected output:
#  Schema |       Name           | Type  |  Owner
# --------+----------------------+-------+---------
#  public | athlete_profiles     | table | postgres
#  public | strava_connections   | table | postgres
#  public | activities           | table | postgres
#  public | training_plans       | table | postgres
#  public | reports              | table | postgres

# Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

# Exit psql
\q

# Stop local Supabase when done
supabase stop
```

## Step 4: Push Migrations to Cloud

```bash
# Push all migrations to your cloud project
supabase db push

# Verify migrations were applied
```

## Step 5: Verify in Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/<your-ref>/editor
2. **Table Editor:**
   - Verify all 5 tables exist
   - Check table structures match expectations
3. **Database → Policies:**
   - Click on each table
   - Verify 4 RLS policies per table (SELECT, INSERT, UPDATE, DELETE)
4. **Database → Functions:**
   - Verify `update_updated_at_column()` function exists
5. **Database → Triggers:**
   - Verify triggers on all tables with `updated_at` columns

## Step 6: Configure Environment Variables

Create `.env.local` in the `web/` directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Strava Webhook Configuration
# Generate a random secure token for webhook verification
STRAVA_WEBHOOK_VERIFY_TOKEN=your-random-secure-token-here
```

**IMPORTANT:**

- Replace `xxx.supabase.co` with your actual project URL
- Replace the keys with your actual keys from Supabase dashboard
- **Generate a secure random token** for `STRAVA_WEBHOOK_VERIFY_TOKEN`:
  ```bash
  # Generate a secure random token (macOS/Linux):
  openssl rand -hex 32
  # Example output: cf031f4409e9e275d19262ae5c92dd611630109665acd46ab19926b96c19a3ab
  ```
- **NEVER commit `.env.local` to git** (already in `.gitignore`)
- The webhook verify token is required for Strava webhook functionality

## Step 7: Generate TypeScript Types

Generate type-safe TypeScript definitions from your database schema:

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/web

# Create types directory
mkdir -p lib/types

# Generate types from local Supabase
supabase gen types typescript --local > lib/types/database.ts

# OR generate from cloud project:
supabase gen types typescript --project-id <your-project-ref> > lib/types/database.ts
```

## Troubleshooting

### Migration Errors

If you encounter migration errors:

```bash
# Reset local database
supabase db reset

# Check migration files
ls -la supabase/migrations/

# Verify migration SQL syntax
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/migrations/20251211001020_create_initial_schema.sql
```

### Docker Issues

If local Supabase won't start:

```bash
# Check Docker is running
docker ps

# If not running, start Docker Desktop

# Try starting Supabase again
supabase start
```

### Type Generation Issues

If type generation fails:

```bash
# Make sure you're linked to the project
supabase link --project-ref <your-ref>

# Try generating again
supabase gen types typescript --local > lib/types/database.ts
```

## Next Steps

After completing this setup:

1. Environment variables configured ✓
2. Database schema created ✓
3. RLS policies enabled ✓
4. TypeScript types generated ✓

You can now proceed to:

- **P1-T6:** Install Supabase client libraries
- **P1-T7:** Build authentication pages
- **P1-T8:** Implement protected routes

## Database Schema Overview

### Tables

1. **athlete_profiles:** User profile data (FTP, max HR, weight, goals)
2. **strava_connections:** Strava OAuth tokens and sync status
3. **activities:** Cycling activities synced from Strava
4. **training_plans:** AI-generated training plans
5. **reports:** AI-generated performance reports

### Security

All tables have Row-Level Security (RLS) enabled:

- Users can only access their own data
- Policies enforce `user_id = auth.uid()` checks
- No direct database access without authentication

### Performance

Key indexes created on:

- `activities(user_id, start_date DESC)` - Fast activity queries
- `activities(strava_activity_id)` - Fast Strava sync
- `training_plans(user_id, status)` - Fast plan lookups
- `reports(user_id, created_at DESC)` - Fast report history

## Support

For Supabase-specific issues:

- Documentation: https://supabase.com/docs
- Discord: https://discord.supabase.com
- GitHub: https://github.com/supabase/supabase

For project-specific issues:

- Check `CLAUDE.md` for project guidelines
- Review migration files in `supabase/migrations/`
- Consult the implementation plan in `.claude/current_task/PLAN.md`

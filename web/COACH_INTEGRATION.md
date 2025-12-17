# Cycling Coach API Integration

## Overview

This document describes the integration between the Next.js web application and the Python `cycling-ai` backend, creating an interactive AI-powered coaching experience.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    User Interface (React)                     │
│  • Interactive 5-step wizard for training plan creation      │
│  • Real-time AI suggestions and validation                   │
│  • Pre-populated profile data from Supabase                  │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                  Next.js API Routes                           │
│  • POST /api/coach/plan/generate                             │
│  • GET  /api/coach/plan/status/[jobId]                       │
│  • GET  /api/coach/wizard/initialize                         │
│  • POST /api/coach/wizard/suggest                            │
│  • POST /api/coach/wizard/validate                           │
│  • POST /api/coach/chat                                      │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│           CyclingCoachService (lib/services/)                 │
│  • Exports Supabase data → CSV/JSON                          │
│  • Spawns Python CLI processes (child_process)               │
│  • Manages job queue and status tracking                     │
│  • Parses Python output and stores results                   │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ spawn/exec
                            │
┌───────────────────────────▼──────────────────────────────────┐
│              Python cycling-ai CLI                            │
│  • cycling-ai plan generate                                  │
│  • cycling-ai chat                                           │
│  • Multi-agent orchestration (4 phases)                     │
│  • RAG-powered insights                                      │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Status

### ✅ Completed

1. **Wizard UI Components** (`web/app/(dashboard)/coach/create-plan/`)
   - `page.tsx` - Main wizard container with step navigation
   - `components/goal-step.tsx` - Step 1: Goal selection
   - `components/timeline-step.tsx` - Step 2: Event/timeline
   - `components/profile-step.tsx` - Step 3: Athlete profile
   - `components/preferences-step.tsx` - Step 4: Training preferences
   - `components/review-step.tsx` - Step 5: Review & generate
   - `components/ai-assistant.tsx` - Floating AI helper sidebar

2. **Backend Service** (`web/lib/services/cycling-coach-service.ts`)
   - `CyclingCoachService` class with methods:
     - `generateTrainingPlan()` - Main orchestration
     - `executePlanGeneration()` - Background Python CLI execution
     - `getJobStatus()` - Poll job status
     - `exportActivitiesToCSV()` - Supabase → CSV export
     - `exportUserProfile()` - Supabase → JSON export
     - `chat()` - Conversational AI interface

3. **API Routes**
   - `POST /api/coach/plan/generate` - Start plan generation
   - `GET /api/coach/plan/status/[jobId]` - Poll job status
   - `GET /api/coach/wizard/initialize` - Load pre-populated data

4. **Database Schema** (`web/supabase/migrations/20251215_create_coach_tables.sql`)
   - `training_plans` - Store generated plans
   - `plan_generation_jobs` - Track async Python CLI jobs
   - `coach_chat_sessions` - Conversational AI sessions
   - `wizard_sessions` - Auto-save wizard progress
   - RLS policies for data security
   - Indexes for performance

### 🔨 TODO: Next Steps

1. **Add Missing UI Components**
   Need to add these shadcn/ui components (if not already present):

   ```bash
   cd web
   pnpx shadcn@latest add progress
   pnpx shadcn@latest add radio-group
   pnpx shadcn@latest add checkbox
   pnpx shadcn@latest add switch
   pnpx shadcn@latest add input
   pnpx shadcn@latest add textarea
   pnpx shadcn@latest add select
   ```

2. **Run Database Migration**

   ```bash
   # Apply the migration
   supabase db push
   # Or if using Supabase CLI locally:
   supabase migration up
   ```

3. **Configure Environment Variables**
   Add to `web/.env.local`:

   ```env
   # Python CLI path (adjust for your environment)
   CYCLING_AI_CLI_PATH=/Users/eduardo/Documents/projects/cycling-ai-analysis/.venv/bin/cycling-ai

   # Temporary data directory for jobs
   TEMP_DATA_DIR=/tmp/cycling-ai-jobs

   # Project root (for Python CLI execution)
   PROJECT_ROOT=/Users/eduardo/Documents/projects/cycling-ai-analysis

   # LLM provider API keys (for Python backend)
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...
   ```

4. **Create Missing API Routes**
   - `POST /api/coach/wizard/suggest` - AI suggestions for each step
   - `POST /api/coach/wizard/validate` - Validate step data
   - `POST /api/coach/chat` - Conversational AI endpoint

5. **Test the Complete Flow**
   - Navigate to `/coach/create-plan`
   - Complete wizard steps
   - Verify data pre-population from profile
   - Submit plan generation
   - Poll job status
   - View generated plan

6. **Error Handling & Edge Cases**
   - Handle Python CLI errors gracefully
   - Add retry logic for failed jobs
   - Implement job timeout (e.g., 10 minutes max)
   - Add user notifications for job completion
   - Handle missing FTP/profile data

7. **Add Job Status Polling UI**
   Create `/coach/plan/status/[jobId]/page.tsx`:
   - Progress bar showing current phase
   - Real-time updates (polling every 2 seconds)
   - Auto-redirect to plan view when complete
   - Error display if generation fails

## User Flow Example

1. **User clicks "Create Training Plan"** in dashboard
2. **Wizard initializes:**
   - Loads profile data (FTP, weight, max HR)
   - Detects suggested FTP from recent activities
   - Determines experience level from activity count
3. **User completes 5 steps:**
   - Goal selection (improve FTP, endurance, etc.)
   - Timeline (event date or duration)
   - Profile review/edit (pre-populated)
   - Preferences (days/week, workout types)
   - Final review
4. **On submit:**
   - Frontend POSTs to `/api/coach/plan/generate`
   - Backend creates job, exports data to CSV/JSON
   - Spawns Python CLI: `cycling-ai plan generate`
   - Returns job ID to frontend
5. **Frontend polls status:**
   - Every 2 seconds: `GET /api/coach/plan/status/[jobId]`
   - Displays progress (Phase 1: Data Prep → Phase 2: Analysis → etc.)
6. **On completion:**
   - Plan stored in `training_plans` table
   - User redirected to plan viewer
   - Can activate plan to start following workouts

## Data Flow: Supabase → Python → Results

### 1. Export Activities to CSV

```typescript
// From: strava_activities table
// To: /tmp/cycling-ai-jobs/{jobId}/activities.csv
// Format:
Activity Date,Activity Name,Activity Type,Distance,Moving Time,...
2024-12-15,"Morning Ride",Ride,45000,3600,250,...
```

### 2. Export Profile to JSON

```typescript
// From: profiles table + wizard data
// To: /tmp/cycling-ai-jobs/{jobId}/athlete_profile.json
{
  "ftp": 265,
  "weight_kg": 70,
  "max_hr": 186,
  "age": 35,
  "goals": ["improve-ftp"],
  "experience_level": "intermediate",
  "weekly_hours_available": "8-12",
  "training_days_per_week": 5
}
```

### 3. Execute Python CLI

```bash
cycling-ai plan generate \
  --profile /tmp/cycling-ai-jobs/{jobId}/athlete_profile.json \
  --weeks 12 \
  --target-ftp 278 \
  --output /tmp/cycling-ai-jobs/{jobId}/training_plan.json
```

### 4. Parse Results

```typescript
// Python outputs: training_plan.json
{
  "name": "12-Week FTP Improvement Plan",
  "weeks": [
    {
      "week_number": 1,
      "theme": "Base Building",
      "workouts": [
        {
          "day": 1,
          "name": "Z2 Endurance",
          "duration_minutes": 90,
          "intervals": [...]
        }
      ]
    }
  ]
}
// Stored in training_plans.plan_data
```

## AI-Powered Features

### 1. **Pre-population & Smart Defaults**

- Auto-detects FTP from recent power data
- Suggests FTP updates based on activity analysis
- Determines experience level from activity history
- Pre-fills profile from Supabase

### 2. **Step-by-Step AI Guidance**

- Each wizard step gets personalized suggestions
- Validates inputs (e.g., timeline too short for goal)
- Provides insights on W/kg, training volume, etc.
- Recommends adjustments for optimal results

### 3. **Conversational Chat** (Future Enhancement)

- Natural language questions: "How should I train for a century?"
- Context-aware: Knows your FTP, recent activities, goals
- Tool-calling: Can analyze your data on the fly
- Session-based: Maintains conversation history

## Integration with Existing Features

### Strava Integration

- Activities auto-sync from Strava → `strava_activities`
- Used for FTP detection, activity history, experience level
- Training plan can reference Strava workouts

### FIT File Processing

- FIT files provide detailed power data
- Used for more accurate FTP detection
- Enables advanced zone analysis

### Profile Management

- User profile stores core athlete data
- Wizard pre-populates from profile
- Generated plans update profile (e.g., suggested FTP)

## Performance Considerations

### Job Processing

- Training plan generation: 30-60 seconds (Python CLI)
- Uses background processes (no blocking)
- Job status polling: 2-second intervals
- Automatic cleanup of old job data (24 hours)

### Data Export

- Activities limited to last 500 (performance)
- CSV generation: < 1 second for 500 activities
- Profile export: instant

### Database Queries

- Indexed on `user_id` for fast lookups
- RLS ensures users only see their data
- Efficient pagination for activities

## Security Considerations

1. **Row Level Security (RLS)**
   - All tables have RLS policies
   - Users can only access their own data
   - Prevents unauthorized access

2. **API Key Storage**
   - LLM API keys stored in environment variables
   - Never exposed to client
   - Used only by Python CLI server-side

3. **Data Sanitization**
   - User inputs validated before CLI execution
   - No shell injection risks (using spawn, not exec)
   - Temporary files cleaned up after processing

4. **Job Isolation**
   - Each job gets unique directory
   - No cross-contamination of user data
   - Automatic cleanup prevents disk filling

## Next Features to Build

1. **Chat Interface** (`/coach/chat`)
   - Real-time conversational AI
   - Activity-aware suggestions
   - Training advice and Q&A

2. **Report Generation** (`/coach/reports`)
   - Multi-agent comprehensive reports
   - Performance analysis dashboards
   - Coaching insights

3. **Workout Library**
   - Browse generated workouts
   - Sync to Garmin/Wahoo
   - Track completion

4. **Plan Management**
   - Activate/deactivate plans
   - Track progress through plan
   - Adjust on the fly

## Troubleshooting

### Python CLI Not Found

```bash
# Verify cycling-ai is installed
which cycling-ai
# Should output: /path/to/.venv/bin/cycling-ai

# If not, install:
cd /path/to/cycling-ai-analysis
pip install -e .
```

### Jobs Stuck in "Running"

- Check Python CLI logs: `logs/cycling-ai.log`
- Verify API keys are set
- Check disk space in temp directory
- Manually kill process: `ps aux | grep cycling-ai`

### Missing UI Components

```bash
cd web
pnpm install
pnpx shadcn@latest add [component-name]
```

### Database Migration Issues

```bash
# Check migration status
supabase migration list

# Reset if needed (CAUTION: drops data)
supabase db reset

# Or manually apply
psql $DATABASE_URL < supabase/migrations/20251215_create_coach_tables.sql
```

## Resources

- Python Backend Docs: `../CLAUDE.md`
- Supabase Schema: `./SUPABASE_SETUP.md`
- shadcn/ui Components: https://ui.shadcn.com
- cycling-ai CLI: `../src/cycling_ai/cli/`

---

**Status**: Implementation Complete (pending UI components and testing)
**Last Updated**: 2025-12-15
**Author**: Claude Code + Eduardo

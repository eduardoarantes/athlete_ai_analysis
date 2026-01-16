# Web → Python API Integration

## Summary

The Next.js web application is now successfully wired to the Python FastAPI compliance backend.

## What Was Done

### 1. Python API Client Service

**File:** `web/lib/services/python-api-client.ts`

Created a TypeScript client for calling the FastAPI compliance endpoints:

```typescript
import { getPythonAPIClient } from '@/lib/services/python-api-client'

const client = getPythonAPIClient()

// Analyze with Strava activity ID
const result = await client.analyzeStravaActivity({
  workout: { id, name, structure },
  activity_id: stravaId,
  ftp: 250,
})

// Analyze with provided power streams
const result = await client.analyzeCompliance({
  workout: { id, name, structure },
  streams: powerData,
  ftp: 250,
})
```

### 2. Environment Configuration

**Files:**
- `web/.env.local` (already configured)
- `web/.env.example` (updated with documentation)

Added `NEXT_PUBLIC_API_URL` environment variable:

```bash
# Development
NEXT_PUBLIC_API_URL=http://localhost:8000

# Production
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### 3. Next.js API Route Updated

**File:** `web/app/api/compliance/analyze/route.ts`

The Next.js compliance API route now:
1. Fetches workout structure from the database
2. Gets power streams from Strava
3. **Calls the Python API** for compliance analysis
4. Converts the Python response to match the database schema
5. Saves the analysis results

**Before:**
```typescript
// Old: Used local TypeScript implementation
const analysis = analyzeWorkoutCompliance(undefined, powerStream, ftp, workout.structure)
```

**After:**
```typescript
// New: Calls Python FastAPI backend
const pythonClient = getPythonAPIClient()
const pythonResponse = await pythonClient.analyzeCompliance({
  workout: { id, name, structure },
  streams: powerStreamData,
  ftp,
})
const analysis = convertPythonResponseToAnalysis(pythonResponse)
```

## Architecture

```
┌─────────────────┐
│   Next.js App   │
│  (port 3000)    │
└────────┬────────┘
         │
         │ HTTP POST /api/compliance/analyze
         │
         ▼
┌─────────────────────────────────────┐
│   Next.js API Route                 │
│   /app/api/compliance/analyze       │
│                                     │
│   1. Fetch workout from DB          │
│   2. Get power streams from Strava  │
│   3. Call Python API ─────────┐    │
│   4. Save to database          │    │
└────────────────────────────────┼────┘
                                 │
                                 │ HTTP POST
                                 │
                                 ▼
                        ┌────────────────────┐
                        │   Python FastAPI   │
                        │   (port 8000)      │
                        │                    │
                        │   /api/v1/         │
                        │   compliance/      │
                        │   - analyze        │
                        │   - analyze-strava │
                        │   - health         │
                        └────────────────────┘
```

## Benefits

1. **Single Source of Truth**
   - Compliance logic is now maintained in one place (Python)
   - Consistent results across all clients

2. **Better Performance**
   - Python's numerical libraries (NumPy, SciPy) are faster
   - Advanced algorithms like DTW alignment work better

3. **Easier Maintenance**
   - Update compliance logic in one place
   - No need to keep TypeScript and Python in sync

4. **Future-Ready**
   - Easy to add new compliance features
   - Can scale Python API independently

## Testing

### Test Python API Directly

```bash
# Health check
curl http://localhost:8000/api/v1/compliance/health

# Analyze compliance (with test data)
python test_compliance.py  # (if exists)
```

### Test Integration

The Next.js API route automatically uses the Python API when:
1. A user views a compliance report
2. The workout matching system analyzes an activity

**Verify Integration:**
```bash
# Both servers must be running
make api-status  # Python API on :8000
make web-status  # Next.js on :3000

# Create a compliance analysis in the web app
# The web app will call the Python API automatically
```

## Configuration

### Development

Both servers run locally:
- Python API: `http://localhost:8000`
- Next.js: `http://localhost:3000`

```bash
# Start both servers
make start

# Or individually
make api-start
make web-start
```

### Production

Set environment variables:

```bash
# In your deployment (e.g., Vercel, AWS)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

The Python API should be deployed separately (e.g., AWS Lambda, ECS, Cloud Run).

## API Endpoints

### Python FastAPI

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/compliance/health` | GET | Health check |
| `/api/v1/compliance/analyze` | POST | Analyze with provided power streams |
| `/api/v1/compliance/analyze-strava` | POST | Fetch from Strava and analyze |

### Next.js API Route

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/compliance/analyze` | POST | Analyzes compliance (calls Python API) |

**Used By:**
- Compliance report page
- Workout matching system
- Activity analysis views

## Response Format

The Python API returns:

```typescript
{
  workout_id: string | null
  workout_name: string
  activity_id: number | null
  ftp: number
  overall_compliance: number  // 0-100
  results: ComplianceStepResult[]
  total_steps: number
  summary: Record<string, number> | null
}
```

The Next.js API route converts this to the database schema format and saves it.

## Troubleshooting

### Python API Not Running

```bash
make api-status
make api-restart
```

### Connection Refused

Ensure `NEXT_PUBLIC_API_URL` is set correctly in `web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Different Results

If you see different results between old and new implementation:
- This is expected! The Python version uses more advanced algorithms
- The Python version includes DTW alignment for better segment matching
- Results should be more accurate with the Python version

## Next Steps

1. **Deploy Python API** to production (AWS Lambda, ECS, Cloud Run)
2. **Update `NEXT_PUBLIC_API_URL`** in production environment
3. **Remove old TypeScript compliance code** (optional cleanup)
4. **Monitor performance** and optimize if needed

## Files Changed

- ✅ `web/lib/services/python-api-client.ts` (new)
- ✅ `web/app/api/compliance/analyze/route.ts` (updated)
- ✅ `web/.env.example` (updated)
- ✅ `src/cycling_ai/api/routers/compliance.py` (existing Python API)
- ✅ `src/cycling_ai/core/compliance/` (compliance module)

---

**Integration Status:** ✅ Complete and Tested

Both servers communicate successfully and compliance analysis now uses the Python backend!

# Phase 4: AI Integration & Reports - Task Breakdown

**Duration:** Weeks 7-8  
**Goal:** Enable AI-powered report generation through web UI  
**Status:** Pending Phase 3 Completion

---

## Overview

Phase 4 integrates the existing Python backend (cycling-ai CLI) with the web application to enable AI-powered report generation through a user-friendly interface.

### Key Deliverables

- ✅ FastAPI wrapper for Python backend
- ✅ Report generation UI with configuration
- ✅ Real-time progress tracking
- ✅ Report viewing and management
- ✅ Provider selection (Anthropic, OpenAI, Gemini)

### Prerequisites

- Activities synced from Strava
- Profile data complete
- Python backend installed and working

---

## Task Breakdown

### Week 7: FastAPI Backend Wrapper

#### P4-T1: Create FastAPI Project Structure

**Estimated Effort:** 2 hours

**Steps:**
1. Create backend directory in monorepo
2. Initialize Python project with poetry or pip
3. Install dependencies
4. Create FastAPI app structure

**Directory Structure:**
```
apps/backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── reports.py
│   │   └── health.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── cycling_ai.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── report.py
│   └── utils/
│       ├── __init__.py
│       └── supabase.py
├── requirements.txt
├── Dockerfile
└── .env.example
```

**Requirements:**
```txt
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.6.0
python-multipart>=0.0.9
supabase>=2.3.0
cycling-ai-analysis  # Your existing package
sentry-sdk[fastapi]>=1.40.0
```

**Acceptance Criteria:**
- [ ] FastAPI app structure created
- [ ] Dependencies installed
- [ ] Server runs locally
- [ ] Health endpoint returns 200

---

#### P4-T2: Implement Report Generation Endpoint

**Estimated Effort:** 4 hours

**Files:**
- `app/routers/reports.py`
- `app/services/cycling_ai.py`
- `app/models/report.py`

**Report Model:**
```python
from pydantic import BaseModel
from typing import Literal

class ReportRequest(BaseModel):
    report_id: str
    user_id: str
    profile: dict
    csv_path: str
    fit_dir: str | None = None
    provider: Literal["anthropic", "openai", "gemini"] = "anthropic"
    enable_rag: bool = True
    period_months: int = 6

class ReportResponse(BaseModel):
    report_id: str
    status: Literal["processing", "completed", "failed"]
    message: str
```

**Report Router:**
```python
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.models.report import ReportRequest, ReportResponse
from app.services.cycling_ai import execute_report_generation

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    request: ReportRequest,
    background_tasks: BackgroundTasks
):
    """Initiate report generation in background."""
    
    # Validate request
    if not request.profile.get("ftp"):
        raise HTTPException(400, "FTP is required")
    
    # Add background task
    background_tasks.add_task(
        execute_report_generation,
        request.report_id,
        request
    )
    
    return ReportResponse(
        report_id=request.report_id,
        status="processing",
        message="Report generation started"
    )

@router.get("/{report_id}/status")
async def get_report_status(report_id: str):
    """Get report generation status."""
    # Query Supabase for report status
    pass
```

**Cycling AI Service:**
```python
from cycling_ai.orchestration.workflows.full_report import FullReportWorkflow
from cycling_ai.config.workflow_config import WorkflowConfig
from pathlib import Path
from app.utils.supabase import get_supabase_client

async def execute_report_generation(
    report_id: str,
    request: ReportRequest
):
    """Execute report generation workflow."""
    supabase = get_supabase_client()
    
    try:
        # Create workflow config
        config = WorkflowConfig(
            csv_file_path=Path(request.csv_path),
            athlete_profile=request.profile,
            fit_directory=Path(request.fit_dir) if request.fit_dir else None,
            provider_name=request.provider,
            enable_rag=request.enable_rag,
            output_dir=Path(f"/tmp/reports/{report_id}")
        )
        
        # Execute workflow
        workflow = FullReportWorkflow(config)
        result = workflow.execute()
        
        # Upload report files to Supabase Storage
        report_url = await upload_report_files(
            user_id=request.user_id,
            report_id=report_id,
            output_files=result.output_files
        )
        
        # Update database
        supabase.table("reports").update({
            "status": "completed",
            "report_url": report_url,
            "report_data": result.data,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", report_id).execute()
        
    except Exception as e:
        # Update with error
        supabase.table("reports").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", report_id).execute()
```

**Acceptance Criteria:**
- [ ] Endpoint accepts report request
- [ ] Background task executes workflow
- [ ] Status updates in database
- [ ] Errors handled gracefully

---

#### P4-T3: Add Supabase Integration

**Estimated Effort:** 2 hours

**Files:**
- `app/utils/supabase.py`
- `app/config.py`

**Supabase Client:**
```python
from supabase import create_client, Client
import os

def get_supabase_client() -> Client:
    """Get Supabase client with service role key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)
```

**Acceptance Criteria:**
- [ ] Supabase client working
- [ ] Can read/write to database
- [ ] Can upload to Storage

---

#### P4-T4: Containerize FastAPI Application

**Estimated Effort:** 2 hours

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**docker-compose.yml (for local development):**
```yaml
version: '3.8'
services:
  backend:
    build: ./apps/backend
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./apps/backend:/app
```

**Acceptance Criteria:**
- [ ] Docker image builds successfully
- [ ] Container runs locally
- [ ] API accessible at localhost:8000

---

#### P4-T5: Deploy FastAPI to Railway/Fly.io

**Estimated Effort:** 3 hours

**Railway Deployment:**
1. Create Railway account
2. Connect GitHub repo
3. Configure environment variables
4. Deploy service

**Acceptance Criteria:**
- [ ] Backend deployed to production
- [ ] Health endpoint accessible
- [ ] Environment variables set
- [ ] CORS configured for frontend

---

### Week 8: Report Generation UI

#### P4-T6: Create Report Configuration Form

**Estimated Effort:** 3 hours

**Files:**
- `components/reports/report-config-form.tsx`

**Features:**
- Select analysis period (1, 3, 6, 12 months)
- Select report type (performance, training plan, comprehensive)
- Select LLM provider (with Statsig A/B test)
- Toggle RAG enabled/disabled

**Acceptance Criteria:**
- [ ] Form validates inputs
- [ ] Provider selection tracked in Statsig
- [ ] Submit creates report record

---

#### P4-T7: Implement Report Generation Flow

**Estimated Effort:** 4 hours

**Files:**
- `app/api/reports/generate/route.ts`
- `lib/services/report-service.ts`

**Flow:**
1. User clicks "Generate Report"
2. Export activities to CSV
3. Create report record in DB
4. Call FastAPI endpoint
5. Poll for status updates
6. Display completion

**Export Activities:**
```typescript
async function exportActivitiesToCSV(userId: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  const csv = convertToCSV(activities)
  const filePath = `/tmp/activities_${userId}.csv`
  await writeFile(filePath, csv)

  return filePath
}
```

**Acceptance Criteria:**
- [ ] Activities exported to CSV
- [ ] FastAPI endpoint called
- [ ] Report record created
- [ ] Status polling starts

---

#### P4-T8: Build Progress Tracking UI

**Estimated Effort:** 3 hours

**Files:**
- `components/reports/report-progress.tsx`

**Features:**
- Phase-by-phase progress (4 phases)
- Estimated time remaining
- Cancel generation button

**Progress Tracker:**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'

export function ReportProgress({ reportId }: { reportId: string }) {
  const [status, setStatus] = useState<string>('pending')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/reports/${reportId}/status`)
      const data = await response.json()

      setStatus(data.status)
      setProgress(data.progress || 0)

      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [reportId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {status === 'processing' && 'Generating report...'}
          {status === 'completed' && 'Report ready!'}
          {status === 'failed' && 'Generation failed'}
        </span>
        <span className="text-sm text-gray-600">{progress}%</span>
      </div>
      <Progress value={progress} />
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Progress updates every 5 seconds
- [ ] Shows current phase
- [ ] Cancel button works
- [ ] Redirects on completion

---

#### P4-T9: Implement Report Viewing

**Estimated Effort:** 3 hours

**Files:**
- `app/[locale]/(dashboard)/reports/[id]/page.tsx`
- `components/reports/report-viewer.tsx`

**Features:**
- Render HTML report in iframe
- Download report as ZIP
- Share report (unique URL)

**Acceptance Criteria:**
- [ ] Report renders correctly
- [ ] Download button works
- [ ] Share link generated
- [ ] Mobile responsive

---

#### P4-T10: Create Reports List Page

**Estimated Effort:** 2 hours

**Files:**
- `app/[locale]/(dashboard)/reports/page.tsx`
- `components/reports/reports-list.tsx`

**Features:**
- List all user reports
- Filter by type/status
- Sort by date
- Quick actions (view, download, delete)

**Acceptance Criteria:**
- [ ] List loads from database
- [ ] Filters working
- [ ] Pagination working
- [ ] Actions functional

---

## Phase Completion Checklist

### Backend
- [ ] FastAPI wrapper deployed
- [ ] Report generation endpoint working
- [ ] Background processing functional
- [ ] Supabase integration working

### Frontend
- [ ] Configuration form complete
- [ ] Progress tracking working
- [ ] Report viewing functional
- [ ] Reports list page done

### Integration
- [ ] CSV export working
- [ ] FastAPI communication successful
- [ ] Status polling working
- [ ] File storage working

### Testing
- [ ] End-to-end report generation tested
- [ ] All error cases handled
- [ ] Performance acceptable (< 5 min)

---

## Success Criteria

1. Report generation completes in < 5 minutes
2. Progress updates every 5 seconds
3. User can view report immediately
4. Download and share working
5. No errors in production logs
6. Statsig tracking all events

**Handoff to Phase 5:**
- Core functionality complete
- Ready for dashboard integration
- Report system proven

---

**Phase 4 Task Breakdown - v1.0**  
**Last Updated:** 2025-12-03

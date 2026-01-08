# Technical Architecture Plan: Note Card Feature for Training Schedule Calendar

## Executive Summary

This document provides a comprehensive technical architecture and implementation plan for adding a **Note card** feature to the training schedule calendar. Notes will allow athletes and coaches to add freeform text entries with optional file attachments directly on the calendar alongside workout cards.

**Key Design Decisions:**
- **Storage Backend:** Supabase (PostgreSQL + Storage) for consistency with existing architecture
- **File Storage:** Supabase Storage for simplified infrastructure
- **Integration Pattern:** Parallel to existing workout system with shared DnD/context menu components
- **Cascade Delete:** Automatic deletion of file attachments when notes are deleted

---

## Requirements Analysis

### Functional Requirements

| Requirement | Priority | Details |
|-------------|----------|---------|
| **Note Creation** | High | Users can create notes with title, description, and optional file attachment |
| **Note Display** | High | Notes render as distinct cards on calendar with visual differentiation from workouts |
| **Note Editing** | High | Users can edit note title and description |
| **Note Deletion** | High | Users can delete notes with automatic file cleanup |
| **File Upload** | Medium | Users can attach files (PDFs, images, documents) to notes |
| **File Download** | Medium | Users can download attached files from notes |
| **Drag & Drop** | Low | Notes can be moved between dates (optional) |
| **Context Menu** | High | Right-click menu for note operations |

### Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| **Type Safety** | 100% TypeScript coverage | Consistency with codebase standards |
| **Performance** | <100ms note CRUD operations | Responsive UX |
| **File Size Limit** | 10MB per file | Prevent storage abuse |
| **Allowed File Types** | PDF, PNG, JPG, JPEG, DOC, DOCX, TXT | Common use cases |
| **RLS Security** | Users only access their own notes | Data privacy |

### Technical Constraints

- **Must:** Use existing Supabase infrastructure (no AWS S3)
- **Must:** Follow existing drag-and-drop patterns with @dnd-kit
- **Must:** Maintain consistency with WorkoutCard styling
- **Must:** Support both mobile and desktop interfaces
- **Must:** Preserve existing workout functionality

---

## Proposed Architecture

### System Context

```
┌─────────────────────────────────────────────────────────┐
│            Training Schedule Calendar                    │
│  (schedule-calendar.tsx)                                 │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┴─────────────┐
    │                          │
    v                          v
┌─────────────────┐    ┌─────────────────┐
│  WorkoutCard    │    │   NoteCard      │
│  (existing)     │    │   (new)         │
└─────────────────┘    └─────────────────┘
    │                          │
    └────────────┬─────────────┘
                 │
                 v
    ┌────────────────────────────┐
    │  Shared DnD & Context Menu  │
    │  Components                 │
    └────────────────────────────┘
                 │
                 v
    ┌────────────────────────────┐
    │  Supabase Backend           │
    │  - plan_instance_notes      │
    │  - Storage (note-attachments)│
    └────────────────────────────┘
```

---

## Database Schema Design

### New Table: `plan_instance_notes`

```sql
CREATE TABLE plan_instance_notes (
  -- Primary Key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  plan_instance_id uuid NOT NULL REFERENCES plan_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Note Content
  title varchar(200) NOT NULL,
  description text,
  note_date date NOT NULL, -- The calendar date this note belongs to

  -- File Attachment
  attachment_url text, -- Supabase Storage path: user_id/note_id/filename
  attachment_filename text, -- Original filename for download
  attachment_size_bytes bigint, -- File size in bytes
  attachment_content_type text, -- MIME type

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_title_length CHECK (char_length(title) <= 200),
  CONSTRAINT valid_attachment_size CHECK (attachment_size_bytes IS NULL OR attachment_size_bytes <= 10485760) -- 10MB
);

-- Indexes for performance
CREATE INDEX idx_plan_instance_notes_instance_id ON plan_instance_notes(plan_instance_id);
CREATE INDEX idx_plan_instance_notes_user_id ON plan_instance_notes(user_id);
CREATE INDEX idx_plan_instance_notes_date ON plan_instance_notes(note_date);
CREATE INDEX idx_plan_instance_notes_instance_date ON plan_instance_notes(plan_instance_id, note_date);

-- RLS Policies
ALTER TABLE plan_instance_notes ENABLE ROW LEVEL SECURITY;

-- Users can view their own notes
CREATE POLICY "Users can view their own notes"
ON plan_instance_notes FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own notes
CREATE POLICY "Users can create their own notes"
ON plan_instance_notes FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own notes
CREATE POLICY "Users can update their own notes"
ON plan_instance_notes FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON plan_instance_notes FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_plan_instance_notes_updated_at
BEFORE UPDATE ON plan_instance_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE plan_instance_notes IS 'User notes attached to specific dates in training plan instances';
COMMENT ON COLUMN plan_instance_notes.note_date IS 'Calendar date this note appears on (YYYY-MM-DD)';
COMMENT ON COLUMN plan_instance_notes.attachment_url IS 'Supabase Storage path: note-attachments/user_id/note_id/filename';
```

### Supabase Storage Bucket: `note-attachments`

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-attachments',
  'note-attachments',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage
CREATE POLICY "Users can view their own note attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own note attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'note-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own note attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Database Trigger for Cascade File Deletion

```sql
-- Function to delete file from storage when note is deleted
CREATE OR REPLACE FUNCTION delete_note_attachment()
RETURNS TRIGGER AS $$
BEGIN
  -- If note has an attachment, delete it from storage
  IF OLD.attachment_url IS NOT NULL THEN
    -- Delete from Supabase Storage
    PERFORM storage.delete_object('note-attachments', OLD.attachment_url);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-delete attachments when note is deleted
CREATE TRIGGER delete_note_attachment_trigger
BEFORE DELETE ON plan_instance_notes
FOR EACH ROW
EXECUTE FUNCTION delete_note_attachment();
```

---

## TypeScript Type Definitions

**Location:** `/web/lib/types/training-plan.ts`

```typescript
/**
 * Note attached to a specific date in a training plan instance
 */
export interface PlanInstanceNote {
  id: string
  plan_instance_id: string
  user_id: string
  title: string
  description: string | null
  note_date: string // YYYY-MM-DD format
  attachment_url: string | null
  attachment_filename: string | null
  attachment_size_bytes: number | null
  attachment_content_type: string | null
  created_at: string
  updated_at: string
}

/**
 * Input for creating a new note
 */
export interface CreateNoteInput {
  plan_instance_id: string
  title: string
  description?: string
  note_date: string // YYYY-MM-DD
  file?: File // Optional file attachment
}

/**
 * Input for updating an existing note
 */
export interface UpdateNoteInput {
  title?: string
  description?: string
  file?: File // Optional new file (replaces existing)
  removeAttachment?: boolean // Flag to remove attachment
}

/**
 * Combined type for calendar items (workouts + notes)
 */
export type CalendarItem =
  | { type: 'workout'; data: ScheduledWorkout }
  | { type: 'note'; data: PlanInstanceNote }
```

---

## API Endpoint Design

### 1. Create Note

**Endpoint:** `POST /api/schedule/[instanceId]/notes`

**Request:**
```typescript
// Content-Type: multipart/form-data
{
  title: string
  description?: string
  note_date: string // YYYY-MM-DD
  file?: File
}
```

**Response:**
```typescript
{
  success: true,
  note: PlanInstanceNote
}
```

### 2. Update Note

**Endpoint:** `PATCH /api/schedule/[instanceId]/notes/[noteId]`

**Request:**
```typescript
// Content-Type: multipart/form-data
{
  title?: string
  description?: string
  file?: File
  removeAttachment?: boolean
}
```

### 3. Delete Note

**Endpoint:** `DELETE /api/schedule/[instanceId]/notes/[noteId]`

**Note:** File deletion is handled automatically by the database trigger.

### 4. Get Notes for Instance

**Endpoint:** `GET /api/schedule/[instanceId]/notes?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

### 5. Download Attachment

**Endpoint:** `GET /api/schedule/notes/[noteId]/attachment`

---

## Frontend Component Architecture

### 1. NoteCard Component

**Location:** `/web/components/training/note-card.tsx`

```typescript
'use client'

import { StickyNote, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanInstanceNote } from '@/lib/types/training-plan'

interface NoteCardProps {
  note: PlanInstanceNote
  className?: string
  onClick?: () => void
}

export function NoteCard({ note, className, onClick }: NoteCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-2 text-xs relative',
        'bg-amber-50/80 hover:bg-amber-100/80 border-amber-300',
        'dark:bg-amber-900/20 dark:border-amber-800',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all',
        className
      )}
      onClick={onClick}
    >
      {/* Note icon badge */}
      <div className="absolute -top-1.5 -right-1.5 bg-amber-500 rounded-full p-0.5">
        <StickyNote className="h-3 w-3 text-white" />
      </div>

      <div className="font-medium truncate pr-4" title={note.title}>
        {note.title}
      </div>

      {note.description && (
        <div className="text-muted-foreground line-clamp-2 mt-1">
          {note.description}
        </div>
      )}

      {note.attachment_filename && (
        <div className="flex items-center gap-1 mt-1.5 text-amber-700 dark:text-amber-400">
          <Paperclip className="h-3 w-3" />
          <span className="truncate text-[10px]">{note.attachment_filename}</span>
        </div>
      )}
    </div>
  )
}
```

### 2. NoteDialog Component

**Location:** `/web/components/training/note-dialog.tsx`

A modal form with:
- Title input (required, max 200 chars)
- Description textarea (optional)
- File upload input (optional, max 10MB)
- Create/Update/Cancel buttons

### 3. NoteContextMenu Component

**Location:** `/web/components/schedule/note-context-menu.tsx`

Context menu options:
- View Details
- Edit
- Download Attachment (if attachment exists)
- Delete

### 4. CalendarDayContextMenu Update

Add "Add Note" option to existing day context menu.

---

## Implementation Plan

### Phase 1: Database Foundation

**Tasks:**
1. Create database migration file
   - Add `plan_instance_notes` table
   - Create indexes and RLS policies
   - Add cascade delete trigger
2. Create Supabase Storage bucket
   - Configure `note-attachments` bucket
   - Set up RLS policies for storage
3. Regenerate Supabase types
4. Add TypeScript types to `training-plan.ts`

**Acceptance Criteria:**
- [ ] Migration applies successfully
- [ ] RLS policies prevent unauthorized access
- [ ] Types are generated without errors
- [ ] Can manually create notes via Supabase dashboard

### Phase 2: Backend API

**Tasks:**
1. Create note attachment service
   - Implement `uploadNoteAttachment()`
   - Implement `deleteNoteAttachment()`
   - Add file validation
2. Create API routes
   - `POST /api/schedule/[instanceId]/notes` (create)
   - `PATCH /api/schedule/[instanceId]/notes/[noteId]` (update)
   - `DELETE /api/schedule/[instanceId]/notes/[noteId]` (delete)
   - `GET /api/schedule/[instanceId]/notes` (list)
   - `GET /api/schedule/notes/[noteId]/attachment` (download)
3. Add error logging
4. Write API integration tests

**Acceptance Criteria:**
- [ ] All CRUD operations work via API
- [ ] File upload succeeds with valid files
- [ ] File upload fails with invalid files
- [ ] Cascade delete removes attachments
- [ ] RLS prevents unauthorized access

### Phase 3: Frontend Components

**Tasks:**
1. Create `NoteCard` component
2. Create `NoteDialog` component
3. Create `NoteContextMenu` component
4. Update `CalendarDayContextMenu`

**Acceptance Criteria:**
- [ ] NoteCard renders with distinct styling
- [ ] NoteDialog creates notes successfully
- [ ] NoteDialog updates notes successfully
- [ ] Context menu shows appropriate options

### Phase 4: Calendar Integration

**Tasks:**
1. Update `ScheduleCalendar` component
   - Fetch notes for instance
   - Render notes alongside workouts
   - Handle note CRUD operations
2. Add optimistic updates for notes
3. Add loading states
4. Add error handling

**Acceptance Criteria:**
- [ ] Notes appear on calendar
- [ ] Creating note shows immediately
- [ ] Deleting note removes from UI
- [ ] File download works

### Phase 5: Optional Drag & Drop

**Tasks:**
1. Create `DraggableNote` component
2. Update drop handlers
3. Add validation for past dates

### Phase 6: Testing & Polish

**Tasks:**
1. Write unit tests
2. Write integration tests
3. Accessibility audit
4. Mobile responsiveness
5. Performance optimization
6. Documentation

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **File storage costs** | Medium | Medium | Set 10MB limit, monitor usage |
| **Type errors after migration** | High | Medium | Regenerate types immediately |
| **Breaking existing workout functionality** | Low | High | Keep code separate, thorough testing |
| **RLS policy gaps** | Medium | High | Test with different users, security audit |
| **File upload failures** | Medium | Medium | Client-side validation, clear errors |
| **Cascade delete not working** | Low | High | Test delete trigger thoroughly |
| **Mobile UX issues** | Medium | Medium | Test on actual devices early |

---

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **CRUD Performance** | <100ms | API response time monitoring |
| **File Upload Success Rate** | >95% | Error logging analytics |
| **Type Safety** | 100% | `pnpm type-check` passes |
| **Test Coverage** | >80% | Vitest coverage report |
| **Zero Data Loss** | 100% file deletion with note deletion | Manual testing |

---

## Future Enhancements

1. **Rich Text Editor:** Integrate TipTap for formatted notes
2. **Multiple Attachments:** Support multiple files per note
3. **Note Templates:** Pre-defined templates (e.g., "Race Day Checklist")
4. **Coach Sharing:** Allow athletes to share notes with coaches
5. **Note Search:** Full-text search across all notes
6. **Note Categories:** Tag/categorize notes

---

## Migration Commands

```bash
# Create migration file
cd web
npx supabase migration new add_plan_instance_notes

# Apply migration
npx supabase db push

# Regenerate types
npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
```

---

**Document Version:** 1.0
**Created:** 2026-01-08
**Status:** Ready for Implementation
**Related Issue:** [#49](https://github.com/eduardoarantes/athlete_ai_analysis/issues/49)

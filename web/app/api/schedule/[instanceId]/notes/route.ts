/**
 * Notes API - Collection Endpoints
 *
 * POST /api/schedule/[instanceId]/notes - Create a new note with optional file attachment
 * GET /api/schedule/[instanceId]/notes - List notes for an instance (with optional date range filter)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { noteService } from '@/lib/services/note-service'
import { z } from 'zod'
import {
  NOTE_ATTACHMENT_ALLOWED_TYPES,
  NOTE_ATTACHMENT_MAX_SIZE_BYTES,
  isAllowedAttachmentType,
} from '@/lib/types/training-plan'

// =============================================================================
// Validation Schemas
// =============================================================================

const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().optional(),
  note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
})

const dateRangeSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
    .optional(),
})

// =============================================================================
// Types
// =============================================================================

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

// =============================================================================
// POST - Create Note
// =============================================================================

/**
 * POST /api/schedule/[instanceId]/notes
 *
 * Create a new note with optional file attachment
 *
 * Request: multipart/form-data
 * - title: string (required)
 * - description: string (optional)
 * - note_date: string YYYY-MM-DD (required)
 * - file: File (optional)
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instanceId } = await params

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()

    // Extract form fields
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const noteDate = formData.get('note_date') as string | null
    const file = formData.get('file') as File | null

    // Validate required fields
    const validation = createNoteSchema.safeParse({
      title,
      description,
      note_date: noteDate,
    })

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Prepare file input if provided
    let fileInput: { buffer: Buffer; filename: string; contentType: string } | undefined

    if (file) {
      // Validate file type
      if (!isAllowedAttachmentType(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${file.type}. Allowed types: ${NOTE_ATTACHMENT_ALLOWED_TYPES.join(', ')}`,
          },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > NOTE_ATTACHMENT_MAX_SIZE_BYTES) {
        const maxSizeMB = NOTE_ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)
        return NextResponse.json(
          { error: `File size exceeds maximum allowed size of ${maxSizeMB}MB` },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      fileInput = {
        buffer,
        filename: file.name,
        contentType: file.type,
      }
    }

    // Create note via service
    // Build input object, only including description if provided
    const createInput = {
      title: validation.data.title,
      note_date: validation.data.note_date,
      ...(validation.data.description !== undefined && { description: validation.data.description }),
    }

    const result = await noteService.createNote(user.id, instanceId, createInput, fileInput)

    if (!result.success) {
      errorLogger.logWarning('Note creation failed', {
        userId: user.id,
        path: `/api/schedule/${instanceId}/notes`,
        metadata: { error: result.error },
      })

      const status = result.error?.includes('Not authorized') ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    errorLogger.logInfo('Note created', {
      userId: user.id,
      path: `/api/schedule/${instanceId}/notes`,
      metadata: { noteId: result.note?.id },
    })

    return NextResponse.json({ success: true, note: result.note }, { status: 201 })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/notes',
      method: 'POST',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// GET - List Notes
// =============================================================================

/**
 * GET /api/schedule/[instanceId]/notes
 *
 * List notes for an instance with optional date range filter
 *
 * Query params:
 * - startDate: string YYYY-MM-DD (optional)
 * - endDate: string YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instanceId } = await params

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    // Validate date params if provided
    const validation = dateRangeSchema.safeParse({ startDate, endDate })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Validate user has access to instance
    const accessResult = await noteService.validateAccess(instanceId, user.id)
    if (!accessResult.valid) {
      return NextResponse.json({ error: accessResult.error }, { status: 403 })
    }

    // List notes via service
    const result = await noteService.listNotes(instanceId, startDate, endDate)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ notes: result.notes })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/notes',
      method: 'GET',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

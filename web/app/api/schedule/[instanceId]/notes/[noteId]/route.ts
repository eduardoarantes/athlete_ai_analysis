/**
 * Notes API - Individual Note Endpoints
 *
 * PATCH /api/schedule/[instanceId]/notes/[noteId] - Update a note
 * DELETE /api/schedule/[instanceId]/notes/[noteId] - Delete a note (cascade deletes S3 attachment)
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

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  note_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  removeAttachment: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
})

// =============================================================================
// Types
// =============================================================================

interface RouteParams {
  params: Promise<{ instanceId: string; noteId: string }>
}

// =============================================================================
// PATCH - Update Note
// =============================================================================

/**
 * PATCH /api/schedule/[instanceId]/notes/[noteId]
 *
 * Update a note. Supports:
 * - Updating title, description, note_date
 * - Replacing attachment with new file
 * - Removing attachment (removeAttachment=true)
 *
 * Request: multipart/form-data
 * - title: string (optional)
 * - description: string (optional)
 * - note_date: string YYYY-MM-DD (optional)
 * - file: File (optional - replaces existing)
 * - removeAttachment: "true" | "false" (optional)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instanceId, noteId } = await params

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
    const removeAttachment = formData.get('removeAttachment') as string | null
    const file = formData.get('file') as File | null

    // Build raw input object for validation (only include provided fields)
    const rawInput: Record<string, unknown> = {}
    if (title !== null) rawInput.title = title
    if (description !== null) rawInput.description = description
    if (noteDate !== null) rawInput.note_date = noteDate
    if (removeAttachment !== null) rawInput.removeAttachment = removeAttachment

    // Validate fields
    const validation = updateNoteSchema.safeParse(rawInput)
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

    // Update note via service
    // Build update input, only including fields that were provided
    const updateInput: {
      title?: string
      description?: string
      note_date?: string
      removeAttachment?: boolean
    } = {}
    if (validation.data.title !== undefined) updateInput.title = validation.data.title
    if (validation.data.description !== undefined)
      updateInput.description = validation.data.description
    if (validation.data.note_date !== undefined) updateInput.note_date = validation.data.note_date
    if (validation.data.removeAttachment !== undefined)
      updateInput.removeAttachment = validation.data.removeAttachment

    const result = await noteService.updateNote(user.id, noteId, updateInput, fileInput)

    if (!result.success) {
      errorLogger.logWarning('Note update failed', {
        userId: user.id,
        path: `/api/schedule/${instanceId}/notes/${noteId}`,
        metadata: { error: result.error },
      })

      const status = result.error?.includes('Not authorized')
        ? 403
        : result.error?.includes('not found')
          ? 404
          : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    errorLogger.logInfo('Note updated', {
      userId: user.id,
      path: `/api/schedule/${instanceId}/notes/${noteId}`,
    })

    return NextResponse.json({ success: true, note: result.note })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/notes/[noteId]',
      method: 'PATCH',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// DELETE - Delete Note
// =============================================================================

/**
 * DELETE /api/schedule/[instanceId]/notes/[noteId]
 *
 * Delete a note and its S3 attachment (cascade delete)
 * S3 object is deleted FIRST, then the database record
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { instanceId, noteId } = await params

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete note via service (handles S3 cascade delete)
    const result = await noteService.deleteNote(user.id, noteId)

    if (!result.success) {
      errorLogger.logWarning('Note deletion failed', {
        userId: user.id,
        path: `/api/schedule/${instanceId}/notes/${noteId}`,
        metadata: { error: result.error },
      })

      const status = result.error?.includes('Not authorized')
        ? 403
        : result.error?.includes('not found')
          ? 404
          : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    errorLogger.logInfo('Note deleted', {
      userId: user.id,
      path: `/api/schedule/${instanceId}/notes/${noteId}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/[instanceId]/notes/[noteId]',
      method: 'DELETE',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Note Attachment Download URL API
 *
 * GET /api/schedule/notes/[noteId]/attachment - Get presigned S3 download URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { noteService } from '@/lib/services/note-service'

// =============================================================================
// Types
// =============================================================================

interface RouteParams {
  params: Promise<{ noteId: string }>
}

// =============================================================================
// GET - Get Presigned Download URL
// =============================================================================

/**
 * GET /api/schedule/notes/[noteId]/attachment
 *
 * Get a presigned S3 download URL for a note's attachment
 * The URL is valid for 15 minutes
 *
 * Response:
 * {
 *   downloadUrl: string,  // Presigned S3 URL
 *   filename: string,     // Original filename
 *   contentType: string   // MIME type
 * }
 */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { noteId } = await params

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get note to verify ownership and get attachment info
    const note = await noteService.getNoteById(noteId)
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (note.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to access this attachment' }, { status: 403 })
    }

    if (!note.attachment_s3_key) {
      return NextResponse.json({ error: 'Note has no attachment' }, { status: 404 })
    }

    // Get presigned download URL
    const result = await noteService.getAttachmentDownloadUrl(noteId, user.id)

    if (result.error || !result.url) {
      errorLogger.logWarning('Failed to generate attachment download URL', {
        userId: user.id,
        path: `/api/schedule/notes/${noteId}/attachment`,
        metadata: { error: result.error },
      })

      return NextResponse.json({ error: result.error || 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({
      downloadUrl: result.url,
      filename: note.attachment_filename,
      contentType: note.attachment_content_type,
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/schedule/notes/[noteId]/attachment',
      method: 'GET',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

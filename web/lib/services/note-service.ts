/**
 * Note Service
 *
 * Handles business logic for plan instance notes including:
 * - Creating, updating, and deleting notes
 * - Managing file attachments via S3
 * - Validating access and ownership
 * - Cascade delete (S3 first, then DB)
 */

import { createClient } from '@/lib/supabase/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { noteAttachmentService } from './note-attachment-service'
import type { PlanInstanceNote, CreateNoteInput, UpdateNoteInput } from '@/lib/types/training-plan'

// =============================================================================
// Types
// =============================================================================

export interface NoteResult {
  success: boolean
  note?: PlanInstanceNote
  error?: string
}

export interface NotesListResult {
  success: boolean
  notes?: PlanInstanceNote[]
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface FileInput {
  buffer: Buffer
  filename: string
  contentType: string
}

// =============================================================================
// Note Service
// =============================================================================

export class NoteService {
  /**
   * Validate user has access to the plan instance
   */
  async validateAccess(instanceId: string, userId: string): Promise<ValidationResult> {
    const supabase = await createClient()

    const { data: instance, error } = await supabase
      .from('plan_instances')
      .select('id, user_id, status')
      .eq('id', instanceId)
      .single()

    if (error || !instance) {
      return { valid: false, error: 'Plan instance not found' }
    }

    if (instance.user_id !== userId) {
      return { valid: false, error: 'Not authorized to access this plan' }
    }

    return { valid: true }
  }

  /**
   * Create a new note with optional file attachment
   */
  async createNote(
    userId: string,
    instanceId: string,
    input: CreateNoteInput,
    file?: FileInput
  ): Promise<NoteResult> {
    try {
      // Validate access
      const accessResult = await this.validateAccess(instanceId, userId)
      if (!accessResult.valid) {
        return { success: false, error: accessResult.error || 'Access denied' }
      }

      const supabase = await createClient()

      // Prepare note data
      const noteData: {
        plan_instance_id: string
        user_id: string
        title: string
        description: string | null
        note_date: string
        attachment_s3_key: string | null
        attachment_filename: string | null
        attachment_size_bytes: number | null
        attachment_content_type: string | null
      } = {
        plan_instance_id: instanceId,
        user_id: userId,
        title: input.title,
        description: input.description || null,
        note_date: input.note_date,
        attachment_s3_key: null,
        attachment_filename: null,
        attachment_size_bytes: null,
        attachment_content_type: null,
      }

      // Insert the note first to get the ID
      const { data: insertedNote, error: insertError } = await supabase
        .from('plan_instance_notes')
        .insert(noteData)
        .select()
        .single()

      if (insertError || !insertedNote) {
        errorLogger.logError(insertError as Error, {
          userId,
          path: 'NoteService.createNote',
          metadata: { instanceId, input },
        })
        return { success: false, error: insertError?.message || 'Failed to create note' }
      }

      // If there's a file, upload it and update the note
      if (file) {
        const uploadResult = await noteAttachmentService.uploadAttachment(
          userId,
          insertedNote.id,
          file.buffer,
          file.filename,
          file.contentType
        )

        if (uploadResult.success && uploadResult.s3Key) {
          // Update note with attachment info
          const { data: updatedNote, error: updateError } = await supabase
            .from('plan_instance_notes')
            .update({
              attachment_s3_key: uploadResult.s3Key,
              attachment_filename: file.filename,
              attachment_size_bytes: file.buffer.length,
              attachment_content_type: file.contentType,
            })
            .eq('id', insertedNote.id)
            .select()
            .single()

          if (updateError || !updatedNote) {
            // Log warning but don't fail - note was created, attachment failed
            errorLogger.logWarning('Failed to update note with attachment info', {
              userId,
              metadata: { noteId: insertedNote.id, s3Key: uploadResult.s3Key },
            })
            // Return the note without attachment
            return {
              success: true,
              note: insertedNote as PlanInstanceNote,
            }
          }

          return {
            success: true,
            note: updatedNote as PlanInstanceNote,
          }
        } else {
          // Log warning but don't fail - note was created, attachment failed
          errorLogger.logWarning('Failed to upload note attachment', {
            userId,
            metadata: { noteId: insertedNote.id, error: uploadResult.error },
          })
        }
      }

      errorLogger.logInfo('Note created successfully', {
        userId,
        metadata: { noteId: insertedNote.id, instanceId },
      })

      return {
        success: true,
        note: insertedNote as PlanInstanceNote,
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: 'NoteService.createNote',
        metadata: { instanceId, input },
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
      }
    }
  }

  /**
   * Update an existing note
   * If file is provided, it replaces any existing attachment
   * If input.removeAttachment is true, the existing attachment is deleted
   */
  async updateNote(
    userId: string,
    noteId: string,
    input: UpdateNoteInput,
    file?: FileInput
  ): Promise<NoteResult> {
    try {
      // Get existing note to verify ownership and get current attachment
      const existingNote = await this.getNoteById(noteId)
      if (!existingNote) {
        return { success: false, error: 'Note not found' }
      }

      if (existingNote.user_id !== userId) {
        return { success: false, error: 'Not authorized to update this note' }
      }

      const supabase = await createClient()

      // Build update data
      const updateData: Record<string, unknown> = {}
      if (input.title !== undefined) updateData.title = input.title
      if (input.description !== undefined) updateData.description = input.description
      if (input.note_date !== undefined) updateData.note_date = input.note_date

      // Handle attachment removal
      if (input.removeAttachment && existingNote.attachment_s3_key) {
        // Delete existing attachment from S3
        await noteAttachmentService.deleteAttachment(existingNote.attachment_s3_key)
        updateData.attachment_s3_key = null
        updateData.attachment_filename = null
        updateData.attachment_size_bytes = null
        updateData.attachment_content_type = null
      }

      // Handle new file upload
      if (file) {
        // Delete existing attachment if present
        if (existingNote.attachment_s3_key) {
          await noteAttachmentService.deleteAttachment(existingNote.attachment_s3_key)
        }

        // Upload new attachment
        const uploadResult = await noteAttachmentService.uploadAttachment(
          userId,
          noteId,
          file.buffer,
          file.filename,
          file.contentType
        )

        if (uploadResult.success && uploadResult.s3Key) {
          updateData.attachment_s3_key = uploadResult.s3Key
          updateData.attachment_filename = file.filename
          updateData.attachment_size_bytes = file.buffer.length
          updateData.attachment_content_type = file.contentType
        } else {
          errorLogger.logWarning('Failed to upload replacement attachment', {
            userId,
            metadata: { noteId, error: uploadResult.error },
          })
        }
      }

      // Update the note
      const { data: updatedNote, error: updateError } = await supabase
        .from('plan_instance_notes')
        .update(updateData)
        .eq('id', noteId)
        .select()
        .single()

      if (updateError || !updatedNote) {
        return { success: false, error: updateError?.message || 'Failed to update note' }
      }

      errorLogger.logInfo('Note updated successfully', {
        userId,
        metadata: { noteId },
      })

      return {
        success: true,
        note: updatedNote as PlanInstanceNote,
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: 'NoteService.updateNote',
        metadata: { noteId, input },
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update note',
      }
    }
  }

  /**
   * Delete a note and its S3 attachment (CASCADE DELETE)
   * IMPORTANT: Must delete S3 object BEFORE database record
   */
  async deleteNote(userId: string, noteId: string): Promise<DeleteResult> {
    try {
      // 1. Fetch note to verify ownership and get S3 key
      const note = await this.getNoteById(noteId)
      if (!note) {
        return { success: false, error: 'Note not found' }
      }

      if (note.user_id !== userId) {
        return { success: false, error: 'Not authorized to delete this note' }
      }

      // 2. Delete S3 object FIRST (if exists)
      if (note.attachment_s3_key) {
        const s3Result = await noteAttachmentService.deleteAttachment(note.attachment_s3_key)
        if (!s3Result.success) {
          errorLogger.logWarning('Failed to delete S3 attachment during note deletion', {
            userId,
            metadata: { noteId, s3Key: note.attachment_s3_key, error: s3Result.error },
          })
          // Continue with DB deletion even if S3 fails - orphaned S3 objects
          // are preferable to orphaned DB records
        }
      }

      // 3. Delete database record
      const supabase = await createClient()
      const { error } = await supabase.from('plan_instance_notes').delete().eq('id', noteId)

      if (error) {
        errorLogger.logError(error as Error, {
          userId,
          path: 'NoteService.deleteNote',
          metadata: { noteId },
        })
        return { success: false, error: error.message }
      }

      errorLogger.logInfo('Note deleted successfully', {
        userId,
        metadata: { noteId },
      })

      return { success: true }
    } catch (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: 'NoteService.deleteNote',
        metadata: { noteId },
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete note',
      }
    }
  }

  /**
   * List notes for an instance, optionally filtered by date range
   */
  async listNotes(
    instanceId: string,
    startDate?: string,
    endDate?: string
  ): Promise<NotesListResult> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('plan_instance_notes')
        .select('*')
        .eq('plan_instance_id', instanceId)
        .order('note_date', { ascending: true })

      if (startDate) {
        query = query.gte('note_date', startDate)
      }

      if (endDate) {
        query = query.lte('note_date', endDate)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        notes: (data || []) as PlanInstanceNote[],
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'NoteService.listNotes',
        metadata: { instanceId, startDate, endDate },
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list notes',
      }
    }
  }

  /**
   * Get a single note by ID
   */
  async getNoteById(noteId: string): Promise<PlanInstanceNote | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('plan_instance_notes')
        .select('*')
        .eq('id', noteId)
        .single()

      if (error || !data) {
        return null
      }

      return data as PlanInstanceNote
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'NoteService.getNoteById',
        metadata: { noteId },
      })
      return null
    }
  }

  /**
   * Get a presigned download URL for a note's attachment
   */
  async getAttachmentDownloadUrl(
    noteId: string,
    userId: string
  ): Promise<{ url?: string; error?: string }> {
    try {
      // Get note to verify ownership and get S3 key
      const note = await this.getNoteById(noteId)
      if (!note) {
        return { error: 'Note not found' }
      }

      if (note.user_id !== userId) {
        return { error: 'Not authorized to access this attachment' }
      }

      if (!note.attachment_s3_key) {
        return { error: 'Note has no attachment' }
      }

      const result = await noteAttachmentService.getDownloadUrl(note.attachment_s3_key)
      if (!result.success || !result.url) {
        return { error: result.error || 'Failed to generate download URL' }
      }

      return { url: result.url }
    } catch (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: 'NoteService.getAttachmentDownloadUrl',
        metadata: { noteId },
      })
      return { error: 'Failed to generate download URL' }
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Singleton instance of NoteService
 * Use this for all note operations
 */
export const noteService = new NoteService()

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { StickyNote, Paperclip, Upload, X, Loader2, FileText, Download, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { PlanInstanceNote } from '@/lib/types/training-plan'
import {
  NOTE_ATTACHMENT_ALLOWED_EXTENSIONS,
  NOTE_ATTACHMENT_ALLOWED_TYPES,
  NOTE_ATTACHMENT_MAX_SIZE_BYTES,
  formatFileSize,
  isAllowedAttachmentType,
} from '@/lib/types/training-plan'
import { format } from 'date-fns'

// =============================================================================
// Types
// =============================================================================

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit' | 'view'
  instanceId: string
  noteDate: string // YYYY-MM-DD
  existingNote?: PlanInstanceNote
  onSuccess?: (note: PlanInstanceNote) => void
  onDelete?: (noteId: string) => void
}

// =============================================================================
// Component
// =============================================================================

/**
 * NoteDialog Component
 *
 * Modal for creating and editing notes with optional file attachments.
 * Supports:
 * - Create mode: New note with title, description, and optional file
 * - Edit mode: Update existing note, replace/remove attachment
 * - View mode: Read-only view of note with download option
 */
export function NoteDialog({
  open,
  onOpenChange,
  mode,
  instanceId,
  noteDate,
  existingNote,
  onSuccess,
  onDelete,
}: NoteDialogProps) {
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize form when dialog opens or existingNote changes
  useEffect(() => {
    if (open) {
      if (existingNote) {
        setTitle(existingNote.title)
        setDescription(existingNote.description || '')
      } else {
        setTitle('')
        setDescription('')
      }
      setSelectedFile(null)
      setRemoveAttachment(false)
      setError(null)
    }
  }, [open, existingNote])

  // File validation
  const validateFile = (file: File): string | null => {
    if (!isAllowedAttachmentType(file.type)) {
      return `Invalid file type. Allowed: ${NOTE_ATTACHMENT_ALLOWED_EXTENSIONS.join(', ')}`
    }
    if (file.size > NOTE_ATTACHMENT_MAX_SIZE_BYTES) {
      return `File too large. Maximum size: ${formatFileSize(NOTE_ATTACHMENT_MAX_SIZE_BYTES)}`
    }
    return null
  }

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setSelectedFile(file)
    setRemoveAttachment(false)
    setError(null)
  }, [])

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      if (description.trim()) {
        formData.append('description', description.trim())
      }
      formData.append('note_date', noteDate)

      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      if (mode === 'edit' && removeAttachment) {
        formData.append('removeAttachment', 'true')
      }

      const url =
        mode === 'create'
          ? `/api/schedule/${instanceId}/notes`
          : `/api/schedule/${instanceId}/notes/${existingNote?.id}`

      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save note')
      }

      const data = await response.json()
      onSuccess?.(data.note)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!existingNote || !onDelete) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/schedule/${instanceId}/notes/${existingNote.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete note')
      }

      onDelete(existingNote.id)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle download
  const handleDownload = async () => {
    if (!existingNote?.attachment_s3_key) return

    setIsDownloading(true)
    setError(null)

    try {
      const response = await fetch(`/api/schedule/notes/${existingNote.id}/attachment`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to get download URL')
      }

      const data = await response.json()

      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDownloading(false)
    }
  }

  const isViewMode = mode === 'view'
  const hasExistingAttachment = existingNote?.attachment_s3_key && !removeAttachment
  const showAttachmentPreview = selectedFile || hasExistingAttachment

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 rounded-full p-1.5">
              <StickyNote className="h-4 w-4 text-white" />
            </div>
            <DialogTitle>
              {mode === 'create' ? 'Add Note' : mode === 'edit' ? 'Edit Note' : 'View Note'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {format(new Date(noteDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title..."
              maxLength={200}
              disabled={isViewMode || isSubmitting}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter note description..."
              rows={4}
              disabled={isViewMode || isSubmitting}
            />
          </div>

          {/* File Upload / Attachment */}
          <div className="space-y-2">
            <Label>Attachment (optional)</Label>

            {/* Attachment preview */}
            {showAttachmentPreview && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {selectedFile?.name || existingNote?.attachment_filename}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile?.size || existingNote?.attachment_size_bytes || 0)}
                  </div>
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedFile) {
                        setSelectedFile(null)
                      } else {
                        setRemoveAttachment(true)
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {isViewMode && existingNote?.attachment_s3_key && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Drop zone for file upload */}
            {!isViewMode && !showAttachmentPreview && (
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
                  isDragging
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-muted-foreground/25 hover:border-amber-400'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={NOTE_ATTACHMENT_ALLOWED_TYPES.join(',')}
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop a file here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {NOTE_ATTACHMENT_ALLOWED_EXTENSIONS.join(', ')} up to{' '}
                  {formatFileSize(NOTE_ATTACHMENT_MAX_SIZE_BYTES)}
                </p>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {isViewMode ? (
              <>
                {onDelete && existingNote && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4 mr-2" />
                  )}
                  {mode === 'create' ? 'Add Note' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

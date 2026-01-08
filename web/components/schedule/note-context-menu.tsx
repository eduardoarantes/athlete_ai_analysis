'use client'

/**
 * Note Context Menu
 *
 * Right-click context menu for notes on the calendar.
 * Provides edit, delete, and download options.
 */

import { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Pencil, Trash2, Eye, Download, Paperclip } from 'lucide-react'
import type { PlanInstanceNote } from '@/lib/types/training-plan'

interface NoteContextMenuProps {
  children: ReactNode
  note: PlanInstanceNote
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDownload?: () => void
}

export function NoteContextMenu({
  children,
  note,
  onView,
  onEdit,
  onDelete,
  onDownload,
}: NoteContextMenuProps) {
  const hasAttachment = !!note.attachment_s3_key

  // Wrapper to stop propagation so CalendarDayContextMenu doesn't capture the event
  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleView = () => {
    onView?.()
  }

  const handleEdit = () => {
    onEdit?.()
  }

  const handleDelete = () => {
    onDelete?.()
  }

  const handleDownload = () => {
    onDownload?.()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div onContextMenu={handleContextMenu}>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {/* View */}
        <ContextMenuItem onClick={handleView}>
          <Eye className="mr-2 h-4 w-4" />
          View Note
        </ContextMenuItem>

        {/* Edit */}
        <ContextMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Note
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Download attachment - only if has attachment */}
        {hasAttachment && (
          <ContextMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download Attachment
          </ContextMenuItem>
        )}

        {/* Delete */}
        <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Note
        </ContextMenuItem>

        {/* Attachment info */}
        {hasAttachment && (
          <>
            <ContextMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center">
              <Paperclip className="mr-2 h-3 w-3" />
              {note.attachment_filename}
            </div>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

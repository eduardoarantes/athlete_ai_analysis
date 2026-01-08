'use client'

import { StickyNote, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanInstanceNote } from '@/lib/types/training-plan'

// =============================================================================
// Note Card Colors
// =============================================================================

/**
 * Amber/yellow color scheme for notes to distinguish from workout cards
 */
const NOTE_COLORS =
  'bg-amber-100/80 hover:bg-amber-200/80 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700 dark:hover:bg-amber-800/40'

// =============================================================================
// Types
// =============================================================================

interface NoteCardProps {
  note: PlanInstanceNote
  className?: string
  onClick?: () => void
}

// =============================================================================
// Component
// =============================================================================

/**
 * NoteCard Component
 *
 * Displays a note on the calendar with:
 * - Amber/yellow color scheme (distinct from workout colors)
 * - Sticky note icon badge in top-right corner
 * - Title prominently displayed
 * - Description excerpt (2 lines max, truncated)
 * - Paperclip icon if attachment exists
 * - Hover state with ring effect
 */
export function NoteCard({ note, className, onClick }: NoteCardProps) {
  const hasAttachment = !!note.attachment_s3_key

  return (
    <div
      className={cn(
        'rounded-lg border p-2 text-xs relative',
        NOTE_COLORS,
        onClick && 'cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Sticky note icon badge */}
      <div className="absolute -top-1.5 -right-1.5 bg-amber-500 rounded-full p-0.5">
        <StickyNote className="h-3 w-3 text-white" />
      </div>

      {/* Title */}
      <div className="font-medium truncate pr-4" title={note.title}>
        {note.title}
      </div>

      {/* Description excerpt (2 lines max) */}
      {note.description && (
        <div
          className="mt-1 text-amber-800 dark:text-amber-300 line-clamp-2"
          title={note.description}
        >
          {note.description}
        </div>
      )}

      {/* Attachment indicator */}
      {hasAttachment && (
        <div className="flex items-center gap-1 mt-1.5 text-amber-700 dark:text-amber-400">
          <Paperclip className="h-3 w-3" />
          <span className="truncate text-[10px]" title={note.attachment_filename || 'Attachment'}>
            {note.attachment_filename || 'Attachment'}
          </span>
        </div>
      )}
    </div>
  )
}

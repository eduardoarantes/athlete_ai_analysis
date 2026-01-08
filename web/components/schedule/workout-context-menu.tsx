'use client'

/**
 * Workout Context Menu
 *
 * Right-click context menu for scheduled workouts.
 * Provides copy, delete, and view details options.
 */

import { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Copy, Trash2, Eye, Lock, StickyNote } from 'lucide-react'
import { startOfDay, parseISO } from 'date-fns'
import { useScheduleClipboard } from './schedule-clipboard-provider'
import type { Workout } from '@/lib/types/training-plan'

interface WorkoutContextMenuProps {
  children: ReactNode
  instanceId: string
  date: string
  index: number
  workout: Workout
  hasMatch: boolean
  isEditMode: boolean
  onViewDetails?: () => void
  onDelete?: () => void
}

export function WorkoutContextMenu({
  children,
  instanceId,
  date,
  index,
  workout,
  hasMatch,
  isEditMode,
  onViewDetails,
  onDelete,
}: WorkoutContextMenuProps) {
  const { copyWorkout } = useScheduleClipboard()

  // Check if workout is in the past
  const workoutDate = parseISO(date)
  const today = startOfDay(new Date())
  const isPast = workoutDate < today

  const handleCopy = () => {
    copyWorkout(instanceId, date, index, workout)
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete()
    }
  }

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails()
    }
  }

  // Wrapper to stop propagation so CalendarDayContextMenu doesn't capture the event
  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // If not in edit mode, just show view details option
  if (!isEditMode) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div onContextMenu={handleContextMenu}>{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleViewDetails}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div onContextMenu={handleContextMenu}>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleViewDetails}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Copy - always available */}
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </ContextMenuItem>

        {/* Delete - disabled for past dates */}
        <ContextMenuItem
          onClick={handleDelete}
          disabled={isPast}
          className={isPast ? 'opacity-50' : ''}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>

        {/* Info about matched workout */}
        {hasMatch && (
          <>
            <ContextMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center">
              <Lock className="mr-2 h-3 w-3" />
              Has matched activity
            </div>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Calendar Day Context Menu
 *
 * Right-click context menu for calendar day cells.
 * Provides paste option when clipboard has content.
 */

interface CalendarDayContextMenuProps {
  children: ReactNode
  date: string
  isEditMode: boolean
  existingWorkoutsCount: number
  onAddNote?: () => void
}

export function CalendarDayContextMenu({
  children,
  date,
  isEditMode,
  existingWorkoutsCount,
  onAddNote,
}: CalendarDayContextMenuProps) {
  const { copiedWorkout, hasClipboard, pasteWorkout } = useScheduleClipboard()

  // Check if date is in the past
  const dayDate = parseISO(date)
  const today = startOfDay(new Date())
  const isPast = dayDate < today

  const canPaste = hasClipboard && !isPast && isEditMode

  const handlePaste = () => {
    if (copiedWorkout) {
      // Paste at the next available index
      pasteWorkout(date, existingWorkoutsCount)
    }
  }

  const handleAddNote = () => {
    onAddNote?.()
  }

  // Always show context menu when onAddNote is provided (for adding notes)
  // or when there's something to paste
  const showMenu = isEditMode && (onAddNote || hasClipboard)

  // If nothing to show, just render children
  if (!showMenu) {
    return <>{children}</>
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {/* Add Note - always available when callback provided */}
        {onAddNote && (
          <ContextMenuItem onClick={handleAddNote}>
            <StickyNote className="mr-2 h-4 w-4" />
            Add Note
          </ContextMenuItem>
        )}

        {/* Paste - available when clipboard has content */}
        {hasClipboard && (
          <>
            {onAddNote && <ContextMenuSeparator />}
            <ContextMenuItem onClick={handlePaste} disabled={!canPaste}>
              <Copy className="mr-2 h-4 w-4" />
              Paste Workout
            </ContextMenuItem>
          </>
        )}

        {hasClipboard && copiedWorkout && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-t">
            Copied: {copiedWorkout.workout.name}
          </div>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

'use client'

/**
 * Plan Builder Component
 *
 * Main layout component for the custom training plan builder.
 * Combines the workout browser, week calendar grid, and controls.
 *
 * Part of Issue #22: Plan Builder Phase 2 - Core UI
 * Updated in Issue #23: Plan Builder Phase 3 - Drag-and-Drop
 */

import { useState } from 'react'
import { Plus, Undo2, Redo2, Save, AlertCircle, GripVertical } from 'lucide-react'
import type { TrainingPhase, WorkoutLibraryItem } from '@/lib/types/workout-library'
import type { DayOfWeek } from '@/lib/types/plan-builder'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PlanBuilderProvider, usePlanBuilder } from '@/lib/contexts/plan-builder-context'
import { WeekCalendar } from './week-calendar'
import { WorkoutBrowser } from './workout-browser'
import { PlanBuilderDndContext } from './dnd'

/**
 * All available training phases
 */
const TRAINING_PHASES: TrainingPhase[] = [
  'Base',
  'Build',
  'Peak',
  'Recovery',
  'Taper',
  'Foundation',
]

/**
 * Add workout dialog state
 */
interface AddWorkoutDialogState {
  isOpen: boolean
  workout: WorkoutLibraryItem | null
  weekNumber: number
  day: DayOfWeek
}

/**
 * Initial dialog state
 */
const initialDialogState: AddWorkoutDialogState = {
  isOpen: false,
  workout: null,
  weekNumber: 1,
  day: 'monday',
}

/**
 * Plan Builder Inner Component (uses context)
 */
function PlanBuilderInner() {
  const {
    state,
    canUndo,
    canRedo,
    isLoading,
    updateMetadata,
    addWeek,
    removeWeek,
    addWorkout,
    removeWorkout,
    undo,
    redo,
    validate,
    saveNow,
    // publishPlan - available for future use
  } = usePlanBuilder()

  const [addWeekPhase, setAddWeekPhase] = useState<TrainingPhase>('Base')
  const [addWorkoutDialog, setAddWorkoutDialog] =
    useState<AddWorkoutDialogState>(initialDialogState)
  const [selectedWeek] = useState<number | null>(null)
  const [selectedDay] = useState<DayOfWeek>('monday')
  const [isDragMode, setIsDragMode] = useState(true) // Drag mode enabled by default

  // Handle workout selection from browser
  const handleSelectWorkout = (workout: WorkoutLibraryItem) => {
    if (state.weeks.length === 0) {
      // No weeks yet, show dialog to create first week
      return
    }

    // Use selected week or default to last week
    const targetWeek = selectedWeek ?? state.weeks[state.weeks.length - 1]?.weekNumber ?? 1

    setAddWorkoutDialog({
      isOpen: true,
      workout,
      weekNumber: targetWeek,
      day: selectedDay,
    })
  }

  // Confirm adding workout
  const handleConfirmAddWorkout = () => {
    if (addWorkoutDialog.workout) {
      addWorkout(addWorkoutDialog.weekNumber, addWorkoutDialog.day, addWorkoutDialog.workout)
    }
    setAddWorkoutDialog(initialDialogState)
  }

  // Handle week removal
  const handleRemoveWorkout = (weekNumber: number) => (day: DayOfWeek, placementId: string) => {
    removeWorkout(weekNumber, day, placementId)
  }

  // Handle validation
  const handleValidate = () => {
    validate()
    // Result is automatically stored in state via context
  }

  // Show loading state when loading an existing plan
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading plan...</p>
        </div>
      </div>
    )
  }

  return (
    <PlanBuilderDndContext>
      <div className="flex h-full">
        {/* Sidebar - Workout Browser */}
        <aside className="w-80 border-r border-border flex flex-col">
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <WorkoutBrowser
              onSelectWorkout={handleSelectWorkout}
              isDragEnabled={isDragMode}
              className="flex-1"
            />
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header with controls */}
          <header className="border-b border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Plan name"
                  value={state.metadata.name}
                  onChange={(e) => updateMetadata({ name: e.target.value })}
                  className="w-64"
                />
                {state.isSaving ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="animate-pulse">●</span> Saving...
                  </span>
                ) : state.isDirty ? (
                  <span className="text-xs text-muted-foreground">Unsaved changes</span>
                ) : state.lastSavedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Saved {new Date(state.lastSavedAt).toLocaleTimeString()}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isDragMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsDragMode(!isDragMode)}
                  title={isDragMode ? 'Drag mode enabled' : 'Click mode'}
                >
                  <GripVertical className="h-4 w-4 mr-1" />
                  {isDragMode ? 'Drag' : 'Click'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleValidate}>
                  Validate
                </Button>
                <Button
                  onClick={() => saveNow()}
                  disabled={!state.isDirty || state.isSaving || !state.metadata.name}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {state.isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Add week controls */}
            <div className="flex items-center gap-2">
              <Label className="text-sm">Add week:</Label>
              <Select
                value={addWeekPhase}
                onValueChange={(value) => setAddWeekPhase(value as TrainingPhase)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_PHASES.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => addWeek(addWeekPhase)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Week
              </Button>
            </div>
          </header>

          {/* Save error message */}
          {state.saveError && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.saveError}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Validation messages */}
          {(state.validationErrors.length > 0 || state.validationWarnings.length > 0) && (
            <div className="p-4 space-y-2">
              {state.validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {state.validationErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {state.validationWarnings.length > 0 && (
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    <ul className="list-disc list-inside">
                      {state.validationWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Calendar grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {state.weeks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground mb-4">No weeks added yet</p>
                <Button onClick={() => addWeek('Base')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first week
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {state.weeks.map((week) => (
                  <div key={week.id} className="relative group">
                    <WeekCalendar
                      week={week}
                      onRemoveWorkout={handleRemoveWorkout(week.weekNumber)}
                      isDragEnabled={isDragMode}
                      className={cn(
                        selectedWeek === week.weekNumber && 'ring-2 ring-primary rounded-lg'
                      )}
                    />
                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeWeek(week.weekNumber)}
                      >
                        Remove week
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Add workout dialog */}
        <Dialog
          open={addWorkoutDialog.isOpen}
          onOpenChange={(open) => {
            if (!open) setAddWorkoutDialog(initialDialogState)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Workout</DialogTitle>
              <DialogDescription>
                Choose which day to add &quot;{addWorkoutDialog.workout?.name}&quot;
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Week</Label>
                <Select
                  value={String(addWorkoutDialog.weekNumber)}
                  onValueChange={(value) =>
                    setAddWorkoutDialog((prev) => ({ ...prev, weekNumber: parseInt(value, 10) }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.weeks.map((week) => (
                      <SelectItem key={week.id} value={String(week.weekNumber)}>
                        Week {week.weekNumber} ({week.phase})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Day</Label>
                <Select
                  value={addWorkoutDialog.day}
                  onValueChange={(value) =>
                    setAddWorkoutDialog((prev) => ({ ...prev, day: value as DayOfWeek }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddWorkoutDialog(initialDialogState)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmAddWorkout}>Add Workout</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PlanBuilderDndContext>
  )
}

/**
 * Plan Builder Props
 */
interface PlanBuilderProps {
  /** Optional initial plan ID for editing */
  planId?: string
  /** Additional className */
  className?: string
}

/**
 * Plan Builder Component
 *
 * Main entry point for the plan builder. Wraps with context provider.
 */
export function PlanBuilder({ planId, className }: PlanBuilderProps) {
  return (
    <PlanBuilderProvider initialState={planId ? { planId } : undefined}>
      <div className={cn('h-full', className)}>
        <PlanBuilderInner />
      </div>
    </PlanBuilderProvider>
  )
}

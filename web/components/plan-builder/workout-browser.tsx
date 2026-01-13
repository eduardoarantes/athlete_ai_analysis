'use client'

/**
 * Workout Browser Component
 *
 * Displays the workout library with filtering and search.
 * Allows users to drag workouts to the calendar or click to add.
 *
 * Part of Issue #22: Plan Builder Phase 2 - Core UI
 */

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { Search, Filter } from 'lucide-react'
import type {
  WorkoutLibraryItem,
  WorkoutType,
  WorkoutIntensity,
  TrainingPhase,
} from '@/lib/types/workout-library'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkoutLibraryCard, WorkoutLibraryCardSkeleton } from './workout-library-card'
import { DraggableLibraryWorkout } from './dnd'

/**
 * Filter state interface
 */
interface FilterState {
  types: WorkoutType[]
  intensities: WorkoutIntensity[]
  phases: TrainingPhase[]
  search: string
}

/**
 * Initial filter state
 */
const initialFilters: FilterState = {
  types: [],
  intensities: [],
  phases: [],
  search: '',
}

/**
 * Number of items to load per page
 */
const ITEMS_PER_PAGE = 10

/**
 * All workout types
 */
const ALL_WORKOUT_TYPES: WorkoutType[] = [
  'endurance',
  'tempo',
  'sweet_spot',
  'threshold',
  'vo2max',
  'recovery',
  'mixed',
]

/**
 * All intensities
 */
const ALL_INTENSITIES: WorkoutIntensity[] = ['easy', 'moderate', 'hard', 'very_hard']

/**
 * All phases
 */
const ALL_PHASES: TrainingPhase[] = ['Base', 'Build', 'Peak', 'Recovery', 'Taper', 'Foundation']

/**
 * Props for the WorkoutBrowser component
 */
interface WorkoutBrowserProps {
  /** Callback when a workout is selected to add */
  onSelectWorkout?: ((workout: WorkoutLibraryItem) => void) | undefined
  /** Whether workouts are draggable */
  isDragEnabled?: boolean | undefined
  /** Compact mode for sidebar usage */
  compact?: boolean | undefined
  /** Custom workout card renderer (for DnD wrapper in sidebar) */
  renderWorkoutCard?:
    | ((workout: WorkoutLibraryItem, defaultCard: ReactNode) => ReactNode)
    | undefined
  /** Additional className */
  className?: string | undefined
}

/**
 * Fetch workouts from API
 */
async function fetchWorkouts(filters: FilterState): Promise<WorkoutLibraryItem[]> {
  const params = new URLSearchParams()

  filters.types.forEach((t) => params.append('type', t))
  filters.intensities.forEach((i) => params.append('intensity', i))
  filters.phases.forEach((p) => params.append('phase', p))

  if (filters.search.trim()) {
    params.set('search', filters.search.trim())
  }

  const response = await fetch(`/api/workouts?${params.toString()}`)

  if (!response.ok) {
    throw new Error('Failed to fetch workouts')
  }

  const data = await response.json()
  return data.workouts ?? []
}

/**
 * Format type for display
 */
function formatType(type: WorkoutType): string {
  const labels: Record<WorkoutType, string> = {
    endurance: 'Endurance',
    tempo: 'Tempo',
    sweet_spot: 'Sweet Spot',
    threshold: 'Threshold',
    vo2max: 'VO2max',
    recovery: 'Recovery',
    mixed: 'Mixed',
  }
  return labels[type]
}

/**
 * Format intensity for display
 */
function formatIntensity(intensity: WorkoutIntensity): string {
  const labels: Record<WorkoutIntensity, string> = {
    easy: 'Easy',
    moderate: 'Moderate',
    hard: 'Hard',
    very_hard: 'Very Hard',
  }
  return labels[intensity]
}

/**
 * Workout Browser Component
 */
export function WorkoutBrowser({
  onSelectWorkout,
  isDragEnabled = false,
  compact = false,
  renderWorkoutCard,
  className,
}: WorkoutBrowserProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [workouts, setWorkouts] = useState<WorkoutLibraryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }))
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch workouts when filters change
  useEffect(() => {
    let cancelled = false

    async function loadWorkouts() {
      setIsLoading(true)
      setError(null)
      // Reset displayed count when filters change
      setDisplayedCount(ITEMS_PER_PAGE)

      try {
        const data = await fetchWorkouts(filters)
        if (!cancelled) {
          setWorkouts(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workouts')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadWorkouts()

    return () => {
      cancelled = true
    }
  }, [filters])

  // Toggle filter value
  const toggleType = useCallback((type: WorkoutType) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }))
  }, [])

  const toggleIntensity = useCallback((intensity: WorkoutIntensity) => {
    setFilters((prev) => ({
      ...prev,
      intensities: prev.intensities.includes(intensity)
        ? prev.intensities.filter((i) => i !== intensity)
        : [...prev.intensities, intensity],
    }))
  }, [])

  const togglePhase = useCallback((phase: TrainingPhase) => {
    setFilters((prev) => ({
      ...prev,
      phases: prev.phases.includes(phase)
        ? prev.phases.filter((p) => p !== phase)
        : [...prev.phases, phase],
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(initialFilters)
    setSearchInput('')
  }, [])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return filters.types.length + filters.intensities.length + filters.phases.length
  }, [filters])

  // Paginated workouts to display
  const displayedWorkouts = useMemo(() => {
    return workouts.slice(0, displayedCount)
  }, [workouts, displayedCount])

  // Check if there are more workouts to load
  const hasMore = displayedCount < workouts.length

  // Load more workouts
  const loadMore = useCallback(() => {
    setDisplayedCount((prev) => prev + ITEMS_PER_PAGE)
  }, [])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className={cn('flex items-center justify-between', compact ? 'mb-2' : 'mb-4')}>
        <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-lg')}>
          {compact ? 'Library' : 'Workout Library'}
        </h3>
        <span className="text-xs text-muted-foreground">
          {isLoading
            ? '...'
            : hasMore
              ? `${displayedWorkouts.length}/${workouts.length}`
              : workouts.length}
        </span>
      </div>

      {/* Search and Filters */}
      <div className={cn('flex gap-2', compact ? 'mb-2' : 'mb-4')}>
        <div className="relative flex-1">
          <Search
            className={cn(
              'absolute text-muted-foreground',
              compact ? 'left-2 top-2 h-3 w-3' : 'left-2.5 top-2.5 h-4 w-4'
            )}
          />
          <Input
            type="text"
            placeholder={compact ? 'Search...' : 'Search workouts...'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(compact ? 'pl-7 h-8 text-sm' : 'pl-8')}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
            {ALL_WORKOUT_TYPES.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={filters.types.includes(type)}
                onCheckedChange={() => toggleType(type)}
              >
                {formatType(type)}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Intensity</DropdownMenuLabel>
            {ALL_INTENSITIES.map((intensity) => (
              <DropdownMenuCheckboxItem
                key={intensity}
                checked={filters.intensities.includes(intensity)}
                onCheckedChange={() => toggleIntensity(intensity)}
              >
                {formatIntensity(intensity)}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Phase</DropdownMenuLabel>
            {ALL_PHASES.map((phase) => (
              <DropdownMenuCheckboxItem
                key={phase}
                checked={filters.phases.includes(phase)}
                onCheckedChange={() => togglePhase(phase)}
              >
                {phase}
              </DropdownMenuCheckboxItem>
            ))}

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={clearFilters}
                >
                  Clear all filters
                </Button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {filters.types.map((type) => (
            <span
              key={type}
              className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {formatType(type)}
            </span>
          ))}
          {filters.intensities.map((intensity) => (
            <span
              key={intensity}
              className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              {formatIntensity(intensity)}
            </span>
          ))}
          {filters.phases.map((phase) => (
            <span
              key={phase}
              className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
            >
              {phase}
            </span>
          ))}
        </div>
      )}

      {/* Workout list */}
      <div className={cn('flex-1 overflow-y-auto', compact ? 'space-y-1.5' : 'space-y-2')}>
        {isLoading ? (
          <>
            <WorkoutLibraryCardSkeleton />
            <WorkoutLibraryCardSkeleton />
            <WorkoutLibraryCardSkeleton />
            {!compact && <WorkoutLibraryCardSkeleton />}
          </>
        ) : error ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center text-center',
              compact ? 'py-4' : 'py-8'
            )}
          >
            <p className={cn('text-destructive', compact ? 'text-xs' : 'text-sm')}>{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setFilters({ ...filters })}
            >
              Retry
            </Button>
          </div>
        ) : workouts.length === 0 ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center text-center',
              compact ? 'py-4' : 'py-8'
            )}
          >
            <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
              No workouts found
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {displayedWorkouts.map((workout) => {
              // Build the default card
              const defaultCard = isDragEnabled ? (
                <DraggableLibraryWorkout key={workout.id} workout={workout}>
                  <WorkoutLibraryCard
                    workout={workout}
                    onClick={onSelectWorkout ? () => onSelectWorkout(workout) : undefined}
                    isDraggable
                    compact={compact}
                  />
                </DraggableLibraryWorkout>
              ) : (
                <WorkoutLibraryCard
                  key={workout.id}
                  workout={workout}
                  onClick={onSelectWorkout ? () => onSelectWorkout(workout) : undefined}
                  compact={compact}
                />
              )

              // Allow custom rendering (e.g., for schedule sidebar DnD)
              if (renderWorkoutCard) {
                return <div key={workout.id}>{renderWorkoutCard(workout, defaultCard)}</div>
              }

              return defaultCard
            })}

            {/* Load More button */}
            {hasMore && (
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={loadMore}>
                Load more ({workouts.length - displayedCount} remaining)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

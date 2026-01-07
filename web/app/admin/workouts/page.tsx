'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  LayoutGrid,
  List,
} from 'lucide-react'
import type {
  WorkoutLibraryItem,
  WorkoutType,
  WorkoutIntensity,
  TrainingPhase,
} from '@/lib/types/workout-library'
import { WORKOUT_TYPE_COLORS, INTENSITY_LABELS } from '@/lib/types/workout-library'
import { PowerProfileSVG } from '@/components/training/power-profile-svg'
import { getPowerRangeColor } from '@/lib/types/power-zones'

const WORKOUT_TYPES: WorkoutType[] = [
  'endurance',
  'tempo',
  'sweet_spot',
  'threshold',
  'vo2max',
  'recovery',
  'mixed',
]

const INTENSITIES: WorkoutIntensity[] = ['easy', 'moderate', 'hard', 'very_hard']

const PHASES: TrainingPhase[] = ['Base', 'Build', 'Peak', 'Recovery', 'Taper', 'Foundation']

const PAGE_SIZE = 20

type ViewMode = 'table' | 'tiles'

export default function AdminWorkoutsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const workoutIdFromUrl = searchParams.get('id')

  const [workouts, setWorkouts] = useState<WorkoutLibraryItem[]>([])
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<WorkoutType | 'all'>('all')
  const [intensityFilter, setIntensityFilter] = useState<WorkoutIntensity | 'all'>('all')
  const [phaseFilter, setPhaseFilter] = useState<TrainingPhase | 'all'>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Detail modal
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLibraryItem | null>(null)
  const [showJson, setShowJson] = useState(false)

  // Update URL when workout is selected/deselected
  const selectWorkout = useCallback(
    (workout: WorkoutLibraryItem | null) => {
      setSelectedWorkout(workout)
      if (workout) {
        router.push(`/admin/workouts?id=${workout.id}`, { scroll: false })
      } else {
        router.push('/admin/workouts', { scroll: false })
      }
    },
    [router]
  )

  // Fetch workouts from API
  useEffect(() => {
    async function fetchWorkouts() {
      try {
        setLoading(true)
        const response = await fetch('/api/workouts')
        if (!response.ok) {
          throw new Error('Failed to fetch workouts')
        }
        const data = await response.json()
        setWorkouts(data.workouts || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchWorkouts()
  }, [])

  // Open workout from URL on initial load or URL change
  useEffect(() => {
    if (workoutIdFromUrl && workouts.length > 0) {
      const workout = workouts.find((w) => w.id === workoutIdFromUrl)
      if (workout) {
        setSelectedWorkout(workout)
      }
    }
  }, [workoutIdFromUrl, workouts])

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...workouts]

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(searchLower) ||
          w.id.toLowerCase().includes(searchLower) ||
          w.detailed_description?.toLowerCase().includes(searchLower)
      )
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((w) => w.type === typeFilter)
    }

    // Intensity filter
    if (intensityFilter !== 'all') {
      filtered = filtered.filter((w) => w.intensity === intensityFilter)
    }

    // Phase filter
    if (phaseFilter !== 'all') {
      filtered = filtered.filter((w) => w.suitable_phases?.includes(phaseFilter))
    }

    setFilteredWorkouts(filtered)
    setCurrentPage(1)
  }, [workouts, search, typeFilter, intensityFilter, phaseFilter])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  // Pagination calculations
  const totalPages = Math.ceil(filteredWorkouts.length / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedWorkouts = filteredWorkouts.slice(startIndex, startIndex + PAGE_SIZE)

  // Clear all filters
  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setIntensityFilter('all')
    setPhaseFilter('all')
  }

  const hasActiveFilters =
    search || typeFilter !== 'all' || intensityFilter !== 'all' || phaseFilter !== 'all'

  // Format workout type for display
  const formatType = (type: WorkoutType) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workout Library</h1>
          <p className="text-muted-foreground">Browse and search the workout library</p>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <p>Failed to load workout library: {error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workout Library</h1>
        <p className="text-muted-foreground">Browse and search the workout library</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workouts</CardTitle>
          <CardDescription>
            {filteredWorkouts.length} of {workouts.length} workouts
            {hasActiveFilters && ' (filtered)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workouts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as WorkoutType | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {WORKOUT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={intensityFilter}
              onValueChange={(value) => setIntensityFilter(value as WorkoutIntensity | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Intensity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intensities</SelectItem>
                {INTENSITIES.map((intensity) => (
                  <SelectItem key={intensity} value={intensity}>
                    {INTENSITY_LABELS[intensity]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={phaseFilter}
              onValueChange={(value) => setPhaseFilter(value as TrainingPhase | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {PHASES.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            {/* View Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'tiles' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tiles')}
                className="rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Results - Table or Tiles */}
          {viewMode === 'table' ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Intensity</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">TSS</TableHead>
                    <TableHead>Phases</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWorkouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No workouts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedWorkouts.map((workout) => (
                      <TableRow
                        key={workout.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => selectWorkout(workout)}
                      >
                        <TableCell className="font-medium">{workout.name}</TableCell>
                        <TableCell>
                          <Badge className={WORKOUT_TYPE_COLORS[workout.type]} variant="outline">
                            {formatType(workout.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{INTENSITY_LABELS[workout.intensity]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {workout.base_duration_min} min
                        </TableCell>
                        <TableCell className="text-right">{workout.base_tss}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {workout.suitable_phases?.slice(0, 3).map((phase) => (
                              <Badge key={phase} variant="outline" className="text-xs">
                                {phase}
                              </Badge>
                            ))}
                            {workout.suitable_phases && workout.suitable_phases.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{workout.suitable_phases.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Tiles View */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {paginatedWorkouts.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No workouts found
                </div>
              ) : (
                paginatedWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors overflow-hidden"
                    onClick={() => selectWorkout(workout)}
                  >
                    {/* Mini Power Profile */}
                    <div className="bg-muted/30 p-2 border-b">
                      {workout.segments && workout.segments.length > 0 ? (
                        <PowerProfileSVG segments={workout.segments} mini />
                      ) : (
                        <div className="h-[44px] flex items-center justify-center text-xs text-muted-foreground">
                          No segments
                        </div>
                      )}
                    </div>
                    {/* Workout Info */}
                    <div className="p-3 space-y-2">
                      <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                        {workout.name}
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          className={`${WORKOUT_TYPE_COLORS[workout.type]} text-xs`}
                          variant="outline"
                        >
                          {formatType(workout.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{workout.base_duration_min} min</span>
                        <span>TSS {workout.base_tss}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredWorkouts.length)}{' '}
                of {filteredWorkouts.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workout Detail Modal */}
      <Dialog
        open={!!selectedWorkout}
        onOpenChange={() => {
          selectWorkout(null)
          setShowJson(false)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedWorkout && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle>{selectedWorkout.name}</DialogTitle>
                    <DialogDescription className="font-mono text-xs">
                      {selectedWorkout.id}
                    </DialogDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowJson(!showJson)}
                    title={showJson ? 'Show formatted view' : 'Show JSON'}
                    className="shrink-0"
                  >
                    {showJson ? <FileText className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                  </Button>
                </div>
              </DialogHeader>

              {showJson ? (
                <div className="rounded-md border bg-muted/30 p-4 overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedWorkout, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Meta badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={WORKOUT_TYPE_COLORS[selectedWorkout.type]} variant="outline">
                      {formatType(selectedWorkout.type)}
                    </Badge>
                    <Badge variant="secondary">{INTENSITY_LABELS[selectedWorkout.intensity]}</Badge>
                    <Badge variant="outline">{selectedWorkout.base_duration_min} min</Badge>
                    <Badge variant="outline">TSS {selectedWorkout.base_tss}</Badge>
                  </div>

                  {/* Description */}
                  {selectedWorkout.detailed_description && (
                    <div>
                      <h4 className="font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedWorkout.detailed_description}
                      </p>
                    </div>
                  )}

                  {/* Suitable Phases */}
                  {selectedWorkout.suitable_phases &&
                    selectedWorkout.suitable_phases.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Suitable Phases</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedWorkout.suitable_phases.map((phase) => (
                            <Badge key={phase} variant="outline">
                              {phase}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Suitable Weekdays */}
                  {selectedWorkout.suitable_weekdays &&
                    selectedWorkout.suitable_weekdays.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Suitable Days</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedWorkout.suitable_weekdays.map((day) => (
                            <Badge key={day} variant="outline">
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Power Profile Chart */}
                  {selectedWorkout.segments && selectedWorkout.segments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Power Profile</h4>
                      <div className="rounded-md border p-3 bg-muted/30">
                        <PowerProfileSVG segments={selectedWorkout.segments} />
                      </div>
                    </div>
                  )}

                  {/* Segments */}
                  {selectedWorkout.segments && selectedWorkout.segments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Workout Structure</h4>
                      <div className="space-y-3">
                        {selectedWorkout.segments.map((segment, idx) => {
                          // Interval set with work/recovery
                          if (segment.sets && segment.work && segment.recovery) {
                            return (
                              <div
                                key={idx}
                                className="bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-lg p-4"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold px-2.5 py-0.5">
                                    {segment.sets}x
                                  </Badge>
                                  <span className="text-sm text-amber-700 dark:text-amber-400">
                                    Repeat the following set {segment.sets} times:
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {/* Work segment */}
                                  <div className="bg-background rounded-lg overflow-hidden">
                                    <div
                                      className="flex items-center gap-4 p-3 border-l-4"
                                      style={{
                                        borderLeftColor: getPowerRangeColor(
                                          segment.work.power_low_pct,
                                          segment.work.power_high_pct
                                        ),
                                      }}
                                    >
                                      <div className="font-semibold min-w-[70px]">
                                        {segment.work.duration_min} min
                                      </div>
                                      <div
                                        className="font-medium"
                                        style={{
                                          color: getPowerRangeColor(
                                            segment.work.power_low_pct,
                                            segment.work.power_high_pct
                                          ),
                                        }}
                                      >
                                        {segment.work.power_low_pct}-{segment.work.power_high_pct}%
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {segment.work.description || 'Work'}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Recovery segment */}
                                  <div className="bg-background rounded-lg overflow-hidden">
                                    <div
                                      className="flex items-center gap-4 p-3 border-l-4"
                                      style={{
                                        borderLeftColor: getPowerRangeColor(
                                          segment.recovery.power_low_pct,
                                          segment.recovery.power_high_pct
                                        ),
                                      }}
                                    >
                                      <div className="font-semibold min-w-[70px]">
                                        {segment.recovery.duration_min} min
                                      </div>
                                      <div
                                        className="font-medium"
                                        style={{
                                          color: getPowerRangeColor(
                                            segment.recovery.power_low_pct,
                                            segment.recovery.power_high_pct
                                          ),
                                        }}
                                      >
                                        {segment.recovery.power_low_pct}-
                                        {segment.recovery.power_high_pct}%
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {segment.recovery.description || 'Recovery'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Simple segment (warmup, cooldown, steady, etc.)
                          return (
                            <div key={idx} className="bg-muted/30 rounded-lg overflow-hidden">
                              <div
                                className="flex items-center gap-4 p-3 border-l-4"
                                style={{
                                  borderLeftColor: getPowerRangeColor(
                                    segment.power_low_pct ?? 50,
                                    segment.power_high_pct ?? 60
                                  ),
                                }}
                              >
                                <div className="font-semibold min-w-[70px]">
                                  {segment.duration_min} min
                                </div>
                                <div
                                  className="font-medium"
                                  style={{
                                    color: getPowerRangeColor(
                                      segment.power_low_pct ?? 50,
                                      segment.power_high_pct ?? 60
                                    ),
                                  }}
                                >
                                  {segment.power_low_pct && segment.power_high_pct
                                    ? `${segment.power_low_pct}-${segment.power_high_pct}%`
                                    : '-'}
                                </div>
                                <div className="text-sm text-muted-foreground capitalize">
                                  {segment.description || segment.type}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Variable Components */}
                  {selectedWorkout.variable_components && (
                    <div>
                      <h4 className="font-medium mb-1">Variable Components</h4>
                      <p className="text-sm text-muted-foreground">
                        Adjustable: {selectedWorkout.variable_components.adjustable_field} (
                        {selectedWorkout.variable_components.min_value} -{' '}
                        {selectedWorkout.variable_components.max_value})
                        {selectedWorkout.variable_components.tss_per_unit &&
                          ` | TSS per unit: ${selectedWorkout.variable_components.tss_per_unit}`}
                      </p>
                    </div>
                  )}

                  {/* Source Info */}
                  {selectedWorkout.source_file && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Source: {selectedWorkout.source_file}
                      {selectedWorkout.source_format && ` (${selectedWorkout.source_format})`}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

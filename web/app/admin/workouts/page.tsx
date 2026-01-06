'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  WorkoutLibraryItem,
  WorkoutType,
  WorkoutIntensity,
  TrainingPhase,
  LibraryWorkoutSegment,
} from '@/lib/types/workout-library'
import { WORKOUT_TYPE_COLORS, INTENSITY_LABELS } from '@/lib/types/workout-library'

// Types for expanded segments
interface ExpandedSegment {
  type: string
  duration_min: number
  power_low_pct: number
  power_high_pct: number
}

// Expand interval sets into individual segments for visualization
function expandSegments(segments: LibraryWorkoutSegment[]): ExpandedSegment[] {
  const expanded: ExpandedSegment[] = []

  segments.forEach((segment) => {
    if (segment.sets != null && segment.work && segment.recovery) {
      for (let i = 0; i < segment.sets; i++) {
        expanded.push({
          type: 'work',
          duration_min: segment.work.duration_min,
          power_low_pct: segment.work.power_low_pct,
          power_high_pct: segment.work.power_high_pct,
        })
        expanded.push({
          type: 'recovery',
          duration_min: segment.recovery.duration_min,
          power_low_pct: segment.recovery.power_low_pct,
          power_high_pct: segment.recovery.power_high_pct,
        })
      }
    } else {
      expanded.push({
        type: segment.type,
        duration_min: segment.duration_min ?? 0,
        power_low_pct: segment.power_low_pct ?? 50,
        power_high_pct: segment.power_high_pct ?? 60,
      })
    }
  })

  return expanded
}

// Get power zone label from power percentage
function getPowerZone(powerPct: number): string {
  if (powerPct < 56) return 'Z1'
  if (powerPct < 76) return 'Z2'
  if (powerPct < 90) return 'Z3'
  if (powerPct < 105) return 'Z4'
  if (powerPct < 120) return 'Z5'
  return 'Z6'
}

// Get color for segment type
function getSegmentColor(type: string): string {
  const colors: Record<string, string> = {
    warmup: '#94A3B8',
    cooldown: '#94A3B8',
    recovery: '#10B981',
    interval: '#EF4444',
    work: '#EF4444',
    steady: '#10B981',
    tempo: '#F59E0B',
    threshold: '#EF4444',
    vo2max: '#8B5CF6',
  }
  return colors[type] || '#3B82F6'
}

// Power Profile Chart SVG Component
function PowerProfileChart({ segments }: { segments: LibraryWorkoutSegment[] }) {
  const expanded = useMemo(() => expandSegments(segments), [segments])

  if (expanded.length === 0) return null

  const width = 600
  const chartHeight = 170
  const graphHeight = 140
  const topMargin = 20

  const totalDuration = expanded.reduce((sum, seg) => sum + seg.duration_min, 0)

  if (totalDuration === 0) return null

  const getBarHeight = (powerLowPct: number, powerHighPct: number) => {
    const avgPercent = (powerLowPct + powerHighPct) / 2
    const heightPercent = Math.min(200, Math.max(20, avgPercent))
    return (heightPercent / 200) * graphHeight
  }

  // Calculate cumulative offsets for positioning
  const cumulativeOffsets = expanded.reduce<number[]>((acc, _segment, index) => {
    if (index === 0) {
      acc.push(0)
    } else {
      const prevOffset = acc[index - 1] ?? 0
      const prevSegment = expanded[index - 1]
      const prevWidth = prevSegment ? (prevSegment.duration_min / totalDuration) * width : 0
      acc.push(prevOffset + prevWidth)
    }
    return acc
  }, [])

  const bars = expanded.map((segment, index) => {
    const xOffset = cumulativeOffsets[index] ?? 0
    const segmentWidth = (segment.duration_min / totalDuration) * width
    const barHeight = getBarHeight(segment.power_low_pct, segment.power_high_pct)
    const y = topMargin + graphHeight - barHeight
    const color = getSegmentColor(segment.type)
    const avgPowerPct = (segment.power_low_pct + segment.power_high_pct) / 2
    const zone = getPowerZone(avgPowerPct)

    return (
      <g key={index}>
        <rect
          x={xOffset}
          y={y}
          width={segmentWidth}
          height={barHeight}
          fill={color}
          stroke="#fff"
          strokeWidth="1"
        />
        {barHeight > 25 && segmentWidth > 30 && (
          <text
            x={xOffset + segmentWidth / 2}
            y={y + barHeight / 2 + 5}
            fontSize="14"
            fontWeight="bold"
            fill="#fff"
            textAnchor="middle"
          >
            {zone}
          </text>
        )}
      </g>
    )
  })

  const ftpY = topMargin + graphHeight * 0.5
  const gridY1 = topMargin + graphHeight * 0.25
  const gridY2 = topMargin + graphHeight * 0.5
  const gridY3 = topMargin + graphHeight * 0.75

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      <line
        x1="0"
        y1={gridY1}
        x2={width}
        y2={gridY1}
        stroke="#e4e6e8"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1="0"
        y1={gridY2}
        x2={width}
        y2={gridY2}
        stroke="#e4e6e8"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1="0"
        y1={gridY3}
        x2={width}
        y2={gridY3}
        stroke="#e4e6e8"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      {/* FTP line */}
      <line
        x1="0"
        y1={ftpY}
        x2={width}
        y2={ftpY}
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <text x="5" y={ftpY - 5} fontSize="12" fontWeight="bold" fill="hsl(var(--primary))">
        FTP (100%)
      </text>
      {/* Segment bars */}
      {bars}
    </svg>
  )
}

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

export default function AdminWorkoutsPage() {
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

  // Detail modal
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLibraryItem | null>(null)

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
          </div>

          {/* Results Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No workouts found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWorkouts.map((workout) => (
                    <TableRow
                      key={workout.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedWorkout(workout)}
                    >
                      <TableCell className="font-mono text-xs">{workout.id}</TableCell>
                      <TableCell className="font-medium">{workout.name}</TableCell>
                      <TableCell>
                        <Badge className={WORKOUT_TYPE_COLORS[workout.type]} variant="outline">
                          {formatType(workout.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{INTENSITY_LABELS[workout.intensity]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{workout.base_duration_min} min</TableCell>
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
      <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedWorkout && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedWorkout.name}</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  {selectedWorkout.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Meta badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={WORKOUT_TYPE_COLORS[selectedWorkout.type]} variant="outline">
                    {formatType(selectedWorkout.type)}
                  </Badge>
                  <Badge variant="secondary">
                    {INTENSITY_LABELS[selectedWorkout.intensity]}
                  </Badge>
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
                {selectedWorkout.suitable_phases && selectedWorkout.suitable_phases.length > 0 && (
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
                      <PowerProfileChart segments={selectedWorkout.segments} />
                    </div>
                  </div>
                )}

                {/* Segments */}
                {selectedWorkout.segments && selectedWorkout.segments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Workout Segments</h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Power Range</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedWorkout.segments.map((segment, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="capitalize">{segment.type}</TableCell>
                              <TableCell>
                                {segment.sets
                                  ? `${segment.sets} sets`
                                  : segment.duration_min
                                    ? `${segment.duration_min} min`
                                    : '-'}
                              </TableCell>
                              <TableCell>
                                {segment.power_low_pct && segment.power_high_pct
                                  ? `${segment.power_low_pct}-${segment.power_high_pct}%`
                                  : segment.work
                                    ? `${segment.work.power_low_pct}-${segment.work.power_high_pct}%`
                                    : '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {segment.description ||
                                  (segment.work &&
                                    segment.recovery &&
                                    `${segment.work.duration_min}min work / ${segment.recovery.duration_min}min rest`)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

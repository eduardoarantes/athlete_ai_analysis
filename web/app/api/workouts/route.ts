/**
 * Workout Library API
 *
 * GET /api/workouts
 *
 * Returns workouts from the cycling-ai workout library with optional filtering.
 * Public endpoint - no authentication required (workout library is public data).
 *
 * Calls the Python FastAPI backend which has the workout library.
 *
 * Part of Issue #21: Plan Builder Phase 1 - Foundation
 *
 * Query Parameters:
 *   - type: Workout type (endurance, tempo, sweet_spot, threshold, vo2max, recovery, mixed)
 *   - intensity: Intensity level (easy, moderate, hard, very_hard)
 *   - phase: Training phase (Base, Build, Peak, Recovery, Taper, Foundation)
 *   - minDuration: Minimum duration in minutes
 *   - maxDuration: Maximum duration in minutes
 *   - search: Search term for name/description
 *
 * Response:
 *   {
 *     workouts: WorkoutLibraryItem[],
 *     total: number,
 *     filters_applied: {...}
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { validateWorkoutFilters } from '@/lib/utils/workout-filters'
import { invokePythonApi } from '@/lib/services/lambda-client'
import type { WorkoutLibraryResponse } from '@/lib/types/workout-library'

/**
 * GET /api/workouts
 *
 * Returns workout library with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // 1. Validate query parameters
    const { valid, errors, filters } = validateWorkoutFilters(searchParams)

    if (!valid) {
      errorLogger.logWarning('Invalid workout library query parameters', {
        path: '/api/workouts',
        method: 'GET',
        metadata: { errors, query: Object.fromEntries(searchParams) },
      })

      return NextResponse.json({ error: 'Invalid parameters', details: errors }, { status: 400 })
    }

    // 2. Build query string for Python API
    const queryParams = new URLSearchParams()

    if (filters.type) {
      for (const t of filters.type) {
        queryParams.append('type', t)
      }
    }

    if (filters.intensity) {
      for (const i of filters.intensity) {
        queryParams.append('intensity', i)
      }
    }

    if (filters.phase) {
      for (const p of filters.phase) {
        queryParams.append('phase', p)
      }
    }

    if (filters.minDuration !== undefined) {
      queryParams.set('minDuration', filters.minDuration.toString())
    }

    if (filters.maxDuration !== undefined) {
      queryParams.set('maxDuration', filters.maxDuration.toString())
    }

    if (filters.search) {
      queryParams.set('search', filters.search)
    }

    const queryString = queryParams.toString()
    const path = queryString ? `/api/v1/workouts?${queryString}` : '/api/v1/workouts'

    errorLogger.logInfo('Fetching workout library from Python API', {
      path: '/api/workouts',
      method: 'GET',
      metadata: { filters, pythonPath: path },
    })

    // 3. Call Python API
    const response = await invokePythonApi<WorkoutLibraryResponse>({
      method: 'GET',
      path,
    })

    if (response.statusCode !== 200) {
      errorLogger.logWarning('Python API returned error', {
        path: '/api/workouts',
        method: 'GET',
        metadata: { statusCode: response.statusCode, body: response.body },
      })

      return NextResponse.json(
        { error: 'Failed to fetch workout library', details: response.body },
        { status: response.statusCode }
      )
    }

    errorLogger.logInfo('Workout library fetched successfully', {
      path: '/api/workouts',
      method: 'GET',
      metadata: { total: response.body.total, filtersApplied: response.body.filters_applied },
    })

    // 4. Return response with caching headers
    return NextResponse.json(response.body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/workouts',
      method: 'GET',
      metadata: { phase: 'python_api_call' },
    })

    return NextResponse.json({ error: 'Failed to fetch workout library' }, { status: 500 })
  }
}

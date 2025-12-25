/**
 * Workout Library API
 *
 * GET /api/workouts
 *
 * Returns workouts from the cycling-ai workout library with optional filtering.
 * Public endpoint - no authentication required (workout library is public data).
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
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { errorLogger } from '@/lib/monitoring/error-logger'
import { validateWorkoutFilters, buildPythonArgs } from '@/lib/utils/workout-filters'
import type { WorkoutLibraryResponse } from '@/lib/types/workout-library'

const execAsync = promisify(exec)

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

    // 2. Build Python command
    // Path to Python script (relative to project root)
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'get_workout_library.py')
    // Use Python from virtual environment if available, otherwise system Python
    const pythonPath = path.join(process.cwd(), '..', '.venv', 'bin', 'python')

    const args = buildPythonArgs(filters)
    const command = [pythonPath, scriptPath, ...args].join(' ')

    errorLogger.logInfo('Fetching workout library', {
      path: '/api/workouts',
      method: 'GET',
      metadata: { filters },
    })

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large library
    })

    // Check for errors in stderr (Python script writes errors there)
    if (stderr) {
      try {
        const errorData = JSON.parse(stderr)
        if (errorData.error) {
          errorLogger.logWarning('Python script returned error', {
            path: '/api/workouts',
            method: 'GET',
            metadata: { errorData },
          })

          return NextResponse.json(
            { error: errorData.message, details: errorData.details },
            { status: 400 }
          )
        }
      } catch {
        // stderr was not JSON, might be warnings - log but continue
        errorLogger.logInfo('Python script stderr (non-critical)', {
          path: '/api/workouts',
          metadata: { stderr: stderr.substring(0, 500) },
        })
      }
    }

    // 3. Parse Python script output
    const result: WorkoutLibraryResponse = JSON.parse(stdout)

    errorLogger.logInfo('Workout library fetched successfully', {
      path: '/api/workouts',
      method: 'GET',
      metadata: { total: result.total, filtersApplied: result.filters_applied },
    })

    // 4. Return response with caching headers
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    // Handle script execution errors
    const execError = error as Error & { stderr?: string; code?: number }

    // Try to extract structured error from stderr
    if (execError.stderr) {
      try {
        const errorData = JSON.parse(execError.stderr)
        if (errorData.error) {
          errorLogger.logWarning('Python script execution error', {
            path: '/api/workouts',
            method: 'GET',
            metadata: { errorData },
          })

          return NextResponse.json(
            { error: errorData.message, details: errorData.details },
            { status: 400 }
          )
        }
      } catch {
        // stderr was not JSON
      }
    }

    errorLogger.logError(error as Error, {
      path: '/api/workouts',
      method: 'GET',
      metadata: {
        phase: 'script_execution',
        stderr: execError.stderr?.substring(0, 500),
        code: execError.code,
      },
    })

    return NextResponse.json({ error: 'Failed to fetch workout library' }, { status: 500 })
  }
}

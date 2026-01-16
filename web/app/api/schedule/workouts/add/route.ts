/**
 * DEPRECATED: Add Library Workout API
 *
 * POST /api/schedule/workouts/add
 *
 * This endpoint has been deprecated. Use POST /api/manual-workouts instead.
 *
 * The old approach stored library workouts in a MANUAL_WORKOUTS plan instance,
 * which had scalability issues. The new approach uses a dedicated manual_workouts table.
 */

import { NextResponse } from 'next/server'

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated. Use POST /api/manual-workouts instead.',
      new_endpoint: '/api/manual-workouts',
      migration_status: 'This endpoint will be removed in a future version.',
    },
    { status: 410 } // 410 Gone
  )
}

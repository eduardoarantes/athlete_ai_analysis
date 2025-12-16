import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FTPDetectionService } from '@/lib/services/ftp-detection-service'

/**
 * Detect FTP from activity data
 * POST /api/profile/ftp/detect
 *
 * Query parameters:
 * - periodDays: Number of days to look back (default: 90)
 * - minActivities: Minimum activities required (default: 5)
 * - updateProfile: Whether to update profile with detected FTP (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)

    const periodDaysParam = searchParams.get('periodDays')
    const periodDays = periodDaysParam ? parseInt(periodDaysParam, 10) : 90
    if (isNaN(periodDays) || periodDays < 1 || periodDays > 365) {
      return NextResponse.json(
        { error: 'periodDays must be between 1 and 365' },
        { status: 400 }
      )
    }

    const minActivitiesParam = searchParams.get('minActivities')
    const minActivities = minActivitiesParam ? parseInt(minActivitiesParam, 10) : 5
    if (isNaN(minActivities) || minActivities < 1 || minActivities > 100) {
      return NextResponse.json(
        { error: 'minActivities must be between 1 and 100' },
        { status: 400 }
      )
    }

    const updateProfile = searchParams.get('updateProfile') === 'true'

    // Detect FTP
    const ftpService = new FTPDetectionService()
    const result = await ftpService.detectFTP(user.id, {
      periodDays,
      minActivities,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Update profile if requested and FTP was detected
    if (updateProfile && result.estimate && result.estimate.estimatedFTP > 0) {
      const updateResult = await ftpService.updateProfileFTP(
        user.id,
        result.estimate.estimatedFTP
      )

      if (!updateResult.success) {
        return NextResponse.json(
          {
            estimate: result.estimate,
            updated: false,
            error: updateResult.error,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        estimate: result.estimate,
        updated: true,
      })
    }

    return NextResponse.json({
      estimate: result.estimate,
      updated: false,
    })
  } catch (error) {
    console.error('FTP detection error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to detect FTP',
      },
      { status: 500 }
    )
  }
}

/**
 * Get current FTP from profile
 * GET /api/profile/ftp/detect
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ftpService = new FTPDetectionService()
    const result = await ftpService.getCurrentFTP(user.id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ftp: result.ftp })
  } catch (error) {
    console.error('Get FTP error:', error)
    return NextResponse.json(
      { error: 'Failed to get FTP' },
      { status: 500 }
    )
  }
}

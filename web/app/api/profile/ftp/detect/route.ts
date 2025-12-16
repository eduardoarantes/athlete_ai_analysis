import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FTPDetectionService } from '@/lib/services/ftp-detection-service'
import { FTP_DETECTION, HTTP_STATUS, MESSAGES } from '@/lib/constants'

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
      return NextResponse.json(
        { error: MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)

    const periodDaysParam = searchParams.get('periodDays')
    const periodDays = periodDaysParam
      ? parseInt(periodDaysParam, 10)
      : FTP_DETECTION.DEFAULT_PERIOD_DAYS
    if (
      isNaN(periodDays) ||
      periodDays < FTP_DETECTION.MIN_PERIOD_DAYS ||
      periodDays > FTP_DETECTION.MAX_PERIOD_DAYS
    ) {
      return NextResponse.json(
        {
          error: `periodDays must be between ${FTP_DETECTION.MIN_PERIOD_DAYS} and ${FTP_DETECTION.MAX_PERIOD_DAYS}`,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const minActivitiesParam = searchParams.get('minActivities')
    const minActivities = minActivitiesParam
      ? parseInt(minActivitiesParam, 10)
      : FTP_DETECTION.DEFAULT_MIN_ACTIVITIES
    if (
      isNaN(minActivities) ||
      minActivities < FTP_DETECTION.MIN_MIN_ACTIVITIES ||
      minActivities > FTP_DETECTION.MAX_MIN_ACTIVITIES
    ) {
      return NextResponse.json(
        {
          error: `minActivities must be between ${FTP_DETECTION.MIN_MIN_ACTIVITIES} and ${FTP_DETECTION.MAX_MIN_ACTIVITIES}`,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
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
      return NextResponse.json(
        { error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
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
        error: error instanceof Error ? error.message : MESSAGES.FAILED_TO_DETECT_FTP,
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
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
      return NextResponse.json(
        { error: MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const ftpService = new FTPDetectionService()
    const result = await ftpService.getCurrentFTP(user.id)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ ftp: result.ftp })
  } catch (error) {
    console.error('Get FTP error:', error)
    return NextResponse.json(
      { error: MESSAGES.FAILED_TO_GET_FTP },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

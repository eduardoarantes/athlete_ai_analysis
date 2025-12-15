import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FTPDetectionService } from '@/lib/services/ftp-detection-service'

/**
 * Initialize training plan wizard with pre-populated data
 * GET /api/coach/wizard/initialize
 *
 * Returns:
 * - profile: User's current profile data (FTP, weight, max HR)
 * - suggestedFTP: AI-detected FTP from recent activities
 * - experienceLevel: Auto-detected from activity history
 * - recentActivities: Summary of recent training
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

    // Fetch user profile
    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Get AI-suggested FTP from recent activities
    const ftpService = new FTPDetectionService()
    const ftpEstimate = await ftpService.detectFTP(user.id, { periodDays: 90 })

    // Get activity count to determine experience level
    const { count: activityCount } = await supabase
      .from('strava_activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const experienceLevel = determineExperienceLevel(activityCount || 0)

    // Get recent activities summary
    const { data: recentActivities } = await supabase
      .from('strava_activities')
      .select('start_date, distance, moving_time, average_watts')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(10)

    // Type assertion needed because Supabase types need to be regenerated after table name change
    const profileData = profile as {
      ftp?: number | null
      weight_kg?: number | null
      max_hr?: number | null
      age?: number | null
    } | null

    return NextResponse.json({
      profile: {
        ftp: profileData?.ftp ?? 0,
        weight: profileData?.weight_kg ?? 0,
        maxHR: profileData?.max_hr ?? 0,
        age: profileData?.age ?? 0,
      },
      suggestedFTP: ftpEstimate.estimate?.estimatedFTP || null,
      ftpConfidence: ftpEstimate.estimate?.confidence || 'low',
      experienceLevel,
      activityCount: activityCount || 0,
      recentActivities,
    })
  } catch (error) {
    console.error('Wizard initialization error:', error)
    return NextResponse.json(
      {
        error: 'Failed to initialize wizard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function determineExperienceLevel(activityCount: number): string {
  if (activityCount < 20) return 'beginner'
  if (activityCount < 100) return 'intermediate'
  if (activityCount < 300) return 'advanced'
  return 'expert'
}

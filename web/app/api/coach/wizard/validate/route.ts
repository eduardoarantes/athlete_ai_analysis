import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Validate wizard step data
 * POST /api/coach/wizard/validate
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { step, data } = await request.json()

    // Basic validation rules per step
    const errors: string[] = []
    const warnings: string[] = []

    switch (step) {
      case 'goal':
        if (!data.goal && !data.customGoal) {
          errors.push('Please select a goal or describe your own')
        }
        break

      case 'timeline':
        if (!data.timeline) {
          errors.push('Please specify your timeline')
        } else if (data.timeline.hasEvent && !data.timeline.eventDate) {
          errors.push('Please select an event date')
        } else if (!data.timeline.hasEvent && !data.timeline.weeks) {
          errors.push('Please specify training duration')
        }
        // Warn if timeline is very short
        if (data.timeline?.weeks < 8 && data.goal === 'improve-ftp') {
          warnings.push(
            'FTP improvement typically requires at least 8-12 weeks for optimal results'
          )
        }
        break

      case 'profile':
        if (!data.profile?.ftp || data.profile.ftp <= 0) {
          errors.push('Please enter your FTP')
        }
        if (!data.profile?.weight || data.profile.weight <= 0) {
          errors.push('Please enter your weight')
        }
        if (!data.profile?.weeklyHours) {
          errors.push('Please select your weekly training time availability')
        }
        if (data.profile?.daysPerWeek && data.profile.daysPerWeek < 3) {
          warnings.push('Training less than 3 days per week may limit progress')
        }
        break
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      warnings,
    })
  } catch (error) {
    console.error('Validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate' },
      { status: 500 }
    )
  }
}

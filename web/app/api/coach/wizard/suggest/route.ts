import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get AI suggestions for wizard steps
 * POST /api/coach/wizard/suggest
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

    const { step, currentData } = await request.json()

    // TODO: Implement AI-powered suggestions using Python backend
    // For now, return step-specific placeholder suggestions
    const suggestions = {
      goal: 'Based on your training history, improving FTP would be a great goal. Your recent activities show consistent effort!',
      timeline:
        'A 12-week plan is ideal for building sustainable improvements. Consider planning around your schedule.',
      profile: currentData.profile?.ftp
        ? `Your current FTP of ${currentData.profile.ftp}W gives you a power-to-weight ratio to build on. Training 4-5 days per week typically yields the best results.`
        : 'Complete your profile for personalized recommendations.',
      review:
        'Your plan looks great! This balanced approach will help you reach your goals effectively.',
    }

    return NextResponse.json({
      suggestion: suggestions[step as keyof typeof suggestions] || '',
    })
  } catch (error) {
    console.error('Suggestion error:', error)
    return NextResponse.json({ error: 'Failed to get suggestion' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeProfileSchema } from '@/lib/validations/profile'
import type { Database } from '@/lib/types/database'

/**
 * POST /api/profile/create
 * Create a new athlete profile for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user - try session first
    let user = null
    let authError = null

    // First try to get user from session
    const sessionResult = await supabase.auth.getSession()
    if (sessionResult.data.session) {
      user = sessionResult.data.session.user
    } else {
      // Fallback to getUser
      const userResult = await supabase.auth.getUser()
      user = userResult.data.user
      authError = userResult.error
    }

    // Debug logging
    console.log('Auth check:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError?.message,
      userId: user?.id,
      userEmail: user?.email,
      emailConfirmed: user?.email_confirmed_at,
    })

    if (authError || !user) {
      console.error('Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('athlete_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Profile already exists. Use PUT /api/profile to update.' },
        { status: 409 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = completeProfileSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const profileData = validationResult.data

    // Create profile with snake_case field names for database
    const insertData: Database['public']['Tables']['athlete_profiles']['Insert'] = {
      user_id: user.id,
      first_name: profileData.firstName,
      last_name: profileData.lastName,
      age: profileData.age,
      gender: profileData.gender,
      ftp: profileData.ftp,
      max_hr: profileData.maxHr,
      weight_kg: profileData.weightKg,
      goals: profileData.goals,
      preferred_language: profileData.preferredLanguage,
      timezone: profileData.timezone,
      units_system: profileData.unitsSystem,
    }

    const { data: profile, error: createError} = await supabase
      .from('athlete_profiles')
      .insert(insertData)
      .select()
      .single()

    if (createError) {
      console.error('Error creating profile:', createError)
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/profile/create:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

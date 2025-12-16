import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProfileSchema } from '@/lib/validations/profile'
import { mapProfileUpdates } from '@/lib/helpers/profile-mapper'
import { HTTP_STATUS, MESSAGES } from '@/lib/constants'

/**
 * GET /api/profile
 * Fetch the authenticated user's athlete profile
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Fetch athlete profile
    const { data: profile, error: profileError } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // No profile found
        return NextResponse.json(
          { error: MESSAGES.PROFILE_NOT_FOUND },
          { status: HTTP_STATUS.NOT_FOUND }
        )
      }
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { error: MESSAGES.FAILED_TO_FETCH_PROFILE },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Unexpected error in GET /api/profile:', error)
    return NextResponse.json(
      { error: MESSAGES.INTERNAL_SERVER_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * PUT /api/profile
 * Update the authenticated user's athlete profile
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateProfileSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: MESSAGES.VALIDATION_FAILED,
          details: validationResult.error.issues,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Map camelCase to snake_case for database
    // Filter out undefined values to satisfy exactOptionalPropertyTypes
    const cleanedData = Object.fromEntries(
      Object.entries(validationResult.data).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof mapProfileUpdates>[0]
    const updateData = mapProfileUpdates(cleanedData)

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from('athlete_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json(
        { error: MESSAGES.FAILED_TO_UPDATE_PROFILE },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Unexpected error in PUT /api/profile:', error)
    return NextResponse.json(
      { error: MESSAGES.INTERNAL_SERVER_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

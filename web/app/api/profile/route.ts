import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProfileSchema } from '@/lib/validations/profile'
import type { Database } from '@/lib/types/database'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Unexpected error in GET /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateProfileSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Build update object (only include provided fields)
    const updateData: Database['public']['Tables']['athlete_profiles']['Update'] = {}

    if (updates.firstName !== undefined) updateData.first_name = updates.firstName
    if (updates.lastName !== undefined) updateData.last_name = updates.lastName
    if (updates.age !== undefined) updateData.age = updates.age
    if (updates.gender !== undefined) updateData.gender = updates.gender
    if (updates.ftp !== undefined) updateData.ftp = updates.ftp
    if (updates.maxHr !== undefined) updateData.max_hr = updates.maxHr
    if (updates.weightKg !== undefined) updateData.weight_kg = updates.weightKg
    if (updates.goals !== undefined) updateData.goals = updates.goals
    if (updates.preferredLanguage !== undefined)
      updateData.preferred_language = updates.preferredLanguage
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone
    if (updates.unitsSystem !== undefined) updateData.units_system = updates.unitsSystem

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from('athlete_profiles')
      // @ts-ignore - Supabase typing issue with partial updates
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Unexpected error in PUT /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

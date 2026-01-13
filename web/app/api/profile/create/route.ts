import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeProfileSchema } from '@/lib/validations/profile'
import { errorLogger } from '@/lib/monitoring/error-logger'
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

    if (authError || !user) {
      errorLogger.logWarning('Profile create auth failed', {
        path: '/api/profile/create',
        metadata: { hasError: !!authError, errorMessage: authError?.message },
      })
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

    const { data: profile, error: createError } = await supabase
      .from('athlete_profiles')
      .insert(insertData)
      .select()
      .single()

    if (createError) {
      errorLogger.logError(new Error(`Failed to create profile: ${createError.message}`), {
        userId: user.id,
        path: '/api/profile/create',
      })
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    // Create MANUAL_WORKOUTS plan for this user
    // This is a special plan that serves as a container for manually added workouts
    // It is never shown in the UI and can overlap with other plans
    console.log('[DEBUG] Starting MANUAL_WORKOUTS plan creation for user:', user.id)
    const today = new Date().toISOString().split('T')[0]!
    const tenYearsLater = new Date()
    tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10)
    const endDate = tenYearsLater.toISOString().split('T')[0]!
    console.log('[DEBUG] Dates - today:', today, 'endDate:', endDate)

    const planData = {
      athlete_profile: {
        ftp: profileData.ftp,
        weight_kg: profileData.weightKg,
      },
      plan_metadata: {
        total_weeks: 520, // 10 years
        current_ftp: profileData.ftp,
        target_ftp: profileData.ftp,
        type: 'manual_workouts',
      },
      weekly_plan: [], // Workouts will be added here as user drops them
    }

    // Create training plan template
    console.log('[DEBUG] Creating training plan template...')
    const { data: template, error: templateError } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        name: 'MANUAL_WORKOUTS',
        description:
          'System-generated plan for manually added workouts. This plan is never shown in the UI and serves as a container for ad-hoc workout additions.',
        weeks_total: 520,
        plan_data: planData,
        metadata: { type: 'manual_workouts', hidden: true },
        status: 'active',
        goal: '',
        created_from: 'system',
      })
      .select()
      .single()

    if (templateError) {
      console.error('[DEBUG] Failed to create training plan template:', templateError)
      errorLogger.logError(
        new Error(`Failed to create MANUAL_WORKOUTS plan: ${templateError.message}`),
        {
          userId: user.id,
          path: '/api/profile/create',
        }
      )
      // Don't fail profile creation if manual plan fails - user can still use the app
    } else {
      console.log('[DEBUG] Training plan template created:', template.id)
      // Create plan instance
      console.log('[DEBUG] Creating plan instance...')
      const { error: instanceError } = await supabase.from('plan_instances').insert({
        template_id: template.id,
        user_id: user.id,
        name: 'MANUAL_WORKOUTS',
        start_date: today,
        end_date: endDate,
        weeks_total: 520,
        plan_data: planData,
        instance_type: 'manual_workouts',
        status: 'active',
      })

      if (instanceError) {
        console.error('[DEBUG] Failed to create plan instance:', instanceError)
        errorLogger.logError(
          new Error(`Failed to create MANUAL_WORKOUTS instance: ${instanceError.message}`),
          {
            userId: user.id,
            path: '/api/profile/create',
          }
        )
        // Don't fail profile creation if instance creation fails
      } else {
        console.log('[DEBUG] ✅ MANUAL_WORKOUTS plan instance created successfully!')
        errorLogger.logInfo('MANUAL_WORKOUTS plan created', {
          userId: user.id,
          path: '/api/profile/create',
        })
      }
    }

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/profile/create',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

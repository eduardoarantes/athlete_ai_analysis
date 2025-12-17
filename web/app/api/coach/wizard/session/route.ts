import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/coach/wizard/session
 * Load saved wizard session for the current user
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

    // Get the most recent in-progress session
    const { data: session, error } = await supabase
      .from('wizard_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No session found
        return NextResponse.json({ session: null })
      }
      throw error
    }

    return NextResponse.json({
      session: {
        id: session.id,
        wizardData: session.wizard_data,
        currentStep: session.current_step,
        updatedAt: session.updated_at,
      },
    })
  } catch (error) {
    console.error('Load session error:', error)
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 })
  }
}

/**
 * POST /api/coach/wizard/session
 * Save wizard session state
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { wizardData, currentStep, status = 'in_progress' } = await request.json()

    // Check if there's an existing in-progress session
    const { data: existingSession } = await supabase
      .from('wizard_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (existingSession) {
      // Update existing session
      const { data, error } = await supabase
        .from('wizard_sessions')
        .update({
          wizard_data: wizardData,
          current_step: currentStep,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSession.id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        session: {
          id: data.id,
          wizardData: data.wizard_data,
          currentStep: data.current_step,
        },
      })
    } else {
      // Create new session
      const { data, error } = await supabase
        .from('wizard_sessions')
        .insert({
          user_id: user.id,
          wizard_data: wizardData,
          current_step: currentStep,
          status,
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        session: {
          id: data.id,
          wizardData: data.wizard_data,
          currentStep: data.current_step,
        },
      })
    }
  } catch (error) {
    console.error('Save session error:', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}

/**
 * DELETE /api/coach/wizard/session
 * Clear wizard session (mark as completed or abandoned)
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status = 'completed' } = await request.json()

    // Update all in-progress sessions to completed/abandoned
    const { error } = await supabase
      .from('wizard_sessions')
      .update({ status })
      .eq('user_id', user.id)
      .eq('status', 'in_progress')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear session error:', error)
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 })
  }
}

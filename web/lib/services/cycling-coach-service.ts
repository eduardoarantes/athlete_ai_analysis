/**
 * Cycling Coach Service
 * Integrates Next.js web API with Python cycling-ai backend
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'

const execAsync = promisify(exec)

// Configuration
const PYTHON_CLI_PATH = process.env.CYCLING_AI_CLI_PATH || 'cycling-ai'
const TEMP_DATA_DIR = process.env.TEMP_DATA_DIR || '/tmp/cycling-ai-jobs'
const PROJECT_ROOT = process.env.PROJECT_ROOT || '/Users/eduardo/Documents/projects/cycling-ai-analysis'

export interface TrainingPlanParams {
  goal: string
  timeline: {
    hasEvent: boolean
    eventDate?: string
    eventType?: string
    weeks?: number
  }
  profile: {
    ftp: number
    weight: number
    maxHR: number
    weeklyHours: string
    experienceLevel: string
  }
  preferences: {
    daysPerWeek: number
    workoutTypes: string[]
    indoorOnly: boolean
  }
}

export interface JobStatus {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: {
    phase: string
    percentage: number
  }
  result?: any
  error?: string
}

export class CyclingCoachService {
  /**
   * Generate a training plan using the Python backend
   */
  async generateTrainingPlan(userId: string, params: TrainingPlanParams): Promise<JobStatus> {
    try {
      // 1. Create job directory
      const jobId = `plan_${Date.now()}_${userId.slice(0, 8)}`
      const jobDir = join(TEMP_DATA_DIR, jobId)
      await mkdir(jobDir, { recursive: true })

      // 2. Export user data
      const csvPath = await this.exportActivitiesToCSV(userId, jobDir)
      const profilePath = await this.exportUserProfile(userId, params, jobDir)

      // 3. Create job record in database
      const supabase = await createClient()
      const { error } = await supabase
        .from('plan_generation_jobs')
        .insert({
          id: jobId,
          user_id: userId,
          status: 'queued',
          params: params as never,
        } as never)
        .select()
        .single()

      if (error) throw error

      // 4. Execute Python CLI in background
      this.executePlanGeneration(jobId, jobDir, csvPath, profilePath, params)

      return {
        id: jobId,
        status: 'queued',
      }
    } catch (error) {
      throw new Error(`Failed to generate training plan: ${error}`)
    }
  }

  /**
   * Execute the Python CLI command for plan generation (background process)
   */
  private async executePlanGeneration(
    jobId: string,
    jobDir: string,
    _csvPath: string,
    profilePath: string,
    params: TrainingPlanParams
  ): Promise<void> {
    const supabase = await createClient()

    try {
      // Update status to running
      await supabase
        .from('plan_generation_jobs')
        .update({ status: 'running' })
        .eq('id', jobId)

      // Build CLI command
      const weeks = params.timeline.hasEvent
        ? this.calculateWeeksUntilEvent(params.timeline.eventDate!)
        : params.timeline.weeks

      const args = [
        'plan',
        'generate',
        '--profile',
        profilePath,
        '--weeks',
        weeks?.toString() || '12',
        '--target-ftp',
        (params.profile.ftp * 1.05).toString(), // 5% improvement target
        '--output',
        join(jobDir, 'training_plan.json'),
      ]

      // Execute Python CLI
      const pythonProcess = spawn(PYTHON_CLI_PATH, args, {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PYTHONPATH: join(PROJECT_ROOT, 'src'),
        },
      })

      let stdout = ''
      let stderr = ''

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
        // Parse progress updates from Python output
        this.updateJobProgress(jobId, stdout)
      })

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          // Success - read generated plan
          const planPath = join(jobDir, 'training_plan.json')
          const planData = await this.readJSONFile(planPath)

          // Store plan in database
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + (weeks || 12) * 7) // Calculate end date based on weeks

          const { data: plan } = await supabase
            .from('training_plans')
            .insert({
              user_id: jobId.split('_')[2] ?? '', // Extract user_id from jobId pattern
              name: `${params.goal} - ${weeks} weeks`,
              description: `Training plan for ${params.goal}`,
              start_date: new Date().toISOString().split('T')[0] ?? '',
              end_date: endDate.toISOString().split('T')[0] ?? '',
              plan_data: planData as never,
              status: 'active',
            } as never)
            .select()
            .single()

          // Update job status
          await supabase
            .from('plan_generation_jobs')
            .update({
              status: 'completed',
              result: { plan_id: plan?.id, plan_data: planData } as unknown as Record<string, unknown>,
            } as never)
            .eq('id', jobId)
        } else {
          // Failure
          await supabase
            .from('plan_generation_jobs')
            .update({
              status: 'failed',
              error: stderr || 'Python process exited with error',
            })
            .eq('id', jobId)
        }
      })
    } catch (error) {
      // Update job as failed
      await supabase
        .from('plan_generation_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', jobId)
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const supabase = await createClient()

    const { data: job, error } = await supabase
      .from('plan_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) return null

    const result: JobStatus = {
      id: job.id,
      status: job.status as JobStatus['status'],
      result: job.result,
    }

    // Only add optional properties if they have values
    if (job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)) {
      const prog = job.progress as { phase?: string; percentage?: number }
      if (prog.phase && typeof prog.percentage === 'number') {
        result.progress = { phase: prog.phase, percentage: prog.percentage }
      }
    }
    if (job.error) {
      result.error = job.error
    }

    return result
  }

  /**
   * Export user activities to CSV format for Python CLI
   */
  async exportActivitiesToCSV(userId: string, outputDir: string): Promise<string> {
    const supabase = await createClient()

    // Fetch user activities
    const { data: activities, error } = await supabase
      .from('strava_activities')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(500)

    if (error) throw error

    // Convert to CSV format expected by Python CLI
    const csvHeader =
      'Activity Date,Activity Name,Activity Type,Distance,Moving Time,Elapsed Time,Elevation Gain,Average Watts,Weighted Average Watts,Max Watts,Average HR,Max HR\n'

    const csvRows = activities?.map((activity) => {
      return [
        activity.start_date,
        `"${activity.name || 'Ride'}"`,
        activity.sport_type || 'Ride',
        activity.distance || 0,
        activity.moving_time || 0,
        activity.elapsed_time || 0,
        activity.total_elevation_gain || 0,
        activity.average_watts || '',
        activity.weighted_average_watts || '',
        activity.max_watts || '',
        activity.average_heartrate || '',
        activity.max_heartrate || '',
      ].join(',')
    })

    const csvContent = csvHeader + (csvRows?.join('\n') || '')
    const csvPath = join(outputDir, 'activities.csv')

    await writeFile(csvPath, csvContent, 'utf-8')
    return csvPath
  }

  /**
   * Export user profile to JSON format for Python CLI
   */
  async exportUserProfile(
    userId: string,
    params: TrainingPlanParams,
    outputDir: string
  ): Promise<string> {
    const supabase = await createClient()

    // Fetch user profile
    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Create athlete profile JSON
    const athleteProfile = {
      ftp: params.profile.ftp,
      weight_kg: params.profile.weight,
      max_hr: params.profile.maxHR,
      age: profile?.age || 35,
      goals: [params.goal],
      experience_level: params.profile.experienceLevel,
      weekly_hours_available: params.profile.weeklyHours,
      training_days_per_week: params.preferences.daysPerWeek,
      preferred_workout_types: params.preferences.workoutTypes,
      indoor_only: params.preferences.indoorOnly,
    }

    const profilePath = join(outputDir, 'athlete_profile.json')
    await writeFile(profilePath, JSON.stringify(athleteProfile, null, 2), 'utf-8')

    return profilePath
  }

  /**
   * Conversational chat with AI coach
   */
  async chat(userId: string, message: string, sessionId?: string): Promise<{
    reply: string
    sessionId: string
  }> {
    const supabase = await createClient()

    // Get or create chat session
    let session
    if (sessionId) {
      const { data } = await supabase
        .from('coach_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
      session = data
    }

    if (!session) {
      const { data: newSession } = await supabase
        .from('coach_chat_sessions')
        .insert({
          user_id: userId,
          messages: [],
        })
        .select()
        .single()
      session = newSession
    }

    // Export context for AI (activities, profile)
    const currentSessionId = session?.id ?? 'temp'
    const jobDir = join(TEMP_DATA_DIR, `chat_${currentSessionId}`)
    await mkdir(jobDir, { recursive: true })

    const csvPath = await this.exportActivitiesToCSV(userId, jobDir)
    const profilePath = await this.exportUserProfile(userId, {} as TrainingPlanParams, jobDir)

    // Execute Python CLI chat command
    const { stdout } = await execAsync(
      `${PYTHON_CLI_PATH} chat --message "${message}" --session-id "${currentSessionId}" --profile "${profilePath}" --csv "${csvPath}"`,
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PYTHONPATH: join(PROJECT_ROOT, 'src'),
        },
      }
    )

    // Parse AI response from stdout
    const reply = stdout.trim()

    // Update session messages
    const updatedMessages = [
      ...(session?.messages || []),
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]

    if (session?.id) {
      await supabase
        .from('coach_chat_sessions')
        .update({ messages: updatedMessages })
        .eq('id', session.id)
    }

    return {
      reply,
      sessionId: session?.id ?? '',
    }
  }

  // Helper methods
  private async updateJobProgress(jobId: string, stdout: string): Promise<void> {
    // Parse progress from Python output (e.g., "Phase 2: Performance Analysis - 50%")
    const progressMatch = stdout.match(/Phase (\d+): (.+) - (\d+)%/)
    if (progressMatch) {
      const [, , phase, percentage] = progressMatch
      const supabase = await createClient()

      await supabase
        .from('plan_generation_jobs')
        .update({
          progress: {
            phase,
            percentage: parseInt(percentage ?? '0'),
          } as never,
        })
        .eq('id', jobId)
    }
  }

  private calculateWeeksUntilEvent(eventDate: string): number {
    const event = new Date(eventDate)
    const now = new Date()
    const diffTime = Math.abs(event.getTime() - now.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
  }

  private async readJSONFile(path: string): Promise<any> {
    const { readFile } = await import('fs/promises')
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content)
  }
}

// Export singleton instance
export const cyclingCoachService = new CyclingCoachService()

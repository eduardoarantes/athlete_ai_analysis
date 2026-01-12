/**
 * TrainingPeaks API Service
 * Handles OAuth flow and API interactions with TrainingPeaks
 *
 * Credentials are loaded from:
 * 1. Environment variables (local dev)
 * 2. Next.js serverRuntimeConfig (Amplify SSR - embedded at build time)
 *
 * NOTE: After running the migration, regenerate Supabase types:
 * npx supabase gen types typescript --project-id yqaskiwzyhhovthbvmqq --schema public > lib/types/database.ts
 */

import { createClient } from '@/lib/supabase/server'
import getConfig from 'next/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = any

// Get server runtime config (embedded at build time in next.config.ts)
const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} }

export interface TPTokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

export interface TPAthleteProfile {
  Id: string
  FirstName: string
  LastName: string
  Email: string
  IsPremium: boolean
}

export interface TPWorkoutCreateRequest {
  AthleteId: string
  WorkoutDay: string // yyyy-MM-dd format
  WorkoutType: 'Bike' | 'Run' | 'Swim' | 'Strength' | 'XTrain' | 'Other'
  Title?: string
  Description?: string
  TotalTimePlanned?: number // Hours as decimal
  TSSPlanned?: number
  Structure?: string // JSON string of structured workout
  Tags?: string[]
}

export interface TPWorkoutResponse {
  Id: string
  AthleteId: string
  WorkoutDay: string
  Title: string
}

interface TPConnectionRow {
  access_token: string
  refresh_token: string
  expires_at: string
}

export class TrainingPeaksService {
  private clientId: string
  private clientSecret: string
  private readonly redirectUri: string
  private readonly isProduction: boolean

  private get oauthBaseUrl(): string {
    return this.isProduction
      ? 'https://oauth.trainingpeaks.com'
      : 'https://oauth.sandbox.trainingpeaks.com'
  }

  private get apiBaseUrl(): string {
    return this.isProduction
      ? 'https://api.trainingpeaks.com'
      : 'https://api.sandbox.trainingpeaks.com'
  }

  private constructor(
    clientId: string,
    clientSecret: string,
    appUrl: string,
    isProduction: boolean
  ) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.redirectUri = `${appUrl}/api/auth/trainingpeaks/callback`
    this.isProduction = isProduction
  }

  /**
   * Create a TrainingPeaksService instance with credentials
   * Tries: env vars first (local dev), then serverRuntimeConfig (Amplify SSR)
   */
  static async create(): Promise<TrainingPeaksService> {
    // Try environment variables first (local dev)
    let clientId = process.env.TRAININGPEAKS_CLIENT_ID
    let clientSecret = process.env.TRAININGPEAKS_CLIENT_SECRET
    let appUrl = process.env.NEXT_PUBLIC_APP_URL
    let tpEnv = process.env.TRAININGPEAKS_ENV

    // Fall back to serverRuntimeConfig (embedded at build time for Amplify SSR)
    if (!clientId || !clientSecret) {
      clientId = serverRuntimeConfig?.trainingPeaksClientId
      clientSecret = serverRuntimeConfig?.trainingPeaksClientSecret
    }
    if (!appUrl) {
      appUrl = serverRuntimeConfig?.appUrl
    }
    if (!tpEnv) {
      tpEnv = serverRuntimeConfig?.trainingPeaksEnv
    }

    if (!clientId || !clientSecret) {
      throw new Error(
        'TrainingPeaks credentials not configured. ' +
          `TRAININGPEAKS_CLIENT_ID: ${clientId ? 'set' : 'missing'}, ` +
          `TRAININGPEAKS_CLIENT_SECRET: ${clientSecret ? 'set' : 'missing'}`
      )
    }

    if (!appUrl) {
      throw new Error('App URL not configured. NEXT_PUBLIC_APP_URL is missing.')
    }

    const isProduction = tpEnv === 'production'
    return new TrainingPeaksService(clientId, clientSecret, appUrl, isProduction)
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'athlete:profile workouts:plan',
      state,
    })
    return `${this.oauthBaseUrl}/OAuth/Authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TPTokenResponse> {
    const response = await fetch(`${this.oauthBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${await response.text()}`)
    }
    return response.json()
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TPTokenResponse> {
    const response = await fetch(`${this.oauthBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${await response.text()}`)
    }
    return response.json()
  }

  /**
   * Get athlete profile
   */
  async getAthlete(accessToken: string): Promise<TPAthleteProfile> {
    const response = await fetch(`${this.apiBaseUrl}/v1/athlete/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to get athlete: ${await response.text()}`)
    }
    return response.json()
  }

  /**
   * Create a planned workout
   */
  async createPlannedWorkout(
    accessToken: string,
    workout: TPWorkoutCreateRequest
  ): Promise<TPWorkoutResponse> {
    const response = await fetch(`${this.apiBaseUrl}/v2/workouts/plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workout),
    })

    if (!response.ok) {
      throw new Error(`Failed to create workout: ${await response.text()}`)
    }
    return response.json()
  }

  /**
   * Delete a planned workout
   */
  async deletePlannedWorkout(accessToken: string, workoutId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/v2/workouts/plan/${workoutId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete workout: ${await response.text()}`)
    }
  }

  /**
   * Check if an access token is expired or will expire soon (within 5 minutes)
   */
  private isTokenExpired(expiresAt: Date): boolean {
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
    return expiresAt <= fiveMinutesFromNow
  }

  /**
   * Get a valid access token for a user, refreshing if necessary
   * This method handles automatic token refresh and database updates
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const supabase: UntypedSupabaseClient = await createClient()

    // Fetch the current connection from database
    const { data: connection, error } = await supabase
      .from('trainingpeaks_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single()

    if (error || !connection) {
      throw new Error('TrainingPeaks connection not found')
    }

    const expiresAt = new Date(connection.expires_at)

    // If token is still valid, return it
    if (!this.isTokenExpired(expiresAt)) {
      return connection.access_token
    }

    // Token is expired or expiring soon, refresh it
    const tokenResponse = await this.refreshAccessToken(connection.refresh_token)

    // Calculate new expiry time
    const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    // Update the database with new tokens
    const updateData: Partial<TPConnectionRow> = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: newExpiresAt.toISOString(),
    }

    const { error: updateError } = await supabase
      .from('trainingpeaks_connections')
      .update(updateData)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(`Failed to update tokens: ${updateError.message}`)
    }

    return tokenResponse.access_token
  }

  /**
   * Get athlete profile with automatic token refresh
   */
  async getAthleteWithRefresh(userId: string): Promise<TPAthleteProfile> {
    const accessToken = await this.getValidAccessToken(userId)
    return this.getAthlete(accessToken)
  }
}

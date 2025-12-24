/**
 * Strava API Service
 * Handles OAuth flow and API interactions with Strava
 *
 * In Amplify SSR, env vars are written to .env.production during build
 * and embedded into the Next.js server bundle by Next.js.
 */

import { createClient } from '@/lib/supabase/server'

export interface StravaTokenResponse {
  token_type: 'Bearer'
  expires_at: number
  expires_in: number
  refresh_token: string
  access_token: string
  athlete: {
    id: number
    username: string
    firstname: string
    lastname: string
    // ... other athlete fields
  }
}

export interface StravaAthlete {
  id: number
  username: string
  firstname: string
  lastname: string
  city: string
  state: string
  country: string
  sex: string
  premium: boolean
  created_at: string
  updated_at: string
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_watts?: number
  max_watts?: number
  weighted_average_watts?: number
  average_heartrate?: number
  max_heartrate?: number
}

interface StravaConnectionRow {
  access_token: string
  refresh_token: string
  expires_at: string
}

export class StravaService {
  private clientId: string
  private clientSecret: string
  private readonly redirectUri: string

  private constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/strava/callback`
  }

  /**
   * Create a StravaService instance with credentials from environment
   * In Amplify SSR, these are embedded at build time via .env.production
   */
  static async create(): Promise<StravaService> {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error(
        'Strava credentials not configured. ' +
          `STRAVA_CLIENT_ID: ${clientId ? 'set' : 'missing'}, ` +
          `STRAVA_CLIENT_SECRET: ${clientSecret ? 'set' : 'missing'}`
      )
    }

    return new StravaService(clientId, clientSecret)
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all,profile:read_all',
      state,
    })

    return `https://www.strava.com/oauth/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to exchange code for token: ${error}`)
    }

    return response.json()
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to refresh token: ${error}`)
    }

    return response.json()
  }

  /**
   * Get athlete profile
   */
  async getAthlete(accessToken: string): Promise<StravaAthlete> {
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get athlete: ${error}`)
    }

    return response.json()
  }

  /**
   * Get athlete activities
   */
  async getActivities(
    accessToken: string,
    params?: {
      before?: number // epoch timestamp
      after?: number // epoch timestamp
      page?: number
      per_page?: number
    }
  ): Promise<StravaActivity[]> {
    const queryParams = new URLSearchParams()
    if (params?.before) queryParams.set('before', params.before.toString())
    if (params?.after) queryParams.set('after', params.after.toString())
    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.per_page) queryParams.set('per_page', params.per_page.toString())

    const url = `https://www.strava.com/api/v3/athlete/activities?${queryParams.toString()}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get activities: ${error}`)
    }

    return response.json()
  }

  /**
   * Deauthorize application (revoke access)
   */
  async deauthorize(accessToken: string): Promise<void> {
    const response = await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to deauthorize: ${error}`)
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
    const supabase = await createClient()

    // Fetch the current connection from database
    const { data: connection, error } = await supabase
      .from('strava_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single<StravaConnectionRow>()

    if (error || !connection) {
      throw new Error('Strava connection not found')
    }

    const expiresAt = new Date(connection.expires_at)

    // If token is still valid, return it
    if (!this.isTokenExpired(expiresAt)) {
      return connection.access_token
    }

    // Token is expired or expiring soon, refresh it
    const tokenResponse = await this.refreshAccessToken(connection.refresh_token)

    // Update the database with new tokens
    const updateData: Partial<StravaConnectionRow> = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: new Date(tokenResponse.expires_at * 1000).toISOString(),
    }

    const { error: updateError } = await supabase
      .from('strava_connections')
      .update(updateData as never)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(`Failed to update tokens: ${updateError.message}`)
    }

    return tokenResponse.access_token
  }

  /**
   * Get athlete profile with automatic token refresh
   */
  async getAthleteWithRefresh(userId: string): Promise<StravaAthlete> {
    const accessToken = await this.getValidAccessToken(userId)
    return this.getAthlete(accessToken)
  }

  /**
   * Get athlete activities with automatic token refresh
   */
  async getActivitiesWithRefresh(
    userId: string,
    params?: {
      before?: number
      after?: number
      page?: number
      per_page?: number
    }
  ): Promise<StravaActivity[]> {
    const accessToken = await this.getValidAccessToken(userId)
    return this.getActivities(accessToken, params)
  }
}

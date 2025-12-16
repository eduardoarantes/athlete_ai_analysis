/**
 * Strava Activity Sync Service
 * Handles syncing activities from Strava API to local database
 */

import { createClient } from '@/lib/supabase/server'
import { StravaService, type StravaActivity } from './strava-service'
import {
  calculateTSS,
  type ActivityData,
  type AthleteData,
  type TSSResult,
} from './tss-calculation-service'

export interface SyncResult {
  success: boolean
  activitiesSynced: number
  error?: string
}

export interface SyncProgress {
  total: number
  synced: number
  page: number
}

export class StravaSyncService {
  private stravaService: StravaService

  constructor() {
    this.stravaService = new StravaService()
  }

  /**
   * Sync activities from Strava for a user
   * Fetches all activities with pagination and stores them in the database
   */
  async syncActivities(
    userId: string,
    options?: {
      after?: number // Unix timestamp - only sync activities after this date
      perPage?: number // Activities per page (default: 30, max: 200)
      maxPages?: number // Maximum pages to fetch (default: unlimited)
    }
  ): Promise<SyncResult> {
    try {
      // NOTE: sync_status is already set to 'syncing' atomically by the API endpoint
      // to prevent race conditions. We don't set it here.

      const perPage = options?.perPage || 30
      const maxPages = options?.maxPages || Infinity
      let page = 1
      let totalSynced = 0
      let hasMore = true

      while (hasMore && page <= maxPages) {
        // Fetch activities from Strava with automatic token refresh
        const params: {
          after?: number
          page: number
          per_page: number
        } = {
          page,
          per_page: perPage,
        }

        if (options?.after !== undefined) {
          params.after = options.after
        }

        const activities =
          await this.stravaService.getActivitiesWithRefresh(userId, params)

        if (activities.length === 0) {
          hasMore = false
          break
        }

        // Store activities in database
        const stored = await this.storeActivities(userId, activities)
        totalSynced += stored

        // If we got fewer activities than requested, we've reached the end
        if (activities.length < perPage) {
          hasMore = false
        }

        page++
      }

      // Update sync status to 'success'
      await this.updateSyncStatus(userId, 'success', null)

      return {
        success: true,
        activitiesSynced: totalSynced,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Try to update sync status to 'error'
      // Don't throw if this fails to avoid masking the original error
      try {
        await this.updateSyncStatus(userId, 'error', errorMessage)
      } catch (statusError) {
        console.error(
          'Failed to update sync status to error:',
          statusError instanceof Error ? statusError.message : statusError
        )
      }

      return {
        success: false,
        activitiesSynced: 0,
        error: errorMessage,
      }
    }
  }

  /**
   * Fetch athlete profile data for TSS calculation
   */
  private async getAthleteData(userId: string): Promise<AthleteData | null> {
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('athlete_profiles')
      .select('ftp, max_hr, resting_hr, gender')
      .eq('user_id', userId)
      .single<{
        ftp: number | null
        max_hr: number | null
        resting_hr: number | null
        gender: string | null
      }>()

    if (error || !profile) {
      return null
    }

    return {
      ftp: profile.ftp ?? undefined,
      maxHr: profile.max_hr ?? undefined,
      restingHr: profile.resting_hr ?? undefined,
      gender: (profile.gender as AthleteData['gender']) ?? undefined,
    }
  }

  /**
   * Calculate TSS for an activity
   */
  private calculateActivityTSS(
    activity: StravaActivity,
    athleteData: AthleteData | null
  ): TSSResult | null {
    if (!athleteData) {
      return null
    }

    const activityData: ActivityData = {
      movingTimeSeconds: activity.moving_time,
      normalizedPower: activity.weighted_average_watts ?? undefined,
      averageWatts: activity.average_watts ?? undefined,
      averageHeartRate: activity.average_heartrate ?? undefined,
      maxHeartRate: activity.max_heartrate ?? undefined,
    }

    return calculateTSS(activityData, athleteData)
  }

  /**
   * Store activities in the database
   * Uses upsert to handle both new activities and updates
   * Also calculates and stores TSS for each activity
   */
  private async storeActivities(
    userId: string,
    activities: StravaActivity[]
  ): Promise<number> {
    const supabase = await createClient()

    // Fetch athlete data for TSS calculation
    const athleteData = await this.getAthleteData(userId)

    const activityRows = activities.map((activity) => {
      // Calculate TSS for this activity
      const tssResult = this.calculateActivityTSS(activity, athleteData)

      return {
        user_id: userId,
        strava_activity_id: activity.id,
        name: activity.name,
        type: activity.type,
        sport_type: activity.sport_type,
        start_date: activity.start_date,
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        average_watts: activity.average_watts,
        max_watts: activity.max_watts,
        weighted_average_watts: activity.weighted_average_watts,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        raw_data: activity as never, // Store full activity object as JSONB
        tss: tssResult?.tss ?? null,
        tss_method: tssResult?.method ?? null,
      }
    })

    // Upsert activities (insert or update if strava_activity_id already exists)
    const { error, count } = await supabase
      .from('strava_activities')
      .upsert(activityRows as never[], {
        onConflict: 'strava_activity_id',
        count: 'exact',
      })

    if (error) {
      throw new Error(`Failed to store activities: ${error.message}`)
    }

    return count || 0
  }

  /**
   * Update sync status in strava_connections table
   */
  private async updateSyncStatus(
    userId: string,
    status: 'pending' | 'syncing' | 'success' | 'error',
    error: string | null
  ): Promise<void> {
    const supabase = await createClient()

    const updateData: {
      sync_status: string
      sync_error: string | null
      last_sync_at?: string
    } = {
      sync_status: status,
      sync_error: error,
    }

    // Set last_sync_at only on success
    if (status === 'success') {
      updateData.last_sync_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('strava_connections')
      .update(updateData as never)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(`Failed to update sync status: ${updateError.message}`)
    }
  }

  /**
   * Get the last sync time for a user
   */
  async getLastSyncTime(userId: string): Promise<Date | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('strava_connections')
      .select('last_sync_at')
      .eq('user_id', userId)
      .single<{ last_sync_at: string | null }>()

    if (error || !data?.last_sync_at) {
      return null
    }

    return new Date(data.last_sync_at)
  }

  /**
   * Get activity count for a user
   */
  async getActivityCount(userId: string): Promise<number> {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('strava_activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to get activity count: ${error.message}`)
    }

    return count || 0
  }
}

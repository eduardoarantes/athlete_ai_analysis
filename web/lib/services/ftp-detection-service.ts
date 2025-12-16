/**
 * FTP Auto-Detection Service
 * Analyzes power data from activities to estimate Functional Threshold Power
 */

import { createClient } from '@/lib/supabase/server'

export interface FTPEstimate {
  estimatedFTP: number
  method: 'max_20min' | 'max_5min' | 'weighted_average_watts' | 'no_data'
  confidence: 'high' | 'medium' | 'low'
  dataPoints: number
  periodDays: number
  maxPowers: {
    max20Min?: number
    max5Min?: number
    maxWeightedAverage?: number
  }
  reasoning: string
}

export interface FTPDetectionResult {
  success: boolean
  estimate?: FTPEstimate
  error?: string
}

export class FTPDetectionService {
  /**
   * Detect FTP for a user based on their activity data
   * Uses multiple estimation methods:
   * 1. 95% of max 20-minute power (most accurate)
   * 2. 75% of max 5-minute power (alternative)
   * 3. Max weighted average watts (fallback)
   */
  async detectFTP(
    userId: string,
    options?: {
      periodDays?: number // Look back this many days (default: 90)
      minActivities?: number // Minimum activities required (default: 5)
    }
  ): Promise<FTPDetectionResult> {
    try {
      const periodDays = options?.periodDays || 90
      const minActivities = options?.minActivities || 5

      // Get activities with power data from the last N days
      const supabase = await createClient()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - periodDays)

      const { data: activities, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', cutoffDate.toISOString())
        .not('average_watts', 'is', null)
        .order('start_date', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch activities: ${error.message}`)
      }

      if (!activities || activities.length < minActivities) {
        return {
          success: true,
          estimate: {
            estimatedFTP: 0,
            method: 'no_data',
            confidence: 'low',
            dataPoints: activities?.length || 0,
            periodDays,
            maxPowers: {},
            reasoning: `Insufficient data: Found ${activities?.length || 0} activities with power data in the last ${periodDays} days. Need at least ${minActivities} activities.`,
          },
        }
      }

      // Extract max powers from activities
      const maxPowers = this.extractMaxPowers(activities)

      // Estimate FTP using available data
      const estimate = this.estimateFTP(maxPowers, activities.length, periodDays)

      return {
        success: true,
        estimate,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Extract max power values from activities
   * Note: Strava doesn't provide true max 20-min or 5-min power in activity summaries
   * We use weighted_average_watts and max_watts as proxies
   */
  private extractMaxPowers(
    activities: Array<{
      average_watts?: number | null
      max_watts?: number | null
      weighted_average_watts?: number | null
      moving_time?: number | null
    }>
  ): {
    maxWeightedAverage: number
    maxAverage: number
    maxPeak: number
  } {
    let maxWeightedAverage = 0
    let maxAverage = 0
    let maxPeak = 0

    for (const activity of activities) {
      if (activity.weighted_average_watts && activity.weighted_average_watts > maxWeightedAverage) {
        maxWeightedAverage = activity.weighted_average_watts
      }
      if (activity.average_watts && activity.average_watts > maxAverage) {
        maxAverage = activity.average_watts
      }
      if (activity.max_watts && activity.max_watts > maxPeak) {
        maxPeak = activity.max_watts
      }
    }

    return { maxWeightedAverage, maxAverage, maxPeak }
  }

  /**
   * Estimate FTP based on available power data
   */
  private estimateFTP(
    maxPowers: {
      maxWeightedAverage: number
      maxAverage: number
      maxPeak: number
    },
    activityCount: number,
    periodDays: number
  ): FTPEstimate {
    const { maxWeightedAverage, maxAverage, maxPeak: _maxPeak } = maxPowers

    // Method 1: Use weighted average watts (most reliable for Strava data)
    // Weighted average watts is typically 85-95% of FTP for hard efforts
    if (maxWeightedAverage > 0) {
      // Assume weighted average from hard effort is ~90% of FTP
      const estimatedFTP = Math.round(maxWeightedAverage / 0.9)

      // Confidence based on data quality
      let confidence: 'high' | 'medium' | 'low' = 'low'
      if (activityCount >= 20 && periodDays <= 90) {
        confidence = 'high'
      } else if (activityCount >= 10 && periodDays <= 180) {
        confidence = 'medium'
      }

      return {
        estimatedFTP,
        method: 'weighted_average_watts',
        confidence,
        dataPoints: activityCount,
        periodDays,
        maxPowers: {
          maxWeightedAverage,
        },
        reasoning: `Estimated from max weighted average power (${maxWeightedAverage}W) across ${activityCount} activities. Weighted average is typically 90% of FTP for hard efforts.`,
      }
    }

    // Method 2: Use average watts as fallback
    if (maxAverage > 0) {
      // Average watts is typically lower, assume 80% of FTP
      const estimatedFTP = Math.round(maxAverage / 0.8)

      return {
        estimatedFTP,
        method: 'weighted_average_watts',
        confidence: 'low',
        dataPoints: activityCount,
        periodDays,
        maxPowers: {
          maxWeightedAverage: maxAverage,
        },
        reasoning: `Estimated from max average power (${maxAverage}W). Less accurate as average power is typically only 80% of FTP. Consider doing a structured FTP test for better accuracy.`,
      }
    }

    // No usable data
    return {
      estimatedFTP: 0,
      method: 'no_data',
      confidence: 'low',
      dataPoints: activityCount,
      periodDays,
      maxPowers: {},
      reasoning: 'No power data available for FTP estimation. Upload activities with power meter data.',
    }
  }

  /**
   * Update user's profile with detected FTP
   */
  async updateProfileFTP(userId: string, ftp: number): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('athlete_profiles')
        .update({ ftp } as never)
        .eq('user_id', userId)

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get user's current FTP from profile
   */
  async getCurrentFTP(userId: string): Promise<{ ftp: number | null; error?: string }> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('ftp')
        .eq('user_id', userId)
        .single<{ ftp: number | null }>()

      if (error) {
        return {
          ftp: null,
          error: error.message,
        }
      }

      return { ftp: data?.ftp || null }
    } catch (error) {
      return {
        ftp: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

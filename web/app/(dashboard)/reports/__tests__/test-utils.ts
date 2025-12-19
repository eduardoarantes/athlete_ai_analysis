/**
 * Reports Test Utilities
 *
 * Shared mocks and helpers for reports page tests.
 */

import { vi } from 'vitest'

/**
 * Mock report data for list page
 */
export const mockCompletedReport = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  report_type: 'performance',
  status: 'completed',
  period_start: '2024-06-01',
  period_end: '2024-12-01',
  created_at: '2024-12-01T10:00:00Z',
  completed_at: '2024-12-01T10:05:00Z',
  error_message: null,
  report_data: {
    activities_analyzed: 50,
    performance_analysis: {
      ai_insights: {
        summary: 'Your cycling performance has improved significantly over the past 6 months.',
        training_focus: 'Endurance Building',
      },
    },
  },
}

export const mockProcessingReport = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  report_type: 'performance',
  status: 'processing',
  period_start: '2024-06-01',
  period_end: '2024-12-01',
  created_at: '2024-12-15T10:00:00Z',
  completed_at: null,
  error_message: null,
  report_data: null,
}

export const mockFailedReport = {
  id: '323e4567-e89b-12d3-a456-426614174002',
  report_type: 'performance',
  status: 'failed',
  period_start: '2024-06-01',
  period_end: '2024-12-01',
  created_at: '2024-12-10T10:00:00Z',
  completed_at: null,
  error_message: 'Insufficient data for analysis',
  report_data: null,
}

/**
 * Mock detailed report data for detail page
 */
export const mockDetailedReport = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  report_type: 'performance',
  status: 'completed',
  period_start: '2024-06-01',
  period_end: '2024-12-01',
  created_at: '2024-12-01T10:00:00Z',
  completed_at: '2024-12-01T10:05:00Z',
  error_message: null,
  report_data: {
    activities_analyzed: 50,
    ai_metadata: {
      ai_provider: 'anthropic',
      ai_model: 'claude-3-sonnet',
    },
    performance_analysis: {
      athlete_profile: {
        name: 'Test Athlete',
        age: 35,
        weight_kg: 75,
        ftp: 280,
        power_to_weight: 3.73,
        max_hr: 185,
      },
      period_months: 6,
      recent_period: {
        period: 'Sep-Dec 2024',
        total_rides: 48,
        total_distance_km: 2400,
        total_time_hours: 80,
        total_elevation_m: 25000,
        avg_power: 185,
        avg_hr: 142,
        rides_per_week: 4,
      },
      previous_period: {
        period: 'Mar-Aug 2024',
        total_rides: 40,
        total_distance_km: 1800,
        total_time_hours: 60,
        total_elevation_m: 18000,
        avg_power: 170,
        avg_hr: 148,
        rides_per_week: 3.3,
      },
      trends: {
        distance_change_pct: 33.3,
        time_change_pct: 33.3,
        elevation_change_pct: 38.9,
        power_change_pct: 8.8,
        hr_change_pct: -4.1,
        frequency_change_pct: 21.2,
      },
      ai_insights: {
        summary: 'Your cycling performance has improved significantly over the past 6 months.',
        key_findings: [
          'FTP increased from 260W to 280W (+7.7%)',
          'Training volume increased by 33%',
          'Better aerobic efficiency (lower HR at same power)',
        ],
        strengths: [
          'Consistent training frequency',
          'Good power development',
          'Improving endurance capacity',
        ],
        areas_for_improvement: [
          'High intensity work could be increased',
          'Recovery rides need more focus',
        ],
        recommendations: {
          short_term: ['Add one VO2max session per week', 'Maintain current volume'],
          long_term: ['Target FTP of 300W by summer', 'Build towards century event'],
        },
        training_focus: 'Endurance Building',
      },
    },
  },
}

/**
 * Create mock translation function
 */
export const createMockTranslations = () => {
  return vi.fn((key: string, params?: Record<string, unknown>) => {
    // Handle interpolation
    if (params) {
      let result = key
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v))
      })
      return result
    }
    return key
  })
}

/**
 * Create mock Supabase client for reports
 */
export const createMockSupabaseClient = (options: {
  reports?: unknown[]
  singleReport?: unknown
  error?: Error | null
}) => {
  const mockSelect = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({
      data: options.reports ?? [],
      error: options.error ?? null,
    }),
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: options.singleReport ?? null,
        error: options.error ?? null,
      }),
    }),
  })

  return {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
    }),
  }
}

/**
 * Create mock router
 */
export const createMockRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
})

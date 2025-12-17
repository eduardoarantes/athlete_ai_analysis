/**
 * Admin API Test Utilities
 *
 * Shared mocks and helpers for admin API route tests.
 */

import { vi } from 'vitest'

/**
 * Mock admin user data matching AdminUserRow structure
 */
export const mockAdminUserRow = {
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  role: 'user',
  account_created_at: '2024-01-01T00:00:00Z',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  last_sign_in_at: '2024-12-01T00:00:00Z',
  subscription_plan_id: 'plan-123',
  plan_name: 'pro',
  plan_display_name: 'Pro',
  subscription_status: 'active',
  subscription_started_at: '2024-01-01T00:00:00Z',
  subscription_ends_at: null,
  strava_connected: true,
  strava_last_sync_at: '2024-12-01T00:00:00Z',
  strava_sync_status: 'success',
  strava_sync_error: null,
  profile_exists: true,
  first_name: 'Test',
  last_name: 'User',
  preferred_language: 'en',
  timezone: 'America/New_York',
  units_system: 'metric',
  total_activities: 100,
  total_training_plans: 5,
  total_reports: 10,
}

/**
 * Mock admin stats row matching AdminStatsRow structure
 */
export const mockAdminStatsRow = {
  total_users: 1000,
  users_last_7_days: 50,
  users_last_30_days: 200,
  active_users_7_days: 300,
  active_users_30_days: 600,
  active_subscriptions: 400,
  suspended_subscriptions: 10,
  cancelled_subscriptions: 50,
  expired_subscriptions: 20,
  free_plan_users: 600,
  pro_plan_users: 300,
  team_plan_users: 100,
  total_strava_connections: 800,
  successful_syncs: 750,
  failed_syncs: 50,
  syncs_last_24h: 200,
  total_profiles_created: 950,
  total_activities: 50000,
  activities_last_7_days: 1000,
  activities_last_30_days: 5000,
  total_training_plans: 2000,
  active_training_plans: 500,
  total_reports: 3000,
  completed_reports: 2800,
  failed_reports: 200,
}

/**
 * Create a mock admin auth result
 */
export const createMockAuthResult = (
  authorized: boolean,
  userId: string | null = 'admin-user-id',
  role: string | null = 'admin'
) => ({
  authorized,
  userId,
  role,
  ...(authorized ? {} : { error: 'Admin role required' }),
})

/**
 * Create a mock Supabase client for admin API tests
 */
export const createMockSupabaseClient = (options: {
  rpcResult?: unknown
  rpcError?: Error | null
  selectResult?: unknown
  selectError?: Error | null
  updateResult?: unknown
  updateError?: Error | null
}) => {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: options.selectResult ?? { id: 'plan-123' },
          error: options.selectError ?? null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: options.updateResult ?? null,
        error: options.updateError ?? null,
      }),
    }),
  })

  return {
    rpc: vi.fn().mockResolvedValue({
      data: options.rpcResult ?? null,
      error: options.rpcError ?? null,
    }),
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'admin-user-id',
            email: 'admin@example.com',
            user_metadata: { role: 'admin' },
          },
        },
        error: null,
      }),
    },
  }
}

/**
 * Create a mock NextRequest
 */
export const createMockRequest = (url: string, options?: { method?: string; body?: unknown }) => {
  return {
    url,
    method: options?.method ?? 'GET',
    json: vi.fn().mockResolvedValue(options?.body ?? {}),
  }
}

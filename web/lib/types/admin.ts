/**
 * Admin System Types
 *
 * Type definitions for admin dashboard and user management.
 * These types match the database views created in migration 20251217000002.
 *
 * PRIVACY: These types expose NO sensitive user data (FTP, weight, HR, goals, activity details).
 */

import type { SubscriptionStatus } from './subscription'

/**
 * User role
 */
export type UserRole = 'user' | 'admin'

/**
 * Raw database row from admin_user_view / get_admin_user_by_id function
 * This matches the flat column structure returned by the database
 */
export interface AdminUserRow {
  user_id: string
  email: string
  role: string | null
  account_created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  subscription_plan_id: string | null
  plan_name: string | null
  plan_display_name: string | null
  subscription_status: string | null
  subscription_started_at: string | null
  subscription_ends_at: string | null
  strava_connected: boolean
  strava_last_sync_at: string | null
  strava_sync_status: string | null
  strava_sync_error: string | null
  profile_exists: boolean
  first_name: string | null
  last_name: string | null
  preferred_language: string | null
  timezone: string | null
  units_system: string | null
  total_activities: number
  total_training_plans: number
  total_reports: number
}

/**
 * Admin user view data (privacy-safe) - transformed for better DX
 */
export interface AdminUser {
  // User identity
  user_id: string
  email: string
  role: UserRole

  // Account dates
  account_created_at: string // ISO timestamp
  email_confirmed_at: string | null // ISO timestamp
  last_sign_in_at: string | null // ISO timestamp

  // Subscription information
  subscription: {
    plan_id: string | null
    plan_name: string | null
    plan_display_name: string | null
    status: SubscriptionStatus | null
    started_at: string | null // ISO timestamp
    ends_at: string | null // ISO timestamp
  }

  // Strava connection (NO TOKENS)
  strava: {
    connected: boolean
    last_sync_at: string | null // ISO timestamp
    sync_status: string | null // 'pending' | 'syncing' | 'success' | 'error'
    sync_error: string | null
  }

  // Profile status (NO SENSITIVE DATA)
  profile: {
    exists: boolean
    first_name: string | null
    last_name: string | null
    preferred_language: string | null
    timezone: string | null
    units_system: string | null
  }

  // Aggregate counts (NOT detail data)
  counts: {
    total_activities: number
    total_training_plans: number
    total_reports: number
  }
}

/**
 * Transform a flat database row to the nested AdminUser structure
 */
export function transformAdminUserRow(row: AdminUserRow): AdminUser {
  return {
    user_id: row.user_id,
    email: row.email,
    role: (row.role as UserRole) || 'user',
    account_created_at: row.account_created_at,
    email_confirmed_at: row.email_confirmed_at,
    last_sign_in_at: row.last_sign_in_at,
    subscription: {
      plan_id: row.subscription_plan_id,
      plan_name: row.plan_name,
      plan_display_name: row.plan_display_name,
      status: row.subscription_status as SubscriptionStatus | null,
      started_at: row.subscription_started_at,
      ends_at: row.subscription_ends_at,
    },
    strava: {
      connected: row.strava_connected,
      last_sync_at: row.strava_last_sync_at,
      sync_status: row.strava_sync_status,
      sync_error: row.strava_sync_error,
    },
    profile: {
      exists: row.profile_exists,
      first_name: row.first_name,
      last_name: row.last_name,
      preferred_language: row.preferred_language,
      timezone: row.timezone,
      units_system: row.units_system,
    },
    counts: {
      total_activities: Number(row.total_activities) || 0,
      total_training_plans: Number(row.total_training_plans) || 0,
      total_reports: Number(row.total_reports) || 0,
    },
  }
}

/**
 * Transform an array of database rows to AdminUser array
 */
export function transformAdminUserRows(rows: AdminUserRow[]): AdminUser[] {
  return rows.map(transformAdminUserRow)
}

/**
 * Raw database row from admin_stats_view / get_admin_stats function
 * This matches the flat column structure returned by the database
 */
export interface AdminStatsRow {
  total_users: number
  users_last_7_days: number
  users_last_30_days: number
  active_users_7_days: number
  active_users_30_days: number
  active_subscriptions: number
  suspended_subscriptions: number
  cancelled_subscriptions: number
  expired_subscriptions: number
  free_plan_users: number
  pro_plan_users: number
  team_plan_users: number
  total_strava_connections: number
  successful_syncs: number
  failed_syncs: number
  syncs_last_24h: number
  total_profiles_created: number
  total_activities: number
  activities_last_7_days: number
  activities_last_30_days: number
  total_training_plans: number
  active_training_plans: number
  total_reports: number
  completed_reports: number
  failed_reports: number
}

/**
 * Platform statistics for admin dashboard
 */
export interface AdminStats {
  // User statistics
  users: {
    total: number
    last_7_days: number
    last_30_days: number
    active_7_days: number
    active_30_days: number
  }

  // Subscription statistics
  subscriptions: {
    active: number
    suspended: number
    cancelled: number
    expired: number
    by_plan: {
      free: number
      pro: number
      team: number
    }
  }

  // Strava statistics
  strava: {
    total_connections: number
    successful_syncs: number
    failed_syncs: number
    syncs_last_24h: number
  }

  // Content statistics
  content: {
    total_profiles: number
    total_activities: number
    activities_last_7_days: number
    activities_last_30_days: number
    total_training_plans: number
    active_training_plans: number
    total_reports: number
    completed_reports: number
    failed_reports: number
  }
}

/**
 * Transform a flat database row to the nested AdminStats structure
 */
export function transformAdminStatsRow(row: AdminStatsRow): AdminStats {
  return {
    users: {
      total: Number(row.total_users) || 0,
      last_7_days: Number(row.users_last_7_days) || 0,
      last_30_days: Number(row.users_last_30_days) || 0,
      active_7_days: Number(row.active_users_7_days) || 0,
      active_30_days: Number(row.active_users_30_days) || 0,
    },
    subscriptions: {
      active: Number(row.active_subscriptions) || 0,
      suspended: Number(row.suspended_subscriptions) || 0,
      cancelled: Number(row.cancelled_subscriptions) || 0,
      expired: Number(row.expired_subscriptions) || 0,
      by_plan: {
        free: Number(row.free_plan_users) || 0,
        pro: Number(row.pro_plan_users) || 0,
        team: Number(row.team_plan_users) || 0,
      },
    },
    strava: {
      total_connections: Number(row.total_strava_connections) || 0,
      successful_syncs: Number(row.successful_syncs) || 0,
      failed_syncs: Number(row.failed_syncs) || 0,
      syncs_last_24h: Number(row.syncs_last_24h) || 0,
    },
    content: {
      total_profiles: Number(row.total_profiles_created) || 0,
      total_activities: Number(row.total_activities) || 0,
      activities_last_7_days: Number(row.activities_last_7_days) || 0,
      activities_last_30_days: Number(row.activities_last_30_days) || 0,
      total_training_plans: Number(row.total_training_plans) || 0,
      active_training_plans: Number(row.active_training_plans) || 0,
      total_reports: Number(row.total_reports) || 0,
      completed_reports: Number(row.completed_reports) || 0,
      failed_reports: Number(row.failed_reports) || 0,
    },
  }
}

/**
 * Admin user list filters
 */
export interface AdminUserFilters {
  search?: string // Email or name search
  role?: UserRole
  subscription?: string // Plan name (e.g., 'free', 'pro')
  strava?: boolean // Has Strava connection
}

/**
 * Pagination for admin user list
 */
export interface AdminUserPagination {
  limit: number
  offset: number
  total?: number // Total count (if available)
}

/**
 * Admin user query result
 */
export interface AdminUserQueryResult {
  users: AdminUser[]
  pagination: AdminUserPagination
}

/**
 * Admin user update request
 */
export interface AdminUserUpdate {
  user_id: string
  role?: UserRole
  subscription?: {
    plan_id: string
    status?: SubscriptionStatus
    ends_at?: string | null
  }
}

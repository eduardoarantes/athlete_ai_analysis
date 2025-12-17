/**
 * Subscription System Types
 *
 * Type definitions for subscription plans and user subscriptions.
 * These types match the database schema created in migration 20251217000001.
 */

/**
 * Subscription plan definition
 */
export interface SubscriptionPlan {
  id: string
  name: string // Slug: 'free', 'pro', 'team'
  display_name: string // Display: 'Free', 'Pro', 'Team'
  description: string | null
  features: string[] // Array of feature descriptions
  limits: SubscriptionLimits // Limit configuration
  price_monthly_cents: number // Price in cents (0 for free)
  is_active: boolean
  sort_order: number
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

/**
 * Subscription plan limits
 * -1 means unlimited
 */
export interface SubscriptionLimits {
  max_activities?: number
  max_training_plans?: number
  max_reports?: number
  max_athletes?: number // For team plan
  [key: string]: number | undefined // Allow custom limits
}

/**
 * User subscription status
 */
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'expired'

/**
 * User subscription record
 */
export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  started_at: string // ISO timestamp
  ends_at: string | null // ISO timestamp or null for unlimited
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  metadata: Record<string, unknown>
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

/**
 * User subscription with plan details (joined data)
 */
export interface UserSubscriptionWithPlan extends UserSubscription {
  plan: SubscriptionPlan
}

/**
 * Feature gate check result
 */
export interface FeatureGateResult {
  allowed: boolean
  limit: number // -1 for unlimited
  current: number
  remaining: number // -1 for unlimited
  plan_name: string
}

/**
 * Subscription feature gates
 * Used to check if user can perform action based on plan limits
 */
export interface SubscriptionFeatureGate {
  /**
   * Check if user can add more activities
   */
  canAddActivity: (
    subscription: UserSubscriptionWithPlan,
    currentActivityCount: number
  ) => FeatureGateResult

  /**
   * Check if user can create training plan
   */
  canCreateTrainingPlan: (
    subscription: UserSubscriptionWithPlan,
    currentPlanCount: number
  ) => FeatureGateResult

  /**
   * Check if user can generate report
   */
  canGenerateReport: (
    subscription: UserSubscriptionWithPlan,
    currentReportCount: number
  ) => FeatureGateResult

  /**
   * Check if user can add athlete (team plan only)
   */
  canAddAthlete: (
    subscription: UserSubscriptionWithPlan,
    currentAthleteCount: number
  ) => FeatureGateResult
}

/**
 * Helper to check feature gate
 */
export function checkFeatureLimit(
  limit: number,
  current: number,
  planName: string
): FeatureGateResult {
  const unlimited = limit === -1
  const allowed = unlimited || current < limit
  const remaining = unlimited ? -1 : Math.max(0, limit - current)

  return {
    allowed,
    limit,
    current,
    remaining,
    plan_name: planName,
  }
}

/**
 * Create feature gate checker object
 * Each method takes a subscription and count to check against limits
 */
export function createFeatureGate(): SubscriptionFeatureGate {
  return {
    canAddActivity: (sub, currentActivityCount) =>
      checkFeatureLimit(sub.plan.limits.max_activities ?? -1, currentActivityCount, sub.plan.name),

    canCreateTrainingPlan: (sub, currentPlanCount) =>
      checkFeatureLimit(sub.plan.limits.max_training_plans ?? -1, currentPlanCount, sub.plan.name),

    canGenerateReport: (sub, currentReportCount) =>
      checkFeatureLimit(sub.plan.limits.max_reports ?? -1, currentReportCount, sub.plan.name),

    canAddAthlete: (sub, currentAthleteCount) =>
      checkFeatureLimit(sub.plan.limits.max_athletes ?? 0, currentAthleteCount, sub.plan.name),
  }
}

/**
 * Simple in-memory rate limiter
 *
 * Uses lazy cleanup during check() calls - suitable for serverless environments.
 * Expired entries are automatically removed during rate limit checks.
 *
 * NOTE: This implementation is suitable for single-instance deployments or low-traffic applications.
 * For production with multiple serverless instances, consider using @upstash/ratelimit with Redis.
 */

export interface RateLimitConfig {
  /** Unique identifier for this rate limit */
  id: string
  /** Time window in milliseconds */
  windowMs: number
  /** Maximum requests allowed in the time window */
  maxRequests: number
}

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory store for rate limit records
const rateLimitStore = new Map<string, RateLimitRecord>()

/**
 * Rate limiter implementation using token bucket algorithm
 */
export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier (e.g., user ID, IP address)
   * @returns Object with allowed status and metadata
   */
  check(identifier: string): {
    allowed: boolean
    limit: number
    remaining: number
    reset: number
  } {
    const now = Date.now()
    const key = `${this.config.id}:${identifier}`

    // Lazy cleanup: Remove expired entries during check
    // This is more reliable in serverless environments than setInterval
    this.cleanupExpiredEntries(now)

    let record = rateLimitStore.get(key)

    // Create new record if doesn't exist or window has expired
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + this.config.windowMs,
      }
      rateLimitStore.set(key, record)
    }

    // Increment request count
    record.count++

    const allowed = record.count <= this.config.maxRequests
    const remaining = Math.max(0, this.config.maxRequests - record.count)

    return {
      allowed,
      limit: this.config.maxRequests,
      remaining,
      reset: record.resetTime,
    }
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    const key = `${this.config.id}:${identifier}`
    rateLimitStore.delete(key)
  }

  /**
   * Clean up expired entries from the store
   * Called during each check() to prevent memory growth
   * @private
   */
  private cleanupExpiredEntries(now: number): void {
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }
}

/**
 * Pre-configured rate limiters for different API routes
 */
export const rateLimiters = {
  /** General API rate limit: 100 requests per hour per user */
  api: new RateLimiter({
    id: 'api',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
  }),

  /** Strava sync: 5 syncs per hour per user (prevent abuse) */
  stravaSync: new RateLimiter({
    id: 'strava-sync',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  }),

  /** Webhook events: 1000 events per hour per subscription */
  webhook: new RateLimiter({
    id: 'webhook',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
  }),

  /** Auth endpoints: 20 requests per 15 minutes per IP */
  auth: new RateLimiter({
    id: 'auth',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
  }),
} as const

/**
 * Helper function to get client identifier (user ID or IP address)
 */
export function getClientIdentifier(userId: string | null, ipAddress: string | null): string {
  return userId || ipAddress || 'anonymous'
}

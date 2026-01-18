/**
 * Service Metrics
 *
 * Lightweight monitoring for service layer operations.
 * Tracks query performance and error rates for observability.
 */

import { errorLogger } from './error-logger'

/**
 * Metrics data structure for a single operation
 */
interface OperationMetrics {
  name: string
  duration: number
  success: boolean
  timestamp: Date
  metadata?: Record<string, unknown>
}

/**
 * In-memory metrics store (for development and basic monitoring)
 * In production, this could be replaced with a proper metrics backend
 * like Prometheus, DataDog, or CloudWatch.
 */
class ServiceMetrics {
  private metrics: OperationMetrics[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics in memory

  /**
   * Record a successful query operation
   *
   * @param name - Operation name (e.g., 'admin_users_query')
   * @param duration - Duration in milliseconds
   * @param metadata - Optional metadata about the operation
   */
  recordQueryTime(name: string, duration: number, metadata?: Record<string, unknown>): void {
    this.addMetric({
      name,
      duration,
      success: true,
      timestamp: new Date(),
      metadata,
    })

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      errorLogger.logWarning(new Error(`Slow query detected: ${name}`), {
        path: 'ServiceMetrics.recordQueryTime',
        metadata: {
          operation: name,
          duration,
          ...metadata,
        },
      })
    }
  }

  /**
   * Record a failed query operation
   *
   * @param name - Operation name
   * @param error - The error that occurred
   * @param metadata - Optional metadata about the operation
   */
  recordQueryError(name: string, error: Error, metadata?: Record<string, unknown>): void {
    this.addMetric({
      name,
      duration: 0,
      success: false,
      timestamp: new Date(),
      metadata: {
        error: error.message,
        ...metadata,
      },
    })

    errorLogger.logError(error, {
      path: 'ServiceMetrics.recordQueryError',
      metadata: {
        operation: name,
        ...metadata,
      },
    })
  }

  /**
   * Get metrics summary for an operation
   *
   * @param name - Operation name to get stats for
   * @returns Summary statistics or null if no data
   */
  getSummary(name: string): {
    totalCalls: number
    successCount: number
    errorCount: number
    avgDuration: number
    maxDuration: number
    minDuration: number
  } | null {
    const operationMetrics = this.metrics.filter((m) => m.name === name)
    if (operationMetrics.length === 0) return null

    const successMetrics = operationMetrics.filter((m) => m.success)
    const durations = successMetrics.map((m) => m.duration)

    return {
      totalCalls: operationMetrics.length,
      successCount: successMetrics.length,
      errorCount: operationMetrics.length - successMetrics.length,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
    }
  }

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): OperationMetrics[] {
    return [...this.metrics]
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
  }

  /**
   * Add a metric to the store
   */
  private addMetric(metric: OperationMetrics): void {
    this.metrics.push(metric)

    // Trim to max size (FIFO)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }
}

// Singleton instance
export const serviceMetrics = new ServiceMetrics()

/**
 * Decorator/wrapper to track service method performance
 *
 * @example
 * ```typescript
 * const result = await trackServiceMetrics('admin_users_query', async () => {
 *   return await supabase.from('users').select('*')
 * }, { userId: user.id })
 * ```
 */
export async function trackServiceMetrics<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await operation()
    const duration = Date.now() - startTime
    serviceMetrics.recordQueryTime(operationName, duration, metadata)
    return result
  } catch (error) {
    serviceMetrics.recordQueryError(operationName, error as Error, metadata)
    throw error
  }
}

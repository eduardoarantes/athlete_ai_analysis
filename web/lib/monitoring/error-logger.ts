/**
 * Structured Error Logging
 *
 * Provides consistent error logging with contextual information.
 * Easy to integrate with monitoring services like Sentry, Datadog, etc.
 */

export interface ErrorContext {
  /** User ID if available */
  userId?: string
  /** Request path */
  path?: string
  /** HTTP method */
  method?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

export interface StructuredError {
  /** Error message */
  message: string
  /** Error stack trace */
  stack?: string
  /** Error name/type */
  name: string
  /** Timestamp */
  timestamp: string
  /** Severity level */
  level: 'error' | 'warn' | 'info'
  /** Context information */
  context?: ErrorContext
}

class ErrorLogger {
  /**
   * Log an error with context
   */
  logError(error: Error, context?: ErrorContext): void {
    const structuredError: StructuredError = {
      message: error.message,
      name: error.name,
      timestamp: new Date().toISOString(),
      level: 'error',
      ...(error.stack && { stack: error.stack }),
      ...(context && { context }),
    }

    // Log to console (in production, this would go to a monitoring service)
    console.error('[ERROR]', JSON.stringify(structuredError, null, 2))

    // TODO: Send to monitoring service (Sentry, Datadog, etc.)
    // await this.sendToMonitoring(structuredError)
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: ErrorContext): void {
    const structuredError: StructuredError = {
      message,
      name: 'Warning',
      timestamp: new Date().toISOString(),
      level: 'warn',
      ...(context && { context }),
    }

    console.warn('[WARN]', JSON.stringify(structuredError, null, 2))
  }

  /**
   * Log info message
   */
  logInfo(message: string, context?: ErrorContext): void {
    const structuredError: StructuredError = {
      message,
      name: 'Info',
      timestamp: new Date().toISOString(),
      level: 'info',
      ...(context && { context }),
    }

    console.info('[INFO]', JSON.stringify(structuredError, null, 2))
  }

  /**
   * Log API route errors
   */
  logApiError(error: Error, request: { path: string; method: string }, userId?: string): void {
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : undefined
    this.logError(error, {
      ...(userId && { userId }),
      path: request.path,
      method: request.method,
      metadata: {
        ...(userAgent && { userAgent }),
      },
    })
  }

  /**
   * Log database errors
   */
  logDatabaseError(error: Error, operation: string, userId?: string): void {
    this.logError(error, {
      ...(userId && { userId }),
      metadata: {
        operation,
        errorCode: (error as unknown as { code?: string }).code,
      },
    })
  }

  /**
   * Log authentication errors
   */
  logAuthError(error: Error, userId?: string): void {
    this.logError(error, {
      ...(userId && { userId }),
      metadata: {
        category: 'authentication',
      },
    })
  }

  /**
   * Log integration errors (Strava, external APIs)
   */
  logIntegrationError(error: Error, service: string, userId?: string): void {
    this.logError(error, {
      ...(userId && { userId }),
      metadata: {
        service,
        category: 'integration',
      },
    })
  }

  // Future: Send to monitoring service
  // Example Sentry integration:
  // if (process.env.SENTRY_DSN) {
  //   await fetch(process.env.SENTRY_DSN, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(error)
  //   })
  // }

  // Example Datadog integration:
  // if (process.env.DATADOG_API_KEY) {
  //   await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'DD-API-KEY': process.env.DATADOG_API_KEY
  //     },
  //     body: JSON.stringify(error)
  //   })
  // }
}

// Export singleton instance
export const errorLogger = new ErrorLogger()

/**
 * Utility function to wrap async functions with error logging
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      errorLogger.logError(error as Error, context)
      throw error
    }
  }) as T
}

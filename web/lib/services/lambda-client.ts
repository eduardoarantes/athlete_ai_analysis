/**
 * Lambda API Client Service
 * Invokes Python Lambda function via HTTP (Lambda Function URL)
 *
 * Note: AWS SDK invocation is not supported in Amplify SSR because the SSR
 * functions cannot obtain AWS credentials. See GitHub issue #37 for implementing
 * secure BFF pattern with SSM-stored credentials.
 */

import { errorLogger } from '@/lib/monitoring/error-logger'

// API URL from environment (Lambda Function URL or localhost for dev)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface LambdaApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  body?: unknown
  headers?: Record<string, string>
}

export interface LambdaApiResponse<T = unknown> {
  statusCode: number
  body: T
  headers?: Record<string, string>
}

/**
 * Invoke the Python API Lambda function via HTTP
 */
export async function invokePythonApi<T = unknown>(
  request: LambdaApiRequest
): Promise<LambdaApiResponse<T>> {
  // Remove trailing slash from base URL if present to avoid double slashes
  const baseUrl = API_URL.replace(/\/$/, '')
  const url = `${baseUrl}${request.path}`

  errorLogger.logInfo('Invoking Python API via HTTP', {
    path: request.path,
    method: request.method,
    metadata: { url },
  })

  const fetchOptions: RequestInit = {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      ...request.headers,
    },
  }

  if (request.body) {
    fetchOptions.body = JSON.stringify(request.body)
  }

  const response = await fetch(url, fetchOptions)

  let body: T
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    body = await response.json()
  } else {
    body = (await response.text()) as unknown as T
  }

  return {
    statusCode: response.status,
    body,
    headers: Object.fromEntries(response.headers.entries()),
  }
}

/**
 * Health check for the Python API
 */
export async function checkPythonApiHealth(): Promise<boolean> {
  try {
    const response = await invokePythonApi({
      method: 'GET',
      path: '/api/v1/health',
    })
    return response.statusCode === 200
  } catch {
    return false
  }
}

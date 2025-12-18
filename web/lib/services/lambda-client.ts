/**
 * AWS Lambda Client Service
 * Invokes Python Lambda function directly via AWS SDK
 * Used when running in AWS (EC2) - falls back to HTTP in development
 */

import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda'
import { errorLogger } from '@/lib/monitoring/error-logger'

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2'
const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'

// Determine if we should use Lambda (production on EC2) or HTTP (local development)
const USE_LAMBDA = !!LAMBDA_FUNCTION_NAME && process.env.NODE_ENV === 'production'

// Lambda client (only created in production)
let lambdaClient: LambdaClient | null = null

function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: AWS_REGION,
      // In EC2, credentials are automatically provided by IAM role
    })
  }
  return lambdaClient
}

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
 * Invoke the Python API Lambda function
 * Automatically uses Lambda SDK in production, HTTP in development
 */
export async function invokePythonApi<T = unknown>(
  request: LambdaApiRequest
): Promise<LambdaApiResponse<T>> {
  if (USE_LAMBDA) {
    return invokeLambda<T>(request)
  } else {
    return invokeHttp<T>(request)
  }
}

/**
 * Invoke Lambda directly via AWS SDK
 */
async function invokeLambda<T>(request: LambdaApiRequest): Promise<LambdaApiResponse<T>> {
  const client = getLambdaClient()

  // Format request as API Gateway v2 event
  const event = {
    version: '2.0',
    routeKey: `${request.method} ${request.path}`,
    rawPath: request.path,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      ...request.headers,
    },
    requestContext: {
      http: {
        method: request.method,
        path: request.path,
        protocol: 'HTTP/1.1',
      },
      requestId: `next-${Date.now()}`,
      stage: '$default',
    },
    body: request.body ? JSON.stringify(request.body) : undefined,
    isBase64Encoded: false,
  }

  try {
    const command = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      InvocationType: InvocationType.RequestResponse,
      Payload: new TextEncoder().encode(JSON.stringify(event)),
    })

    const response = await client.send(command)

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(new TextDecoder().decode(response.Payload))
        : { message: 'Unknown Lambda error' }

      errorLogger.logError(new Error(`Lambda function error: ${response.FunctionError}`), {
        path: request.path,
        method: request.method,
        metadata: { errorPayload },
      })

      throw new Error(errorPayload.message || `Lambda error: ${response.FunctionError}`)
    }

    if (!response.Payload) {
      throw new Error('Empty response from Lambda')
    }

    // Parse Lambda response (API Gateway format)
    const lambdaResponse = JSON.parse(new TextDecoder().decode(response.Payload))

    // Handle both direct response and API Gateway v2 format
    let body: T
    let statusCode: number

    if (lambdaResponse.statusCode !== undefined) {
      // API Gateway v2 format
      statusCode = lambdaResponse.statusCode
      body =
        typeof lambdaResponse.body === 'string'
          ? JSON.parse(lambdaResponse.body)
          : lambdaResponse.body
    } else {
      // Direct response format
      statusCode = 200
      body = lambdaResponse as T
    }

    return {
      statusCode,
      body,
      headers: lambdaResponse.headers,
    }
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: request.path,
      method: request.method,
      metadata: { functionName: LAMBDA_FUNCTION_NAME },
    })
    throw error
  }
}

/**
 * Invoke via HTTP (for local development)
 */
async function invokeHttp<T>(request: LambdaApiRequest): Promise<LambdaApiResponse<T>> {
  const url = `${FASTAPI_URL}${request.path}`

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

/**
 * AWS Lambda Client Service
 * Invokes Python Lambda function directly via AWS SDK
 * Used when running in AWS (EC2) - falls back to HTTP in development
 */

import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda'
import getConfig from 'next/config'
import { errorLogger } from '@/lib/monitoring/error-logger'

// Get serverRuntimeConfig (embedded at build time for Amplify SSR)
const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} }

// Configuration - try serverRuntimeConfig first (for Amplify SSR), then env vars
const AWS_REGION = serverRuntimeConfig?.awsRegion || process.env.AWS_REGION || 'ap-southeast-2'
const LAMBDA_FUNCTION_NAME =
  serverRuntimeConfig?.lambdaFunctionName || process.env.LAMBDA_FUNCTION_NAME
// FASTAPI_URL fallback chain: explicit env var -> Lambda function URL -> localhost for dev
const FASTAPI_URL =
  process.env.FASTAPI_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Use Lambda SDK when LAMBDA_FUNCTION_NAME is set (regardless of NODE_ENV)
// This enables BFF pattern in Amplify SSR where we call Lambda directly via SDK
const USE_LAMBDA = !!LAMBDA_FUNCTION_NAME

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
  errorLogger.logInfo('Invoking Python API', {
    path: request.path,
    method: request.method,
    metadata: { useLambda: USE_LAMBDA, functionName: LAMBDA_FUNCTION_NAME || 'not set' },
  })

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

  // Split path and query string
  const [rawPath, rawQueryString = ''] = request.path.split('?')

  // Parse query string into parameters object
  const queryStringParameters: Record<string, string> = {}
  if (rawQueryString) {
    const params = new URLSearchParams(rawQueryString)
    params.forEach((value, key) => {
      queryStringParameters[key] = value
    })
  }

  // Format request as Lambda Function URL event (exactly matching AWS format)
  // See: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
  const requestId = `next-${Date.now()}`
  const event = {
    version: '2.0',
    routeKey: '$default', // Function URLs always use $default
    rawPath,
    rawQueryString,
    queryStringParameters:
      Object.keys(queryStringParameters).length > 0 ? queryStringParameters : undefined,
    headers: {
      'content-type': 'application/json',
      host: 'lambda-internal',
      ...request.headers,
    },
    requestContext: {
      accountId: 'anonymous',
      apiId: 'lambda-internal',
      domainName: 'lambda-internal',
      domainPrefix: 'lambda-internal',
      http: {
        method: request.method,
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'NextJS-SSR',
      },
      requestId,
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: request.body ? JSON.stringify(request.body) : null,
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
 * Invoke via HTTP (for local development or Amplify SSR)
 */
async function invokeHttp<T>(request: LambdaApiRequest): Promise<LambdaApiResponse<T>> {
  // Remove trailing slash from base URL if present to avoid double slashes
  const baseUrl = FASTAPI_URL.replace(/\/$/, '')
  const url = `${baseUrl}${request.path}`

  errorLogger.logInfo('Invoking Python API via HTTP', {
    path: request.path,
    method: request.method,
    metadata: { url, baseUrl: FASTAPI_URL },
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

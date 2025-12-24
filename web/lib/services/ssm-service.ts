/**
 * AWS SSM Parameter Store Service
 *
 * Provides secure access to secrets stored in AWS SSM Parameter Store.
 * Includes caching to minimize API calls during Lambda function execution.
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

// Cache for SSM parameters (persists for Lambda container lifetime)
const parameterCache = new Map<string, { value: string; expiry: number }>()

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000

// SSM client singleton
let ssmClient: SSMClient | null = null

function getSSMClient(): SSMClient {
  if (!ssmClient) {
    ssmClient = new SSMClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
    })
  }
  return ssmClient
}

/**
 * Get parameter path prefix from environment
 */
function getParameterPrefix(): string {
  const prefix = process.env.SSM_PARAMETER_PREFIX
  if (!prefix) {
    throw new Error('SSM_PARAMETER_PREFIX environment variable is not set')
  }
  return prefix
}

/**
 * Fetch a parameter from SSM Parameter Store with caching
 */
export async function getParameter(name: string, withDecryption = true): Promise<string | null> {
  const fullPath = `${getParameterPrefix()}${name}`

  // Check cache first
  const cached = parameterCache.get(fullPath)
  if (cached && cached.expiry > Date.now()) {
    return cached.value
  }

  try {
    const client = getSSMClient()
    const command = new GetParameterCommand({
      Name: fullPath,
      WithDecryption: withDecryption,
    })

    const response = await client.send(command)
    const value = response.Parameter?.Value || null

    // Cache the result
    if (value) {
      parameterCache.set(fullPath, {
        value,
        expiry: Date.now() + CACHE_TTL_MS,
      })
    }

    return value
  } catch (error) {
    // Log error but don't expose details
    console.error(`Failed to fetch SSM parameter ${fullPath}:`, error)
    return null
  }
}

/**
 * Get Strava OAuth credentials from SSM
 */
export async function getStravaCredentials(): Promise<{
  clientId: string | null
  clientSecret: string | null
}> {
  const [clientId, clientSecret] = await Promise.all([
    getParameter('/strava/client-id', false), // Not encrypted
    getParameter('/strava/client-secret', true), // Encrypted
  ])

  return { clientId, clientSecret }
}

/**
 * Clear the parameter cache (useful for testing or forced refresh)
 */
export function clearParameterCache(): void {
  parameterCache.clear()
}

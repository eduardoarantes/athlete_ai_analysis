/**
 * Python API Client
 *
 * Client for calling the FastAPI backend compliance endpoints.
 */

import type { WorkoutStructure } from '@/lib/types/training-plan'

// ============================================================================
// Types
// ============================================================================

/**
 * Request to analyze compliance with Strava activity
 */
export interface AnalyzeStravaActivityRequest {
  workout: {
    id?: string
    name?: string
    structure: WorkoutStructure
  }
  activity_id: number
  ftp: number
}

/**
 * Request to analyze compliance with provided power streams
 */
export interface AnalyzeComplianceRequest {
  workout: {
    id?: string
    name?: string
    structure: WorkoutStructure
  }
  streams: Array<{
    time_offset: number
    power: number
  }>
  ftp: number
  activity_id?: number
}

/**
 * Compliance result for a single step
 */
export interface ComplianceStepResult {
  step_name: string
  planned_duration: number
  actual_duration: number
  target_power: number
  actual_power_avg: number
  compliance_pct: number
  intensity_class: string | null
}

/**
 * Compliance analysis response from Python API
 */
export interface ComplianceAnalysisResponse {
  workout_id: string | null
  workout_name: string
  activity_id: number | null
  ftp: number
  overall_compliance: number
  results: ComplianceStepResult[]
  total_steps: number
  summary: Record<string, number> | null
}

// ============================================================================
// Python API Client
// ============================================================================

export class PythonAPIClient {
  private baseURL: string

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }

  /**
   * Analyze compliance from Strava activity
   * Fetches power streams from Strava and analyzes compliance
   */
  async analyzeStravaActivity(
    request: AnalyzeStravaActivityRequest
  ): Promise<ComplianceAnalysisResponse> {
    const response = await fetch(`${this.baseURL}/api/v1/compliance/analyze-strava`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `API request failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Analyze compliance with provided power streams
   */
  async analyzeCompliance(request: AnalyzeComplianceRequest): Promise<ComplianceAnalysisResponse> {
    const response = await fetch(`${this.baseURL}/api/v1/compliance/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `API request failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Health check for compliance service
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await fetch(`${this.baseURL}/api/v1/compliance/health`)

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`)
    }

    return response.json()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: PythonAPIClient | null = null

/**
 * Get or create the Python API client instance
 */
export function getPythonAPIClient(): PythonAPIClient {
  if (!clientInstance) {
    clientInstance = new PythonAPIClient()
  }
  return clientInstance
}

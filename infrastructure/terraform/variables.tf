# Cycling AI Analysis - Terraform Variables
#
# Environment is determined by Terraform workspace, not a variable.
# Use: terraform workspace select <env>

# AWS Configuration
variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "cycling-ai"
}

# Supabase Configuration
variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anonymous/public key"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key (server-side only)"
  type        = string
  sensitive   = true
}

variable "supabase_jwt_secret" {
  description = "Supabase JWT secret for token validation"
  type        = string
  sensitive   = true
}

# Strava Configuration
variable "strava_client_id" {
  description = "Strava OAuth client ID"
  type        = string
  default     = ""
}

variable "strava_client_secret" {
  description = "Strava OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "strava_webhook_verify_token" {
  description = "Strava webhook verification token. Generate with: openssl rand -base64 32"
  type        = string
  default     = ""
  sensitive   = true
}

# API Keys
variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

variable "google_api_key" {
  description = "Google API key for Gemini (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

# AI Plan Generation Configuration
variable "workout_source" {
  description = "Workout source: 'library' (LLM for structure, library for workouts) or 'llm' (full LLM generation)"
  type        = string
  default     = "library"
}

# Lambda Configuration
variable "lambda_memory_size" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300 # 5 minutes for plan generation
}

# Domain Configuration (optional)
variable "custom_domain" {
  description = "Custom domain for the web app (optional)"
  type        = string
  default     = ""
}

# Note: ACM certificate is auto-created in acm.tf when custom_domain is set

# GitHub Configuration for Amplify
variable "github_repository" {
  description = "GitHub repository URL (e.g., https://github.com/username/repo)"
  type        = string
  default     = "https://github.com/eduardoarantes/athlete_ai_analysis"
}

variable "github_access_token" {
  description = "GitHub personal access token for Amplify to access the repository"
  type        = string
  sensitive   = true
  default     = ""
}

# Cycling AI Analysis - SSM Parameter Store Configuration
# Stores secrets securely for EC2 to fetch at runtime

# Parameter path prefix
locals {
  ssm_prefix = "/${local.name_prefix}"
}

# Supabase URL (not secret, but stored for consistency)
resource "aws_ssm_parameter" "supabase_url" {
  name        = "${local.ssm_prefix}/supabase/url"
  description = "Supabase project URL"
  type        = "String"
  value       = var.supabase_url

  tags = {
    Name        = "${local.name_prefix}-supabase-url"
    Environment = local.environment
  }
}

# Supabase Anon Key (public, but stored for consistency)
resource "aws_ssm_parameter" "supabase_anon_key" {
  name        = "${local.ssm_prefix}/supabase/anon-key"
  description = "Supabase anonymous/public key"
  type        = "SecureString"
  value       = var.supabase_anon_key

  tags = {
    Name        = "${local.name_prefix}-supabase-anon-key"
    Environment = local.environment
  }
}

# Supabase Service Role Key (secret - server-side only)
resource "aws_ssm_parameter" "supabase_service_role_key" {
  name        = "${local.ssm_prefix}/supabase/service-role-key"
  description = "Supabase service role key for server-side operations"
  type        = "SecureString"
  value       = var.supabase_service_role_key

  tags = {
    Name        = "${local.name_prefix}-supabase-service-role-key"
    Environment = local.environment
  }
}

# Strava Client ID (optional - use placeholder if not set)
resource "aws_ssm_parameter" "strava_client_id" {
  count       = var.strava_client_id != "" ? 1 : 0
  name        = "${local.ssm_prefix}/strava/client-id"
  description = "Strava OAuth client ID"
  type        = "String"
  value       = var.strava_client_id

  tags = {
    Name        = "${local.name_prefix}-strava-client-id"
    Environment = local.environment
  }
}

# Strava Client Secret (optional - use placeholder if not set)
resource "aws_ssm_parameter" "strava_client_secret" {
  count       = var.strava_client_secret != "" ? 1 : 0
  name        = "${local.ssm_prefix}/strava/client-secret"
  description = "Strava OAuth client secret"
  type        = "SecureString"
  value       = var.strava_client_secret

  tags = {
    Name        = "${local.name_prefix}-strava-client-secret"
    Environment = local.environment
  }
}

# App URL (for OAuth callbacks)
resource "aws_ssm_parameter" "app_url" {
  name        = "${local.ssm_prefix}/app/url"
  description = "Application public URL"
  type        = "String"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${aws_amplify_app.web.default_domain}"

  tags = {
    Name        = "${local.name_prefix}-app-url"
    Environment = local.environment
  }
}

# AWS Amplify Configuration for Next.js Web Application
#
# This replaces the S3/CloudFront static hosting with Amplify,
# which natively supports Next.js SSR and API routes.

# Amplify App
resource "aws_amplify_app" "web" {
  name       = "${local.name_prefix}-web"
  repository = var.github_repository

  # GitHub access token for repository connection
  access_token = var.github_access_token

  # IAM service role for SSM access
  iam_service_role_arn = aws_iam_role.amplify_service_role.arn

  # Build specification
  # Note: STRAVA credentials are embedded via next.config.ts serverRuntimeConfig at build time
  # (Amplify SSR Lambda doesn't have access to console env vars at runtime)
  build_spec = <<-EOT
    version: 1
    applications:
      - appRoot: web
        frontend:
          phases:
            preBuild:
              commands:
                - npm install -g pnpm
                - pnpm install --frozen-lockfile
            build:
              commands:
                - pnpm build
          artifacts:
            baseDirectory: .next
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
              - .next/cache/**/*
  EOT

  # Environment variables for all branches (app-level)
  # Note: AWS_REGION is automatically set by Amplify for SSR functions
  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "web"
    NEXT_PUBLIC_ENV           = local.environment
    # SSM parameter path prefix for runtime secrets (credentials fetched at runtime)
    SSM_PARAMETER_PREFIX = "/${local.name_prefix}"
  }

  # Enable auto branch creation for feature branches (optional)
  enable_auto_branch_creation = false

  # Enable branch auto-build
  enable_branch_auto_build = true

  # Enable branch auto-deletion when branch is deleted in GitHub
  enable_branch_auto_deletion = true

  # Platform configuration for Next.js SSR
  platform = "WEB_COMPUTE"

  # Custom rules for SPA routing (handled by Next.js, but good fallback)
  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"
  }

  tags = {
    Name = "${local.name_prefix}-amplify-app"
  }
}

# Main branch configuration
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.web.id
  branch_name = "main"

  # Framework for Next.js SSR
  framework = "Next.js - SSR"

  # Enable auto-build on push
  enable_auto_build = true

  # Stage for this branch
  stage = local.environment == "prod" ? "PRODUCTION" : "DEVELOPMENT"

  # Environment variables specific to this branch
  # Note: AWS_REGION is automatically set by Amplify for SSR functions
  # Note: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are set separately via CLI
  # to avoid storing secrets in Terraform state. They are needed for SSR runtime.
  # Command: aws amplify update-branch --app-id <app-id> --branch-name main \
  #          --environment-variables "STRAVA_CLIENT_ID=xxx,STRAVA_CLIENT_SECRET=yyy"
  environment_variables = {
    NEXT_PUBLIC_SUPABASE_URL      = var.supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
    NEXT_PUBLIC_API_URL           = aws_lambda_function_url.api.function_url
    NEXT_PUBLIC_ENV               = local.environment
    NEXT_PUBLIC_STRAVA_CLIENT_ID  = var.strava_client_id
    NEXT_PUBLIC_APP_URL           = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${aws_amplify_app.web.default_domain}"
  }

  tags = {
    Name = "${local.name_prefix}-amplify-main"
  }
}

# Optional: Development branch for staging
resource "aws_amplify_branch" "develop" {
  count = local.environment == "prod" ? 0 : 1

  app_id      = aws_amplify_app.web.id
  branch_name = "develop"

  framework         = "Next.js - SSR"
  enable_auto_build = true
  stage             = "DEVELOPMENT"

  # Note: AWS_REGION is automatically set by Amplify for SSR functions
  environment_variables = {
    NEXT_PUBLIC_SUPABASE_URL      = var.supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
    NEXT_PUBLIC_API_URL           = aws_lambda_function_url.api.function_url
    NEXT_PUBLIC_ENV               = "development"
    NEXT_PUBLIC_STRAVA_CLIENT_ID  = var.strava_client_id
    NEXT_PUBLIC_APP_URL           = "https://${aws_amplify_app.web.default_domain}"
    # SSM parameter path prefix for runtime secrets (credentials fetched at runtime)
    SSM_PARAMETER_PREFIX = "/${local.name_prefix}"
  }

  tags = {
    Name = "${local.name_prefix}-amplify-develop"
  }
}

# Optional: Custom domain configuration
resource "aws_amplify_domain_association" "main" {
  count = var.custom_domain != "" ? 1 : 0

  app_id      = aws_amplify_app.web.id
  domain_name = var.custom_domain

  # Main branch serves the apex domain
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = ""
  }

  # www subdomain redirects to apex
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = "www"
  }
}

# Webhook for manual/programmatic deployments (optional)
resource "aws_amplify_webhook" "main" {
  app_id      = aws_amplify_app.web.id
  branch_name = aws_amplify_branch.main.branch_name
  description = "Trigger deployment for main branch"
}

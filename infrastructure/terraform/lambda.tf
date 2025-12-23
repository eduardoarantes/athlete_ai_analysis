# Cycling AI Analysis - Lambda Function Configuration
# Python FastAPI backend - PRIVATE (only accessible via EC2 IAM role)

# S3 bucket for Lambda code (needed for packages > 50MB)
resource "aws_s3_bucket" "lambda_code" {
  bucket = "${local.name_prefix}-lambda-code-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${local.name_prefix}-lambda-code"
  }
}

resource "aws_s3_bucket_versioning" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Upload Lambda zip to S3
resource "aws_s3_object" "lambda_zip" {
  bucket = aws_s3_bucket.lambda_code.id
  key    = "lambda.zip"
  source = "${path.module}/../../dist/lambda.zip"
  etag   = filemd5("${path.module}/../../dist/lambda.zip")
}

# Lambda function for Python FastAPI backend
resource "aws_lambda_function" "api" {
  s3_bucket         = aws_s3_bucket.lambda_code.id
  s3_key            = aws_s3_object.lambda_zip.key
  s3_object_version = aws_s3_object.lambda_zip.version_id
  function_name     = "${local.name_prefix}-api"
  role              = aws_iam_role.lambda_exec.arn
  handler           = "cycling_ai.api.lambda_handler.handler"
  runtime           = "python3.11"
  timeout           = local.config.lambda_timeout
  memory_size       = local.config.lambda_memory
  source_code_hash  = filebase64sha256("${path.module}/../../dist/lambda.zip")

  # Limit concurrent executions to prevent abuse/cost overruns
  # This protects against spam attacks on LLM endpoints
  # Use -1 for unreserved concurrency (avoids account limit issues)
  # The account needs at least 10 unreserved, so we can't reserve any
  reserved_concurrent_executions = -1

  environment {
    variables = {
      ENVIRONMENT               = local.environment
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      SUPABASE_JWT_SECRET       = var.supabase_jwt_secret
      ANTHROPIC_API_KEY         = var.anthropic_api_key
      GOOGLE_API_KEY            = var.google_api_key
      OPENAI_API_KEY            = var.openai_api_key
      # Strava OAuth
      STRAVA_CLIENT_ID     = var.strava_client_id
      STRAVA_CLIENT_SECRET = var.strava_client_secret
      # App URL for OAuth callbacks
      APP_URL = var.custom_domain != "" ? "https://${var.custom_domain}" : ""
      # AI Plan Generation
      WORKOUT_SOURCE = var.workout_source
      # Disable buffering for Lambda
      PYTHONUNBUFFERED = "1"
    }
  }

  # Ensure Lambda can access the zip file
  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_cloudwatch_log_group.lambda,
  ]

  tags = {
    Name = "${local.name_prefix}-api"
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = local.config.log_retention

  tags = {
    Name = "${local.name_prefix}-api-logs"
  }
}

# Lambda permission for CloudWatch Logs
resource "aws_lambda_permission" "cloudwatch" {
  statement_id  = "AllowCloudWatchLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "logs.${var.aws_region}.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.lambda.arn}:*"
}

# Lambda Function URL for direct HTTPS access
# Required for Amplify (and other clients) to call the API
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE" # Public access - API handles its own auth via JWT

  cors {
    allow_credentials = true
    allow_origins     = ["*"] # Will be restricted in production
    allow_methods     = ["*"] # Use wildcard to avoid AWS validation issues
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# NOTE: Amplify app calls Lambda via the function URL (HTTPS)

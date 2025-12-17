# Cycling AI Analysis - Lambda Function Configuration

# Lambda function for Python FastAPI backend
resource "aws_lambda_function" "api" {
  filename         = "${path.module}/../../dist/lambda.zip"
  function_name    = "${local.name_prefix}-api"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "cycling_ai.api.lambda_handler.handler"
  runtime          = "python3.11"
  timeout          = local.config.lambda_timeout
  memory_size      = local.config.lambda_memory
  source_code_hash = filebase64sha256("${path.module}/../../dist/lambda.zip")

  environment {
    variables = {
      ENVIRONMENT               = local.environment
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      SUPABASE_JWT_SECRET       = var.supabase_jwt_secret
      ANTHROPIC_API_KEY         = var.anthropic_api_key
      GOOGLE_API_KEY            = var.google_api_key
      OPENAI_API_KEY            = var.openai_api_key
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

# Lambda Function URL (simpler than API Gateway for prototype)
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE" # Auth handled by JWT middleware in the app

  cors {
    allow_credentials = true
    allow_origins     = var.custom_domain != "" ? ["https://${var.custom_domain}"] : ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
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

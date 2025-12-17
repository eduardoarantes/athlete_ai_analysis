# Cycling AI Analysis - Next.js Lambda Function Configuration
# Deployed using open-next for server-side rendering

# Upload Next.js Lambda zip to S3
resource "aws_s3_object" "web_lambda_zip" {
  bucket = aws_s3_bucket.lambda_code.id
  key    = "web-lambda.zip"
  source = "${path.module}/../../web/.open-next/web-lambda.zip"
  etag   = filemd5("${path.module}/../../web/.open-next/web-lambda.zip")
}

# Lambda function for Next.js server-side rendering
resource "aws_lambda_function" "web" {
  s3_bucket         = aws_s3_bucket.lambda_code.id
  s3_key            = aws_s3_object.web_lambda_zip.key
  s3_object_version = aws_s3_object.web_lambda_zip.version_id
  function_name     = "${local.name_prefix}-web"
  role              = aws_iam_role.lambda_exec.arn
  handler           = "index.handler"
  runtime           = "nodejs20.x"
  timeout           = 30
  memory_size       = 1024
  source_code_hash  = filebase64sha256("${path.module}/../../web/.open-next/web-lambda.zip")

  environment {
    variables = {
      NODE_ENV                      = "production"
      NEXT_PUBLIC_API_URL           = "https://${aws_cloudfront_distribution.web.domain_name}/api"
      NEXT_PUBLIC_SUPABASE_URL      = var.supabase_url
      NEXT_PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_cloudwatch_log_group.lambda_web,
  ]

  tags = {
    Name = "${local.name_prefix}-web"
  }
}

# Lambda Function URL for Next.js
resource "aws_lambda_function_url" "web" {
  function_name      = aws_lambda_function.web.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# CloudWatch Log Group for Web Lambda
resource "aws_cloudwatch_log_group" "lambda_web" {
  name              = "/aws/lambda/${local.name_prefix}-web"
  retention_in_days = local.config.log_retention

  tags = {
    Name = "${local.name_prefix}-web-logs"
  }
}

# Lambda permission for Function URL public access
resource "aws_lambda_permission" "web_function_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.web.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "web_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.web.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.web.execution_arn}/*/*"
}

# API Gateway HTTP API for Next.js
resource "aws_apigatewayv2_api" "web" {
  name          = "${local.name_prefix}-web"
  protocol_type = "HTTP"
  description   = "${local.name_prefix} Next.js Web App"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"]
    allow_origins     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }

  tags = {
    Name = "${local.name_prefix}-web-api"
  }
}

# Lambda integration for Next.js
resource "aws_apigatewayv2_integration" "web" {
  api_id                 = aws_apigatewayv2_api.web.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.web.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Default route for Next.js - proxy all requests
resource "aws_apigatewayv2_route" "web_default" {
  api_id    = aws_apigatewayv2_api.web.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.web.id}"
}

# Deploy to default stage
resource "aws_apigatewayv2_stage" "web_default" {
  api_id      = aws_apigatewayv2_api.web.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_web.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = {
    Name = "${local.name_prefix}-web-stage"
  }
}

# CloudWatch Log Group for Web API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_web" {
  name              = "/aws/apigateway/${local.name_prefix}-web"
  retention_in_days = local.config.log_retention

  tags = {
    Name = "${local.name_prefix}-web-api-gateway-logs"
  }
}

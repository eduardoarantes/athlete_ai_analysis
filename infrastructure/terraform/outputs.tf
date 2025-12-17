# Cycling AI Analysis - Terraform Outputs

# Environment info
output "environment" {
  description = "Current deployment environment (from workspace)"
  value       = local.environment
}

output "name_prefix" {
  description = "Resource naming prefix"
  value       = local.name_prefix
}

# Python API Lambda outputs
output "lambda_function_name" {
  description = "Name of the Python API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Python API Lambda function"
  value       = aws_lambda_function.api.arn
}

output "lambda_url" {
  description = "Python API Lambda Function URL (internal, blocked by account policy)"
  value       = aws_lambda_function_url.api.function_url
}

output "api_gateway_url" {
  description = "Python API Gateway URL (direct access)"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_url" {
  description = "Python API URL via CloudFront (recommended)"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}/api"
}

# Next.js Web Lambda outputs
output "web_lambda_function_name" {
  description = "Name of the Next.js Web Lambda function"
  value       = aws_lambda_function.web.function_name
}

output "web_lambda_url" {
  description = "Next.js Lambda Function URL (internal)"
  value       = aws_lambda_function_url.web.function_url
}

output "web_api_gateway_url" {
  description = "Next.js API Gateway URL (direct access)"
  value       = aws_apigatewayv2_api.web.api_endpoint
}

# S3 outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for web assets"
  value       = aws_s3_bucket.web.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.web.arn
}

# CloudFront outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_url" {
  description = "Full CloudFront URL"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

# Useful deployment commands
output "deployment_commands" {
  description = "Commands to deploy the application"
  value = {
    deploy_web = "aws s3 sync web/out/ s3://${aws_s3_bucket.web.id} --delete"
    invalidate = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.web.id} --paths '/*'"
    update_lambda = "aws lambda update-function-code --function-name ${aws_lambda_function.api.function_name} --zip-file fileb://dist/lambda.zip"
  }
}

# Environment variables for web app
output "web_env_vars" {
  description = "Environment variables to set in web/.env.production"
  value = {
    NEXT_PUBLIC_API_URL = "https://${aws_cloudfront_distribution.web.domain_name}/api"
  }
}

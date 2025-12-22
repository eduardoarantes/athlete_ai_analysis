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

output "lambda_function_url" {
  description = "Lambda Function URL for direct HTTPS access"
  value       = aws_lambda_function_url.api.function_url
}

# AWS Amplify outputs
output "amplify_app_id" {
  description = "Amplify App ID"
  value       = aws_amplify_app.web.id
}

output "amplify_app_arn" {
  description = "Amplify App ARN"
  value       = aws_amplify_app.web.arn
}

output "amplify_default_domain" {
  description = "Amplify default domain (auto-generated)"
  value       = aws_amplify_app.web.default_domain
}

output "amplify_main_branch_url" {
  description = "URL for the main branch deployment"
  value       = "https://main.${aws_amplify_app.web.default_domain}"
}

output "amplify_webhook_url" {
  description = "Webhook URL to trigger deployments"
  value       = aws_amplify_webhook.main.url
  sensitive   = true
}

output "amplify_app_default_domain" {
  description = "Amplify app default domain"
  value       = aws_amplify_app.web.default_domain
}

# Website URL (custom domain or Amplify default)
output "website_url" {
  description = "Primary website URL"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${aws_amplify_app.web.default_domain}"
}

# Deployment commands
output "deployment_commands" {
  description = "Commands to deploy the application"
  value = {
    # Lambda update
    update_lambda = "aws lambda update-function-code --function-name ${aws_lambda_function.api.function_name} --s3-bucket ${aws_s3_bucket.lambda_code.id} --s3-key lambda.zip"

    # Trigger Amplify build
    trigger_amplify = "aws amplify start-job --app-id ${aws_amplify_app.web.id} --branch-name main --job-type RELEASE"
  }
}

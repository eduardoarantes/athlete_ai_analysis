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

# Python API Lambda outputs (PRIVATE - no public URL)
output "lambda_function_name" {
  description = "Name of the Python API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Python API Lambda function"
  value       = aws_lambda_function.api.arn
}

# ECR outputs
output "ecr_repository_url" {
  description = "ECR repository URL for Next.js Docker image"
  value       = aws_ecr_repository.web.repository_url
}

output "ecr_registry" {
  description = "ECR registry URL"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

# EC2 outputs
output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.web.id
}

output "ec2_public_ip" {
  description = "EC2 Elastic IP address"
  value       = aws_eip.web.public_ip
}

output "ec2_public_dns" {
  description = "EC2 public DNS name"
  value       = aws_eip.web.public_dns
}

# S3 outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for static assets"
  value       = aws_s3_bucket.web.id
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

# Deployment commands
output "deployment_commands" {
  description = "Commands to deploy the application"
  value = {
    # Docker build and push
    docker_login = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    docker_build = "cd web && docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY -t ${aws_ecr_repository.web.repository_url}:latest ."
    docker_push  = "docker push ${aws_ecr_repository.web.repository_url}:latest"

    # EC2 deployment
    ec2_ssh     = "ssh -i ~/.ssh/your-key.pem ec2-user@${aws_eip.web.public_ip}"
    ec2_restart = "ssh -i ~/.ssh/your-key.pem ec2-user@${aws_eip.web.public_ip} 'sudo /usr/local/bin/start-nextjs.sh'"

    # Lambda update
    update_lambda = "aws lambda update-function-code --function-name ${aws_lambda_function.api.function_name} --s3-bucket ${aws_s3_bucket.lambda_code.id} --s3-key lambda.zip"

    # CloudFront invalidation
    invalidate = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.web.id} --paths '/*'"

    # Static assets sync (for _next/static)
    sync_static = "aws s3 sync web/.next/static/ s3://${aws_s3_bucket.web.id}/_next/static/ --delete"
  }
}

# Environment variables for web app Docker build
output "web_env_vars" {
  description = "Environment variables for Next.js Docker build"
  value = {
    NEXT_PUBLIC_SUPABASE_URL = var.supabase_url
    # Note: NEXT_PUBLIC_SUPABASE_ANON_KEY should be passed as build arg
    AWS_REGION           = var.aws_region
    LAMBDA_FUNCTION_NAME = aws_lambda_function.api.function_name
  }
  sensitive = true
}

# Cycling AI Analysis - S3 and CloudFront Configuration
# Serves Next.js app via Lambda SSR with static assets from S3
# Routes /api/* to Python FastAPI Lambda

# S3 bucket for static Next.js files
resource "aws_s3_bucket" "web" {
  bucket = "${local.name_prefix}-web-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${local.name_prefix}-web"
  }
}

# Block public access (CloudFront will access via OAC)
resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket versioning (optional, good for rollbacks)
resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id

  versioning_configuration {
    status = "Enabled"
  }
}

# CloudFront Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name_prefix}-web-oac"
  description                       = "OAC for ${local.name_prefix} web bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Origin Access Control for Lambda
resource "aws_cloudfront_origin_access_control" "api" {
  name                              = "${local.name_prefix}-api-oac"
  description                       = "OAC for ${local.name_prefix} Lambda API"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${local.name_prefix} web app"
  price_class         = "PriceClass_100" # US, Canada, Europe only (cheapest)

  # Custom domain (if provided)
  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "S3Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # API Gateway origin (Python FastAPI)
  origin {
    domain_name = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
    origin_id   = "APIGatewayOrigin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Next.js SSR origin (API Gateway)
  origin {
    domain_name = replace(aws_apigatewayv2_api.web.api_endpoint, "https://", "")
    origin_id   = "NextJSOrigin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API cache behavior - forward all requests to API Gateway (no caching)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "APIGatewayOrigin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Use AWS managed CachingDisabled policy
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  # Static assets from S3 (_next/static - immutable, long cache)
  ordered_cache_behavior {
    path_pattern           = "_next/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.immutable.id
  }

  # Static files from S3 (favicon, robots, etc.)
  ordered_cache_behavior {
    path_pattern           = "*.ico"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.web.id
  }

  ordered_cache_behavior {
    path_pattern           = "*.svg"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.web.id
  }

  # Default behavior - S3 static hosting (Next.js SSR disabled due to open-next compatibility issues)
  # TODO: Re-enable Next.js SSR once open-next supports Next.js 16
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id          = aws_cloudfront_cache_policy.web.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.web.id
  }

  # SPA routing - return index.html for 404s (for client-side routing)
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Use ACM certificate if custom domain, otherwise CloudFront default
    cloudfront_default_certificate = var.certificate_arn == ""
    acm_certificate_arn            = var.certificate_arn != "" ? var.certificate_arn : null
    ssl_support_method             = var.certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name = "${local.name_prefix}-web"
  }
}

# Cache policy for regular content
resource "aws_cloudfront_cache_policy" "web" {
  name        = "${local.name_prefix}-web-cache-policy"
  comment     = "Cache policy for ${local.name_prefix} web app"
  min_ttl     = 0
  default_ttl = 86400    # 1 day
  max_ttl     = 31536000 # 1 year

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache policy for immutable assets (_next/static)
resource "aws_cloudfront_cache_policy" "immutable" {
  name        = "${local.name_prefix}-immutable-cache-policy"
  comment     = "Cache policy for immutable assets"
  min_ttl     = 31536000 # 1 year
  default_ttl = 31536000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Origin request policy for web (S3)
resource "aws_cloudfront_origin_request_policy" "web" {
  name    = "${local.name_prefix}-web-origin-policy"
  comment = "Origin request policy for ${local.name_prefix}"

  cookies_config {
    cookie_behavior = "none"
  }
  headers_config {
    header_behavior = "none"
  }
  query_strings_config {
    query_string_behavior = "none"
  }
}

# Origin request policy for API - forward headers and query strings
resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${local.name_prefix}-api-origin-policy"
  comment = "Origin request policy for ${local.name_prefix} API"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      # Note: Authorization is handled separately by OAC, don't include it here
      items = ["Content-Type", "Accept", "Origin", "Referer", "Accept-Language"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# Origin request policy for Next.js SSR - forward headers, cookies, and query strings
resource "aws_cloudfront_origin_request_policy" "nextjs" {
  name    = "${local.name_prefix}-nextjs-origin-policy"
  comment = "Origin request policy for ${local.name_prefix} Next.js SSR"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Host", "Accept", "Accept-Language", "Content-Type", "Origin", "Referer", "X-Forwarded-Host"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# S3 bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
          }
        }
      }
    ]
  })
}

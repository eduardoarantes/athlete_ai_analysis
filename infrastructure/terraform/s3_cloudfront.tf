# Cycling AI Analysis - S3 and CloudFront Configuration
# Routes all traffic to EC2 running Next.js Docker
# EC2 handles both frontend and API routes, calls Python Lambda directly

# S3 bucket for static assets (optional - for _next/static caching)
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

# S3 bucket versioning
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

# CloudFront distribution
resource "aws_cloudfront_distribution" "web" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_prefix} web app"
  price_class     = "PriceClass_100" # US, Canada, Europe only (cheapest)

  # Custom domain (if provided)
  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  # S3 origin for static assets
  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "S3Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # EC2 origin for Next.js application
  origin {
    domain_name = aws_eip.web.public_dns
    origin_id   = "EC2Origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # EC2 serves HTTP, CloudFront handles HTTPS
      origin_ssl_protocols   = ["TLSv1.2"]
    }
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

  # Default behavior - EC2 Next.js application
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "EC2Origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Use AWS managed CachingDisabled policy for dynamic content
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = aws_cloudfront_origin_request_policy.ec2.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Use auto-created ACM certificate if custom domain, otherwise CloudFront default
    cloudfront_default_certificate = var.custom_domain == ""
    acm_certificate_arn            = var.custom_domain != "" ? aws_acm_certificate.main[0].arn : null
    ssl_support_method             = var.custom_domain != "" ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  # Wait for certificate validation before creating distribution
  depends_on = [aws_acm_certificate_validation.main]

  tags = {
    Name = "${local.name_prefix}-web"
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

# Origin request policy for EC2 - forward all headers, cookies, and query strings
resource "aws_cloudfront_origin_request_policy" "ec2" {
  name    = "${local.name_prefix}-ec2-origin-policy"
  comment = "Origin request policy for ${local.name_prefix} EC2"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "allViewer"
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

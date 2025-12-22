# ACM Certificate for Custom Domain
#
# Creates an SSL certificate in us-east-1 (required for CloudFront)
# Uses DNS validation via Route53

# Provider alias for us-east-1 (required for CloudFront certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ACM Certificate (only if custom domain is configured)
resource "aws_acm_certificate" "main" {
  count    = var.custom_domain != "" ? 1 : 0
  provider = aws.us_east_1

  domain_name               = var.custom_domain
  subject_alternative_names = ["*.${var.custom_domain}"]
  validation_method         = "DNS"

  tags = {
    Name        = var.custom_domain
    Environment = local.environment
    Project     = var.project_name
  }

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records in Route53
resource "aws_route53_record" "acm_validation" {
  for_each = var.custom_domain != "" ? {
    for dvo in aws_acm_certificate.main[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main[0].zone_id
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "main" {
  count    = var.custom_domain != "" ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

# Output the certificate ARN
output "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront"
  value       = var.custom_domain != "" ? aws_acm_certificate.main[0].arn : ""
}

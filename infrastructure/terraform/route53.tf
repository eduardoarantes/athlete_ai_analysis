# Route 53 Configuration for Custom Domain
#
# This creates a hosted zone for the custom domain and configures
# DNS records for Amplify domain verification.

# Route 53 Hosted Zone (only created if custom_domain is set)
resource "aws_route53_zone" "main" {
  count = var.custom_domain != "" ? 1 : 0

  name    = var.custom_domain
  comment = "Hosted zone for ${var.custom_domain}"

  tags = {
    Name        = var.custom_domain
    Environment = local.environment
    Project     = var.project_name
  }
}

# Output the nameservers for the hosted zone
# These need to be configured at your domain registrar
output "route53_nameservers" {
  description = "Nameservers for the hosted zone - configure these at your domain registrar"
  value       = var.custom_domain != "" ? aws_route53_zone.main[0].name_servers : []
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = var.custom_domain != "" ? aws_route53_zone.main[0].zone_id : ""
}

# DNS records for Amplify domain verification
# Amplify provides the verification records after domain association
# These are created automatically by Amplify, but we output them for reference

output "domain_status" {
  description = "Instructions for domain setup"
  value = var.custom_domain != "" ? <<-EOT

    Domain Setup Instructions for ${var.custom_domain}:

    1. Update nameservers at your domain registrar to:
       ${join("\n       ", aws_route53_zone.main[0].name_servers)}

    2. Wait for DNS propagation (can take up to 48 hours)

    3. Amplify will automatically:
       - Request an SSL certificate
       - Verify domain ownership via DNS
       - Configure the domain

    4. Check Amplify Console for domain status:
       https://console.aws.amazon.com/amplify/

  EOT
  : "No custom domain configured"
}

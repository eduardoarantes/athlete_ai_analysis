# Cycling AI Analysis - AWS Infrastructure
# Terraform configuration for AWS Free Tier + Supabase Cloud deployment
#
# Uses Terraform workspaces for multi-environment support:
#   terraform workspace new dev
#   terraform workspace new prod
#   terraform workspace select prod

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Local values for workspace-aware naming
locals {
  # Use workspace name as environment (default workspace maps to "dev")
  environment = terraform.workspace == "default" ? "dev" : terraform.workspace

  # Resource naming prefix
  name_prefix = "${var.project_name}-${local.environment}"

  # Common tags for all resources
  common_tags = {
    Project     = var.project_name
    Environment = local.environment
    ManagedBy   = "terraform"
    Workspace   = terraform.workspace
  }

  # Environment-specific configurations
  env_config = {
    dev = {
      lambda_memory              = 256
      lambda_timeout             = 60
      lambda_max_concurrency     = 3 # Limit concurrent LLM calls
      log_retention              = 3
      enable_deletion_protection = false
    }
    staging = {
      lambda_memory              = 512
      lambda_timeout             = 180
      lambda_max_concurrency     = 5 # Limit concurrent LLM calls
      log_retention              = 7
      enable_deletion_protection = false
    }
    prod = {
      lambda_memory              = 512
      lambda_timeout             = 300
      lambda_max_concurrency     = 10 # Limit concurrent LLM calls
      log_retention              = 14
      enable_deletion_protection = true
    }
  }

  # Get config for current environment, default to dev if not found
  config = lookup(local.env_config, local.environment, local.env_config["dev"])
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Provider alias for us-east-1 (needed to destroy orphaned ACM resources)
# Can be removed after ACM resources are destroyed from state
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}

# Data sources for AWS account info
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

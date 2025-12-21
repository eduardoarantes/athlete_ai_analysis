# Terraform Backend Configuration
#
# This configures S3 as the backend for storing Terraform state.
# Required for GitHub Actions and team collaboration.
#
# WORKSPACES:
# Each workspace stores state in a separate path:
#   - default/dev: cycling-ai/env:/dev/terraform.tfstate
#   - prod:        cycling-ai/env:/prod/terraform.tfstate
#
# FIRST-TIME SETUP:
# 1. Run the bootstrap script to create S3 bucket and DynamoDB table:
#    ./scripts/bootstrap-terraform.sh
#
# 2. Initialize Terraform with the backend:
#    terraform init -backend-config="bucket=cycling-ai-terraform-state-<ACCOUNT_ID>"
#
# 3. Create workspaces:
#    terraform workspace new dev
#    terraform workspace new prod
#
# 4. Select workspace and apply:
#    terraform workspace select prod
#    terraform apply

terraform {
  backend "s3" {
    # Bucket name - override with -backend-config="bucket=<name>"
    # bucket = "cycling-ai-terraform-state-ACCOUNT_ID"

    # State file path - workspaces create separate paths automatically
    key     = "cycling-ai/terraform.tfstate"
    region  = "ap-southeast-2"
    encrypt = true

    # DynamoDB table for state locking
    dynamodb_table = "cycling-ai-terraform-locks"

    # Enable workspace prefix for state isolation
    workspace_key_prefix = "cycling-ai/env:"
  }
}

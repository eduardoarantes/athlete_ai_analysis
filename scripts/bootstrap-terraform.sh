#!/bin/bash
# Bootstrap Terraform Backend
#
# Creates the S3 bucket and DynamoDB table needed for Terraform state management.
# Run this ONCE before using Terraform with the S3 backend.
#
# Usage:
#   ./scripts/bootstrap-terraform.sh
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Permissions to create S3 buckets and DynamoDB tables

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="cycling-ai"

# Get AWS account ID
echo -e "${YELLOW}Getting AWS account ID...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}Failed to get AWS account ID. Is AWS CLI configured?${NC}"
    exit 1
fi

echo -e "${GREEN}AWS Account ID: $ACCOUNT_ID${NC}"

# S3 bucket name (must be globally unique)
BUCKET_NAME="${PROJECT_NAME}-terraform-state-${ACCOUNT_ID}"
DYNAMO_TABLE="${PROJECT_NAME}-terraform-locks"

echo ""
echo -e "${YELLOW}Creating Terraform state infrastructure...${NC}"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  DynamoDB Table: $DYNAMO_TABLE"
echo "  Region: $AWS_REGION"
echo ""

# Create S3 bucket
echo -e "${YELLOW}Creating S3 bucket...${NC}"
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo -e "${GREEN}Bucket already exists${NC}"
else
    # us-east-1 doesn't need LocationConstraint
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    echo -e "${GREEN}Bucket created${NC}"
fi

# Enable versioning
echo -e "${YELLOW}Enabling bucket versioning...${NC}"
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
echo -e "${GREEN}Versioning enabled${NC}"

# Enable encryption
echo -e "${YELLOW}Enabling bucket encryption...${NC}"
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
echo -e "${GREEN}Encryption enabled${NC}"

# Block public access
echo -e "${YELLOW}Blocking public access...${NC}"
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration '{
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }'
echo -e "${GREEN}Public access blocked${NC}"

# Create DynamoDB table for state locking
echo -e "${YELLOW}Creating DynamoDB table...${NC}"
if aws dynamodb describe-table --table-name "$DYNAMO_TABLE" --region "$AWS_REGION" 2>/dev/null; then
    echo -e "${GREEN}Table already exists${NC}"
else
    aws dynamodb create-table \
        --table-name "$DYNAMO_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION"

    # Wait for table to be active
    echo -e "${YELLOW}Waiting for table to be active...${NC}"
    aws dynamodb wait table-exists --table-name "$DYNAMO_TABLE" --region "$AWS_REGION"
    echo -e "${GREEN}Table created${NC}"
fi

echo ""
echo -e "${GREEN}Bootstrap complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Initialize Terraform with the S3 backend:"
echo "   cd infrastructure/terraform"
echo "   terraform init -backend-config=\"bucket=$BUCKET_NAME\""
echo ""
echo "2. Add these secrets to GitHub:"
echo "   S3_BUCKET_NAME: $BUCKET_NAME"
echo ""
echo "3. The Terraform state will now be stored in S3 and locked with DynamoDB"

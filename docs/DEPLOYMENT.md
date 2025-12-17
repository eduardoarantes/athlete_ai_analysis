# Deployment Guide

This guide covers deploying the Cycling AI Analysis platform to AWS using GitHub Actions.

## Multi-Environment Support

The infrastructure uses **Terraform workspaces** for environment isolation:

| Workspace | Environment | Resource Naming |
|-----------|-------------|-----------------|
| `dev` | Development | `cycling-ai-dev-*` |
| `staging` | Staging | `cycling-ai-staging-*` |
| `prod` | Production | `cycling-ai-prod-*` |

Each environment has its own:
- Lambda function
- S3 bucket
- CloudFront distribution
- CloudWatch log group
- Terraform state file

## Architecture Overview

```
User → CloudFront → S3 (Next.js static)
            ↓
      Lambda Function URL → Lambda (Python FastAPI)
            ↓
      Supabase Cloud (PostgreSQL + Auth)
```

**Components:**
- **Web App**: Next.js static export hosted on S3 + CloudFront
- **API**: Python FastAPI running on AWS Lambda
- **Database**: Supabase Cloud (PostgreSQL)
- **Auth**: Supabase Auth with JWT validation

## Prerequisites

1. **AWS Account** with Free Tier eligibility
2. **Supabase Cloud Project** (already set up)
3. **GitHub Repository** with Actions enabled
4. **AWS CLI** installed locally (for initial setup)
5. **AWS IAM User** with deployment permissions (see below)

## AWS IAM Permissions

The AWS user needs permissions to create and manage the infrastructure resources.

### Option A: Custom Policy (Recommended - Least Privilege)

Create a custom IAM policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3StateAndWeb",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:GetBucketAcl",
        "s3:GetBucketCORS",
        "s3:GetBucketLocation",
        "s3:GetBucketLogging",
        "s3:GetBucketPolicy",
        "s3:GetBucketPublicAccessBlock",
        "s3:GetBucketTagging",
        "s3:GetBucketVersioning",
        "s3:GetBucketWebsite",
        "s3:GetEncryptionConfiguration",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutBucketAcl",
        "s3:PutBucketCORS",
        "s3:PutBucketPolicy",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutBucketTagging",
        "s3:PutBucketVersioning",
        "s3:PutBucketWebsite",
        "s3:PutEncryptionConfiguration",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::cycling-ai-*",
        "arn:aws:s3:::cycling-ai-*/*"
      ]
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionCodeSigningConfig",
        "lambda:GetFunctionConfiguration",
        "lambda:GetFunctionUrlConfig",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:CreateFunctionUrlConfig",
        "lambda:DeleteFunctionUrlConfig",
        "lambda:UpdateFunctionUrlConfig",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:ListTags",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:PublishVersion"
      ],
      "Resource": "arn:aws:lambda:*:*:function:cycling-ai-*"
    },
    {
      "Sid": "IAM",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:ListInstanceProfilesForRole"
      ],
      "Resource": "arn:aws:iam::*:role/cycling-ai-*"
    },
    {
      "Sid": "CloudFront",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:TagResource",
        "cloudfront:UntagResource",
        "cloudfront:ListTagsForResource",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:CreateCachePolicy",
        "cloudfront:DeleteCachePolicy",
        "cloudfront:GetCachePolicy",
        "cloudfront:UpdateCachePolicy",
        "cloudfront:CreateOriginRequestPolicy",
        "cloudfront:DeleteOriginRequestPolicy",
        "cloudfront:GetOriginRequestPolicy",
        "cloudfront:UpdateOriginRequestPolicy",
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:ListTagsLogGroup",
        "logs:PutRetentionPolicy",
        "logs:TagLogGroup",
        "logs:UntagLogGroup"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/cycling-ai-*"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/cycling-ai-*"
    }
  ]
}
```

### Option B: Managed Policies (Simpler, Less Secure)

For prototyping, attach these AWS managed policies to your IAM user:

| Policy | Purpose |
|--------|---------|
| `AmazonS3FullAccess` | S3 buckets |
| `AWSLambda_FullAccess` | Lambda functions |
| `CloudFrontFullAccess` | CloudFront distributions |
| `IAMFullAccess` | IAM roles |
| `CloudWatchLogsFullAccess` | CloudWatch logs |
| `AmazonDynamoDBFullAccess` | DynamoDB for state locking |

### Setup Steps

1. Go to **AWS Console → IAM → Policies → Create policy**
2. Select **JSON** tab and paste the custom policy above
3. Name it `CyclingAIDeployment`
4. Go to **IAM → Users → Your User → Permissions**
5. Click **Add permissions → Attach policies directly**
6. Select `CyclingAIDeployment`

## Initial Setup (One-Time)

### 1. Bootstrap Terraform State Storage

Run this once to create the S3 bucket and DynamoDB table for Terraform state:

```bash
# Configure AWS CLI if not already done
aws configure

# Run the bootstrap script
./scripts/bootstrap-terraform.sh
```

This creates:
- S3 bucket: `cycling-ai-terraform-state-<ACCOUNT_ID>`
- DynamoDB table: `cycling-ai-terraform-locks`

### 2. Initial Infrastructure Deployment

Deploy the infrastructure locally first to get the output values needed for GitHub secrets:

```bash
cd infrastructure/terraform

# Initialize with S3 backend
terraform init -backend-config="bucket=cycling-ai-terraform-state-<ACCOUNT_ID>"

# Create workspaces for each environment
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Select prod workspace for initial deployment
terraform workspace select prod

# Create terraform.tfvars with your secrets
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual values

# Deploy infrastructure
terraform apply
```

Note the outputs:
- `lambda_url` - Lambda Function URL
- `s3_bucket_name` - S3 bucket for web assets
- `cloudfront_distribution_id` - CloudFront distribution ID
- `cloudfront_url` - Public URL for the web app

### 3. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### AWS Credentials
| Secret | Description | How to Get |
|--------|-------------|------------|
| `AWS_ACCESS_KEY_ID` | AWS access key | IAM Console → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | IAM Console → Users → Security credentials |
| `TERRAFORM_STATE_BUCKET` | S3 bucket for Terraform state | `cycling-ai-terraform-state-<ACCOUNT_ID>` |

#### Supabase Configuration
| Secret | Description | How to Get |
|--------|-------------|------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API |
| `SUPABASE_JWT_SECRET` | JWT secret for validation | Supabase Dashboard → Settings → API → JWT Settings |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL | (for web app build) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY | (for web app build) |

#### API Keys
| Secret | Description | How to Get |
|--------|-------------|------------|
| `ANTHROPIC_API_KEY` | Anthropic API key | console.anthropic.com |

#### Deployment Outputs (from terraform output)
| Secret | Description | How to Get |
|--------|-------------|------------|
| `NEXT_PUBLIC_API_URL` | Lambda Function URL | `terraform output lambda_url` |

**Note:** S3 bucket and CloudFront distribution IDs are automatically retrieved from Terraform state during deployment - no need to store them as secrets.

### 4. Create GitHub Environments

Go to GitHub repository → Settings → Environments

Create environments for each workspace:

**dev** environment:
- No protection rules needed
- Secrets: All secrets from step 3

**staging** environment (optional):
- Protection rules: Require reviewers (optional)
- Secrets: All secrets from step 3

**prod** environment:
- Protection rules: Require reviewers (recommended)
- Secrets: All secrets from step 3

**Note:** Environment-specific secrets (like `NEXT_PUBLIC_API_URL`) should point to the corresponding Lambda function URL for that environment.

## Deployment Workflow

### Automatic Deployments

The deployment workflow runs automatically when you push to `main` and any of these paths change:
- `src/**` - Python source code
- `web/**` - Next.js application
- `infrastructure/**` - Terraform configuration
- `requirements-lambda.txt` - Lambda dependencies

**Note:** Automatic deployments always target the `prod` environment.

### Manual Deployments

Trigger a deployment manually:

1. Go to Actions → Deploy → Run workflow
2. Select options:
   - **Environment**: Choose `dev`, `staging`, or `prod`
   - **Deploy Lambda function**: Update Lambda code
   - **Deploy web application**: Update S3/CloudFront
   - **Apply Terraform changes**: Update infrastructure

### Deploy to Different Environments

```bash
# Local deployment to dev
cd infrastructure/terraform
terraform workspace select dev
terraform apply

# Local deployment to prod
terraform workspace select prod
terraform apply
```

### Deployment Steps

The workflow performs these steps:

1. **Test** - Run Python test suite
2. **Build Lambda** - Create deployment package
3. **Build Web** - Create static export
4. **Terraform** - Plan and apply infrastructure changes
5. **Deploy Lambda** - Update Lambda function code
6. **Deploy Web** - Sync to S3 and invalidate CloudFront

## Monitoring

### CloudWatch Logs

Lambda logs are available in CloudWatch:
- Log group: `/aws/lambda/cycling-ai-api-prod`
- Retention: 14 days

### GitHub Actions

View deployment status:
- Go to Actions tab
- Click on the workflow run
- Check the summary for component status

## Rollback

### Lambda Rollback

```bash
# List Lambda versions
aws lambda list-versions-by-function --function-name cycling-ai-api-prod

# Rollback to previous version
aws lambda update-alias \
  --function-name cycling-ai-api-prod \
  --name live \
  --function-version <VERSION_NUMBER>
```

### Web Rollback

S3 bucket has versioning enabled:

```bash
# List object versions
aws s3api list-object-versions --bucket <S3_BUCKET_NAME>

# Restore previous version
aws s3api copy-object \
  --bucket <S3_BUCKET_NAME> \
  --copy-source <S3_BUCKET_NAME>/index.html?versionId=<VERSION_ID> \
  --key index.html
```

### Full Infrastructure Rollback

```bash
cd infrastructure/terraform
terraform plan -destroy
terraform destroy
```

## Troubleshooting

### Build Failures

**Lambda package too large:**
- Review `requirements-lambda.txt`
- Remove unnecessary dependencies
- Check for large transitive dependencies

**Web build fails:**
- Check Node.js version matches (v20)
- Verify environment variables are set
- Check for TypeScript errors

### Deployment Failures

**Terraform state lock:**
```bash
terraform force-unlock <LOCK_ID>
```

**Lambda update fails:**
- Check IAM permissions
- Verify function name matches
- Check Lambda limits (package size, timeout)

**S3 sync fails:**
- Verify bucket permissions
- Check bucket policy allows GitHub Actions role

### Runtime Errors

**Lambda 500 errors:**
- Check CloudWatch logs
- Verify environment variables
- Check Supabase connectivity

**CORS errors:**
- Verify Lambda CORS configuration
- Check CloudFront behaviors
- Verify CSP headers in next.config.ts

## Cost Estimation

All resources are within AWS Free Tier limits:

| Service | Free Tier | Expected Usage |
|---------|-----------|----------------|
| Lambda | 1M requests/month | ~10K requests |
| S3 | 5GB storage | ~100MB |
| CloudFront | 1TB transfer | ~1GB |
| DynamoDB | 25GB storage | ~1MB (state locks) |

**Estimated monthly cost: $0-0.50**

## Security Checklist

- [ ] GitHub secrets are set (not in code)
- [ ] terraform.tfvars is gitignored
- [ ] S3 bucket blocks public access
- [ ] Lambda uses least-privilege IAM role
- [ ] Supabase RLS policies are enabled
- [ ] JWT validation is enabled in Lambda
- [ ] HTTPS enforced (CloudFront redirect)

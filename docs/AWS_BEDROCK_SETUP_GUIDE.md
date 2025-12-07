# AWS Bedrock Setup Guide - Step by Step

Complete guide to setting up AWS Bedrock from scratch and using it with cycling-ai.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [Enable Model Access](#enable-model-access)
4. [Configure AWS Credentials](#configure-aws-credentials)
5. [Verify Setup](#verify-setup)
6. [Use with cycling-ai](#use-with-cycling-ai)
7. [Optional: Create Guardrails](#optional-create-guardrails)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ AWS Account (or permission to create one)
- ✅ Credit card for AWS billing
- ✅ cycling-ai installed (`pip install -e .`)
- ✅ Basic command line knowledge

**Estimated Setup Time:** 15-20 minutes

---

## AWS Account Setup

### Step 1: Create AWS Account (Skip if you have one)

1. **Navigate to AWS:**
   - Go to: https://aws.amazon.com/
   - Click "Create an AWS Account" (top right)

2. **Enter Account Information:**
   - Email address
   - Password
   - AWS account name (e.g., "My Cycling AI Account")

3. **Contact Information:**
   - Select account type: "Personal" or "Business"
   - Full name, phone number, address

4. **Payment Information:**
   - Enter credit card details
   - AWS will charge $1 to verify (refunded immediately)

5. **Identity Verification:**
   - Choose verification method (phone or SMS)
   - Enter verification code

6. **Select Support Plan:**
   - Choose "Basic Support - Free" (sufficient for most users)

7. **Wait for Activation:**
   - Usually takes 5-10 minutes
   - You'll receive confirmation email

### Step 2: Sign In to AWS Console

1. **Navigate to Console:**
   - Go to: https://console.aws.amazon.com/
   - Click "Sign In to the Console"

2. **Enter Credentials:**
   - Email address (root user)
   - Password
   - Click "Sign In"

3. **Enable MFA (Recommended):**
   - Click your account name (top right) → "Security credentials"
   - Under "Multi-factor authentication (MFA)" → "Assign MFA device"
   - Follow prompts (use app like Google Authenticator)

---

## Enable Model Access

**This is the most critical step - you must enable model access before using Bedrock.**

### Step 1: Navigate to Bedrock Console

1. **Open Bedrock Service:**
   - In AWS Console, search bar (top): type "Bedrock"
   - Click "Amazon Bedrock"
   - Or go directly to: https://console.aws.amazon.com/bedrock/

2. **Select Region:**
   - Top right corner: ensure you're in a supported region
   - **Recommended regions:**
     - `us-east-1` (N. Virginia) - Most models available
     - `us-west-2` (Oregon) - Good alternative
     - `eu-west-1` (Ireland) - For EU users

### Step 2: Request Model Access

1. **Navigate to Model Access:**
   - In Bedrock console, left menu
   - Click "Model access" (under "Bedrock configurations")

2. **Review Available Models:**
   - You'll see a list of foundation models
   - Status will show "Available to request"

3. **Select Models to Enable:**

   **For cycling-ai, recommended models:**

   - ✅ **Anthropic Claude 3.5 Sonnet** (Best quality, recommended)
     - Model ID: `anthropic.claude-3-5-sonnet-20241022-v2:0`
     - Use case: Production, high-quality reports
     - Price: ~$3 per million input tokens

   - ✅ **Anthropic Claude 3 Haiku** (Fast, cost-effective)
     - Model ID: `anthropic.claude-3-haiku-20240307-v1:0`
     - Use case: Development, testing, high-volume
     - Price: ~$0.25 per million input tokens

   - ⚠️ **Amazon Nova** (Optional, experimental)
     - Models: Nova Pro, Nova Lite
     - Use case: Cost optimization

   **How to select:**
   - Check the box next to each model you want
   - Or click "Modify model access" → "Select all Anthropic models"

4. **Submit Access Request:**
   - Click "Request model access" (bottom right)
   - Review your selections
   - Click "Submit"

5. **Wait for Approval:**
   - **Anthropic Claude:** Usually instant (1-2 minutes)
   - **Other models:** May take 1-24 hours
   - Status changes from "In progress" → "Access granted"
   - Refresh the page to see updates

6. **Verify Access:**
   - Once approved, status shows green "Access granted"
   - You can now use these models via API

**Important Notes:**
- Model access is **region-specific** (must enable in each region you use)
- Some models require use case justification (Claude usually doesn't)
- Free tier: AWS doesn't offer Bedrock free tier, but usage is pay-as-you-go

---

## Configure AWS Credentials

You have 3 options for authentication. Choose the one that fits your use case.

### Option 1: AWS CLI Configuration (Recommended for Most Users)

**Step 1: Install AWS CLI**

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download installer from: https://aws.amazon.com/cli/
```

**Step 2: Create IAM User with Bedrock Access**

1. **Navigate to IAM:**
   - AWS Console → Search "IAM" → Click "IAM"
   - Or go to: https://console.aws.amazon.com/iam/

2. **Create New User:**
   - Left menu: Click "Users"
   - Click "Create user" (top right)
   - User name: `cycling-ai-bedrock-user`
   - Click "Next"

3. **Set Permissions:**
   - Select "Attach policies directly"
   - Search for: `AmazonBedrockFullAccess`
   - Check the box next to it
   - Click "Next" → "Create user"

4. **Create Access Keys:**
   - Click on the newly created user
   - Click "Security credentials" tab
   - Scroll to "Access keys" section
   - Click "Create access key"
   - Select use case: "Command Line Interface (CLI)"
   - Check "I understand..." → Click "Next"
   - Description: "cycling-ai local development"
   - Click "Create access key"

5. **Save Credentials:**
   - **Access key ID:** Shows on screen (e.g., `AKIAIOSFODNN7EXAMPLE`)
   - **Secret access key:** Click "Show" (e.g., `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
   - ⚠️ **IMPORTANT:** Download CSV or copy both values NOW
   - You cannot view the secret key again!

**Step 3: Configure AWS CLI**

```bash
# Run configuration command
aws configure

# Enter when prompted:
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

**Verify Configuration:**

```bash
# Test AWS CLI
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/cycling-ai-bedrock-user"
# }

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Expected: List of models (no error)
```

### Option 2: Named AWS Profiles (For Multiple Accounts)

If you manage multiple AWS accounts or want to keep cycling-ai separate:

**Step 1: Create Named Profile**

```bash
# Configure named profile
aws configure --profile cycling-ai

# Enter credentials as above
```

**Step 2: Update cycling-ai Configuration**

Create/edit `.cycling-ai.yaml`:

```yaml
version: "1.3"

providers:
  bedrock:
    model: anthropic.claude-3-5-sonnet-20241022-v2:0
    region: us-east-1
    profile_name: cycling-ai  # Use named profile
```

**Or specify at command line:**

```bash
cycling-ai generate \
  --csv data.csv \
  --profile profile.json \
  --provider bedrock \
  --aws-profile cycling-ai
```

### Option 3: Environment Variables (For CI/CD)

**Best for:** Automated deployments, Docker containers, CI/CD pipelines

```bash
# Export credentials
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_DEFAULT_REGION="us-east-1"

# Verify
echo $AWS_ACCESS_KEY_ID
```

**Add to shell profile (persistent):**

```bash
# For bash
echo 'export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"' >> ~/.bashrc
echo 'export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"' >> ~/.bashrc
echo 'export AWS_DEFAULT_REGION="us-east-1"' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"' >> ~/.zshrc
echo 'export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"' >> ~/.zshrc
echo 'export AWS_DEFAULT_REGION="us-east-1"' >> ~/.zshrc
source ~/.zshrc
```

---

## Verify Setup

### Test 1: AWS CLI Bedrock Access

```bash
# List available models
aws bedrock list-foundation-models \
  --region us-east-1 \
  --by-provider anthropic

# Expected output: JSON with Claude models
```

### Test 2: cycling-ai Integration

**Create test athlete profile:**

```bash
cat > test_profile.json << 'EOF'
{
  "ftp": 250,
  "max_hr": 180,
  "weight_kg": 75,
  "age": 35,
  "goals": ["Test AWS Bedrock setup"]
}
EOF
```

**Test chat command:**

```bash
cycling-ai chat \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --profile test_profile.json

# Once in chat, type:
> What is my FTP?

# Expected response:
# Your FTP (Functional Threshold Power) is 250 watts...
```

**Test with Python:**

```python
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.providers.base import ProviderConfig, ProviderMessage

# Configure Bedrock
config = ProviderConfig(
    provider_name="bedrock",
    api_key="",  # Not needed
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    additional_params={"region": "us-east-1"}
)

# Create provider
provider = ProviderFactory.create_provider(config)

# Test completion
messages = [
    ProviderMessage(role="user", content="Say 'Bedrock is working!'")
]

response = provider.create_completion(messages)
print(response.content)
# Expected: "Bedrock is working!"
```

---

## Use with cycling-ai

### Method 1: Command Line (Quick Start)

**Generate report with Bedrock:**

```bash
cycling-ai generate \
  --csv ~/Downloads/activities.csv \
  --profile athlete_profile.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0
```

**Chat with Bedrock:**

```bash
cycling-ai chat \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --profile athlete_profile.json
```

**Specify region explicitly:**

```bash
cycling-ai generate \
  --csv data.csv \
  --profile profile.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --aws-region us-west-2
```

### Method 2: Configuration File (Recommended)

**Create `.cycling-ai.yaml` in project root or `~/.cycling-ai/.cycling-ai.yaml`:**

```yaml
version: "1.3"

providers:
  bedrock:
    model: anthropic.claude-3-5-sonnet-20241022-v2:0
    region: us-east-1
    # Optional: Use named profile
    # profile_name: cycling-ai

logging:
  level: INFO
  file: ~/.cycling-ai/logs/cycling-ai.log
  interactions_dir: ~/.cycling-ai/logs/llm_interactions

reports:
  output_dir: ./reports
  period_months: 6
```

**Then use simplified commands:**

```bash
# Uses config file defaults
cycling-ai generate \
  --csv data.csv \
  --profile profile.json \
  --provider bedrock

# Override model from config
cycling-ai generate \
  --csv data.csv \
  --profile profile.json \
  --provider bedrock \
  --model anthropic.claude-3-haiku-20240307-v1:0
```

### Method 3: Python API

```python
from cycling_ai.orchestration.workflows.full_report import FullReportWorkflow
from cycling_ai.orchestration.base import WorkflowConfig
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.providers.base import ProviderConfig
from pathlib import Path

# Configure Bedrock provider
provider_config = ProviderConfig(
    provider_name="bedrock",
    api_key="",
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    temperature=0.7,
    max_tokens=4096,
    additional_params={
        "region": "us-east-1",
        # "profile_name": "cycling-ai"  # Optional
    }
)

provider = ProviderFactory.create_provider(provider_config)

# Configure workflow
workflow_config = WorkflowConfig(
    csv_file_path=Path("activities.csv"),
    athlete_profile_path=Path("athlete_profile.json"),
    output_dir=Path("reports"),
    fit_directory=Path("fit_files"),  # Optional
    period_months=6,
    include_training_plan=True,
    training_plan_weeks=12,
)

# Execute workflow
workflow = FullReportWorkflow(provider=provider, config=workflow_config)
result = workflow.execute()

if result.success:
    print(f"Report generated: {result.output_files}")
else:
    print(f"Workflow failed: {result.error}")
```

---

## Optional: Create Guardrails

Guardrails provide content filtering and safety controls. **Note:** Not compatible with tool use.

### Step 1: Navigate to Guardrails

1. **Bedrock Console:**
   - https://console.aws.amazon.com/bedrock/
   - Left menu: "Guardrails"

2. **Create Guardrail:**
   - Click "Create guardrail"

### Step 2: Configure Guardrail

**Basic Information:**
- Name: `cycling-ai-content-filter`
- Description: "Content filtering for cycling AI app"

**Content Filters:**
- ✅ Hate speech: HIGH (blocks all)
- ✅ Insults: MEDIUM (blocks most)
- ✅ Sexual content: HIGH (blocks all)
- ✅ Violence: MEDIUM (blocks most)

**Denied Topics (Optional):**
- Click "Add denied topic"
- Topic: "Medical advice"
- Definition: "Providing medical diagnoses or treatment recommendations"

**Word Filters (Optional):**
- Profanity filtering: Enable
- Custom words: Add specific words to block

**PII Filters (Optional):**
- ✅ Email addresses
- ✅ Phone numbers
- ✅ Credit card numbers
- Action: "Block" or "Anonymize"

### Step 3: Create Version

1. **Review Configuration:**
   - Check all settings

2. **Create Version:**
   - Click "Create guardrail"
   - Wait for creation (1-2 minutes)
   - Note the Guardrail ID (e.g., `abc123def456`)

3. **Create Version:**
   - Click "Create version"
   - Version number: `1.0`
   - Description: "Initial production version"

### Step 4: Use with cycling-ai

**Important:** Guardrails only work without tools (use `--no-training-plan`).

```bash
# CLI usage
cycling-ai generate \
  --csv data.csv \
  --profile profile.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --guardrail-id abc123def456 \
  --guardrail-version 1.0 \
  --no-training-plan

# Configuration file
cat > .cycling-ai.yaml << 'EOF'
version: "1.3"

providers:
  bedrock:
    model: anthropic.claude-3-5-sonnet-20241022-v2:0
    region: us-east-1
    guardrail_id: abc123def456
    guardrail_version: "1.0"
    guardrail_trace: true  # Enable debugging
EOF
```

---

## Troubleshooting

### Error: "Could not connect to the endpoint URL"

**Cause:** Wrong region or region not enabled

**Solution:**
```bash
# Check your configured region
aws configure get region

# List regions with Bedrock
aws account list-regions --region-opt-in-status-contains ENABLED,OPTED_IN

# Update region
aws configure set region us-east-1

# Or specify in command
cycling-ai generate --aws-region us-east-1 ...
```

### Error: "AccessDeniedException"

**Cause:** Model access not enabled or insufficient IAM permissions

**Solution:**

1. **Check Model Access:**
   - Bedrock Console → Model access
   - Ensure status is "Access granted"
   - If not, request access again

2. **Check IAM Permissions:**
   - IAM Console → Users → Your user
   - Ensure `AmazonBedrockFullAccess` policy is attached

3. **Verify Credentials:**
   ```bash
   aws sts get-caller-identity
   # Check Account ID matches
   ```

### Error: "ResourceNotFoundException: Could not resolve model"

**Cause:** Model ID typo or model not available in region

**Solution:**

1. **List Available Models:**
   ```bash
   aws bedrock list-foundation-models \
     --region us-east-1 \
     --by-provider anthropic

   # Find exact model ID
   ```

2. **Check Region:**
   - Some models only available in specific regions
   - Try `us-east-1` (most models available)

3. **Use Correct Model ID:**
   ```bash
   # Correct IDs:
   anthropic.claude-3-5-sonnet-20241022-v2:0
   anthropic.claude-3-haiku-20240307-v1:0

   # NOT:
   claude-3-5-sonnet  # Wrong format
   ```

### Error: "ThrottlingException: Rate exceeded"

**Cause:** Too many requests in short time

**Solution:**

1. **Check Service Quotas:**
   - Service Quotas Console → AWS Bedrock
   - Default: 10 requests/second per model

2. **Request Quota Increase:**
   - Service Quotas → Request quota increase
   - Specify use case and desired limit

3. **Add Retry Logic:**
   - cycling-ai has built-in retry (3 attempts)
   - Exponential backoff: 1s, 2s, 4s

### Error: "Invalid credentials"

**Cause:** Access key/secret incorrect or expired

**Solution:**

1. **Verify Credentials:**
   ```bash
   aws sts get-caller-identity
   # Should show your user info
   ```

2. **Recreate Access Keys:**
   - IAM Console → Users → Security credentials
   - Deactivate old keys
   - Create new access key
   - Update `aws configure`

3. **Check Environment Variables:**
   ```bash
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_SECRET_ACCESS_KEY

   # If set, they override CLI config
   # Unset if needed:
   unset AWS_ACCESS_KEY_ID
   unset AWS_SECRET_ACCESS_KEY
   ```

### Costs Higher Than Expected

**Check Usage:**

```bash
# View Bedrock usage in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name InvocationCount \
  --dimensions Name=ModelId,Value=anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

**Cost Optimization:**

1. **Use Cheaper Models:**
   - Haiku: ~$0.25/M tokens (12x cheaper than Sonnet)
   - For development/testing

2. **Reduce Token Usage:**
   - Shorter analysis periods (`--period-months 3` instead of 12)
   - Disable training plans when not needed (`--no-training-plan`)

3. **Monitor Costs:**
   - AWS Cost Explorer → Bedrock
   - Set up billing alerts

---

## Next Steps

✅ **Setup Complete!** You can now:

1. **Generate Your First Report:**
   ```bash
   cycling-ai generate \
     --csv your_activities.csv \
     --profile your_profile.json \
     --provider bedrock
   ```

2. **Read Documentation:**
   - [AWS Bedrock User Guide](./AWS_BEDROCK_USER_GUIDE.md)
   - [Main README](../README.md)

3. **Join Community:**
   - Report issues: https://github.com/yourusername/cycling-ai-analysis/issues
   - Share feedback and improvements

4. **Optimize Setup:**
   - Create configuration file for your preferences
   - Set up cost alerts in AWS
   - Explore different models (Haiku for speed, Sonnet for quality)

---

## Quick Reference

### Essential Model IDs

```bash
# Anthropic Claude (Recommended)
anthropic.claude-3-5-sonnet-20241022-v2:0   # Best quality
anthropic.claude-3-haiku-20240307-v1:0      # Fast & cheap

# Amazon Nova (Optional)
amazon.nova-pro-v1:0                         # Balanced
amazon.nova-lite-v1:0                        # Cost-effective
```

### Essential AWS CLI Commands

```bash
# Configure credentials
aws configure

# Verify identity
aws sts get-caller-identity

# List models
aws bedrock list-foundation-models --region us-east-1

# Test Bedrock access
aws bedrock invoke-model \
  --region us-east-1 \
  --model-id anthropic.claude-3-haiku-20240307-v1:0 \
  --body '{"messages":[{"role":"user","content":"test"}],"anthropic_version":"bedrock-2023-05-31","max_tokens":100}' \
  output.json
```

### Essential cycling-ai Commands

```bash
# Generate report
cycling-ai generate --csv data.csv --profile profile.json --provider bedrock

# Start chat
cycling-ai chat --provider bedrock --profile profile.json

# Check configuration
cycling-ai config show

# View help
cycling-ai --help
cycling-ai generate --help
```

---

## Support

**Need Help?**
- 📖 Documentation: [AWS_BEDROCK_USER_GUIDE.md](./AWS_BEDROCK_USER_GUIDE.md)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/cycling-ai-analysis/issues)
- 📧 AWS Support: [AWS Support Center](https://console.aws.amazon.com/support/)

**Useful Resources:**
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)

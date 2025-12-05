# AWS Bedrock User Guide

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [AWS Credential Setup](#aws-credential-setup)
- [Model Selection](#model-selection)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## Overview

AWS Bedrock is Amazon's fully managed service for accessing foundation models from leading AI companies including Anthropic, Amazon, Meta, and Mistral. The Cycling AI Analysis tool now supports AWS Bedrock as a provider, giving you:

### Benefits
- **Pay-per-use pricing** - No monthly subscriptions, pay only for what you use
- **Multiple models** - Access Claude, Nova, Llama, and Mistral through one API
- **Enterprise features** - VPC support, encryption, audit logging, and compliance
- **Multi-region** - Deploy in your preferred AWS region for low latency
- **No API key management** - Uses your existing AWS credentials

### Supported Models
- **Anthropic Claude 3.5 Sonnet** - Best for complex analysis and tool calling
- **Anthropic Claude 3 Haiku** - Fast, cost-effective for simpler tasks
- **Amazon Nova** - AWS's own foundation models
- **Meta Llama 3.1/3.2** - Open source models with commercial use
- **Mistral Large** - European AI model with multilingual support

---

## Prerequisites

### 1. AWS Account
You need an active AWS account. Sign up at [aws.amazon.com](https://aws.amazon.com) if you don't have one.

### 2. Bedrock Model Access
Enable model access in the AWS Bedrock console:

1. Log into AWS Console
2. Navigate to **Amazon Bedrock**
3. Click **Model access** in left sidebar
4. Click **Manage model access**
5. Select the models you want to use (at minimum, enable **Claude 3.5 Sonnet**)
6. Click **Request model access**
7. Wait for approval (usually instant for most models)

### 3. AWS Credentials
Configure AWS credentials using one of these methods:
- AWS CLI (`aws configure`)
- Environment variables
- AWS credentials file
- IAM role (when running on AWS)
- Named profiles

See [AWS Credential Setup](#aws-credential-setup) for detailed instructions.

### 4. Dependencies
The `boto3` and `botocore` packages are installed automatically with Cycling AI:

```bash
pip install cycling-ai-analysis
```

---

## Quick Start

### 1. Configure AWS Credentials

**Option A: AWS CLI (Recommended)**
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter default output format (json)
```

**Option B: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### 2. Test Bedrock Connection

Start an interactive chat session:
```bash
cycling-ai chat --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0
```

If successful, you'll see:
```
✓ Provider initialized: bedrock (anthropic.claude-3-5-sonnet-20241022-v2:0)
```

### 3. Generate Your First Report

```bash
cycling-ai generate \
  --profile athlete_profile.json \
  --csv activities.csv \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0
```

---

## Configuration

### Command-Line Options

#### Provider Selection
```bash
--provider bedrock
```

#### Model Selection (Required)
```bash
--model anthropic.claude-3-5-sonnet-20241022-v2:0
```

#### AWS Region (Optional, default: us-east-1)
```bash
--aws-region us-west-2
```

#### AWS Profile (Optional)
```bash
--aws-profile my-profile-name
```

### Configuration File

Add Bedrock settings to `.cycling-ai.yaml`:

```yaml
# .cycling-ai.yaml
version: "1.3"

providers:
  bedrock:
    model: anthropic.claude-3-5-sonnet-20241022-v2:0
    # Optional: AWS-specific settings
    # region: us-east-1
    # profile_name: my-aws-profile
```

Then use it without CLI flags:
```bash
cycling-ai generate --profile athlete.json --provider bedrock
```

---

## Usage Examples

### Example 1: Generate Report with Bedrock

```bash
cycling-ai generate \
  --profile data/Eduardo/athlete_profile.json \
  --csv data/Eduardo/activities.csv \
  --fit-dir data/Eduardo/fit_files \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --output-dir ./reports
```

### Example 2: Interactive Chat with Specific Region

```bash
cycling-ai chat \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --aws-region eu-west-1 \
  --profile athlete_profile.json
```

### Example 3: Using Named AWS Profile

```bash
cycling-ai generate \
  --profile athlete.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --aws-profile production \
  --aws-region us-east-1
```

### Example 4: Cost-Optimized with Haiku

```bash
cycling-ai chat \
  --provider bedrock \
  --model anthropic.claude-3-haiku-20240307-v1:0 \
  --profile athlete.json
```

### Example 5: Using Amazon Nova

```bash
cycling-ai generate \
  --profile athlete.json \
  --provider bedrock \
  --model amazon.nova-pro-v1:0
```

---

## AWS Credential Setup

AWS Bedrock uses standard AWS credential resolution. Credentials are checked in this order:

### Method 1: AWS CLI (Recommended for Development)

```bash
# Install AWS CLI
# macOS: brew install awscli
# Linux: pip install awscli
# Windows: Download from aws.amazon.com

# Configure credentials
aws configure

# Test connection
aws bedrock list-foundation-models --region us-east-1
```

### Method 2: Environment Variables (CI/CD)

```bash
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_DEFAULT_REGION="us-east-1"

# Verify
cycling-ai chat --provider bedrock --model anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Method 3: Named Profiles (Multiple Accounts)

**Setup profiles in `~/.aws/credentials`:**
```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[production]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY

[development]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Use specific profile:**
```bash
cycling-ai generate \
  --profile athlete.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --aws-profile production
```

### Method 4: Credentials File (Default Profile)

AWS automatically checks `~/.aws/credentials` for the `[default]` profile.

### Method 5: IAM Role (Production on AWS)

When running on AWS infrastructure (EC2, ECS, Lambda), use IAM roles:

1. Create IAM role with Bedrock permissions
2. Attach role to your compute resource
3. No credentials needed in code

**Required IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
      ]
    }
  ]
}
```

---

## Model Selection

### Anthropic Claude 3.5 Sonnet (Recommended)

**Model ID:** `anthropic.claude-3-5-sonnet-20241022-v2:0`

**Best for:**
- Comprehensive cycling analysis reports
- Multi-phase workflows with tool calling
- Complex reasoning and planning
- High-quality natural language generation

**Pricing:** ~$3 per million input tokens, ~$15 per million output tokens

**Typical Report Cost:** $0.25-0.50 per complete report

### Anthropic Claude 3 Haiku (Budget Option)

**Model ID:** `anthropic.claude-3-haiku-20240307-v1:0`

**Best for:**
- Simple performance queries
- Quick chat interactions
- Cost-sensitive workloads
- High-volume analysis

**Pricing:** ~$0.25 per million input tokens, ~$1.25 per million output tokens

**Typical Report Cost:** $0.05-0.10 per report

### Amazon Nova Pro

**Model ID:** `amazon.nova-pro-v1:0`

**Best for:**
- AWS ecosystem integration
- Cost-effective alternative to Claude
- Multimodal capabilities (future)

**Pricing:** Competitive with Haiku, varies by region

### Meta Llama 3.1 70B

**Model ID:** `meta.llama3-1-70b-instruct-v1:0`

**Best for:**
- Open source preference
- Custom fine-tuning potential
- Research and experimentation

**Note:** Tool calling support may be limited compared to Claude

### Choosing the Right Model

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Production reports | Claude 3.5 Sonnet | Best quality, reliable tool calling |
| Development/testing | Claude 3 Haiku | Fast, cheap, good enough for iteration |
| High-volume batch | Claude 3 Haiku | Cost-effective at scale |
| Interactive chat | Claude 3.5 Sonnet | Better context understanding |
| Budget-constrained | Amazon Nova Pro | AWS-native, competitive pricing |

---

## Cost Optimization

### 1. Choose the Right Model

- **Development:** Use Claude 3 Haiku during testing
- **Production:** Use Claude 3.5 Sonnet only when needed
- **Batch processing:** Use Haiku for bulk analysis

### 2. Optimize Analysis Period

Shorter analysis periods = fewer tokens:
```bash
# More expensive (6 months of data)
cycling-ai generate --period-months 6 --provider bedrock

# Less expensive (3 months of data)
cycling-ai generate --period-months 3 --provider bedrock
```

### 3. Skip Training Plans When Not Needed

Training plans consume significant tokens:
```bash
cycling-ai generate \
  --profile athlete.json \
  --provider bedrock \
  --skip-training-plan  # Saves ~5,000 tokens
```

### 4. Use RAG Efficiently

Enable RAG to reduce context size:
```bash
cycling-ai generate \
  --profile athlete.json \
  --provider bedrock \
  --enable-rag \
  --rag-top-k 3  # Only retrieve 3 most relevant docs
```

### 5. Regional Pricing

Some regions have lower pricing:
- **us-east-1** (N. Virginia) - Usually cheapest
- **us-west-2** (Oregon) - Similar pricing
- **eu-west-1** (Ireland) - Slightly higher
- **ap-southeast-1** (Singapore) - Higher

### 6. Monitor Usage

Track your Bedrock costs in AWS Cost Explorer:
1. AWS Console → Cost Management → Cost Explorer
2. Filter by Service: "Amazon Bedrock"
3. Group by: Model ID

### 7. Set Budget Alerts

Create CloudWatch alarms for unexpected costs:
```bash
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://bedrock-budget.json
```

**Example Cost Scenarios:**

| Workload | Model | Monthly Reports | Est. Cost |
|----------|-------|-----------------|-----------|
| Single athlete | Claude 3.5 Sonnet | 4 reports | $1-2/month |
| Single athlete | Claude 3 Haiku | 4 reports | $0.20-0.40/month |
| Coaching (10 athletes) | Claude 3.5 Sonnet | 40 reports | $10-20/month |
| High-volume batch | Claude 3 Haiku | 200 reports | $10-20/month |

---

## Troubleshooting

### Error: "No module named 'boto3'"

**Solution:**
```bash
pip install boto3 botocore
```

### Error: "AccessDeniedException"

**Cause:** AWS credentials not configured or insufficient permissions

**Solutions:**
1. Verify credentials: `aws sts get-caller-identity`
2. Check IAM permissions include `bedrock:InvokeModel`
3. Ensure model access enabled in Bedrock console

### Error: "ResourceNotFoundException: Model not found"

**Cause:** Model not available in your region or access not enabled

**Solutions:**
1. Check model availability: `aws bedrock list-foundation-models --region us-east-1`
2. Enable model access in Bedrock console
3. Try different region: `--aws-region us-west-2`

### Error: "ThrottlingException"

**Cause:** Exceeded service quotas or rate limits

**Solutions:**
1. Add retry logic (already built-in)
2. Reduce concurrent requests
3. Request quota increase in AWS Console

### Error: "ValidationException: Invalid model identifier"

**Cause:** Incorrect model ID format

**Solution:** Use full model ARN format:
```bash
--model anthropic.claude-3-5-sonnet-20241022-v2:0
```

Not:
```bash
--model claude-3.5-sonnet  # Wrong format
```

### Connection Issues

**Test AWS connectivity:**
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Test specific model
aws bedrock invoke-model \
  --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --body '{"messages":[{"role":"user","content":"Hi"}],"max_tokens":100}' \
  --region us-east-1 \
  output.json
```

### Debugging Tips

**Enable verbose logging:**
```bash
cycling-ai generate --profile athlete.json --provider bedrock --verbose
```

**Check logs:**
```bash
tail -f ~/.cycling-ai/logs/cycling-ai.log
```

**Verify provider initialization:**
```python
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.providers.base import ProviderConfig

config = ProviderConfig(
    provider_name="bedrock",
    api_key="",
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    additional_params={"region": "us-east-1"}
)

provider = ProviderFactory.create_provider(config)
print(f"Provider initialized: {provider}")
```

---

## Advanced Topics

### Using Bedrock in Custom Scripts

```python
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.providers.base import ProviderConfig, ProviderMessage

# Configure Bedrock provider
config = ProviderConfig(
    provider_name="bedrock",
    api_key="",  # Not needed for Bedrock
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    temperature=0.7,
    max_tokens=4096,
    additional_params={
        "region": "us-east-1",
        # "profile_name": "my-profile"  # Optional
    }
)

# Create provider
provider = ProviderFactory.create_provider(config)

# Create messages
messages = [
    ProviderMessage(role="system", content="You are a cycling coach."),
    ProviderMessage(role="user", content="What's a good FTP test protocol?")
]

# Get completion
response = provider.create_completion(messages)
print(response.content)
```

### AWS Bedrock Guardrails

AWS Bedrock Guardrails provide content filtering, safety controls, and PII detection for your LLM applications. You can configure guardrails to ensure responsible AI usage.

#### Important Limitations

**Guardrails are NOT compatible with tool use** in Bedrock. If you enable guardrails when tools are configured, the system will:
1. Log a warning message
2. Skip guardrail configuration
3. Proceed with tool use enabled

This is a Bedrock platform limitation, not a cycling-ai limitation.

#### Creating a Guardrail

1. **Navigate to AWS Bedrock Console**
   - Go to: https://console.aws.amazon.com/bedrock/
   - Select "Guardrails" from the left menu
   - Click "Create guardrail"

2. **Configure Guardrail Policies**
   - **Content Filters**: Block harmful content (hate, insults, sexual, violence)
   - **Denied Topics**: Block specific topics (e.g., financial advice)
   - **Word Filters**: Block specific words or phrases
   - **PII Filters**: Detect and redact personally identifiable information
   - **Sensitive Information Filters**: Detect credentials, API keys, etc.

3. **Create Version**
   - After configuration, create a version (e.g., "1.0")
   - Or use "DRAFT" for testing

4. **Note the Guardrail ID**
   - Format: `guardrail-id` or full ARN
   - Example: `abc123def456` or `arn:aws:bedrock:us-east-1:123456789012:guardrail/abc123def456`

#### CLI Usage

**Basic Usage (without tools):**

```bash
# Generate report with guardrails (no training plan)
cycling-ai generate \
  --csv activities.csv \
  --profile profile.json \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --guardrail-id abc123def456 \
  --guardrail-version 1.0 \
  --no-training-plan

# Chat with guardrails
cycling-ai chat \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --guardrail-id abc123def456 \
  --guardrail-version DRAFT
```

**Important Notes:**
- Guardrails work with `--no-training-plan` (no tool use)
- Guardrails are automatically disabled when tools are present
- Default version is "DRAFT" if not specified
- Use `--guardrail-version 1.0` for production deployments

#### Configuration File

Add guardrails to your `.cycling-ai.yaml`:

```yaml
version: "1.3"

providers:
  bedrock:
    model: anthropic.claude-3-5-sonnet-20241022-v2:0
    region: us-east-1
    guardrail_id: abc123def456
    guardrail_version: "1.0"
    # Optional: Enable trace for debugging
    guardrail_trace: true
```

#### Python API

```python
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.providers.base import ProviderConfig, ProviderMessage

# Configure with guardrails
config = ProviderConfig(
    provider_name="bedrock",
    api_key="",
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    additional_params={
        "region": "us-east-1",
        "guardrail_id": "abc123def456",
        "guardrail_version": "1.0",
        "guardrail_trace": True,  # Optional: Enable trace
    }
)

provider = ProviderFactory.create_provider(config)

# Use without tools (guardrails enabled)
messages = [
    ProviderMessage(role="user", content="What's a good FTP test protocol?")
]
response = provider.create_completion(messages)  # Guardrails applied

# If you pass tools, guardrails are automatically skipped
from cycling_ai.tools.registry import get_global_registry
registry = get_global_registry()
tools = [registry.get_tool("analyze_performance").definition]

response = provider.create_completion(messages, tools=tools)  # No guardrails
# Warning: "Guardrails are not compatible with tool use in Bedrock. Skipping..."
```

#### Guardrail Trace (Debugging)

Enable trace to see detailed guardrail evaluation:

```python
config = ProviderConfig(
    provider_name="bedrock",
    api_key="",
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    additional_params={
        "region": "us-east-1",
        "guardrail_id": "abc123def456",
        "guardrail_version": "1.0",
        "guardrail_trace": True,  # Enable trace
    }
)

provider = ProviderFactory.create_provider(config)
response = provider.create_completion(messages)

# Access trace data
if "guardrail_trace" in response.metadata:
    trace = response.metadata["guardrail_trace"]
    print(f"Guardrail trace: {trace}")
```

#### Cost Implications

- **Guardrails pricing**: $0.75 per 1,000 input tokens, $1.00 per 1,000 output tokens
- **Additional latency**: ~200-500ms per request
- **Best practices**:
  - Use for sensitive/production workloads
  - Disable for development/testing
  - Monitor costs in CloudWatch

#### Common Use Cases

1. **Content Moderation**: Block harmful content in user inputs
2. **PII Protection**: Detect and redact personal information
3. **Compliance**: Enforce regulatory requirements (HIPAA, GDPR)
4. **Brand Safety**: Prevent off-brand responses
5. **Topic Control**: Block out-of-scope topics

#### Troubleshooting

**Guardrails not working:**
- Verify guardrail ID exists in your AWS account
- Check guardrail version is deployed (not just DRAFT)
- Ensure IAM permissions include `bedrock:ApplyGuardrail`
- Confirm you're NOT using tools (incompatible)

**Guardrail blocking valid content:**
- Review guardrail policies in Bedrock console
- Adjust content filter thresholds
- Test with trace enabled to see evaluation details
- Consider using "DRAFT" version for testing

**Performance issues:**
- Guardrails add ~200-500ms latency
- Consider caching common queries
- Use guardrails only for sensitive operations

#### Reference

- [AWS Bedrock Guardrails Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [Converse API with Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-converse-api.html)
- [Guardrails Pricing](https://aws.amazon.com/bedrock/pricing/)

---

### Multi-Region Deployment

Deploy in multiple regions for redundancy:

```python
regions = ["us-east-1", "us-west-2", "eu-west-1"]

for region in regions:
    try:
        config = ProviderConfig(
            provider_name="bedrock",
            api_key="",
            model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            additional_params={"region": region}
        )
        provider = ProviderFactory.create_provider(config)
        # Use provider
        break
    except Exception as e:
        print(f"Failed in {region}: {e}")
        continue
```

### VPC Endpoint Configuration

Use VPC endpoints for private connectivity:

1. Create VPC endpoint for Bedrock
2. Update security groups
3. No code changes needed (boto3 auto-detects)

### Cross-Account Access

Access Bedrock from different AWS account:

1. Create IAM role in target account
2. Add trust policy for source account
3. Use STS assume role in code

### Monitoring and Observability

**CloudWatch Metrics:**
- `Invocations` - Number of API calls
- `ModelInvocationLatency` - Response time
- `ModelInvocationClientErrors` - 4xx errors
- `ModelInvocationServerErrors` - 5xx errors

**X-Ray Tracing:**
Enable AWS X-Ray for distributed tracing:
```bash
export AWS_XRAY_SDK_ENABLED=true
```

---

## Additional Resources

### AWS Documentation
- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [Bedrock API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/)

### Model Documentation
- [Anthropic Claude Models](https://docs.anthropic.com/claude/docs)
- [Amazon Nova Models](https://docs.aws.amazon.com/nova/)
- [Meta Llama Models](https://llama.meta.com/)

### Security
- [AWS Security Best Practices](https://docs.aws.amazon.com/bedrock/latest/userguide/security-best-practices.html)
- [IAM Policies for Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/security_iam_service-with-iam.html)

### Support
- [Cycling AI GitHub Issues](https://github.com/eduardoarantes/cycling-ai-analysis/issues)
- [AWS Bedrock Support](https://console.aws.amazon.com/support/)

---

## Summary

AWS Bedrock integration provides:
- ✅ **Enterprise-grade** LLM access with AWS security
- ✅ **Cost-effective** pay-per-use pricing
- ✅ **Multiple models** from leading AI providers
- ✅ **Easy setup** using existing AWS credentials
- ✅ **Production-ready** with full tool calling support

**Next Steps:**
1. Configure AWS credentials
2. Enable model access in Bedrock console
3. Try the quick start example
4. Generate your first report with Bedrock

**Happy cycling! 🚴**

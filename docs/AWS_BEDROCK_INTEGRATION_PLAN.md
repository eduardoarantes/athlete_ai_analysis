# AWS Bedrock Integration Plan

**Project:** Cycling AI Analysis
**Date:** 2025-11-01
**Status:** Planning Phase

---

## Executive Summary

This document outlines the complete plan for integrating AWS Bedrock as an LLM provider for the cycling-ai-analysis project. AWS Bedrock provides access to multiple foundation models (Anthropic Claude, Meta Llama, Amazon Nova, etc.) through a unified API, offering benefits like:

- **Enterprise-grade infrastructure** with AWS reliability and security
- **Cost optimization** through batch processing (50% savings) and intelligent routing (30% savings)
- **Regional availability** with data residency compliance
- **Simplified billing** consolidated with other AWS services
- **No direct API key management** for third-party providers (uses AWS IAM)

---

## Table of Contents

1. [AWS Bedrock Overview](#1-aws-bedrock-overview)
2. [Architecture Design](#2-architecture-design)
3. [Implementation Plan](#3-implementation-plan)
4. [Code Examples](#4-code-examples)
5. [Cost Analysis](#5-cost-analysis)
6. [Testing Strategy](#6-testing-strategy)
7. [Deployment Considerations](#7-deployment-considerations)
8. [Migration Path](#8-migration-path)

---

## 1. AWS Bedrock Overview

### 1.1 What is AWS Bedrock?

AWS Bedrock is a fully managed service that provides access to foundation models from leading AI companies through a unified API. Instead of managing separate API keys and integrations for each provider, you access all models through AWS with IAM-based authentication.

### 1.2 Available Models (2025)

| Model Family | Model ID | Context Window | Best For |
|--------------|----------|----------------|----------|
| **Anthropic Claude** |
| Claude Sonnet 4.5 | `anthropic.claude-sonnet-4-5-v1` | 200K | Production workflows, coding, complex agents |
| Claude Sonnet 3.5 v2 | `anthropic.claude-3-5-sonnet-20241022-v2:0` | 200K | High-quality analysis |
| Claude Haiku 3.5 | `anthropic.claude-3-5-haiku-20241022-v1:0` | 200K | Fast, cost-effective tasks |
| **Amazon Nova** |
| Nova Pro | `amazon.nova-pro-v1:0` | 300K | Balanced performance |
| Nova Lite | `amazon.nova-lite-v1:0` | 300K | Fast, economical |
| **Meta Llama** |
| Llama 3.3 70B | `meta.llama3-3-70b-instruct-v1:0` | 128K | Open-source alternative |
| **OpenAI** |
| GPT-OSS 120B | Available via Bedrock | - | High-performance tasks |

### 1.3 Key Features for Our Use Case

**Tool Calling Support:**
- ✅ Anthropic Claude (all models)
- ✅ Amazon Nova Pro/Lite
- ✅ Meta Llama 3+ models
- ✅ Mistral Large
- ✅ Cohere Command R/R+

**Converse API:**
- Unified interface across all models
- Consistent tool calling format
- Built-in streaming support
- Simplified message handling

**Advanced Features (2025):**
- **Fine-grained tool streaming** - Stream tool parameters without buffering
- **Automatic tool call clearing** - Context management for long conversations
- **Latency-optimized inference** - Claude 3.5 Haiku runs faster on AWS than anywhere else
- **Intelligent prompt routing** - Automatically route to best model in family

---

## 2. Architecture Design

### 2.1 Provider Adapter Pattern

We'll follow the existing pattern established in the codebase:

```
BaseProvider (abstract)
├── AnthropicProvider (direct API)
├── OpenAIProvider (direct API)
├── GeminiProvider (direct API)
├── OllamaProvider (local)
└── BedrockProvider (NEW - unified AWS access)
```

### 2.2 BedrockProvider Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BedrockProvider                           │
│  Implements: BaseProvider                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  boto3 Client       │         │  Converse API       │
│  (bedrock-runtime)  │         │  - converse()       │
│                     │         │  - converse_stream()│
└─────────┬───────────┘         └─────────┬───────────┘
          │                               │
          v                               v
┌──────────────────────────────────────────────────────┐
│            AWS Bedrock Service                        │
│  • Model routing (Claude, Nova, Llama, etc.)         │
│  • IAM authentication                                │
│  • Regional deployment                               │
│  • Usage tracking & billing                          │
└──────────────────────────────────────────────────────┘
```

### 2.3 Configuration Schema

**Extended ProviderConfig:**

```python
@dataclass(frozen=True, slots=True)
class ProviderConfig:
    provider_name: str  # "bedrock"
    api_key: str  # Can be empty for Bedrock (uses AWS credentials)
    model: str  # e.g., "anthropic.claude-sonnet-4-5-v1"
    max_tokens: int = 4096
    temperature: float = 0.7
    additional_params: dict[str, Any] = field(default_factory=dict)
    # Bedrock-specific params in additional_params:
    # - region: str (e.g., "us-east-1")
    # - aws_access_key_id: str | None
    # - aws_secret_access_key: str | None
    # - aws_session_token: str | None
    # - profile_name: str | None
```

### 2.4 Message Format Mapping

**Our Standard → Bedrock Converse API:**

```python
# Our ProviderMessage
ProviderMessage(
    role="user",
    content="Analyze my performance",
    tool_calls=None,
    tool_results=None
)

# Maps to Bedrock format:
{
    "role": "user",
    "content": [
        {"text": "Analyze my performance"}
    ]
}

# Tool results format:
{
    "role": "user",
    "content": [
        {
            "toolResult": {
                "toolUseId": "tool-xyz",
                "content": [
                    {"json": {"result": "..."}}
                ]
            }
        }
    ]
}
```

---

## 3. Implementation Plan

### Phase 1: Core Provider Implementation (Week 1)

**Tasks:**
1. ✅ Create `src/cycling_ai/providers/bedrock_provider.py`
2. ✅ Implement `BedrockProvider` class extending `BaseProvider`
3. ✅ Implement required methods:
   - `convert_tool_schema()` - Convert to Bedrock tool format
   - `invoke_tool()` - Execute tools (delegate to registry)
   - `format_response()` - Format tool results for Bedrock
   - `create_completion()` - Call Bedrock Converse API
4. ✅ Add retry logic with exponential backoff
5. ✅ Add interaction logging

**Dependencies:**
```bash
boto3>=1.34.0
botocore>=1.34.0
```

**Deliverables:**
- Working `BedrockProvider` class
- Unit tests for message format conversion
- Unit tests for tool schema conversion

### Phase 2: CLI Integration (Week 1)

**Tasks:**
1. ✅ Register Bedrock provider in `providers/factory.py`
2. ✅ Add `bedrock` option to CLI commands:
   - `cycling-ai generate --provider bedrock`
   - `cycling-ai chat --provider bedrock`
3. ✅ Add `--aws-region` CLI option
4. ✅ Add `--aws-profile` CLI option
5. ✅ Update help text and documentation

**Example CLI usage:**
```bash
# Using default AWS credentials
cycling-ai generate --provider bedrock \
  --model anthropic.claude-sonnet-4-5-v1 \
  --profile profile.json

# Using specific AWS profile
cycling-ai chat --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --aws-profile production \
  --aws-region us-west-2

# Using environment variables
export AWS_REGION=us-east-1
export AWS_PROFILE=cycling-ai
cycling-ai generate --provider bedrock --model amazon.nova-pro-v1:0
```

**Deliverables:**
- Updated CLI with Bedrock support
- Integration tests for CLI commands

### Phase 3: Testing & Validation (Week 2)

**Tasks:**
1. ✅ Unit tests for BedrockProvider
   - Message format conversion
   - Tool schema conversion
   - Error handling (auth, API errors)
2. ✅ Integration tests with real Bedrock API
   - Single-turn completion
   - Multi-turn conversation
   - Tool calling workflow
   - Streaming responses (optional)
3. ✅ End-to-end workflow tests
   - Complete 4-phase report generation
   - Chat session with tool use
4. ✅ Performance benchmarking
   - Token usage comparison
   - Latency measurements
   - Cost calculations

**Test Data:**
- Use existing test CSV, FIT files, athlete profiles
- Mock Bedrock responses for unit tests
- Real Bedrock calls for integration tests (marked with `@pytest.mark.integration`)

**Deliverables:**
- 95%+ test coverage for BedrockProvider
- Performance benchmark report
- Cost comparison vs direct Anthropic API

### Phase 4: Documentation & Deployment (Week 2)

**Tasks:**
1. ✅ Update `CLAUDE.md` with Bedrock section
2. ✅ Create `docs/AWS_BEDROCK_GUIDE.md` user guide
3. ✅ Add cost optimization tips
4. ✅ Document AWS IAM permissions required
5. ✅ Update `DEPLOYMENT_CHECKLIST.md`
6. ✅ Create migration guide for existing users

**Deliverables:**
- Complete documentation
- Deployment guide
- Migration guide

---

## 4. Code Examples

### 4.1 BedrockProvider Implementation

```python
"""
AWS Bedrock provider adapter.

Implements the provider interface for AWS Bedrock foundation models.
Supports Anthropic Claude, Amazon Nova, Meta Llama, and other models
via the unified Converse API.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.interaction_logger import get_interaction_logger
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult

logger = logging.getLogger(__name__)


class BedrockProvider(BaseProvider):
    """
    AWS Bedrock provider adapter.

    Supports multiple foundation models through AWS Bedrock's unified API:
    - Anthropic Claude (Sonnet 4.5, Sonnet 3.5, Haiku 3.5)
    - Amazon Nova (Pro, Lite)
    - Meta Llama (3.3 70B, 3.1 405B)
    - OpenAI GPT-OSS models

    Uses boto3 Converse API for consistent interface across all models.

    Example:
        >>> config = ProviderConfig(
        ...     provider_name="bedrock",
        ...     api_key="",  # Uses AWS credentials instead
        ...     model="anthropic.claude-sonnet-4-5-v1",
        ...     additional_params={
        ...         "region": "us-east-1",
        ...         "profile_name": "default"
        ...     }
        ... )
        >>> provider = BedrockProvider(config)
        >>> response = provider.create_completion(messages)
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize Bedrock provider.

        Args:
            config: Provider configuration. API key not required (uses AWS credentials).
                   additional_params can include:
                   - region: AWS region (default: us-east-1)
                   - profile_name: AWS profile name (default: None)
                   - aws_access_key_id: AWS access key (default: None)
                   - aws_secret_access_key: AWS secret key (default: None)
                   - aws_session_token: AWS session token (default: None)
        """
        super().__init__(config)

        # Extract AWS-specific configuration
        region = config.additional_params.get("region", "us-east-1")
        profile_name = config.additional_params.get("profile_name")
        aws_access_key_id = config.additional_params.get("aws_access_key_id")
        aws_secret_access_key = config.additional_params.get("aws_secret_access_key")
        aws_session_token = config.additional_params.get("aws_session_token")

        # Create boto3 session
        session_kwargs: dict[str, Any] = {"region_name": region}
        if profile_name:
            session_kwargs["profile_name"] = profile_name

        session = boto3.Session(**session_kwargs)

        # Create Bedrock Runtime client
        client_kwargs: dict[str, Any] = {}
        if aws_access_key_id:
            client_kwargs["aws_access_key_id"] = aws_access_key_id
        if aws_secret_access_key:
            client_kwargs["aws_secret_access_key"] = aws_secret_access_key
        if aws_session_token:
            client_kwargs["aws_session_token"] = aws_session_token

        self.client = session.client("bedrock-runtime", **client_kwargs)
        self.region = region

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """
        Convert generic tool definitions to Bedrock tool specification format.

        Bedrock uses a unified tool format across all models via the Converse API.

        Args:
            tools: List of generic tool definitions

        Returns:
            List of Bedrock tool specifications

        Example:
            >>> schema = provider.convert_tool_schema([tool_def])
            >>> schema[0]["toolSpec"]["name"]
            'analyze_performance'
        """
        bedrock_tools = []

        for tool in tools:
            properties: dict[str, Any] = {}
            required: list[str] = []

            for param in tool.parameters:
                properties[param.name] = {
                    "type": param.type.lower(),
                    "description": param.description,
                }
                if param.enum:
                    properties[param.name]["enum"] = param.enum
                if param.items:
                    properties[param.name]["items"] = param.items
                if param.required:
                    required.append(param.name)

            bedrock_tools.append({
                "toolSpec": {
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": {
                        "json": {
                            "type": "object",
                            "properties": properties,
                            "required": required,
                        }
                    },
                }
            })

        return bedrock_tools

    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> ToolExecutionResult:
        """
        Execute a tool by delegating to the tool registry.

        Args:
            tool_name: Name of the tool to invoke
            parameters: Tool parameters

        Returns:
            Tool execution result

        Example:
            >>> result = provider.invoke_tool("analyze_performance", {"period_months": 6})
        """
        from cycling_ai.tools.registry import get_global_registry

        registry = get_global_registry()
        tool = registry.get_tool(tool_name)
        return tool.execute(**parameters)

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """
        Format tool execution result for Bedrock.

        Bedrock expects tool results in a specific format within user messages.

        Args:
            result: Tool execution result

        Returns:
            Bedrock-format tool result message

        Example:
            >>> formatted = provider.format_response(result)
            >>> formatted["role"]
            'user'
        """
        return {
            "role": "user",
            "content": [
                {
                    "toolResult": {
                        "toolUseId": result.metadata.get("tool_use_id", "unknown"),
                        "content": [
                            {"json": result.to_dict()}
                        ]
                    }
                }
            ],
        }

    @retry_with_exponential_backoff(max_retries=3, initial_delay=1.0)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
        force_tool_call: bool = False,
    ) -> CompletionResponse:
        """
        Create completion using Bedrock Converse API.

        Args:
            messages: Conversation messages
            tools: Available tools (optional)
            force_tool_call: If True, force model to call tool instead of text response

        Returns:
            Standardized completion response

        Raises:
            ValueError: If authentication fails or model not found
            RuntimeError: If API error occurs

        Example:
            >>> messages = [ProviderMessage(role="user", content="Hello")]
            >>> response = provider.create_completion(messages)
        """
        try:
            # Convert messages to Bedrock format
            bedrock_messages = self._convert_messages(messages)

            # Extract system message if present
            system_prompts = []
            for msg in messages:
                if msg.role == "system":
                    system_prompts.append({"text": msg.content})

            # Build request parameters
            request_params: dict[str, Any] = {
                "modelId": self.config.model,
                "messages": bedrock_messages,
                "inferenceConfig": {
                    "maxTokens": self.config.max_tokens,
                    "temperature": self.config.temperature,
                },
            }

            # Add system prompts if present
            if system_prompts:
                request_params["system"] = system_prompts

            # Add tools if provided
            if tools:
                tool_config: dict[str, Any] = {
                    "tools": self.convert_tool_schema(tools)
                }

                # Force tool calling if requested
                if force_tool_call:
                    tool_config["toolChoice"] = {"any": {}}

                request_params["toolConfig"] = tool_config

            # Track timing
            start_time = time.time()

            # Call Bedrock Converse API
            response = self.client.converse(**request_params)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Parse response
            output = response["output"]
            message = output["message"]

            # Extract content and tool calls
            content = ""
            tool_calls = None

            for content_block in message["content"]:
                if "text" in content_block:
                    content += content_block["text"]
                elif "toolUse" in content_block:
                    tool_use = content_block["toolUse"]
                    if tool_calls is None:
                        tool_calls = []
                    tool_calls.append({
                        "name": tool_use["name"],
                        "arguments": tool_use["input"],
                        "id": tool_use["toolUseId"],
                    })

            # Extract usage metrics
            usage = response.get("usage", {})

            completion_response = CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": self.config.model,
                    "usage": {
                        "input_tokens": usage.get("inputTokens", 0),
                        "output_tokens": usage.get("outputTokens", 0),
                    },
                    "stop_reason": response.get("stopReason", "unknown"),
                },
            )

            # Log the interaction
            try:
                interaction_logger = get_interaction_logger()
                interaction_logger.log_interaction(
                    provider_name="bedrock",
                    model=self.config.model,
                    messages=messages,
                    tools=tools,
                    response=completion_response,
                    duration_ms=duration_ms,
                )
            except Exception as e:
                logger.warning(f"Failed to log LLM interaction: {e}")

            return completion_response

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", str(e))

            if error_code == "AccessDeniedException":
                raise ValueError(
                    f"AWS Bedrock access denied. Check IAM permissions: {error_message}"
                ) from e
            elif error_code == "ResourceNotFoundException":
                raise ValueError(
                    f"Model not found: {self.config.model}. "
                    f"Ensure model access is enabled in AWS Console: {error_message}"
                ) from e
            else:
                raise RuntimeError(f"AWS Bedrock API error ({error_code}): {error_message}") from e

        except BotoCoreError as e:
            raise RuntimeError(f"AWS SDK error: {e}") from e

    def _convert_messages(self, messages: list[ProviderMessage]) -> list[dict[str, Any]]:
        """
        Convert ProviderMessage list to Bedrock message format.

        Args:
            messages: List of provider messages

        Returns:
            List of Bedrock-format messages
        """
        bedrock_messages: list[dict[str, Any]] = []

        for msg in messages:
            # Skip system messages (handled separately)
            if msg.role == "system":
                continue

            # Handle tool result messages
            if msg.role == "tool":
                tool_result_content = []
                if msg.tool_results:
                    for tool_result in msg.tool_results:
                        try:
                            result_data = json.loads(msg.content) if msg.content else {}
                        except json.JSONDecodeError:
                            result_data = {"response": msg.content}

                        tool_result_content.append({
                            "toolResult": {
                                "toolUseId": tool_result.get("tool_call_id", "unknown"),
                                "content": [{"json": result_data}]
                            }
                        })

                bedrock_messages.append({
                    "role": "user",
                    "content": tool_result_content
                })

            # Handle assistant messages with tool calls
            elif msg.role == "assistant" and msg.tool_calls:
                content_blocks: list[dict[str, Any]] = []

                # Add text content if present
                if msg.content:
                    content_blocks.append({"text": msg.content})

                # Add tool use blocks
                for tc in msg.tool_calls:
                    content_blocks.append({
                        "toolUse": {
                            "toolUseId": tc.get("id"),
                            "name": tc.get("name"),
                            "input": tc.get("arguments", {}),
                        }
                    })

                bedrock_messages.append({
                    "role": "assistant",
                    "content": content_blocks
                })

            # Handle regular messages
            else:
                if msg.content:  # Skip empty messages
                    bedrock_messages.append({
                        "role": msg.role,
                        "content": [{"text": msg.content}]
                    })

        return bedrock_messages
```

### 4.2 Factory Registration

```python
# In providers/factory.py, add to auto-registration section:

try:
    from cycling_ai.providers.bedrock_provider import BedrockProvider

    ProviderFactory.register_provider("bedrock", BedrockProvider)
except ImportError:
    pass
```

### 4.3 CLI Integration

```python
# In cli/commands/generate.py:

@click.option(
    "--provider",
    type=click.Choice(["anthropic", "openai", "gemini", "ollama", "bedrock"]),
    default="anthropic",
    help="LLM provider to use",
)
@click.option(
    "--aws-region",
    type=str,
    default="us-east-1",
    help="AWS region for Bedrock (only used with --provider bedrock)",
)
@click.option(
    "--aws-profile",
    type=str,
    help="AWS profile name for Bedrock (only used with --provider bedrock)",
)
def generate(
    csv_file: str,
    profile: str,
    fit_dir: str | None,
    provider: str,
    model: str | None,
    aws_region: str,
    aws_profile: str | None,
    output_dir: str,
    verbose: bool,
) -> None:
    """Generate comprehensive cycling performance reports."""

    # ... existing code ...

    # Build provider config
    additional_params = {}
    if provider == "bedrock":
        additional_params["region"] = aws_region
        if aws_profile:
            additional_params["profile_name"] = aws_profile

    config = ProviderConfig(
        provider_name=provider,
        api_key=api_key,
        model=model_name,
        additional_params=additional_params,
    )

    # ... rest of implementation ...
```

### 4.4 Usage Examples

```bash
# Example 1: Use Bedrock with default AWS credentials
cycling-ai generate \
  --provider bedrock \
  --model anthropic.claude-sonnet-4-5-v1 \
  --csv activities.csv \
  --profile profile.json \
  --fit-dir ./fit/

# Example 2: Use Bedrock with specific AWS profile
cycling-ai chat \
  --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --aws-profile cycling-prod \
  --aws-region us-west-2 \
  --profile profile.json

# Example 3: Use Amazon Nova for cost savings
cycling-ai generate \
  --provider bedrock \
  --model amazon.nova-pro-v1:0 \
  --csv activities.csv \
  --profile profile.json

# Example 4: Environment-based configuration
export AWS_REGION=eu-west-1
export AWS_PROFILE=default
cycling-ai generate --provider bedrock --model meta.llama3-3-70b-instruct-v1:0
```

---

## 5. Cost Analysis

### 5.1 Pricing Comparison (Per 1M Tokens)

**Anthropic Claude Models - Direct API vs Bedrock:**

| Model | Direct API (Input/Output) | Bedrock On-Demand (Input/Output) | Savings |
|-------|---------------------------|----------------------------------|---------|
| Claude Sonnet 4.5 | $3 / $15 | $3 / $15 | 0% |
| Claude Sonnet 3.5 | $3 / $15 | $3 / $15 | 0% |
| Claude Haiku 3.5 | $0.80 / $4 | $0.80 / $4 | 0% |

**Bedrock-Exclusive Models:**

| Model | Bedrock On-Demand (Input/Output) | Use Case |
|-------|----------------------------------|----------|
| Amazon Nova Pro | $0.80 / $3.20 | Balanced performance |
| Amazon Nova Lite | $0.06 / $0.24 | High-volume, cost-sensitive |
| Meta Llama 3.3 70B | $0.99 / $0.99 | Open-source alternative |

### 5.2 Cost Optimization Strategies

**1. Batch Inference (50% savings)**
```python
# For large workloads, use batch processing
# Available for Claude Sonnet 4 and OpenAI GPT-OSS models
# Runs asynchronously at 50% of on-demand pricing

additional_params = {
    "region": "us-east-1",
    "use_batch": True,  # Custom parameter for batch mode
}
```

**2. Intelligent Prompt Routing (30% savings)**
```python
# Automatically route simple queries to cheaper models
# Complex queries go to more capable models

additional_params = {
    "region": "us-east-1",
    "enable_intelligent_routing": True,
    "model_family": "claude",  # Routes within Claude family
}
```

**3. Model Selection by Use Case**

| Use Case | Recommended Model | Cost/Quality Ratio |
|----------|-------------------|-------------------|
| Production reports (Phase 1-4) | Claude Sonnet 4.5 | High quality |
| Chat interface | Claude Haiku 3.5 | Fast + economical |
| High-volume batch | Amazon Nova Lite | Most economical |
| Privacy-focused | Meta Llama 3.3 70B | Open-source |

### 5.3 Typical Workflow Costs

**4-Phase Report Generation:**

| Phase | Tokens (Input/Output) | Cost (Claude Sonnet 4.5) | Cost (Nova Pro) |
|-------|-----------------------|--------------------------|-----------------|
| Phase 1: Data Prep | 500/500 | $0.0075 | $0.002 |
| Phase 2: Performance | 6000/2000 | $0.048 | $0.011 |
| Phase 3: Training Plan | 4000/1000 | $0.027 | $0.007 |
| Phase 4: Report Data | 8000/2000 | $0.054 | $0.015 |
| **Total** | **18,500/5,500** | **$0.14** | **$0.035** |

**Annual Cost Estimates (100 reports/month):**

- **Claude Sonnet 4.5:** $168/year
- **Amazon Nova Pro:** $42/year (75% savings)
- **Claude Haiku 3.5:** $50/year (70% savings)

---

## 6. Testing Strategy

### 6.1 Unit Tests

```python
# tests/providers/test_bedrock_provider.py

import pytest
from unittest.mock import Mock, patch
from cycling_ai.providers.bedrock_provider import BedrockProvider
from cycling_ai.providers.base import ProviderConfig, ProviderMessage


class TestBedrockProvider:
    """Test suite for BedrockProvider."""

    @pytest.fixture
    def config(self):
        """Create test configuration."""
        return ProviderConfig(
            provider_name="bedrock",
            api_key="",
            model="anthropic.claude-sonnet-4-5-v1",
            additional_params={"region": "us-east-1"}
        )

    @pytest.fixture
    def provider(self, config):
        """Create provider instance."""
        with patch("boto3.Session"):
            return BedrockProvider(config)

    def test_convert_tool_schema(self, provider):
        """Test tool schema conversion to Bedrock format."""
        from cycling_ai.tools.base import ToolDefinition, ToolParameter

        tool = ToolDefinition(
            name="test_tool",
            description="Test tool",
            parameters=[
                ToolParameter(
                    name="param1",
                    type="string",
                    description="Test parameter",
                    required=True
                )
            ]
        )

        schema = provider.convert_tool_schema([tool])

        assert len(schema) == 1
        assert schema[0]["toolSpec"]["name"] == "test_tool"
        assert "inputSchema" in schema[0]["toolSpec"]
        assert schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]["param1"]["type"] == "string"

    def test_convert_messages(self, provider):
        """Test message format conversion."""
        messages = [
            ProviderMessage(role="system", content="You are a helpful assistant"),
            ProviderMessage(role="user", content="Hello"),
        ]

        bedrock_messages = provider._convert_messages(messages)

        # System message should be filtered out
        assert len(bedrock_messages) == 1
        assert bedrock_messages[0]["role"] == "user"
        assert bedrock_messages[0]["content"][0]["text"] == "Hello"

    @patch("boto3.Session")
    def test_create_completion_success(self, mock_session, config):
        """Test successful completion creation."""
        mock_client = Mock()
        mock_session.return_value.client.return_value = mock_client

        mock_client.converse.return_value = {
            "output": {
                "message": {
                    "content": [{"text": "Hello! How can I help?"}]
                }
            },
            "usage": {"inputTokens": 10, "outputTokens": 20},
            "stopReason": "end_turn"
        }

        provider = BedrockProvider(config)
        messages = [ProviderMessage(role="user", content="Hello")]

        response = provider.create_completion(messages)

        assert response.content == "Hello! How can I help?"
        assert response.metadata["usage"]["input_tokens"] == 10
        assert response.metadata["usage"]["output_tokens"] == 20

    @patch("boto3.Session")
    def test_create_completion_with_tools(self, mock_session, config):
        """Test completion with tool calling."""
        mock_client = Mock()
        mock_session.return_value.client.return_value = mock_client

        mock_client.converse.return_value = {
            "output": {
                "message": {
                    "content": [{
                        "toolUse": {
                            "toolUseId": "tool-123",
                            "name": "analyze_performance",
                            "input": {"period_months": 6}
                        }
                    }]
                }
            },
            "usage": {"inputTokens": 50, "outputTokens": 30},
            "stopReason": "tool_use"
        }

        provider = BedrockProvider(config)
        messages = [ProviderMessage(role="user", content="Analyze my performance")]

        from cycling_ai.tools.base import ToolDefinition, ToolParameter
        tools = [ToolDefinition(
            name="analyze_performance",
            description="Analyze performance",
            parameters=[ToolParameter(
                name="period_months",
                type="integer",
                description="Period in months",
                required=True
            )]
        )]

        response = provider.create_completion(messages, tools=tools)

        assert response.tool_calls is not None
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "analyze_performance"
        assert response.tool_calls[0]["arguments"]["period_months"] == 6
```

### 6.2 Integration Tests

```python
# tests/integration/test_bedrock_integration.py

import pytest
import os
from cycling_ai.providers.bedrock_provider import BedrockProvider
from cycling_ai.providers.base import ProviderConfig, ProviderMessage


@pytest.mark.integration
class TestBedrockIntegration:
    """Integration tests with real AWS Bedrock API."""

    @pytest.fixture
    def config(self):
        """Create real configuration from environment."""
        # Requires AWS credentials configured (env vars or ~/.aws/credentials)
        return ProviderConfig(
            provider_name="bedrock",
            api_key="",
            model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            additional_params={
                "region": os.environ.get("AWS_REGION", "us-east-1")
            }
        )

    @pytest.fixture
    def provider(self, config):
        """Create provider with real credentials."""
        return BedrockProvider(config)

    def test_simple_completion(self, provider):
        """Test simple text completion."""
        messages = [
            ProviderMessage(role="user", content="What is 2+2? Answer with just the number.")
        ]

        response = provider.create_completion(messages)

        assert response.content
        assert "4" in response.content
        assert response.metadata["usage"]["input_tokens"] > 0
        assert response.metadata["usage"]["output_tokens"] > 0

    def test_tool_calling_workflow(self, provider):
        """Test complete tool calling workflow."""
        from cycling_ai.tools.registry import get_global_registry

        registry = get_global_registry()
        tools = [registry.get_tool("analyze_performance").to_definition()]

        # First turn: User asks for analysis
        messages = [
            ProviderMessage(
                role="user",
                content="Analyze cycling performance for the last 6 months using CSV at test_data.csv"
            )
        ]

        response = provider.create_completion(messages, tools=tools)

        # Should request tool call
        assert response.tool_calls is not None
        assert len(response.tool_calls) > 0
        assert response.tool_calls[0]["name"] == "analyze_performance"
```

---

## 7. Deployment Considerations

### 7.1 AWS IAM Permissions

**Required IAM Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
        "arn:aws:bedrock:*::foundation-model/meta.llama*"
      ]
    },
    {
      "Sid": "BedrockConverse",
      "Effect": "Allow",
      "Action": [
        "bedrock:Converse",
        "bedrock:ConverseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

**Model Access:**
- Enable model access in AWS Console → Bedrock → Model access
- Request access for specific models (Claude, Nova, etc.)
- Access approval is usually instant for most models

### 7.2 Environment Variables

```bash
# AWS credentials (one of these methods):

# Method 1: Default credentials file (~/.aws/credentials)
# No environment variables needed

# Method 2: Environment variables
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1

# Method 3: AWS profile
export AWS_PROFILE=cycling-ai
export AWS_REGION=us-east-1

# Method 4: IAM role (for EC2/ECS/Lambda)
# No environment variables needed - uses instance metadata
```

### 7.3 Regional Availability

**Bedrock Model Availability by Region (2025):**

| Region | Claude 4.5 | Claude 3.5 | Nova | Llama 3.3 |
|--------|-----------|------------|------|-----------|
| us-east-1 | ✅ | ✅ | ✅ | ✅ |
| us-west-2 | ✅ | ✅ | ✅ | ✅ |
| eu-west-1 | ✅ | ✅ | ✅ | ✅ |
| ap-southeast-1 | ✅ | ✅ | ❌ | ✅ |
| eu-central-1 | ⚠️ | ✅ | ❌ | ✅ |

**Recommendation:** Use `us-east-1` or `us-west-2` for best model availability.

### 7.4 Deployment Checklist

- [ ] AWS account created and configured
- [ ] IAM user/role created with Bedrock permissions
- [ ] Model access enabled in Bedrock console
- [ ] AWS credentials configured (profile or env vars)
- [ ] Region selected based on data residency requirements
- [ ] Dependencies installed: `boto3>=1.34.0`, `botocore>=1.34.0`
- [ ] Integration tests passing with real Bedrock API
- [ ] Cost monitoring configured (AWS CloudWatch, Cost Explorer)
- [ ] Logging configured for debugging

---

## 8. Migration Path

### 8.1 For Existing Users

**Current Setup:**
```bash
# Using direct Anthropic API
export ANTHROPIC_API_KEY=sk-ant-...
cycling-ai generate --provider anthropic --model claude-3-5-sonnet-20241022
```

**Migrating to Bedrock:**

**Step 1:** Set up AWS credentials
```bash
# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region, Output format
```

**Step 2:** Enable model access
```bash
# Open AWS Console → Bedrock → Model access
# Click "Request model access"
# Select: Anthropic Claude models
# Submit request (usually instant approval)
```

**Step 3:** Update commands
```bash
# Same workflow, different provider
cycling-ai generate --provider bedrock --model anthropic.claude-sonnet-4-5-v1
```

### 8.2 Gradual Migration Strategy

**Phase 1: Testing (Week 1)**
- Set up Bedrock access
- Run integration tests
- Compare outputs between direct API and Bedrock
- Validate cost savings

**Phase 2: Parallel Running (Week 2-3)**
- Run some workflows with Bedrock
- Keep direct API as fallback
- Monitor performance and costs

**Phase 3: Full Migration (Week 4)**
- Switch default provider to Bedrock
- Update documentation
- Archive direct API keys

### 8.3 Rollback Plan

If issues occur with Bedrock:

1. **Immediate fallback:**
   ```bash
   # Simply switch back to direct API
   cycling-ai generate --provider anthropic
   ```

2. **No data loss:**
   - All tools work identically
   - Session format is the same
   - Reports are identical

3. **Cost optimization still available:**
   - Can use cheaper models (Haiku) with direct API
   - Bedrock not required for cost savings

---

## Summary & Recommendations

### Recommended Implementation Timeline

- **Week 1:** Implement BedrockProvider + CLI integration
- **Week 2:** Testing, documentation, deployment guide
- **Total:** 2 weeks to production-ready

### When to Use Bedrock vs Direct APIs

**Use Bedrock when:**
- ✅ Already using AWS infrastructure
- ✅ Need consolidated billing
- ✅ Want cost optimization (batch, routing)
- ✅ Require data residency compliance
- ✅ Want to try Amazon Nova or other exclusive models

**Use Direct APIs when:**
- ✅ Minimal infrastructure complexity
- ✅ Only need one provider (Anthropic)
- ✅ Want latest model releases first (direct APIs get updates faster)
- ✅ No AWS account

### Cost Optimization Recommendations

1. **Start with Nova Pro** for 75% cost savings vs Claude Sonnet
2. **Use batch processing** for report generation (50% savings)
3. **Enable intelligent routing** within Claude family (30% savings)
4. **Reserve Claude Sonnet 4.5** for complex phases only

### Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/bedrock-provider`
3. Implement Phase 1 (core provider)
4. Run integration tests
5. Deploy to production

---

**Questions or Concerns?**

Please review this plan and provide feedback on:
- Architecture decisions
- Cost estimates
- Timeline
- Testing strategy
- Documentation needs

---

**Document Version:** 1.0
**Last Updated:** 2025-11-01
**Author:** Claude Code
**Status:** Awaiting Review

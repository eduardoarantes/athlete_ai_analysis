# Phase 2 Implementation Plan: Provider Adapters

**Project:** Cycling AI Analysis - Generic Multi-Provider Architecture
**Phase:** 2 - Provider Adapters
**Status:** READY TO START
**Created:** October 24, 2025
**Prerequisites:** Phase 1 Complete (Base Abstractions, Business Logic Extraction)

---

## Executive Summary

Phase 2 implements LLM provider adapters that enable the Cycling AI Analysis system to work with multiple AI providers. This phase builds upon the base abstractions created in Phase 1 and delivers production-ready adapters for OpenAI, Anthropic Claude, Google Gemini, and Ollama (local models).

**Key Deliverables:**
- 4 production-ready provider adapters
- Provider factory with automatic registration
- Comprehensive test suite (>85% coverage)
- Integration testing framework
- Updated dependencies and documentation

**Estimated Duration:** 8-10 hours
**Approach:** Test-Driven Development (TDD)
**Success Criteria:** All adapters functional, >85% test coverage, type-safe

---

## Table of Contents

1. [Requirements Analysis](#requirements-analysis)
2. [Architecture Design](#architecture-design)
3. [Provider Specifications](#provider-specifications)
4. [Implementation Strategy](#implementation-strategy)
5. [Testing Approach](#testing-approach)
6. [Task Cards](#task-cards)
7. [Dependencies](#dependencies)
8. [Success Metrics](#success-metrics)
9. [Risk Assessment](#risk-assessment)

---

## Requirements Analysis

### Functional Requirements

**FR-1: Provider Adapter Interface**
- Each adapter MUST extend `BaseProvider` abstract class
- Each adapter MUST implement all abstract methods:
  - `convert_tool_schema()` - Convert generic tool definitions to provider format
  - `invoke_tool()` - Execute tools with provider-specific handling
  - `format_response()` - Format tool results for provider
  - `create_completion()` - Generate completions using provider API

**FR-2: Multi-Provider Support**
- Support OpenAI (GPT-4, GPT-3.5-turbo)
- Support Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Support Google Gemini (Gemini 1.5 Pro, Gemini 2.0 Flash)
- Support Ollama (Llama 3, Mistral, local models)

**FR-3: Tool/Function Calling**
- Each adapter MUST convert generic `ToolDefinition` to provider-specific schema
- Support native function calling where available (OpenAI, Anthropic, Gemini)
- Implement fallback strategy for providers without native tool support (some Ollama models)
- Extract tool calls from provider responses and normalize to standard format

**FR-4: Authentication & Configuration**
- Support API key authentication (OpenAI, Anthropic, Gemini)
- Support base URL configuration (Ollama, custom endpoints)
- Validate configuration on initialization
- Clear error messages for missing/invalid credentials

**FR-5: Error Handling & Retry Logic**
- Implement exponential backoff for rate limits
- Handle provider-specific error codes
- Retry transient failures (network, timeout)
- Do NOT retry permanent failures (invalid API key, model not found)
- Maximum 3 retry attempts with configurable backoff

**FR-6: Response Normalization**
- All provider responses MUST be normalized to `CompletionResponse` format
- Preserve provider-specific metadata (model, tokens used, finish reason)
- Extract content and tool calls consistently
- Handle streaming responses (future: Phase 3)

### Non-Functional Requirements

**NFR-1: Type Safety**
- All code MUST pass `mypy --strict`
- Complete type hints for all functions, methods, and variables
- No `Any` types except where interfacing with untyped provider SDKs

**NFR-2: Test Coverage**
- Minimum 85% code coverage for all provider adapters
- 100% coverage for critical paths (authentication, tool conversion, completion)
- Unit tests with mocked provider APIs
- Optional integration tests with real APIs (requires keys)

**NFR-3: Performance**
- Provider initialization < 100ms
- Tool schema conversion < 50ms for 10 tools
- Completion calls limited only by provider API latency
- No unnecessary serialization/deserialization overhead

**NFR-4: Maintainability**
- Each provider in separate file (`openai_provider.py`, `anthropic_provider.py`, etc.)
- Shared utilities in `provider_utils.py`
- Clear separation between provider-specific and shared code
- Comprehensive docstrings following Google style

**NFR-5: Security**
- API keys stored in `ProviderConfig`, never logged
- Secure credential handling
- No hardcoded secrets in tests (use environment variables or mocks)

---

## Architecture Design

### Component Overview

```
src/cycling_ai/providers/
├── __init__.py                 # Public exports
├── base.py                     # Base abstractions (Phase 1)
├── factory.py                  # NEW: Provider factory
├── provider_utils.py           # NEW: Shared utilities
├── openai_provider.py          # NEW: OpenAI adapter
├── anthropic_provider.py       # NEW: Anthropic adapter
├── gemini_provider.py          # NEW: Google Gemini adapter
└── ollama_provider.py          # NEW: Ollama adapter

tests/providers/
├── __init__.py
├── test_base.py                # Existing
├── test_factory.py             # NEW: Factory tests
├── test_openai_provider.py     # NEW: OpenAI adapter tests
├── test_anthropic_provider.py  # NEW: Anthropic adapter tests
├── test_gemini_provider.py     # NEW: Gemini adapter tests
├── test_ollama_provider.py     # NEW: Ollama adapter tests
└── conftest.py                 # NEW: Test fixtures
```

### Class Diagram

```
BaseProvider (ABC)
    │
    ├── OpenAIProvider
    │   ├── convert_tool_schema() → OpenAI function schema
    │   ├── invoke_tool() → Execute tool
    │   ├── format_response() → OpenAI message format
    │   └── create_completion() → OpenAI Chat Completion
    │
    ├── AnthropicProvider
    │   ├── convert_tool_schema() → Anthropic tool schema
    │   ├── invoke_tool() → Execute tool
    │   ├── format_response() → Anthropic message format
    │   └── create_completion() → Anthropic Messages API
    │
    ├── GeminiProvider
    │   ├── convert_tool_schema() → Gemini function declaration
    │   ├── invoke_tool() → Execute tool
    │   ├── format_response() → Gemini response format
    │   └── create_completion() → Gemini Generate Content
    │
    └── OllamaProvider
        ├── convert_tool_schema() → Ollama tool schema
        ├── invoke_tool() → Execute tool
        ├── format_response() → Ollama message format
        └── create_completion() → Ollama Generate

ProviderFactory
    ├── register_provider(name, class)
    ├── create_provider(config) → BaseProvider
    └── list_providers() → list[str]
```

### Data Flow

```
1. User creates ProviderConfig
   │
   ├─> provider_name: "openai"
   ├─> api_key: "sk-..."
   ├─> model: "gpt-4"
   └─> max_tokens: 4096

2. ProviderFactory.create_provider(config)
   │
   ├─> Lookup provider class by name
   ├─> Instantiate provider with config
   └─> Return BaseProvider instance

3. Provider.create_completion(messages, tools)
   │
   ├─> Convert tools to provider schema
   ├─> Build provider-specific request
   ├─> Call provider API
   ├─> Parse provider response
   ├─> Extract content and tool calls
   └─> Return CompletionResponse

4. CompletionResponse
   │
   ├─> content: str
   ├─> tool_calls: list[dict] | None
   └─> metadata: dict (model, tokens, etc.)
```

---

## Provider Specifications

### 1. OpenAI Provider

**SDK:** `openai` (v1.0+)
**Models:** GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
**Function Calling:** Native support via `tools` parameter

#### Tool Schema Format

OpenAI uses the following schema for function definitions:

```python
{
    "type": "function",
    "function": {
        "name": "tool_name",
        "description": "Tool description",
        "parameters": {
            "type": "object",
            "properties": {
                "param_name": {
                    "type": "string",
                    "description": "Parameter description",
                    "enum": ["value1", "value2"]  # Optional
                }
            },
            "required": ["param_name"]
        }
    }
}
```

#### Conversion Logic

```python
def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
    """Convert generic tools to OpenAI function schema."""
    openai_tools = []
    for tool in tools:
        properties = {}
        required = []

        for param in tool.parameters:
            properties[param.name] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                properties[param.name]["enum"] = param.enum
            if param.required:
                required.append(param.name)

        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                }
            }
        })

    return openai_tools
```

#### API Call Pattern

```python
import openai

client = openai.OpenAI(api_key=self.config.api_key)

response = client.chat.completions.create(
    model=self.config.model,
    messages=[{"role": m.role, "content": m.content} for m in messages],
    tools=self.convert_tool_schema(tools) if tools else None,
    max_tokens=self.config.max_tokens,
    temperature=self.config.temperature,
)

# Extract response
content = response.choices[0].message.content or ""
tool_calls = None
if response.choices[0].message.tool_calls:
    tool_calls = [
        {
            "name": tc.function.name,
            "arguments": json.loads(tc.function.arguments),
            "id": tc.id,
        }
        for tc in response.choices[0].message.tool_calls
    ]

return CompletionResponse(
    content=content,
    tool_calls=tool_calls,
    metadata={
        "model": response.model,
        "usage": response.usage.model_dump(),
        "finish_reason": response.choices[0].finish_reason,
    }
)
```

#### Error Handling

```python
from openai import (
    AuthenticationError,
    RateLimitError,
    APIConnectionError,
    APIError,
)

try:
    response = client.chat.completions.create(...)
except AuthenticationError as e:
    raise ValueError(f"Invalid OpenAI API key: {e}")
except RateLimitError as e:
    # Retry with exponential backoff
    pass
except APIConnectionError as e:
    # Retry with exponential backoff
    pass
except APIError as e:
    raise RuntimeError(f"OpenAI API error: {e}")
```

---

### 2. Anthropic Provider

**SDK:** `anthropic` (v0.18+)
**Models:** Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet
**Function Calling:** Native support via `tools` parameter (Messages API)

#### Tool Schema Format

Anthropic uses the following schema:

```python
{
    "name": "tool_name",
    "description": "Tool description",
    "input_schema": {
        "type": "object",
        "properties": {
            "param_name": {
                "type": "string",
                "description": "Parameter description"
            }
        },
        "required": ["param_name"]
    }
}
```

#### Conversion Logic

```python
def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
    """Convert generic tools to Anthropic tool schema."""
    anthropic_tools = []
    for tool in tools:
        properties = {}
        required = []

        for param in tool.parameters:
            properties[param.name] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                properties[param.name]["enum"] = param.enum
            if param.required:
                required.append(param.name)

        anthropic_tools.append({
            "name": tool.name,
            "description": tool.description,
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required,
            }
        })

    return anthropic_tools
```

#### API Call Pattern

```python
import anthropic

client = anthropic.Anthropic(api_key=self.config.api_key)

# Separate system message
system_msg = None
user_messages = []
for msg in messages:
    if msg.role == "system":
        system_msg = msg.content
    else:
        user_messages.append({
            "role": msg.role,
            "content": msg.content
        })

response = client.messages.create(
    model=self.config.model,
    system=system_msg,
    messages=user_messages,
    tools=self.convert_tool_schema(tools) if tools else None,
    max_tokens=self.config.max_tokens,
    temperature=self.config.temperature,
)

# Extract response
content = ""
tool_calls = None

for block in response.content:
    if block.type == "text":
        content += block.text
    elif block.type == "tool_use":
        if tool_calls is None:
            tool_calls = []
        tool_calls.append({
            "name": block.name,
            "arguments": block.input,
            "id": block.id,
        })

return CompletionResponse(
    content=content,
    tool_calls=tool_calls,
    metadata={
        "model": response.model,
        "usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
        "stop_reason": response.stop_reason,
    }
)
```

#### Error Handling

```python
from anthropic import (
    AuthenticationError,
    RateLimitError,
    APIConnectionError,
    APIError,
)

# Similar to OpenAI error handling
```

---

### 3. Google Gemini Provider

**SDK:** `google-generativeai` (v0.3+)
**Models:** Gemini 1.5 Pro, Gemini 2.0 Flash
**Function Calling:** Native support via function declarations

#### Tool Schema Format

Gemini uses function declarations:

```python
{
    "name": "tool_name",
    "description": "Tool description",
    "parameters": {
        "type": "object",
        "properties": {
            "param_name": {
                "type": "string",
                "description": "Parameter description"
            }
        },
        "required": ["param_name"]
    }
}
```

#### Conversion Logic

```python
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[Tool]:
    """Convert generic tools to Gemini function declarations."""
    function_declarations = []

    for tool in tools:
        properties = {}
        required = []

        for param in tool.parameters:
            # Gemini uses OpenAPI-style schema
            param_schema = {
                "type": param.type.upper(),  # STRING, INTEGER, etc.
                "description": param.description,
            }
            if param.enum:
                param_schema["enum"] = param.enum
            properties[param.name] = param_schema

            if param.required:
                required.append(param.name)

        func_decl = FunctionDeclaration(
            name=tool.name,
            description=tool.description,
            parameters={
                "type": "OBJECT",
                "properties": properties,
                "required": required,
            }
        )
        function_declarations.append(func_decl)

    return [Tool(function_declarations=function_declarations)]
```

#### API Call Pattern

```python
import google.generativeai as genai

genai.configure(api_key=self.config.api_key)
model = genai.GenerativeModel(
    model_name=self.config.model,
    tools=self.convert_tool_schema(tools) if tools else None,
)

# Build chat history
chat = model.start_chat(history=[])
for msg in messages[:-1]:  # All but last
    chat.history.append({
        "role": "user" if msg.role == "user" else "model",
        "parts": [msg.content]
    })

# Send last message
response = chat.send_message(
    messages[-1].content,
    generation_config={
        "max_output_tokens": self.config.max_tokens,
        "temperature": self.config.temperature,
    }
)

# Extract response
content = response.text if response.text else ""
tool_calls = None

if response.candidates[0].content.parts:
    for part in response.candidates[0].content.parts:
        if hasattr(part, 'function_call'):
            if tool_calls is None:
                tool_calls = []
            tool_calls.append({
                "name": part.function_call.name,
                "arguments": dict(part.function_call.args),
                "id": f"call_{len(tool_calls)}",  # Gemini doesn't provide IDs
            })

return CompletionResponse(
    content=content,
    tool_calls=tool_calls,
    metadata={
        "model": self.config.model,
        "usage": {
            "prompt_tokens": response.usage_metadata.prompt_token_count,
            "total_tokens": response.usage_metadata.total_token_count,
        },
        "finish_reason": response.candidates[0].finish_reason.name,
    }
)
```

#### Error Handling

```python
from google.api_core import exceptions

try:
    response = chat.send_message(...)
except exceptions.Unauthenticated as e:
    raise ValueError(f"Invalid Gemini API key: {e}")
except exceptions.ResourceExhausted as e:
    # Rate limit - retry
    pass
except exceptions.GoogleAPIError as e:
    raise RuntimeError(f"Gemini API error: {e}")
```

---

### 4. Ollama Provider

**SDK:** `ollama` (v0.1+) or direct HTTP requests
**Models:** Llama 3, Mistral, CodeLlama, etc. (local)
**Function Calling:** Limited support (depends on model)

#### Tool Schema Format

Ollama uses OpenAI-compatible schema:

```python
{
    "type": "function",
    "function": {
        "name": "tool_name",
        "description": "Tool description",
        "parameters": {
            "type": "object",
            "properties": {...},
            "required": [...]
        }
    }
}
```

#### Conversion Logic

```python
def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
    """Convert generic tools to Ollama schema (OpenAI-compatible)."""
    # Same as OpenAI format
    return self._convert_to_openai_format(tools)
```

#### API Call Pattern

```python
import ollama

# Ollama doesn't require API key, uses base_url from config
client = ollama.Client(
    host=self.config.additional_params.get("base_url", "http://localhost:11434")
)

response = client.chat(
    model=self.config.model,
    messages=[{"role": m.role, "content": m.content} for m in messages],
    tools=self.convert_tool_schema(tools) if tools else None,
    options={
        "temperature": self.config.temperature,
        "num_predict": self.config.max_tokens,
    }
)

# Extract response (varies by model capability)
content = response["message"]["content"]
tool_calls = None

if "tool_calls" in response["message"]:
    tool_calls = [
        {
            "name": tc["function"]["name"],
            "arguments": tc["function"]["arguments"],
            "id": tc.get("id", f"call_{i}"),
        }
        for i, tc in enumerate(response["message"]["tool_calls"])
    ]

return CompletionResponse(
    content=content,
    tool_calls=tool_calls,
    metadata={
        "model": response["model"],
        "eval_count": response.get("eval_count", 0),
        "prompt_eval_count": response.get("prompt_eval_count", 0),
    }
)
```

#### Error Handling

```python
import requests

try:
    response = client.chat(...)
except requests.ConnectionError as e:
    raise RuntimeError(f"Cannot connect to Ollama at {base_url}: {e}")
except requests.HTTPError as e:
    if e.response.status_code == 404:
        raise ValueError(f"Model '{self.config.model}' not found in Ollama")
    raise RuntimeError(f"Ollama API error: {e}")
```

---

### 5. Provider Factory

**Purpose:** Centralized provider creation and registration

#### Implementation

```python
# src/cycling_ai/providers/factory.py

from typing import Type
from cycling_ai.providers.base import BaseProvider, ProviderConfig


class ProviderFactory:
    """Factory for creating provider instances."""

    _providers: dict[str, Type[BaseProvider]] = {}

    @classmethod
    def register_provider(cls, name: str, provider_class: Type[BaseProvider]) -> None:
        """Register a provider class."""
        cls._providers[name.lower()] = provider_class

    @classmethod
    def create_provider(cls, config: ProviderConfig) -> BaseProvider:
        """Create a provider instance from configuration."""
        provider_name = config.provider_name.lower()

        if provider_name not in cls._providers:
            available = ", ".join(sorted(cls._providers.keys()))
            raise ValueError(
                f"Unknown provider '{config.provider_name}'. "
                f"Available providers: {available}"
            )

        provider_class = cls._providers[provider_name]
        return provider_class(config)

    @classmethod
    def list_providers(cls) -> list[str]:
        """List all registered providers."""
        return sorted(cls._providers.keys())


# Auto-register all providers on import
from cycling_ai.providers.openai_provider import OpenAIProvider
from cycling_ai.providers.anthropic_provider import AnthropicProvider
from cycling_ai.providers.gemini_provider import GeminiProvider
from cycling_ai.providers.ollama_provider import OllamaProvider

ProviderFactory.register_provider("openai", OpenAIProvider)
ProviderFactory.register_provider("anthropic", AnthropicProvider)
ProviderFactory.register_provider("gemini", GeminiProvider)
ProviderFactory.register_provider("ollama", OllamaProvider)
```

---

### 6. Shared Utilities

**Purpose:** Common functionality used by multiple providers

```python
# src/cycling_ai/providers/provider_utils.py

import time
import functools
from typing import Callable, TypeVar, ParamSpec

P = ParamSpec("P")
T = TypeVar("T")


def retry_with_exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    exponential_base: float = 2.0,
    max_delay: float = 60.0,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator for retrying with exponential backoff."""

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            delay = initial_delay
            last_exception = None

            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    # Don't retry on permanent failures
                    if is_permanent_error(e):
                        raise

                    if attempt < max_retries - 1:
                        time.sleep(min(delay, max_delay))
                        delay *= exponential_base

            # All retries exhausted
            raise last_exception  # type: ignore

        return wrapper
    return decorator


def is_permanent_error(error: Exception) -> bool:
    """Check if error is permanent (should not retry)."""
    error_type = type(error).__name__
    permanent_errors = [
        "AuthenticationError",
        "InvalidRequestError",
        "NotFoundError",
        "ValueError",
    ]
    return error_type in permanent_errors


def convert_to_openai_format(tools: list[ToolDefinition]) -> list[dict[str, Any]]:
    """Convert tools to OpenAI format (reusable for Ollama)."""
    openai_tools = []
    for tool in tools:
        properties = {}
        required = []

        for param in tool.parameters:
            properties[param.name] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                properties[param.name]["enum"] = param.enum
            if param.required:
                required.append(param.name)

        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                }
            }
        })

    return openai_tools
```

---

## Implementation Strategy

### Development Approach

**Test-Driven Development (TDD):**
1. Write failing test for a feature
2. Implement minimum code to pass test
3. Refactor while keeping tests green
4. Repeat

**Incremental Delivery:**
- Implement one provider at a time
- Validate each provider fully before moving to next
- Build shared utilities as patterns emerge

### Implementation Order

**Recommended Order:**
1. **Provider Utils & Factory** (Foundation)
2. **OpenAI Provider** (Most mature SDK, good reference)
3. **Anthropic Provider** (Similar to OpenAI)
4. **Gemini Provider** (Different API patterns)
5. **Ollama Provider** (Local, different constraints)

**Rationale:**
- OpenAI has the most stable SDK and documentation
- Start with API-based providers before local
- Extract common patterns early (utils)
- Build confidence with each completed provider

### Validation Checkpoints

After each provider:
- [ ] All unit tests passing (>85% coverage)
- [ ] Type checking passing (`mypy --strict`)
- [ ] Linting passing (`ruff check`)
- [ ] Manual smoke test with real API (optional)
- [ ] Documentation updated

---

## Testing Approach

### Unit Testing Strategy

**Mock Provider APIs:**
```python
# tests/providers/test_openai_provider.py

from unittest.mock import Mock, patch
import pytest
from cycling_ai.providers.openai_provider import OpenAIProvider
from cycling_ai.providers.base import ProviderConfig, ProviderMessage


@pytest.fixture
def openai_config():
    """Create OpenAI provider config for testing."""
    return ProviderConfig(
        provider_name="openai",
        api_key="sk-test-key",
        model="gpt-4",
        max_tokens=2048,
        temperature=0.7,
    )


@pytest.fixture
def openai_provider(openai_config):
    """Create OpenAI provider instance."""
    return OpenAIProvider(openai_config)


class TestOpenAIProvider:
    """Tests for OpenAI provider adapter."""

    def test_initialization(self, openai_provider):
        """Test provider initializes correctly."""
        assert openai_provider.config.provider_name == "openai"
        assert openai_provider.config.model == "gpt-4"

    @patch("openai.OpenAI")
    def test_create_completion_no_tools(self, mock_openai, openai_provider):
        """Test completion without tool calls."""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hello, world!"
        mock_response.choices[0].message.tool_calls = None
        mock_response.choices[0].finish_reason = "stop"
        mock_response.model = "gpt-4"
        mock_response.usage.model_dump.return_value = {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
        }

        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client

        # Test
        messages = [ProviderMessage(role="user", content="Hello")]
        response = openai_provider.create_completion(messages)

        assert response.content == "Hello, world!"
        assert response.tool_calls is None
        assert response.metadata["model"] == "gpt-4"

    @patch("openai.OpenAI")
    def test_create_completion_with_tools(self, mock_openai, openai_provider):
        """Test completion with tool calls."""
        # Mock tool call response
        mock_tool_call = Mock()
        mock_tool_call.id = "call_123"
        mock_tool_call.function.name = "analyze_performance"
        mock_tool_call.function.arguments = '{"period_months": 6}'

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = ""
        mock_response.choices[0].message.tool_calls = [mock_tool_call]
        mock_response.choices[0].finish_reason = "tool_calls"
        mock_response.model = "gpt-4"
        mock_response.usage.model_dump.return_value = {"total_tokens": 20}

        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client

        # Test
        messages = [ProviderMessage(role="user", content="Analyze my performance")]
        tools = [...]  # Tool definitions
        response = openai_provider.create_completion(messages, tools)

        assert response.tool_calls is not None
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "analyze_performance"

    def test_convert_tool_schema(self, openai_provider):
        """Test tool schema conversion."""
        from cycling_ai.tools.base import ToolDefinition, ToolParameter

        tool = ToolDefinition(
            name="test_tool",
            description="Test tool",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="param1",
                    type="string",
                    description="First param",
                    required=True,
                ),
                ToolParameter(
                    name="param2",
                    type="integer",
                    description="Second param",
                    required=False,
                ),
            ],
            returns={"type": "json"},
        )

        schema = openai_provider.convert_tool_schema([tool])

        assert len(schema) == 1
        assert schema[0]["type"] == "function"
        assert schema[0]["function"]["name"] == "test_tool"
        assert "param1" in schema[0]["function"]["parameters"]["properties"]
        assert "param1" in schema[0]["function"]["parameters"]["required"]
```

### Integration Testing (Optional)

**Real API Testing:**
```python
# tests/integration/test_providers_integration.py

import os
import pytest
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.providers.base import ProviderConfig, ProviderMessage


@pytest.mark.integration
@pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set"
)
def test_openai_real_completion():
    """Test OpenAI provider with real API."""
    config = ProviderConfig(
        provider_name="openai",
        api_key=os.getenv("OPENAI_API_KEY"),
        model="gpt-3.5-turbo",  # Use cheaper model
        max_tokens=50,
    )

    provider = ProviderFactory.create_provider(config)
    messages = [ProviderMessage(role="user", content="Say 'test successful'")]

    response = provider.create_completion(messages)

    assert response.content
    assert "test successful" in response.content.lower()
```

**Run Integration Tests:**
```bash
# Set API keys
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...

# Run integration tests only
pytest -m integration -v

# Run all tests
pytest -v
```

### Test Fixtures

```python
# tests/providers/conftest.py

import pytest
from cycling_ai.providers.base import ProviderConfig
from cycling_ai.tools.base import ToolDefinition, ToolParameter


@pytest.fixture
def sample_tool_definition():
    """Sample tool definition for testing."""
    return ToolDefinition(
        name="analyze_performance",
        description="Analyze cycling performance data",
        category="analysis",
        parameters=[
            ToolParameter(
                name="period_months",
                type="integer",
                description="Number of months to analyze",
                required=True,
                min_value=1,
                max_value=12,
            ),
            ToolParameter(
                name="include_cross_training",
                type="boolean",
                description="Include cross-training analysis",
                required=False,
                default=False,
            ),
        ],
        returns={"type": "json", "format": "analysis_report"},
        version="1.0.0",
    )


@pytest.fixture
def sample_messages():
    """Sample messages for testing."""
    return [
        ProviderMessage(role="system", content="You are a cycling coach."),
        ProviderMessage(role="user", content="Analyze my recent performance."),
    ]


@pytest.fixture(params=["openai", "anthropic", "gemini", "ollama"])
def provider_config(request):
    """Parameterized fixture for all provider configs."""
    return ProviderConfig(
        provider_name=request.param,
        api_key="test-key",
        model="test-model",
    )
```

---

## Task Cards

### CARD 01: Shared Utilities & Factory (2 hours)

**Priority:** CRITICAL
**Depends On:** Phase 1 Complete
**Blocks:** All provider implementations

**Objectives:**
- Create provider_utils.py with retry logic and common converters
- Implement ProviderFactory with registration system
- Write comprehensive tests for factory

**Deliverables:**
1. `src/cycling_ai/providers/provider_utils.py`
   - `retry_with_exponential_backoff` decorator
   - `is_permanent_error()` function
   - `convert_to_openai_format()` helper (for reuse)

2. `src/cycling_ai/providers/factory.py`
   - `ProviderFactory` class
   - `register_provider()` method
   - `create_provider()` method
   - `list_providers()` method

3. `tests/providers/test_factory.py`
   - Test provider registration
   - Test provider creation
   - Test error handling for unknown providers
   - Test list_providers()

**Acceptance Criteria:**
- [ ] Factory can register and create providers
- [ ] Clear error messages for unknown providers
- [ ] Retry decorator works with exponential backoff
- [ ] All tests passing (100% coverage for factory)
- [ ] Type checking passing

**Test Strategy:**
```python
def test_factory_registration():
    """Test registering a provider."""
    class MockProvider(BaseProvider):
        ...

    ProviderFactory.register_provider("mock", MockProvider)
    assert "mock" in ProviderFactory.list_providers()

def test_factory_create_provider():
    """Test creating a provider instance."""
    config = ProviderConfig(provider_name="openai", ...)
    provider = ProviderFactory.create_provider(config)
    assert isinstance(provider, BaseProvider)

def test_factory_unknown_provider():
    """Test error for unknown provider."""
    config = ProviderConfig(provider_name="unknown", ...)
    with pytest.raises(ValueError, match="Unknown provider"):
        ProviderFactory.create_provider(config)
```

---

### CARD 02: OpenAI Provider Implementation (2 hours)

**Priority:** HIGH
**Depends On:** CARD 01
**Blocks:** None

**Objectives:**
- Implement OpenAI adapter with full tool support
- Write comprehensive unit tests with mocked API
- Validate tool schema conversion

**Deliverables:**
1. `src/cycling_ai/providers/openai_provider.py`
   - `OpenAIProvider` class extending `BaseProvider`
   - `convert_tool_schema()` - Convert to OpenAI function schema
   - `invoke_tool()` - Execute tool (delegate to tool registry)
   - `format_response()` - Format tool results for OpenAI
   - `create_completion()` - Call OpenAI Chat Completion API
   - Error handling with retry logic

2. `tests/providers/test_openai_provider.py`
   - Test initialization
   - Test completion without tools (mocked)
   - Test completion with tools (mocked)
   - Test tool schema conversion
   - Test error handling (auth, rate limit, API errors)
   - Test retry logic

**Implementation Details:**
```python
# src/cycling_ai/providers/openai_provider.py

from typing import Any
import json
import openai
from cycling_ai.providers.base import (
    BaseProvider,
    ProviderConfig,
    ProviderMessage,
    CompletionResponse,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff


class OpenAIProvider(BaseProvider):
    """OpenAI provider adapter (GPT-4, GPT-3.5)."""

    def __init__(self, config: ProviderConfig):
        """Initialize OpenAI provider."""
        super().__init__(config)
        self.client = openai.OpenAI(api_key=config.api_key)

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """Convert tools to OpenAI function schema."""
        # Implementation as shown in Provider Specifications
        ...

    def invoke_tool(
        self, tool_name: str, parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """Execute a tool (delegate to tool registry)."""
        from cycling_ai.tools.registry import get_tool

        tool = get_tool(tool_name)
        return tool.execute(**parameters)

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """Format tool result for OpenAI."""
        return {
            "role": "tool",
            "content": json.dumps(result.to_dict()),
        }

    @retry_with_exponential_backoff(max_retries=3)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """Create completion using OpenAI API."""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": m.role, "content": m.content} for m in messages
                ],
                tools=self.convert_tool_schema(tools) if tools else None,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            )

            # Extract and normalize response
            content = response.choices[0].message.content or ""
            tool_calls = None

            if response.choices[0].message.tool_calls:
                tool_calls = [
                    {
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments),
                        "id": tc.id,
                    }
                    for tc in response.choices[0].message.tool_calls
                ]

            return CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": response.model,
                    "usage": response.usage.model_dump(),
                    "finish_reason": response.choices[0].finish_reason,
                }
            )

        except openai.AuthenticationError as e:
            raise ValueError(f"Invalid OpenAI API key: {e}")
        except openai.APIError as e:
            raise RuntimeError(f"OpenAI API error: {e}")
```

**Acceptance Criteria:**
- [ ] OpenAI provider implements all BaseProvider methods
- [ ] Tool schema conversion matches OpenAI format
- [ ] Completion works without tools (text-only)
- [ ] Completion works with tools (function calling)
- [ ] Error handling for auth failures
- [ ] Retry logic for transient failures
- [ ] >85% test coverage
- [ ] Type checking passing

---

### CARD 03: Anthropic Provider Implementation (2 hours)

**Priority:** HIGH
**Depends On:** CARD 01
**Blocks:** None

**Objectives:**
- Implement Anthropic Claude adapter with tool support
- Handle Messages API peculiarities (system messages, content blocks)
- Write comprehensive unit tests

**Deliverables:**
1. `src/cycling_ai/providers/anthropic_provider.py`
   - `AnthropicProvider` class
   - Tool schema conversion (input_schema format)
   - Completion with system message handling
   - Content block parsing (text + tool_use)

2. `tests/providers/test_anthropic_provider.py`
   - Test initialization
   - Test completion without tools
   - Test completion with tools
   - Test system message handling
   - Test content block parsing
   - Test error handling

**Implementation Details:**
```python
# src/cycling_ai/providers/anthropic_provider.py

from typing import Any
import json
import anthropic
from cycling_ai.providers.base import (
    BaseProvider,
    ProviderConfig,
    ProviderMessage,
    CompletionResponse,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff


class AnthropicProvider(BaseProvider):
    """Anthropic Claude provider adapter."""

    def __init__(self, config: ProviderConfig):
        """Initialize Anthropic provider."""
        super().__init__(config)
        self.client = anthropic.Anthropic(api_key=config.api_key)

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """Convert tools to Anthropic tool schema."""
        # Implementation as shown in Provider Specifications
        ...

    def invoke_tool(
        self, tool_name: str, parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """Execute a tool."""
        from cycling_ai.tools.registry import get_tool

        tool = get_tool(tool_name)
        return tool.execute(**parameters)

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """Format tool result for Anthropic."""
        return {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "content": json.dumps(result.to_dict()),
                }
            ]
        }

    @retry_with_exponential_backoff(max_retries=3)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """Create completion using Anthropic Messages API."""
        # Separate system message
        system_msg = None
        user_messages = []

        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                user_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        try:
            response = self.client.messages.create(
                model=self.config.model,
                system=system_msg,
                messages=user_messages,
                tools=self.convert_tool_schema(tools) if tools else None,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            )

            # Parse content blocks
            content = ""
            tool_calls = None

            for block in response.content:
                if block.type == "text":
                    content += block.text
                elif block.type == "tool_use":
                    if tool_calls is None:
                        tool_calls = []
                    tool_calls.append({
                        "name": block.name,
                        "arguments": block.input,
                        "id": block.id,
                    })

            return CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": response.model,
                    "usage": {
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens,
                    },
                    "stop_reason": response.stop_reason,
                }
            )

        except anthropic.AuthenticationError as e:
            raise ValueError(f"Invalid Anthropic API key: {e}")
        except anthropic.APIError as e:
            raise RuntimeError(f"Anthropic API error: {e}")
```

**Acceptance Criteria:**
- [ ] Anthropic provider implements all BaseProvider methods
- [ ] Tool schema uses input_schema format
- [ ] System messages handled correctly
- [ ] Content blocks parsed correctly (text + tool_use)
- [ ] Error handling for auth failures
- [ ] >85% test coverage
- [ ] Type checking passing

---

### CARD 04: Google Gemini Provider Implementation (2 hours)

**Priority:** MEDIUM
**Depends On:** CARD 01
**Blocks:** None

**Objectives:**
- Implement Google Gemini adapter
- Handle function declarations and chat history
- Write comprehensive unit tests

**Deliverables:**
1. `src/cycling_ai/providers/gemini_provider.py`
   - `GeminiProvider` class
   - FunctionDeclaration conversion
   - Chat history management
   - Function call extraction

2. `tests/providers/test_gemini_provider.py`
   - Test initialization
   - Test completion without tools
   - Test completion with tools
   - Test chat history building
   - Test error handling

**Implementation Details:**
```python
# src/cycling_ai/providers/gemini_provider.py

from typing import Any
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool
from cycling_ai.providers.base import (
    BaseProvider,
    ProviderConfig,
    ProviderMessage,
    CompletionResponse,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff


class GeminiProvider(BaseProvider):
    """Google Gemini provider adapter."""

    def __init__(self, config: ProviderConfig):
        """Initialize Gemini provider."""
        super().__init__(config)
        genai.configure(api_key=config.api_key)

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[Tool]:
        """Convert tools to Gemini function declarations."""
        # Implementation as shown in Provider Specifications
        ...

    def invoke_tool(
        self, tool_name: str, parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """Execute a tool."""
        from cycling_ai.tools.registry import get_tool

        tool = get_tool(tool_name)
        return tool.execute(**parameters)

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """Format tool result for Gemini."""
        return {
            "role": "function",
            "parts": [{"function_response": result.to_dict()}]
        }

    @retry_with_exponential_backoff(max_retries=3)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """Create completion using Gemini API."""
        # Implementation as shown in Provider Specifications
        ...
```

**Acceptance Criteria:**
- [ ] Gemini provider implements all BaseProvider methods
- [ ] Tool schema uses FunctionDeclaration format
- [ ] Chat history built correctly
- [ ] Function calls extracted properly
- [ ] Error handling implemented
- [ ] >85% test coverage
- [ ] Type checking passing

---

### CARD 05: Ollama Provider Implementation (1.5 hours)

**Priority:** LOW
**Depends On:** CARD 01
**Blocks:** None

**Objectives:**
- Implement Ollama adapter for local models
- Reuse OpenAI schema format
- Handle connection errors gracefully

**Deliverables:**
1. `src/cycling_ai/providers/ollama_provider.py`
   - `OllamaProvider` class
   - OpenAI-compatible schema (reuse utility)
   - Local connection handling
   - Model availability checking

2. `tests/providers/test_ollama_provider.py`
   - Test initialization
   - Test completion without tools
   - Test completion with tools (if supported)
   - Test connection error handling
   - Test model not found handling

**Implementation Details:**
```python
# src/cycling_ai/providers/ollama_provider.py

from typing import Any
import ollama
import requests
from cycling_ai.providers.base import (
    BaseProvider,
    ProviderConfig,
    ProviderMessage,
    CompletionResponse,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult
from cycling_ai.providers.provider_utils import (
    retry_with_exponential_backoff,
    convert_to_openai_format,
)


class OllamaProvider(BaseProvider):
    """Ollama provider adapter for local models."""

    def __init__(self, config: ProviderConfig):
        """Initialize Ollama provider."""
        super().__init__(config)
        base_url = config.additional_params.get("base_url", "http://localhost:11434")
        self.client = ollama.Client(host=base_url)
        self.base_url = base_url

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """Convert tools to Ollama schema (OpenAI-compatible)."""
        return convert_to_openai_format(tools)

    def invoke_tool(
        self, tool_name: str, parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """Execute a tool."""
        from cycling_ai.tools.registry import get_tool

        tool = get_tool(tool_name)
        return tool.execute(**parameters)

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """Format tool result for Ollama."""
        return {
            "role": "tool",
            "content": json.dumps(result.to_dict()),
        }

    @retry_with_exponential_backoff(max_retries=2)  # Fewer retries for local
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """Create completion using Ollama API."""
        # Implementation as shown in Provider Specifications
        ...
```

**Acceptance Criteria:**
- [ ] Ollama provider implements all BaseProvider methods
- [ ] Reuses OpenAI schema format
- [ ] Connection errors handled gracefully
- [ ] Model not found errors clear
- [ ] >85% test coverage
- [ ] Type checking passing

---

### CARD 06: Integration & Documentation (1.5 hours)

**Priority:** MEDIUM
**Depends On:** CARD 02, CARD 03, CARD 04, CARD 05
**Blocks:** None

**Objectives:**
- Update package exports
- Write integration tests (optional, requires API keys)
- Update documentation
- Create usage examples

**Deliverables:**
1. Update `src/cycling_ai/providers/__init__.py`
   - Export all provider classes
   - Export factory
   - Export config classes

2. `tests/integration/test_providers_integration.py` (optional)
   - Real API tests for each provider
   - Require API keys via environment variables
   - Skip if keys not available

3. Update `README.md`
   - Add provider setup instructions
   - Add usage examples
   - Document supported models

4. Create `docs/PROVIDER_GUIDE.md`
   - Detailed guide for each provider
   - API key setup
   - Model selection
   - Configuration options
   - Troubleshooting

5. Update `CHANGELOG.md`
   - Document Phase 2 completion
   - List all new features

**Usage Example:**
```python
from cycling_ai.providers import ProviderFactory, ProviderConfig, ProviderMessage

# Create provider configuration
config = ProviderConfig(
    provider_name="openai",
    api_key="sk-...",
    model="gpt-4",
    max_tokens=4096,
    temperature=0.7,
)

# Create provider instance
provider = ProviderFactory.create_provider(config)

# Create completion
messages = [
    ProviderMessage(role="system", content="You are a cycling coach."),
    ProviderMessage(role="user", content="Analyze my performance."),
]

response = provider.create_completion(messages, tools=available_tools)

print(f"Response: {response.content}")
if response.tool_calls:
    print(f"Tool calls: {response.tool_calls}")
```

**Acceptance Criteria:**
- [ ] All providers exported from __init__.py
- [ ] Integration tests created (optional)
- [ ] README updated with examples
- [ ] Provider guide created
- [ ] CHANGELOG updated
- [ ] All documentation accurate

---

## Dependencies

### Python Package Updates

Update `pyproject.toml`:

```toml
[project]
name = "cycling-ai-analysis"
version = "0.2.0"  # Increment for Phase 2
description = "Generic AI-powered cycling performance analysis with multi-provider LLM support"
readme = "README.md"
requires-python = ">=3.11"
authors = [
    {name = "Eduardo", email = "eduardo@example.com"}
]
keywords = ["cycling", "performance", "analysis", "ai", "llm", "openai", "anthropic", "gemini"]
classifiers = [
    "Development Status :: 3 - Alpha",
    "Intended Audience :: Developers",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]

dependencies = [
    # Data processing
    "pandas>=2.1.0",
    "numpy>=1.26.0",
    "pyarrow>=14.0.0",

    # FIT file parsing
    "fitparse>=1.2.0",

    # LLM Provider SDKs
    "openai>=1.0.0",                    # NEW: OpenAI API
    "anthropic>=0.18.0",                # NEW: Anthropic Claude API
    "google-generativeai>=0.3.0",      # NEW: Google Gemini API
    "ollama>=0.1.0",                   # NEW: Ollama local models

    # HTTP client (used by providers)
    "httpx>=0.25.0",                   # NEW: Modern HTTP client

    # Utilities
    "python-dateutil>=2.8.0",
]

[project.optional-dependencies]
dev = [
    # Linting and formatting
    "ruff>=0.1.0",

    # Type checking
    "mypy>=1.7.0",
    "pandas-stubs>=2.1.0",
    "types-requests>=2.31.0",          # NEW: Type stubs

    # Testing
    "pytest>=7.4.0",
    "pytest-cov>=4.1.0",
    "pytest-asyncio>=0.21.0",
    "pytest-mock>=3.12.0",             # NEW: Better mocking
    "responses>=0.24.0",               # NEW: HTTP response mocking
]

# Integration testing (optional)
integration = [
    "python-dotenv>=1.0.0",            # NEW: Load API keys from .env
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/cycling_ai"]

[tool.ruff]
target-version = "py311"
line-length = 100
select = ["E", "F", "I", "N", "UP", "B", "C4", "SIM"]
ignore = []

[tool.ruff.per-file-ignores]
"__init__.py" = ["F401"]  # Allow unused imports in __init__.py

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_any_unimported = false
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_no_return = true
check_untyped_defs = true
strict_equality = true

[[tool.mypy.overrides]]
module = "fitparse.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "ollama.*"
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
markers = [
    "integration: Integration tests requiring API keys (deselect with '-m \"not integration\"')",
]
addopts = [
    "-v",
    "-m", "not integration",  # Skip integration tests by default
]
```

### Installation Commands

```bash
# Update dependencies
pip install -e ".[dev]"

# Or with uv
uv pip install -e ".[dev]"

# For integration testing
pip install -e ".[dev,integration]"
```

### Version Constraints Rationale

- **openai>=1.0.0**: Latest stable SDK with improved types
- **anthropic>=0.18.0**: Messages API with tool support
- **google-generativeai>=0.3.0**: Latest Gemini SDK with function calling
- **ollama>=0.1.0**: Official Python SDK for Ollama
- **httpx>=0.25.0**: Modern async HTTP client, used by some SDKs
- **pytest-mock>=3.12.0**: Better mocking support
- **responses>=0.24.0**: HTTP response mocking for integration tests

---

## Success Metrics

### Technical Quality Metrics

| Metric | Target | Validation Method |
|--------|--------|-------------------|
| Test Coverage | >85% | `pytest --cov` |
| Type Safety | 100% | `mypy --strict src/cycling_ai/providers/` |
| Linting | Pass | `ruff check src/cycling_ai/providers/` |
| Provider Tests | All passing | `pytest tests/providers/ -v` |
| Integration Tests | All passing (optional) | `pytest -m integration -v` |

### Functional Completeness

| Feature | Status |
|---------|--------|
| OpenAI adapter functional | ⬜ |
| Anthropic adapter functional | ⬜ |
| Gemini adapter functional | ⬜ |
| Ollama adapter functional | ⬜ |
| Provider factory working | ⬜ |
| Tool schema conversion (all providers) | ⬜ |
| Completion without tools | ⬜ |
| Completion with tools | ⬜ |
| Error handling & retry | ⬜ |
| Response normalization | ⬜ |

### Documentation Completeness

| Document | Status |
|----------|--------|
| README updated | ⬜ |
| Provider guide created | ⬜ |
| API documentation | ⬜ |
| Usage examples | ⬜ |
| CHANGELOG updated | ⬜ |

### Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Provider initialization | <100ms | Unit tests |
| Tool schema conversion (10 tools) | <50ms | Unit tests |
| API call overhead (excluding network) | <10ms | Unit tests |

---

## Risk Assessment

### Technical Risks

**RISK 1: Provider SDK Breaking Changes**
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:** Pin SDK versions, monitor changelogs, comprehensive tests
- **Contingency:** Create adapter versioning system

**RISK 2: Inconsistent Tool Support Across Providers**
- **Likelihood:** High
- **Impact:** Medium
- **Mitigation:** Document provider capabilities, graceful degradation
- **Contingency:** Implement fallback strategies for limited tool support

**RISK 3: Rate Limiting & API Errors**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:** Implement exponential backoff, clear error messages
- **Contingency:** Circuit breaker pattern for repeated failures

**RISK 4: Authentication Complexity**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** Clear documentation, validation on initialization
- **Contingency:** Detailed error messages with setup links

### Schedule Risks

**RISK 5: Provider SDK Learning Curve**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Start with most familiar provider (OpenAI)
- **Contingency:** Allocate extra time for Gemini/Ollama

**RISK 6: Test Mocking Complexity**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Use pytest-mock, responses library
- **Contingency:** Simplify mocks, focus on critical paths

### Quality Risks

**RISK 7: Type Safety with External SDKs**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Use type stubs, isolate SDK calls
- **Contingency:** Use `# type: ignore` judiciously with comments

**RISK 8: Incomplete Test Coverage**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** TDD approach, coverage monitoring
- **Contingency:** Incremental improvement, focus on critical paths

---

## Appendix A: Provider API References

### OpenAI
- **Documentation:** https://platform.openai.com/docs/guides/function-calling
- **Python SDK:** https://github.com/openai/openai-python
- **Models:** GPT-4, GPT-4 Turbo, GPT-3.5 Turbo

### Anthropic
- **Documentation:** https://docs.anthropic.com/claude/docs/tool-use
- **Python SDK:** https://github.com/anthropics/anthropic-sdk-python
- **Models:** Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet

### Google Gemini
- **Documentation:** https://ai.google.dev/gemini-api/docs/function-calling
- **Python SDK:** https://github.com/google-gemini/generative-ai-python
- **Models:** Gemini 1.5 Pro, Gemini 2.0 Flash

### Ollama
- **Documentation:** https://ollama.ai/docs
- **Python SDK:** https://github.com/ollama/ollama-python
- **Models:** Llama 3, Mistral, CodeLlama, etc.

---

## Appendix B: Validation Commands

```bash
# Run all unit tests
pytest tests/providers/ -v

# Run tests with coverage
pytest tests/providers/ --cov=src/cycling_ai/providers --cov-report=html

# Run integration tests (requires API keys)
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
pytest -m integration -v

# Type checking
mypy --strict src/cycling_ai/providers/

# Linting
ruff check src/cycling_ai/providers/
ruff format src/cycling_ai/providers/

# Full validation suite
pytest tests/providers/ --cov=src/cycling_ai/providers && \
mypy --strict src/cycling_ai/providers/ && \
ruff check src/cycling_ai/providers/
```

---

## Appendix C: Estimated Timeline

| Task Card | Estimated Time | Dependencies |
|-----------|---------------|--------------|
| CARD 01: Utils & Factory | 2 hours | Phase 1 |
| CARD 02: OpenAI Provider | 2 hours | CARD 01 |
| CARD 03: Anthropic Provider | 2 hours | CARD 01 |
| CARD 04: Gemini Provider | 2 hours | CARD 01 |
| CARD 05: Ollama Provider | 1.5 hours | CARD 01 |
| CARD 06: Integration & Docs | 1.5 hours | CARD 02-05 |
| **Total** | **11 hours** | |

**Buffer:** Add 20% for unexpected issues = **13-14 hours total**

**Recommended Schedule:**
- **Day 1 (4 hours):** CARD 01 + CARD 02
- **Day 2 (4 hours):** CARD 03 + CARD 04
- **Day 3 (3 hours):** CARD 05 + CARD 06
- **Total:** 3 days (part-time) or 1.5 days (full-time)

---

## Sign-Off Checklist

Before declaring Phase 2 complete:

- [ ] All 4 provider adapters implemented
- [ ] Provider factory functional
- [ ] All unit tests passing (>85% coverage)
- [ ] Type checking passing (mypy --strict)
- [ ] Linting passing (ruff)
- [ ] Integration tests created (optional)
- [ ] README updated with examples
- [ ] Provider guide created
- [ ] CHANGELOG updated
- [ ] Dependencies added to pyproject.toml
- [ ] All task cards completed
- [ ] Success metrics met
- [ ] Phase 2 completion report written

---

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Next Phase:** Phase 3 - Tool Wrappers & Registry Population
**Status:** READY FOR IMPLEMENTATION

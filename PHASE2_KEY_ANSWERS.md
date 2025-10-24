# Phase 2 Key Questions - Answered

**Date:** October 24, 2025
**Purpose:** Quick reference for critical implementation decisions

---

## Question 1: What specific SDK methods does each provider use?

### OpenAI
```python
import openai

client = openai.OpenAI(api_key="...")
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "..."}],
    tools=[...],  # Function definitions
    max_tokens=4096,
    temperature=0.7,
)

# Access response
content = response.choices[0].message.content
tool_calls = response.choices[0].message.tool_calls
usage = response.usage.model_dump()
```

**Key Classes:**
- `openai.OpenAI` - Main client
- `response.choices[0].message` - Message object
- `response.choices[0].message.tool_calls` - List of tool calls
- `tool_call.function.name` - Tool name
- `tool_call.function.arguments` - JSON string of arguments

---

### Anthropic
```python
import anthropic

client = anthropic.Anthropic(api_key="...")
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    system="You are a cycling coach.",  # Separate system param
    messages=[{"role": "user", "content": "..."}],
    tools=[...],  # Tool definitions
    max_tokens=4096,
    temperature=0.7,
)

# Access response (content blocks)
for block in response.content:
    if block.type == "text":
        content = block.text
    elif block.type == "tool_use":
        name = block.name
        arguments = block.input  # Dict, not JSON string
        id = block.id
```

**Key Classes:**
- `anthropic.Anthropic` - Main client
- `response.content` - List of content blocks
- `block.type` - "text" or "tool_use"
- `block.input` - Dict (not JSON string like OpenAI)

---

### Google Gemini
```python
import google.generativeai as genai

genai.configure(api_key="...")
model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    tools=[...],  # FunctionDeclaration objects
)

chat = model.start_chat(history=[])
response = chat.send_message(
    "Analyze my performance",
    generation_config={
        "max_output_tokens": 4096,
        "temperature": 0.7,
    }
)

# Access response
content = response.text
for part in response.candidates[0].content.parts:
    if hasattr(part, 'function_call'):
        name = part.function_call.name
        arguments = dict(part.function_call.args)
```

**Key Classes:**
- `genai.GenerativeModel` - Model with tools
- `model.start_chat()` - Create chat session
- `chat.send_message()` - Send message
- `part.function_call` - Function call object
- `part.function_call.args` - Map/Dict of arguments

---

### Ollama
```python
import ollama

client = ollama.Client(host="http://localhost:11434")
response = client.chat(
    model="llama3",
    messages=[{"role": "user", "content": "..."}],
    tools=[...],  # OpenAI-compatible format
    options={
        "temperature": 0.7,
        "num_predict": 4096,
    }
)

# Access response
content = response["message"]["content"]
if "tool_calls" in response["message"]:
    tool_calls = response["message"]["tool_calls"]
```

**Key Classes:**
- `ollama.Client` - Main client (local, no API key)
- Response is a dict (not object)
- OpenAI-compatible tool format

---

## Question 2: How does each provider format tool definitions differently?

### OpenAI Format
```json
{
    "type": "function",
    "function": {
        "name": "analyze_performance",
        "description": "Analyze cycling performance",
        "parameters": {
            "type": "object",
            "properties": {
                "period_months": {
                    "type": "integer",
                    "description": "Months to analyze"
                }
            },
            "required": ["period_months"]
        }
    }
}
```

**Key Differences:**
- Wrapped in `"type": "function"`
- Parameters use JSON Schema format
- `required` is array of strings

---

### Anthropic Format
```json
{
    "name": "analyze_performance",
    "description": "Analyze cycling performance",
    "input_schema": {
        "type": "object",
        "properties": {
            "period_months": {
                "type": "integer",
                "description": "Months to analyze"
            }
        },
        "required": ["period_months"]
    }
}
```

**Key Differences:**
- No `"type": "function"` wrapper
- Uses `"input_schema"` instead of `"parameters"`
- Otherwise similar to OpenAI

---

### Gemini Format
```python
from google.generativeai.types import FunctionDeclaration, Tool

func_decl = FunctionDeclaration(
    name="analyze_performance",
    description="Analyze cycling performance",
    parameters={
        "type": "OBJECT",  # All caps
        "properties": {
            "period_months": {
                "type": "INTEGER",  # All caps
                "description": "Months to analyze"
            }
        },
        "required": ["period_months"]
    }
)

tool = Tool(function_declarations=[func_decl])
```

**Key Differences:**
- Python objects, not dicts
- Type names in ALL CAPS (`OBJECT`, `INTEGER`, `STRING`)
- Wrapped in `Tool` object
- Multiple function declarations per tool

---

### Ollama Format
```json
{
    "type": "function",
    "function": {
        "name": "analyze_performance",
        "description": "Analyze cycling performance",
        "parameters": {
            "type": "object",
            "properties": {
                "period_months": {
                    "type": "integer",
                    "description": "Months to analyze"
                }
            },
            "required": ["period_months"]
        }
    }
}
```

**Key Differences:**
- Identical to OpenAI format (OpenAI-compatible)
- Not all Ollama models support tools (depends on model)

---

## Question 3: How do we handle providers without native function calling?

### Strategy: Graceful Degradation

**Option 1: Prompt Engineering (for models without tool support)**
```python
def create_completion_without_tools(self, messages, tools):
    """Fallback for models without native tool support."""

    # Generate tool descriptions in prompt
    tool_descriptions = "\n\n".join([
        f"**{tool.name}**: {tool.description}\n"
        f"Parameters: {json.dumps(tool.parameters)}"
        for tool in tools
    ])

    # Add system message with tool instructions
    enhanced_messages = [
        ProviderMessage(
            role="system",
            content=(
                "You have access to these tools:\n\n"
                f"{tool_descriptions}\n\n"
                "To use a tool, respond with JSON: "
                '{"tool": "tool_name", "arguments": {...}}'
            )
        ),
        *messages
    ]

    # Call provider without native tool support
    response = self._call_without_tools(enhanced_messages)

    # Try to parse tool call from response text
    tool_calls = self._extract_tool_calls_from_text(response.content)

    return CompletionResponse(
        content=response.content,
        tool_calls=tool_calls,
        metadata=response.metadata,
    )
```

**Option 2: ReAct Pattern**
- Use chain-of-thought prompting
- Model outputs thought + action
- Parse action as tool call

**Option 3: Mark as Unsupported**
```python
def supports_function_calling(self) -> bool:
    """Check if provider supports native function calling."""
    # For Ollama, check model capabilities
    if "llama3" in self.config.model:
        return True
    if "mistral" in self.config.model:
        return False  # No tool support
    return False

def create_completion(self, messages, tools):
    if tools and not self.supports_function_calling():
        raise ValueError(
            f"Model '{self.config.model}' does not support function calling. "
            f"Use a tool-capable model or call without tools."
        )
    # Proceed with normal completion
```

**Recommended Approach:**
- **Phase 2:** Implement native tool support only, raise clear error if unsupported
- **Phase 3:** Add graceful degradation with prompt engineering
- Document which models support tools

---

## Question 4: What's the best approach for testing without API keys?

### Strategy: Comprehensive Mocking

**Approach 1: pytest-mock with MagicMock**
```python
from unittest.mock import Mock, patch
import pytest

@patch("openai.OpenAI")
def test_openai_completion(mock_openai_class):
    """Test OpenAI completion with mocked API."""

    # Create mock response
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = "Test response"
    mock_response.choices[0].message.tool_calls = None
    mock_response.choices[0].finish_reason = "stop"
    mock_response.model = "gpt-4"
    mock_response.usage.model_dump.return_value = {"total_tokens": 100}

    # Mock client
    mock_client = Mock()
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai_class.return_value = mock_client

    # Test provider
    config = ProviderConfig(provider_name="openai", api_key="test", model="gpt-4")
    provider = OpenAIProvider(config)

    messages = [ProviderMessage(role="user", content="Hello")]
    response = provider.create_completion(messages)

    assert response.content == "Test response"
    assert mock_client.chat.completions.create.called
```

**Approach 2: responses library (for HTTP mocking)**
```python
import responses
import json

@responses.activate
def test_ollama_completion():
    """Test Ollama completion with mocked HTTP."""

    # Mock HTTP response
    responses.add(
        responses.POST,
        "http://localhost:11434/api/chat",
        json={
            "model": "llama3",
            "message": {"content": "Test response", "role": "assistant"},
            "done": True,
        },
        status=200,
    )

    # Test provider
    config = ProviderConfig(
        provider_name="ollama",
        api_key="",  # Not needed for Ollama
        model="llama3",
    )
    provider = OllamaProvider(config)

    messages = [ProviderMessage(role="user", content="Hello")]
    response = provider.create_completion(messages)

    assert response.content == "Test response"
```

**Approach 3: Fixture-based Mock Responses**
```python
# tests/providers/conftest.py

@pytest.fixture
def mock_openai_response():
    """Reusable OpenAI response mock."""
    response = Mock()
    response.choices = [Mock()]
    response.choices[0].message.content = "Test content"
    response.choices[0].message.tool_calls = None
    response.choices[0].finish_reason = "stop"
    response.model = "gpt-4"
    response.usage.model_dump.return_value = {"total_tokens": 100}
    return response

@pytest.fixture
def mock_openai_client(mock_openai_response):
    """Reusable OpenAI client mock."""
    client = Mock()
    client.chat.completions.create.return_value = mock_openai_response
    return client
```

**Recommended Approach:**
- **Unit Tests:** Use `unittest.mock` for provider SDK mocking
- **Integration Tests:** Optional, require real API keys via environment variables
- **CI/CD:** Run unit tests only (no API keys needed)
- **Local Dev:** Run integration tests with personal API keys

**Benefits:**
1. No API costs during development
2. Fast test execution (no network calls)
3. Deterministic test results
4. Test error conditions easily
5. Works in CI/CD without credentials

---

## Question 5: How do we validate responses are properly normalized?

### Strategy: Response Schema Validation

**Approach 1: Assert CompletionResponse Structure**
```python
def test_response_normalization(provider):
    """Test that all providers return normalized CompletionResponse."""

    messages = [ProviderMessage(role="user", content="Test")]
    response = provider.create_completion(messages)

    # Type check
    assert isinstance(response, CompletionResponse)

    # Required fields
    assert isinstance(response.content, str)
    assert isinstance(response.metadata, dict)

    # Tool calls (optional, but consistent format)
    if response.tool_calls is not None:
        assert isinstance(response.tool_calls, list)
        for tc in response.tool_calls:
            assert "name" in tc
            assert "arguments" in tc
            assert isinstance(tc["arguments"], dict)  # Not JSON string!
            assert "id" in tc
```

**Approach 2: Parameterized Tests for All Providers**
```python
@pytest.mark.parametrize("provider_name", ["openai", "anthropic", "gemini", "ollama"])
def test_all_providers_normalize_responses(provider_name, mock_responses):
    """Test all providers return consistent CompletionResponse format."""

    config = ProviderConfig(
        provider_name=provider_name,
        api_key="test",
        model="test-model",
    )

    provider = ProviderFactory.create_provider(config)

    # Mock the provider-specific API
    with mock_provider_api(provider_name, mock_responses[provider_name]):
        messages = [ProviderMessage(role="user", content="Test")]
        response = provider.create_completion(messages)

        # Validate normalized structure
        validate_completion_response(response)
```

**Approach 3: Schema Validation Helper**
```python
def validate_completion_response(response: CompletionResponse) -> None:
    """Validate CompletionResponse schema."""

    # Content validation
    assert isinstance(response.content, str), "content must be string"

    # Tool calls validation (if present)
    if response.tool_calls is not None:
        assert isinstance(response.tool_calls, list), "tool_calls must be list"

        for i, tc in enumerate(response.tool_calls):
            assert isinstance(tc, dict), f"tool_call[{i}] must be dict"

            # Required fields
            assert "name" in tc, f"tool_call[{i}] missing 'name'"
            assert "arguments" in tc, f"tool_call[{i}] missing 'arguments'"
            assert "id" in tc, f"tool_call[{i}] missing 'id'"

            # Type validation
            assert isinstance(tc["name"], str), f"tool_call[{i}] name must be string"
            assert isinstance(tc["arguments"], dict), (
                f"tool_call[{i}] arguments must be dict (not JSON string)"
            )
            assert isinstance(tc["id"], str), f"tool_call[{i}] id must be string"

    # Metadata validation
    assert isinstance(response.metadata, dict), "metadata must be dict"

    # Common metadata fields (if present)
    if "model" in response.metadata:
        assert isinstance(response.metadata["model"], str)

    if "usage" in response.metadata:
        assert isinstance(response.metadata["usage"], dict)
```

**Approach 4: Integration Test with Real Providers**
```python
@pytest.mark.integration
@pytest.mark.parametrize("provider_config", [
    {"provider_name": "openai", "model": "gpt-3.5-turbo"},
    {"provider_name": "anthropic", "model": "claude-3-5-sonnet-20241022"},
    {"provider_name": "gemini", "model": "gemini-1.5-pro"},
])
def test_real_provider_normalization(provider_config):
    """Test response normalization with real APIs."""

    config = ProviderConfig(
        **provider_config,
        api_key=get_api_key(provider_config["provider_name"]),
        max_tokens=50,
    )

    provider = ProviderFactory.create_provider(config)
    messages = [ProviderMessage(role="user", content="Say 'test'")]

    response = provider.create_completion(messages)

    # Validate normalized response
    validate_completion_response(response)

    # Verify metadata is provider-specific but properly formatted
    assert "model" in response.metadata or "finish_reason" in response.metadata
```

**Recommended Validation Strategy:**
1. **Unit Tests:** Mock provider responses, validate normalization
2. **Schema Helper:** Reusable validation function for all tests
3. **Parameterized Tests:** Test all providers with same validation
4. **Integration Tests:** Optional real API tests for validation

**Critical Validations:**
- ✅ `response.content` is always a string (never None)
- ✅ `response.tool_calls` is None or list of dicts
- ✅ Tool call arguments are dicts (not JSON strings - normalize from OpenAI)
- ✅ Tool call IDs always present (generate if provider doesn't provide)
- ✅ Metadata contains useful info (model, tokens, finish_reason)

---

## Additional Insights

### Type Conversion Gotchas

**OpenAI:**
- `tool_call.function.arguments` is a JSON **string** → Must parse to dict
- `response.usage` is object → Use `.model_dump()` for dict

**Anthropic:**
- `block.input` is already a **dict** → Don't parse
- System messages are separate parameter, not in messages array

**Gemini:**
- Types are ALL CAPS: `"STRING"`, `"INTEGER"`, `"OBJECT"`
- `function_call.args` is a special Map → Convert with `dict()`
- No tool call IDs → Generate them

**Ollama:**
- Response is a **dict**, not object
- Connection errors are `requests.ConnectionError`, not provider-specific
- Tool support varies by model

---

### Common Pitfalls

1. **Forgetting to normalize arguments:**
   ```python
   # WRONG: OpenAI gives JSON string
   tool_calls = [{"arguments": tc.function.arguments}]

   # RIGHT: Parse to dict
   tool_calls = [{"arguments": json.loads(tc.function.arguments)}]
   ```

2. **Not handling missing tool call IDs (Gemini):**
   ```python
   # WRONG: Gemini doesn't provide IDs
   tool_calls = [{"id": tc.id}]  # AttributeError

   # RIGHT: Generate ID if not present
   tool_calls = [{"id": getattr(tc, "id", f"call_{i}")}]
   ```

3. **System message handling (Anthropic):**
   ```python
   # WRONG: Include system in messages
   messages = [{"role": "system", "content": "..."}]

   # RIGHT: Separate system parameter
   system = "..."
   messages = [{"role": "user", "content": "..."}]
   client.messages.create(system=system, messages=messages)
   ```

4. **Type annotation for provider-specific returns:**
   ```python
   # Use type: ignore for untyped SDK responses
   response = client.chat.completions.create(...)  # type: ignore
   ```

---

## Summary Table

| Provider | SDK Method | Tool Format | Tool Call Args | Has IDs | System Msg |
|----------|-----------|-------------|----------------|---------|------------|
| OpenAI | `chat.completions.create()` | `{"type": "function", "function": {...}}` | JSON string → parse | Yes | In messages |
| Anthropic | `messages.create()` | `{"name": "...", "input_schema": {...}}` | Dict (ready) | Yes | Separate param |
| Gemini | `chat.send_message()` | `FunctionDeclaration(...)` | Map → dict() | No (generate) | In messages |
| Ollama | `chat()` | Same as OpenAI | JSON string → parse | Varies | In messages |

---

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Companion:** PHASE2_IMPLEMENTATION_PLAN.md

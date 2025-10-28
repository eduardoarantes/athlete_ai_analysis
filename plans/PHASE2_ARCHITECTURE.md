# Phase 2 Architecture: Provider Adapters

**Visual diagrams and data flow for Phase 2 implementation**

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CYCLING AI ANALYSIS                          │
│                   Multi-Provider Architecture                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 (Future): Agent Layer                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Conversation Manager  │  Tool Orchestrator  │  CLI      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 (This Phase): Provider Adapter Layer                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ProviderFactory                              │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ create_provider(config) → BaseProvider             │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   OpenAI     │   │  Anthropic   │   │   Gemini     │        │
│  │   Provider   │   │   Provider   │   │   Provider   │ ...    │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                   │
│                              ▼                                   │
│              ┌──────────────────────────────┐                   │
│              │   CompletionResponse         │                   │
│              │  ┌──────────────────────┐    │                   │
│              │  │ content: str         │    │                   │
│              │  │ tool_calls: list     │    │                   │
│              │  │ metadata: dict       │    │                   │
│              │  └──────────────────────┘    │                   │
│              └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 (Complete): Core Foundation                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Base Abstractions: BaseProvider, ToolDefinition         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Business Logic: performance, zones, training, etc.      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Provider Adapter Class Hierarchy

```
BaseProvider (Abstract Base Class)
│
│  # Configuration
│  ├─ config: ProviderConfig
│
│  # Abstract Methods (must implement)
│  ├─ convert_tool_schema(tools) → provider_specific_schema
│  ├─ invoke_tool(name, params) → ToolExecutionResult
│  ├─ format_response(result) → provider_specific_format
│  └─ create_completion(messages, tools) → CompletionResponse
│
├─── OpenAIProvider
│    ├─ client: openai.OpenAI
│    ├─ convert_tool_schema() → OpenAI function schema
│    └─ create_completion() → calls client.chat.completions.create()
│
├─── AnthropicProvider
│    ├─ client: anthropic.Anthropic
│    ├─ convert_tool_schema() → Anthropic tool schema
│    └─ create_completion() → calls client.messages.create()
│
├─── GeminiProvider
│    ├─ model: genai.GenerativeModel
│    ├─ convert_tool_schema() → FunctionDeclaration
│    └─ create_completion() → calls chat.send_message()
│
└─── OllamaProvider
     ├─ client: ollama.Client
     ├─ convert_tool_schema() → OpenAI-compatible schema
     └─ create_completion() → calls client.chat()
```

---

## Data Flow: Tool Schema Conversion

```
┌──────────────────────────────────────────────────────────────┐
│  Generic ToolDefinition (Provider-Agnostic)                  │
├──────────────────────────────────────────────────────────────┤
│  name: "analyze_performance"                                 │
│  description: "Analyze cycling performance data"             │
│  category: "analysis"                                        │
│  parameters: [                                               │
│    ToolParameter(                                            │
│      name="period_months",                                   │
│      type="integer",                                         │
│      description="Months to analyze",                        │
│      required=True                                           │
│    )                                                         │
│  ]                                                           │
└──────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  OpenAI Format   │ │ Anthropic    │ │ Gemini       │
├──────────────────┤ │ Format       │ │ Format       │
│ {                │ ├──────────────┤ ├──────────────┤
│   "type":        │ │ {            │ │ Func         │
│     "function",  │ │   "name":    │ │ Declaration( │
│   "function": {  │ │     "analyze │ │   name=      │
│     "name": "...",│ │      _perfor │ │     "analyze │
│     "parameters":│ │      mance", │ │      _perfor │
│     {            │ │   "input_    │ │      mance", │
│       "type":    │ │     schema": │ │   parameters │
│         "object",│ │     {...}    │ │     ={...}   │
│       "properti  │ │ }            │ │ )            │
│        es": {...}│ │              │ │              │
│     }            │ │              │ │              │
│   }              │ │              │ │              │
│ }                │ │              │ │              │
└──────────────────┘ └──────────────┘ └──────────────┘
```

---

## Data Flow: Create Completion

```
USER CODE:
┌──────────────────────────────────────────────────────┐
│  config = ProviderConfig(provider_name="openai", ...) │
│  provider = ProviderFactory.create_provider(config)  │
│  messages = [ProviderMessage(...)]                   │
│  response = provider.create_completion(messages)     │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  PROVIDER FACTORY                                    │
├──────────────────────────────────────────────────────┤
│  1. Lookup provider class: "openai" → OpenAIProvider│
│  2. Instantiate: OpenAIProvider(config)              │
│  3. Return: BaseProvider instance                    │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  OPENAI PROVIDER                                     │
├──────────────────────────────────────────────────────┤
│  create_completion(messages, tools):                 │
│    │                                                 │
│    ├─ 1. Convert tools to OpenAI schema              │
│    │    convert_tool_schema(tools) → openai_tools   │
│    │                                                 │
│    ├─ 2. Build API request                          │
│    │    {                                            │
│    │      model: "gpt-4",                            │
│    │      messages: [...],                           │
│    │      tools: openai_tools,                       │
│    │      max_tokens: 4096,                          │
│    │      temperature: 0.7                           │
│    │    }                                            │
│    │                                                 │
│    ├─ 3. Call OpenAI API (with retry logic)         │
│    │    response = client.chat.completions.create() │
│    │                                                 │
│    ├─ 4. Parse response                             │
│    │    content = response.choices[0].message.content│
│    │    tool_calls = response.choices[0].message    │
│    │                        .tool_calls              │
│    │                                                 │
│    └─ 5. Normalize to CompletionResponse            │
│         return CompletionResponse(                  │
│           content=content,                           │
│           tool_calls=[                               │
│             {                                        │
│               "name": tc.function.name,              │
│               "arguments": json.loads(tc.function   │
│                                  .arguments),        │
│               "id": tc.id                            │
│             }                                        │
│           ],                                         │
│           metadata={...}                             │
│         )                                            │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  NORMALIZED RESPONSE (Same for all providers)       │
├──────────────────────────────────────────────────────┤
│  CompletionResponse(                                 │
│    content="Here's the analysis...",                 │
│    tool_calls=[                                      │
│      {                                               │
│        "name": "analyze_performance",                │
│        "arguments": {"period_months": 6},  ← Dict!  │
│        "id": "call_abc123"                           │
│      }                                               │
│    ],                                                │
│    metadata={                                        │
│      "model": "gpt-4",                               │
│      "usage": {"total_tokens": 150},                 │
│      "finish_reason": "tool_calls"                   │
│    }                                                 │
│  )                                                   │
└──────────────────────────────────────────────────────┘
```

---

## Provider-Specific Response Parsing

### OpenAI Response Structure
```
OpenAI API Response:
┌────────────────────────────────────────┐
│ ChatCompletion                         │
│  ├─ choices: [                         │
│  │   ├─ message:                       │
│  │   │   ├─ content: "text" or ""      │
│  │   │   └─ tool_calls: [              │
│  │   │       ├─ id: "call_abc123"      │
│  │   │       ├─ type: "function"       │
│  │   │       └─ function:              │
│  │   │           ├─ name: "tool_name"  │
│  │   │           └─ arguments: "{...}" │ ← JSON string!
│  │   │       ]                          │
│  │   └─ finish_reason: "stop"          │
│  │  ]                                  │
│  ├─ model: "gpt-4"                     │
│  └─ usage:                             │
│      ├─ prompt_tokens: 100             │
│      ├─ completion_tokens: 50          │
│      └─ total_tokens: 150              │
└────────────────────────────────────────┘

Normalization Steps:
1. Extract content: response.choices[0].message.content or ""
2. Parse tool calls: json.loads(tc.function.arguments) for each
3. Build metadata: model, usage, finish_reason
```

---

### Anthropic Response Structure
```
Anthropic API Response:
┌────────────────────────────────────────┐
│ Message                                │
│  ├─ content: [                         │ ← Content blocks!
│  │   ├─ {                              │
│  │   │   type: "text",                 │
│  │   │   text: "Here's the analysis"   │
│  │   │ },                              │
│  │   ├─ {                              │
│  │   │   type: "tool_use",             │
│  │   │   id: "toolu_abc123",           │
│  │   │   name: "analyze_performance",  │
│  │   │   input: {"period_months": 6}   │ ← Already dict!
│  │   │ }                                │
│  │  ]                                  │
│  ├─ model: "claude-3-5-sonnet"         │
│  ├─ stop_reason: "tool_use"            │
│  └─ usage:                             │
│      ├─ input_tokens: 100              │
│      └─ output_tokens: 50              │
└────────────────────────────────────────┘

Normalization Steps:
1. Iterate content blocks
2. Concatenate text blocks → content
3. Extract tool_use blocks → tool_calls (input already dict!)
4. Build metadata: model, usage, stop_reason
```

---

### Gemini Response Structure
```
Gemini API Response:
┌────────────────────────────────────────┐
│ GenerateContentResponse                │
│  ├─ text: "Here's the analysis"        │ ← Direct text
│  ├─ candidates: [                      │
│  │   ├─ content:                       │
│  │   │   └─ parts: [                   │
│  │   │       ├─ {text: "..."},         │
│  │   │       ├─ {                      │
│  │   │       │   function_call:        │
│  │   │       │     ├─ name: "analyze", │
│  │   │       │     └─ args: Map{       │ ← Map, not dict!
│  │   │       │         "period_months"  │
│  │   │       │         : 6             │
│  │   │       │       }                 │
│  │   │       │ }                       │
│  │   │      ]                          │
│  │   └─ finish_reason: FUNCTION_CALL   │
│  │  ]                                  │
│  └─ usage_metadata:                    │
│      ├─ prompt_token_count: 100        │
│      └─ total_token_count: 150         │
└────────────────────────────────────────┘

Normalization Steps:
1. Extract text: response.text or ""
2. Parse parts for function_call
3. Convert args Map to dict: dict(part.function_call.args)
4. Generate IDs: f"call_{i}" (Gemini doesn't provide)
5. Build metadata: model, usage_metadata, finish_reason
```

---

## Error Handling Flow

```
┌──────────────────────────────────────────────────────┐
│  provider.create_completion(messages, tools)         │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  TRY: Call provider API                              │
│  ├─ OpenAI: client.chat.completions.create()         │
│  ├─ Anthropic: client.messages.create()              │
│  ├─ Gemini: chat.send_message()                      │
│  └─ Ollama: client.chat()                            │
└──────────────────────────────────────────────────────┘
                        │
                ┌───────┴────────┐
                │                │
         Success │                │ Error
                ▼                ▼
    ┌──────────────┐   ┌──────────────────────┐
    │ Parse &      │   │ Check Error Type     │
    │ Normalize    │   ├──────────────────────┤
    │ Response     │   │ Permanent?           │
    └──────────────┘   │ ├─ AuthenticationErr │
                       │ ├─ InvalidRequest    │
                       │ └─ NotFound          │
                       │   → Raise immediately│
                       │                      │
                       │ Transient?           │
                       │ ├─ RateLimitError    │
                       │ ├─ APIConnectionErr  │
                       │ └─ Timeout           │
                       │   → Retry with       │
                       │     backoff          │
                       └──────────────────────┘
                                 │
                     ┌───────────┴────────────┐
                     │                        │
              Retry  │                        │ Max Retries
             Attempt │                        │ Exceeded
                     ▼                        ▼
           ┌──────────────┐        ┌─────────────────┐
           │ Wait         │        │ Raise Last      │
           │ (exponential │        │ Exception       │
           │  backoff)    │        └─────────────────┘
           │              │
           │ Delay =      │
           │  initial *   │
           │  (base ^     │
           │   attempt)   │
           │              │
           │ Max: 60s     │
           └──────────────┘
                 │
                 └─── Back to TRY
```

---

## Provider Factory Registration

```
┌──────────────────────────────────────────────────────┐
│  src/cycling_ai/providers/factory.py                 │
└──────────────────────────────────────────────────────┘

class ProviderFactory:
    _providers: dict[str, Type[BaseProvider]] = {}
                      └───┬───┘  └──────┬──────┘
                          │             │
                   Provider name    Provider class
                   ("openai")       (OpenAIProvider)

    @classmethod
    def register_provider(cls, name: str, provider_class):
        cls._providers[name.lower()] = provider_class

    @classmethod
    def create_provider(cls, config: ProviderConfig):
        provider_class = cls._providers[config.provider_name]
        return provider_class(config)

┌──────────────────────────────────────────────────────┐
│  Auto-registration on import:                        │
├──────────────────────────────────────────────────────┤
│  from .openai_provider import OpenAIProvider         │
│  from .anthropic_provider import AnthropicProvider   │
│  from .gemini_provider import GeminiProvider         │
│  from .ollama_provider import OllamaProvider         │
│                                                      │
│  ProviderFactory.register_provider("openai",        │
│                                     OpenAIProvider)  │
│  ProviderFactory.register_provider("anthropic",     │
│                                     AnthropicProvider)│
│  ProviderFactory.register_provider("gemini",        │
│                                     GeminiProvider)  │
│  ProviderFactory.register_provider("ollama",        │
│                                     OllamaProvider)  │
└──────────────────────────────────────────────────────┘

USAGE:
┌──────────────────────────────────────────────────────┐
│  config = ProviderConfig(provider_name="openai", ...)│
│  provider = ProviderFactory.create_provider(config)  │
│           └──────────────┬──────────────┘            │
│                          │                            │
│                          ▼                            │
│          ┌───────────────────────────┐               │
│          │ 1. Lookup: "openai"       │               │
│          │    → OpenAIProvider       │               │
│          │                           │               │
│          │ 2. Instantiate:           │               │
│          │    OpenAIProvider(config) │               │
│          │                           │               │
│          │ 3. Return:                │               │
│          │    BaseProvider instance  │               │
│          └───────────────────────────┘               │
└──────────────────────────────────────────────────────┘
```

---

## Testing Architecture

```
┌──────────────────────────────────────────────────────────┐
│  UNIT TESTS (No real API calls)                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  tests/providers/test_openai_provider.py                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  @patch("openai.OpenAI")                           │ │
│  │  def test_create_completion(mock_openai):          │ │
│  │      # Mock the SDK                                │ │
│  │      mock_client = Mock()                          │ │
│  │      mock_response = Mock()                        │ │
│  │      mock_response.choices[0].message.content = ..│ │
│  │      mock_client.chat.completions.create.return_  │ │
│  │                             value = mock_response  │ │
│  │      mock_openai.return_value = mock_client       │ │
│  │                                                    │ │
│  │      # Test provider                              │ │
│  │      provider = OpenAIProvider(config)            │ │
│  │      response = provider.create_completion(...)   │ │
│  │                                                    │ │
│  │      # Assert normalized response                 │ │
│  │      assert response.content == "expected"        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Benefits:                                               │
│  ✓ No API costs                                          │
│  ✓ Fast execution                                        │
│  ✓ Deterministic results                                 │
│  ✓ Test error conditions                                 │
│  ✓ Works in CI/CD without credentials                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  INTEGRATION TESTS (Optional - Real API calls)           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  tests/integration/test_providers_integration.py        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  @pytest.mark.integration                          │ │
│  │  @pytest.mark.skipif(                              │ │
│  │      not os.getenv("OPENAI_API_KEY"),              │ │
│  │      reason="API key not set"                      │ │
│  │  )                                                 │ │
│  │  def test_openai_real_api():                       │ │
│  │      config = ProviderConfig(                      │ │
│  │          provider_name="openai",                   │ │
│  │          api_key=os.getenv("OPENAI_API_KEY"),      │ │
│  │          model="gpt-3.5-turbo"                     │ │
│  │      )                                             │ │
│  │      provider = ProviderFactory.create_provider(  │ │
│  │                                          config)   │ │
│  │      response = provider.create_completion(...)   │ │
│  │      assert response.content                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Run integration tests:                                  │
│  $ export OPENAI_API_KEY=sk-...                          │
│  $ pytest -m integration -v                              │
│                                                          │
│  Skip integration tests (default):                       │
│  $ pytest -m "not integration" -v                        │
└──────────────────────────────────────────────────────────┘
```

---

## File Organization

```
src/cycling_ai/providers/
│
├── __init__.py                  # Public API exports
│   └─ Exports:
│       ├─ BaseProvider
│       ├─ ProviderConfig
│       ├─ ProviderMessage
│       ├─ CompletionResponse
│       ├─ ProviderFactory
│       ├─ OpenAIProvider
│       ├─ AnthropicProvider
│       ├─ GeminiProvider
│       └─ OllamaProvider
│
├── base.py                      # Phase 1 (Existing)
│   ├─ ProviderConfig
│   ├─ ProviderMessage
│   ├─ CompletionResponse
│   └─ BaseProvider (ABC)
│
├── factory.py                   # Phase 2 (CARD 01)
│   └─ ProviderFactory
│       ├─ _providers: dict
│       ├─ register_provider()
│       ├─ create_provider()
│       └─ list_providers()
│
├── provider_utils.py            # Phase 2 (CARD 01)
│   ├─ retry_with_exponential_backoff()
│   ├─ is_permanent_error()
│   └─ convert_to_openai_format()
│
├── openai_provider.py           # Phase 2 (CARD 02)
│   └─ OpenAIProvider(BaseProvider)
│       ├─ client: openai.OpenAI
│       ├─ convert_tool_schema()
│       ├─ invoke_tool()
│       ├─ format_response()
│       └─ create_completion()
│
├── anthropic_provider.py        # Phase 2 (CARD 03)
│   └─ AnthropicProvider(BaseProvider)
│       ├─ client: anthropic.Anthropic
│       ├─ convert_tool_schema()
│       ├─ invoke_tool()
│       ├─ format_response()
│       └─ create_completion()
│
├── gemini_provider.py           # Phase 2 (CARD 04)
│   └─ GeminiProvider(BaseProvider)
│       ├─ convert_tool_schema()
│       ├─ invoke_tool()
│       ├─ format_response()
│       └─ create_completion()
│
└── ollama_provider.py           # Phase 2 (CARD 05)
    └─ OllamaProvider(BaseProvider)
        ├─ client: ollama.Client
        ├─ convert_tool_schema()
        ├─ invoke_tool()
        ├─ format_response()
        └─ create_completion()
```

---

## Sequence Diagram: Complete Request Flow

```
User Code          Factory          Provider        External API
    │                 │                 │                 │
    │ create_config   │                 │                 │
    │────────────────>│                 │                 │
    │                 │                 │                 │
    │ create_provider │                 │                 │
    │────────────────>│                 │                 │
    │                 │ instantiate     │                 │
    │                 │────────────────>│                 │
    │                 │                 │ initialize      │
    │                 │                 │ client          │
    │                 │                 │────────────────>│
    │                 │                 │<────────────────│
    │                 │<────────────────│                 │
    │<────────────────│                 │                 │
    │                 │                 │                 │
    │ create_completion(messages, tools)│                 │
    │──────────────────────────────────>│                 │
    │                 │                 │                 │
    │                 │                 │ convert_tools   │
    │                 │                 │ (internal)      │
    │                 │                 │                 │
    │                 │                 │ API call        │
    │                 │                 │────────────────>│
    │                 │                 │                 │
    │                 │                 │ [retry loop if  │
    │                 │                 │  transient err] │
    │                 │                 │                 │
    │                 │                 │<────────────────│
    │                 │                 │ raw response    │
    │                 │                 │                 │
    │                 │                 │ normalize       │
    │                 │                 │ (internal)      │
    │                 │                 │                 │
    │<──────────────────────────────────│                 │
    │ CompletionResponse                │                 │
    │                 │                 │                 │
    │ access response.content            │                 │
    │ access response.tool_calls         │                 │
    │                 │                 │                 │
```

---

## Configuration Flow

```
┌──────────────────────────────────────────────────────┐
│  1. User creates ProviderConfig                      │
├──────────────────────────────────────────────────────┤
│  config = ProviderConfig(                            │
│      provider_name="openai",                         │
│      api_key="sk-...",                               │
│      model="gpt-4",                                  │
│      max_tokens=4096,                                │
│      temperature=0.7,                                │
│      additional_params={"organization": "org-..."}   │
│  )                                                   │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  2. Config validation (__post_init__)                │
├──────────────────────────────────────────────────────┤
│  ✓ provider_name not empty                           │
│  ✓ model not empty                                   │
│  ✓ max_tokens > 0                                    │
│  ✓ 0.0 <= temperature <= 2.0                         │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  3. Factory creates provider                         │
├──────────────────────────────────────────────────────┤
│  provider = ProviderFactory.create_provider(config)  │
│                                                      │
│  Lookup: "openai" → OpenAIProvider                   │
│  Instantiate: OpenAIProvider(config)                 │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  4. Provider initialization                          │
├──────────────────────────────────────────────────────┤
│  def __init__(self, config: ProviderConfig):         │
│      super().__init__(config)                        │
│      self.config = config                            │
│      self.client = openai.OpenAI(                    │
│          api_key=config.api_key,                     │
│          organization=config.additional_params       │
│                               .get("organization")   │
│      )                                               │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  5. Provider ready for completions                   │
├──────────────────────────────────────────────────────┤
│  provider.create_completion(messages, tools)         │
└──────────────────────────────────────────────────────┘
```

---

## Summary: Key Architectural Principles

1. **Abstraction:** BaseProvider defines the contract, implementations hide details
2. **Normalization:** All responses converted to CompletionResponse format
3. **Extensibility:** New providers just implement BaseProvider interface
4. **Factory Pattern:** Centralized provider creation and registration
5. **Retry Logic:** Shared exponential backoff for transient failures
6. **Type Safety:** Full type hints, mypy --strict compliance
7. **Testability:** Mock-friendly design, no global state
8. **Separation of Concerns:** Provider layer isolated from business logic

---

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Companion Documents:**
- PHASE2_IMPLEMENTATION_PLAN.md
- PHASE2_KEY_ANSWERS.md
- PHASE2_QUICKSTART.md
- PHASE2_SUMMARY.md

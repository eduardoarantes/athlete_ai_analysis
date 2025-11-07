# Gemini SDK Migration Optimization Plan

**Date:** 2025-01-03
**Status:** Migration Complete - Optimization Plan Ready
**Current Quality Score:** 8.5/10 (Production-ready)
**Target Quality Score:** 9.5/10 (With optimizations)

---

## Migration Summary

Successfully migrated from deprecated `google-generativeai` SDK to new unified `google-genai` SDK (v1.47.0).

**Changes Made:**
- ✅ Updated dependencies in `pyproject.toml`
- ✅ Updated imports to use `from google import genai` and `from google.genai import types`
- ✅ Changed client initialization to `genai.Client(api_key=...)`
- ✅ Updated API calls to use `client.models.generate_content()`
- ✅ Updated tool schemas to use `types.FunctionDeclaration` with `types.Schema` and `types.Type` enums
- ✅ **FIXED: Wrap function declarations in `types.Tool` object** (required by new SDK)
- ✅ Updated tool config to use `types.FunctionCallingConfigMode.ANY`
- ✅ All type checking passes (`mypy --strict`)
- ✅ All linting passes (`ruff check`)
- ✅ Smoke tests pass
- ✅ **Critical bug fixed: tools parameter now correctly formatted**

**Critical Fix Applied (2025-01-03):**
The initial migration had a bug where `convert_tool_schema` returned `list[types.FunctionDeclaration]` but the API requires `list[types.Tool]`. Fixed by wrapping function declarations:
```python
# Return Tool objects, not raw FunctionDeclarations
return [types.Tool(function_declarations=function_declarations)]
```

This resolves the error: `tools[0].tool_type: required one_of 'tool_type' must have one initialized field`

**Reference Documentation:** https://context7.com/websites/googleapis_github_io_python-genai

---

## Optimization Recommendations

### High Priority (Implement Now) - ~70 minutes total

#### 1. Move Imports to Module Level (5 minutes)
**Impact:** Performance improvement, cleaner code
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 132-133, 224-226, 386

**Current:**
```python
def invoke_tool(...):
    import logging
    from cycling_ai.tools.registry import get_global_registry
    logger = logging.getLogger(__name__)
```

**Change to:**
```python
# At module level (after line 25)
import json
import logging

logger = logging.getLogger(__name__)

# Remove imports from inside methods
def invoke_tool(...):
    logger.debug(f"[GEMINI PROVIDER] invoke_tool called: {tool_name}")
```

---

#### 2. Refactor Schema Building (10 minutes)
**Impact:** Better Pydantic compatibility, clearer code
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 87-98

**Current:**
```python
param_schema = types.Schema(
    type=param_type,
    description=param.description,
)
if param.enum:
    param_schema.enum = param.enum  # Mutating after creation
```

**Change to:**
```python
# Build all schema attributes upfront
schema_kwargs: dict[str, Any] = {
    "type": param_type,
    "description": param.description,
}

if param.enum:
    schema_kwargs["enum"] = param.enum

# Handle array items
if param.type == "array" and param.items and isinstance(param.items, dict):
    item_type_str = param.items.get("type", "string")
    item_type = type_map.get(item_type_str.lower(), types.Type.STRING)
    schema_kwargs["items"] = types.Schema(type=item_type)

# Create schema with all attributes at once
param_schema = types.Schema(**schema_kwargs)
```

---

#### 3. Extract Message Conversion Helpers (30 minutes)
**Impact:** Testability, maintainability, readability
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 199-269

**Add these helper methods:**

```python
def _convert_message_to_content(self, msg: ProviderMessage) -> types.Content | None:
    """
    Convert a ProviderMessage to Gemini Content format.

    Args:
        msg: Provider message to convert

    Returns:
        Gemini Content object, or None if message should be skipped
    """
    if not msg or not hasattr(msg, 'role') or not hasattr(msg, 'content'):
        return None

    # Handle tool results
    if msg.role == "tool":
        return self._build_function_response_content(msg)

    # Handle assistant messages with tool calls
    if msg.role == "assistant" and hasattr(msg, 'tool_calls') and msg.tool_calls:
        return self._build_function_call_content(msg)

    # Handle regular messages
    return self._build_text_content(msg)

def _build_function_response_content(self, msg: ProviderMessage) -> types.Content:
    """Build Content for tool/function results."""
    tool_data = self._parse_tool_data(msg.content)

    # Extract tool name from metadata
    tool_name = "unknown"
    if hasattr(msg, 'tool_results') and msg.tool_results:
        tool_name = msg.tool_results[0].get("tool_name", "unknown")

    logger.debug(
        f"[GEMINI] Adding function response: "
        f"name={tool_name}, data_keys={list(tool_data.keys())}"
    )

    return types.Content(
        role="function",
        parts=[types.Part(
            function_response=types.FunctionResponse(
                name=tool_name,
                response=tool_data
            )
        )]
    )

def _build_function_call_content(self, msg: ProviderMessage) -> types.Content:
    """Build Content for assistant messages with tool calls."""
    parts: list[types.Part] = []

    # Add text content if present
    if msg.content:
        parts.append(types.Part(text=msg.content))

    # Add function calls
    for tool_call in msg.tool_calls:
        parts.append(types.Part(
            function_call=types.FunctionCall(
                name=tool_call.get("name", ""),
                args=tool_call.get("arguments", {})
            )
        ))

    role = "user" if msg.role == "system" else "model"
    return types.Content(role=role, parts=parts)

def _build_text_content(self, msg: ProviderMessage) -> types.Content:
    """Build Content for regular text messages."""
    role = "user" if msg.role in ("user", "system") else "model"
    content = msg.content if msg.content is not None else ""

    return types.Content(
        role=role,
        parts=[types.Part(text=content)]
    )

def _parse_tool_data(self, content: str | None) -> dict[str, Any]:
    """Parse tool result data from message content."""
    if not content:
        return {}

    try:
        tool_data = json.loads(content)
        if not isinstance(tool_data, dict):
            return {"response": tool_data}
        return tool_data
    except json.JSONDecodeError:
        logger.warning("Failed to parse tool result JSON, using raw content")
        return {"response": content}
```

**Then simplify create_completion:**
```python
# Build contents list from messages
contents: list[types.Content] = []
for msg in messages:
    content = self._convert_message_to_content(msg)
    if content is not None:
        contents.append(content)
```

---

#### 4. Add Validation to Tool Schema Conversion (15 minutes)
**Impact:** Catch errors early, better debugging
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 74-112

**Add validation:**
```python
for param in tool.parameters:
    # Validate parameter type
    if param.type.lower() not in self._TYPE_MAP:
        logger.warning(
            f"Unknown parameter type '{param.type}' for tool '{tool.name}', "
            f"parameter '{param.name}'. Defaulting to STRING."
        )

    param_type = self._TYPE_MAP.get(param.type.lower(), types.Type.STRING)

    # Build schema
    schema_kwargs: dict[str, Any] = {
        "type": param_type,
        "description": param.description,
    }

    if param.enum:
        # Validate enum values exist
        if not param.enum:
            logger.warning(f"Empty enum for parameter '{param.name}' in tool '{tool.name}'")
        schema_kwargs["enum"] = param.enum

    # Handle array items with validation
    if param.type == "array":
        if not param.items or not isinstance(param.items, dict):
            logger.warning(
                f"Array parameter '{param.name}' in tool '{tool.name}' "
                f"missing items schema. Defaulting to string array."
            )
            schema_kwargs["items"] = types.Schema(type=types.Type.STRING)
        else:
            item_type_str = param.items.get("type", "string")
            item_type = self._TYPE_MAP.get(item_type_str.lower(), types.Type.STRING)
            schema_kwargs["items"] = types.Schema(type=item_type)

    param_schema = types.Schema(**schema_kwargs)
    properties[param.name] = param_schema
```

---

#### 5. Improve Error Handling (10 minutes)
**Impact:** Better error messages, easier debugging
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 383-390

**Current:**
```python
except Exception as e:
    if "unauthenticated" in str(e).lower():
        raise ValueError(f"Invalid Gemini API key: {e}") from e
    import traceback
    tb_str = ''.join(traceback.format_tb(e.__traceback__))
    raise RuntimeError(f"Gemini API error: {e}\nTraceback:\n{tb_str}") from e
```

**Change to:**
```python
except Exception as e:
    # Handle specific Gemini error types
    error_msg = str(e).lower()

    # Authentication errors
    if "unauthenticated" in error_msg or "api key" in error_msg:
        raise ValueError(f"Invalid Gemini API key: {e}") from e

    # Rate limiting errors
    if "rate limit" in error_msg or "quota" in error_msg:
        logger.warning(f"Gemini rate limit hit: {e}")
        # Let retry logic handle it (already has exponential backoff)
        raise

    # Invalid request errors
    if "invalid" in error_msg or "bad request" in error_msg:
        raise ValueError(f"Invalid Gemini request: {e}") from e

    # Generic error with better logging
    logger.error(f"Gemini API error: {e}", exc_info=True)
    raise RuntimeError(f"Gemini API error: {e}") from e
```

---

### Medium Priority (Consider Soon) - ~45 minutes total

#### 6. Move Type Map to Class Constant (3 minutes)
**Impact:** Small performance gain
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 77-84

**Change:**
```python
class GeminiProvider(BaseProvider):
    """Google Gemini provider adapter."""

    # Class-level constant for type mapping
    _TYPE_MAP: dict[str, types.Type] = {
        "string": types.Type.STRING,
        "number": types.Type.NUMBER,
        "integer": types.Type.INTEGER,
        "boolean": types.Type.BOOLEAN,
        "array": types.Type.ARRAY,
        "object": types.Type.OBJECT,
    }

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[types.FunctionDeclaration]:
        # Use self._TYPE_MAP instead of creating dict each time
```

---

#### 7. Add Response Schema Support (10 minutes)
**Impact:** Enable new SDK features for structured outputs
**Files:** `src/cycling_ai/providers/gemini_provider.py`

**Add support for structured JSON outputs:**
```python
# In create_completion, after line 275:
if "response_schema" in self.config.additional_params:
    config_kwargs["response_schema"] = self.config.additional_params["response_schema"]

# Or for JSON mode
if "response_mime_type" in self.config.additional_params:
    config_kwargs["response_mime_type"] = self.config.additional_params["response_mime_type"]
```

**Usage:**
```python
config = ProviderConfig(
    provider_name="gemini",
    api_key="...",
    model="gemini-2.5-flash",
    additional_params={
        "response_schema": types.Schema(
            type=types.Type.OBJECT,
            properties={
                "ftp": types.Schema(type=types.Type.NUMBER),
                "zones": types.Schema(type=types.Type.ARRAY)
            }
        )
    }
)
```

---

#### 8. Add Safety Settings Support (5 minutes)
**Impact:** Production configurability
**Files:** `src/cycling_ai/providers/gemini_provider.py`

**Add:**
```python
# In create_completion, after line 275:
if "safety_settings" in self.config.additional_params:
    config_kwargs["safety_settings"] = self.config.additional_params["safety_settings"]
```

**Usage:**
```python
config = ProviderConfig(
    provider_name="gemini",
    api_key="...",
    model="gemini-2.5-flash",
    additional_params={
        "safety_settings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        ]
    }
)
```

---

#### 9. Update Test Script (20 minutes)
**Impact:** Consistency
**Files:** `scripts/test_gemini_function_response.py`

Update to use new SDK instead of deprecated one. See detailed example in the full review.

---

#### 10. Improve Silent Failure Logging (7 minutes)
**Impact:** Better debugging
**Files:** `src/cycling_ai/providers/gemini_provider.py`
**Lines:** 307-312

**Current:**
```python
try:
    if hasattr(response, "text") and response.text:
        content = response.text
except (ValueError, AttributeError):
    pass
```

**Change to:**
```python
try:
    if hasattr(response, "text") and response.text:
        content = response.text
except (ValueError, AttributeError) as e:
    # response.text raises ValueError when only function calls exist (no text)
    logger.debug(f"No text content in response (likely function call): {e}")
    # This is expected behavior when model makes function calls, not an error
```

---

### Low Priority (Nice to Have) - ~80 minutes total

#### 11. Add Comprehensive Docstrings (20 minutes)
**Impact:** Documentation quality
**Files:** `src/cycling_ai/providers/gemini_provider.py`

Add Google-style docstrings to all new helper methods following project conventions.

---

#### 12. Add Unit Tests for Edge Cases (60 minutes)
**Impact:** Test coverage
**Files:** `tests/providers/test_gemini_provider.py`

**Add tests:**
```python
def test_convert_tool_schema_with_enum():
    """Test schema conversion preserves enum values."""

def test_convert_tool_schema_array_with_items():
    """Test array parameters include items schema."""

def test_convert_tool_schema_unknown_type_defaults_to_string():
    """Test unknown parameter types default to STRING."""

def test_parse_tool_data_invalid_json():
    """Test parsing handles malformed JSON gracefully."""

def test_build_function_response_content():
    """Test function response content building."""
```

---

## Implementation Timeline

### Phase 1: High Priority (Week 1)
- Day 1: Items 1-2 (Move imports, refactor schema building)
- Day 2: Item 3 (Extract message conversion helpers)
- Day 3: Items 4-5 (Add validation, improve error handling)
- Day 4: Testing and verification

**Expected Outcome:** Code quality increases from 8.5/10 to 9.2/10

### Phase 2: Medium Priority (Week 2)
- Day 1: Items 6-8 (Type map constant, response schema, safety settings)
- Day 2: Items 9-10 (Update test script, improve logging)
- Day 3: Testing and documentation

**Expected Outcome:** Code quality increases to 9.5/10

### Phase 3: Low Priority (Week 3)
- Items 11-12 (Docstrings, unit tests)

**Expected Outcome:** Code quality reaches 9.7/10, test coverage improves

---

## Quality Metrics

### Current State (8.5/10)
- ✅ Type Safety: 10/10 (perfect `mypy --strict` compliance)
- ✅ SDK Usage: 9/10 (correct API usage, minor optimization opportunities)
- ⚠️ Performance: 7/10 (unnecessary imports in loops, dict conversions)
- ⚠️ Maintainability: 7/10 (complex nested conditionals)
- ✅ Error Handling: 8/10 (good retry logic, could be more specific)
- ✅ Logging: 9/10 (good coverage, minor import issues)

### After High Priority Changes (9.2/10)
- ✅ Type Safety: 10/10
- ✅ SDK Usage: 9.5/10
- ✅ Performance: 9/10 (imports moved, unnecessary conversions removed)
- ✅ Maintainability: 9/10 (helper methods extracted, clearer structure)
- ✅ Error Handling: 9/10 (specific error types handled)
- ✅ Logging: 10/10 (consistent, proper placement)

### After All Changes (9.7/10)
- ✅ Type Safety: 10/10
- ✅ SDK Usage: 10/10 (all features supported)
- ✅ Performance: 10/10 (fully optimized)
- ✅ Maintainability: 10/10 (well-documented, tested)
- ✅ Error Handling: 10/10 (comprehensive)
- ✅ Logging: 10/10 (perfect)

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All imports moved to module level
- [ ] Schema building uses immutable construction
- [ ] Message conversion extracted to helper methods
- [ ] Tool schema validation added
- [ ] Error handling improved with specific types
- [ ] All tests pass
- [ ] `mypy --strict` passes
- [ ] `ruff check` passes

### Phase 2 Complete When:
- [ ] Type map is class constant
- [ ] Response schema support added
- [ ] Safety settings support added
- [ ] Test script updated to new SDK
- [ ] Silent failure logging improved
- [ ] Integration tests pass with new features

### Phase 3 Complete When:
- [ ] All helper methods have docstrings
- [ ] Unit tests added for edge cases
- [ ] Test coverage > 90% for gemini_provider.py
- [ ] Documentation updated

---

## Notes

**Migration Status:** ✅ Complete and Production-Ready

**Current Code Quality:** The existing implementation is correct and production-ready. These optimizations are incremental improvements, not critical fixes.

**Benefits:**
- Better performance (avoiding repeated operations)
- Improved maintainability (clearer code structure)
- Enhanced debugging (better error messages and logging)
- Future-proofing (support for new SDK features)

**Review Source:** python-expert-reviewer agent analysis on 2025-01-03
**Review Documentation:** https://context7.com/websites/googleapis_github_io_python-genai

---

## Related Files

- `src/cycling_ai/providers/gemini_provider.py` - Main implementation
- `pyproject.toml` - Dependencies and configuration
- `scripts/test_gemini_function_response.py` - Test script (needs update)
- `tests/providers/test_gemini_provider.py` - Unit tests (needs expansion)

---

**Last Updated:** 2025-01-03
**Status:** Ready for Implementation
**Priority:** High priority items should be implemented in next sprint

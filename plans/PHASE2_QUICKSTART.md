# Phase 2 Quick Start Guide

**Ready to implement provider adapters? Follow this checklist.**

---

## Pre-Implementation Checklist

### ✅ Phase 1 Verification

Run these commands to verify Phase 1 is complete:

```bash
# Navigate to project
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# Verify imports work
python3 -c "from cycling_ai.providers.base import BaseProvider, ProviderConfig; print('✓ Base abstractions OK')"

python3 -c "from cycling_ai.tools.base import ToolDefinition, BaseTool; print('✓ Tool abstractions OK')"

python3 -c "from cycling_ai.tools.registry import ToolRegistry; print('✓ Tool registry OK')"

# Run existing tests (should have pytest-cov installed)
python3 -m pip install pytest-cov pytest-mock responses

# Run tests without coverage options
python3 -m pytest tests/providers/test_base.py tests/tools/ -v
```

**Expected Result:** All imports succeed, tests pass

---

## Environment Setup

### 1. Update Dependencies

```bash
# Edit pyproject.toml to add provider SDKs
# (See PHASE2_IMPLEMENTATION_PLAN.md Appendix for full file)

# Install new dependencies
pip install -e ".[dev]"

# Or with uv
uv pip install -e ".[dev]"
```

**New packages to install:**
- openai>=1.0.0
- anthropic>=0.18.0
- google-generativeai>=0.3.0
- ollama>=0.1.0
- httpx>=0.25.0
- pytest-mock>=3.12.0
- responses>=0.24.0

### 2. Verify SDK Installation

```bash
python3 -c "import openai; print(f'OpenAI SDK: {openai.__version__}')"
python3 -c "import anthropic; print(f'Anthropic SDK: {anthropic.__version__}')"
python3 -c "import google.generativeai as genai; print('Gemini SDK: OK')"
python3 -c "import ollama; print('Ollama SDK: OK')"
```

**Expected Result:** All SDKs import successfully

---

## Implementation Order

### CARD 01: Shared Utilities & Factory (START HERE)

**Time Estimate:** 2 hours

**Files to Create:**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/provider_utils.py`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/factory.py`
3. `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/providers/test_factory.py`
4. `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/providers/conftest.py` (test fixtures)

**TDD Steps:**
```bash
# 1. Create test file first
touch tests/providers/test_factory.py

# 2. Write failing test
# (See PHASE2_IMPLEMENTATION_PLAN.md CARD 01 for test examples)

# 3. Run test (should fail)
python3 -m pytest tests/providers/test_factory.py -v

# 4. Implement factory.py to pass test

# 5. Run test again (should pass)
python3 -m pytest tests/providers/test_factory.py -v

# 6. Check coverage
python3 -m pytest tests/providers/test_factory.py --cov=src/cycling_ai/providers/factory

# 7. Type check
mypy --strict src/cycling_ai/providers/factory.py

# 8. Lint
ruff check src/cycling_ai/providers/factory.py
```

**Validation Commands:**
```bash
# All tests pass
python3 -m pytest tests/providers/test_factory.py -v

# 100% coverage for factory
python3 -m pytest tests/providers/test_factory.py \
    --cov=src/cycling_ai/providers/factory \
    --cov-report=term-missing

# Type check passes
mypy --strict src/cycling_ai/providers/

# Lint passes
ruff check src/cycling_ai/providers/
```

---

### CARD 02: OpenAI Provider

**Time Estimate:** 2 hours

**Files to Create:**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/openai_provider.py`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/providers/test_openai_provider.py`

**TDD Steps:**
```bash
# 1. Create test file
touch tests/providers/test_openai_provider.py

# 2. Write test for initialization
# (See PHASE2_IMPLEMENTATION_PLAN.md CARD 02 for examples)

# 3. Run test (should fail)
python3 -m pytest tests/providers/test_openai_provider.py::TestOpenAIProvider::test_initialization -v

# 4. Implement OpenAIProvider.__init__()

# 5. Run test (should pass)
python3 -m pytest tests/providers/test_openai_provider.py::TestOpenAIProvider::test_initialization -v

# 6. Repeat for each method:
#    - convert_tool_schema()
#    - invoke_tool()
#    - format_response()
#    - create_completion() [without tools]
#    - create_completion() [with tools]
#    - error handling
```

**Validation Commands:**
```bash
# All OpenAI tests pass
python3 -m pytest tests/providers/test_openai_provider.py -v

# >85% coverage
python3 -m pytest tests/providers/test_openai_provider.py \
    --cov=src/cycling_ai/providers/openai_provider \
    --cov-report=term-missing \
    --cov-fail-under=85

# Type check
mypy --strict src/cycling_ai/providers/openai_provider.py

# Lint
ruff check src/cycling_ai/providers/openai_provider.py
```

**Optional: Manual Smoke Test**
```bash
# Create .env file
echo "OPENAI_API_KEY=sk-..." > .env

# Test with real API (requires API key)
python3 << 'EOF'
from cycling_ai.providers.openai_provider import OpenAIProvider
from cycling_ai.providers.base import ProviderConfig, ProviderMessage
import os

config = ProviderConfig(
    provider_name="openai",
    api_key=os.getenv("OPENAI_API_KEY"),
    model="gpt-3.5-turbo",
    max_tokens=50,
)

provider = OpenAIProvider(config)
messages = [ProviderMessage(role="user", content="Say 'OpenAI works!'")]
response = provider.create_completion(messages)
print(f"✓ Response: {response.content}")
EOF
```

---

### CARD 03: Anthropic Provider

**Time Estimate:** 2 hours

**Files to Create:**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/anthropic_provider.py`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/providers/test_anthropic_provider.py`

**Follow same TDD pattern as OpenAI (CARD 02)**

**Special Considerations:**
- System messages are separate parameter
- Content blocks (text + tool_use)
- Tool arguments are dicts (not JSON strings)

---

### CARD 04: Gemini Provider

**Time Estimate:** 2 hours

**Files to Create:**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/gemini_provider.py`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/providers/test_gemini_provider.py`

**Special Considerations:**
- Types in ALL CAPS (STRING, INTEGER, OBJECT)
- FunctionDeclaration and Tool objects
- Chat history management
- Generate tool call IDs (Gemini doesn't provide them)

---

### CARD 05: Ollama Provider

**Time Estimate:** 1.5 hours

**Files to Create:**
1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/ollama_provider.py`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/providers/test_ollama_provider.py`

**Special Considerations:**
- No API key required (local)
- Base URL configuration (default: http://localhost:11434)
- Connection error handling
- Model availability checking

**Optional: Local Testing**
```bash
# Install Ollama
brew install ollama  # macOS

# Pull a model
ollama pull llama3

# Test with real local model
python3 << 'EOF'
from cycling_ai.providers.ollama_provider import OllamaProvider
from cycling_ai.providers.base import ProviderConfig, ProviderMessage

config = ProviderConfig(
    provider_name="ollama",
    api_key="",  # Not needed
    model="llama3",
    max_tokens=50,
)

provider = OllamaProvider(config)
messages = [ProviderMessage(role="user", content="Say 'Ollama works!'")]
response = provider.create_completion(messages)
print(f"✓ Response: {response.content}")
EOF
```

---

### CARD 06: Integration & Documentation

**Time Estimate:** 1.5 hours

**Files to Create/Update:**
1. Update `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/__init__.py`
2. Create `/Users/eduardo/Documents/projects/cycling-ai-analysis/tests/integration/test_providers_integration.py`
3. Update `/Users/eduardo/Documents/projects/cycling-ai-analysis/README.md`
4. Create `/Users/eduardo/Documents/projects/cycling-ai-analysis/docs/PROVIDER_GUIDE.md`
5. Update `/Users/eduardo/Documents/projects/cycling-ai-analysis/CHANGELOG.md`

---

## Progress Tracking

### Daily Checklist Template

**Day 1: Foundation**
- [ ] CARD 01: Shared utilities & factory complete
- [ ] CARD 02: OpenAI provider complete
- [ ] All tests passing (factory + openai)
- [ ] Type checking passing
- [ ] Linting passing

**Day 2: Additional Providers**
- [ ] CARD 03: Anthropic provider complete
- [ ] CARD 04: Gemini provider complete
- [ ] All tests passing (all providers so far)
- [ ] Type checking passing
- [ ] Linting passing

**Day 3: Completion**
- [ ] CARD 05: Ollama provider complete
- [ ] CARD 06: Integration & docs complete
- [ ] All tests passing (full suite)
- [ ] Integration tests created
- [ ] Documentation complete
- [ ] PHASE2_COMPLETION.md written

---

## Validation at Each Step

### After Each Provider

```bash
# 1. Run provider-specific tests
python3 -m pytest tests/providers/test_<PROVIDER>_provider.py -v

# 2. Run all provider tests
python3 -m pytest tests/providers/ -v

# 3. Check coverage
python3 -m pytest tests/providers/ \
    --cov=src/cycling_ai/providers \
    --cov-report=html \
    --cov-report=term-missing

# 4. Type check
mypy --strict src/cycling_ai/providers/

# 5. Lint
ruff check src/cycling_ai/providers/
ruff format src/cycling_ai/providers/

# 6. View coverage report
open htmlcov/index.html  # macOS
```

### Final Validation (Phase 2 Complete)

```bash
# Full test suite
python3 -m pytest tests/ -v

# Coverage check (target: >85%)
python3 -m pytest tests/providers/ \
    --cov=src/cycling_ai/providers \
    --cov-report=term-missing \
    --cov-fail-under=85

# Type checking (strict)
mypy --strict src/cycling_ai/

# Linting
ruff check src/cycling_ai/

# Integration tests (optional, requires API keys)
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
python3 -m pytest -m integration -v
```

---

## Debugging Tips

### Common Issues

**Issue: Import errors**
```bash
# Solution: Ensure package installed in editable mode
pip install -e ".[dev]"

# Verify installation
pip show cycling-ai-analysis
```

**Issue: Pytest not found**
```bash
# Solution: Install pytest
pip install pytest pytest-cov pytest-mock

# Verify
python3 -m pytest --version
```

**Issue: Type checking fails**
```bash
# Solution: Install type stubs
pip install types-requests

# Check specific file
mypy --strict src/cycling_ai/providers/openai_provider.py
```

**Issue: Coverage too low**
```bash
# See which lines are missing coverage
python3 -m pytest tests/providers/test_openai_provider.py \
    --cov=src/cycling_ai/providers/openai_provider \
    --cov-report=term-missing

# Add tests for uncovered lines
```

**Issue: Mock not working**
```bash
# Verify mock is patching correct path
@patch("cycling_ai.providers.openai_provider.openai.OpenAI")  # Patch where it's used
# NOT
@patch("openai.OpenAI")  # This won't work

# Debug mock calls
mock_client.chat.completions.create.assert_called_once()
print(mock_client.chat.completions.create.call_args)
```

---

## Reference Documents

While implementing, keep these open:

1. **PHASE2_IMPLEMENTATION_PLAN.md** - Full detailed plan
2. **PHASE2_KEY_ANSWERS.md** - Quick answers to common questions
3. **Base abstractions:**
   - `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/providers/base.py`
   - `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/tools/base.py`

---

## Quick Commands Reference

```bash
# Test single provider
pytest tests/providers/test_openai_provider.py -v

# Test all providers
pytest tests/providers/ -v

# Test with coverage
pytest tests/providers/ --cov=src/cycling_ai/providers --cov-report=html

# Type check
mypy --strict src/cycling_ai/providers/

# Lint
ruff check src/cycling_ai/providers/

# Format
ruff format src/cycling_ai/providers/

# Run integration tests
pytest -m integration -v

# Skip integration tests
pytest -m "not integration" -v
```

---

## Success Criteria

Phase 2 is complete when:

- [ ] All 4 provider adapters implemented
- [ ] ProviderFactory working
- [ ] All unit tests passing
- [ ] >85% test coverage
- [ ] Type checking passing (mypy --strict)
- [ ] Linting passing (ruff)
- [ ] Integration tests created
- [ ] Documentation updated
- [ ] PHASE2_COMPLETION.md written

---

**Ready to start? Begin with CARD 01: Shared Utilities & Factory**

**Next Step:** Create `tests/providers/test_factory.py` and write your first failing test!

---

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Phase:** 2 - Provider Adapters

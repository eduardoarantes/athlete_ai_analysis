# Phase 4 Implementation Plan: LLM Natural Language Queries

**Status:** Planning Complete ✅
**Ready for:** Implementation
**Phase:** 4A - Core LLM Orchestration

---

## Quick Navigation

### Planning Documents
- 📋 **[PLAN.md](PLAN.md)** - Master architecture plan (comprehensive)
- 📝 **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Quick reference guide
- 🗂️ **[PLAN/](PLAN/)** - Implementation cards (detailed specs)

### Implementation Cards (Execute in Order)

| # | Card | Component | Time | Status |
|---|------|-----------|------|--------|
| 1 | [CARD_001](PLAN/CARD_001.md) | Conversation Types | 2-3h | 🔲 Not Started |
| 2 | [CARD_002](PLAN/CARD_002.md) | Prompt Template System | 3-4h | 🔲 Not Started |
| 3 | [CARD_003](PLAN/CARD_003.md) | Conversation Manager | 4-5h | 🔲 Not Started |
| 4 | [CARD_004](PLAN/CARD_004.md) | LLM Orchestrator (ReAct) | 6-8h | 🔲 Not Started |
| 5 | [CARD_005](PLAN/CARD_005.md) | CLI "ask" Command | 3-4h | 🔲 Not Started |

**Total Estimated Time:** 18-24 hours (2-3 days focused work)

---

## What We're Building

Transform the system from **programmatic CLI tool** to **conversational AI coach**:

### Current (Phase 3)
```bash
cycling-ai analyze performance --csv data.csv --profile profile.json --period-months 6
```

### Goal (Phase 4A)
```bash
cycling-ai ask "How has my performance improved in the last 6 months?" --profile profile.json
```

**The LLM will:**
1. Understand the question
2. Decide which tools to call (e.g., `analyze_performance`)
3. Execute tools automatically
4. Interpret results in natural language
5. Provide personalized coaching advice

---

## Architecture at a Glance

```
User: "How has my performance improved?"
    ↓
ConversationManager (build context with athlete profile + history)
    ↓
LLMOrchestrator (ReAct loop: Think → Act → Observe → Answer)
    ↓
LLM Provider (OpenAI/Anthropic/Gemini/Ollama)
    ↓
Tool Execution (analyze_performance, analyze_zones, etc.)
    ↓
LLM Interpretation ("Your performance improved 15%...")
    ↓
Rich CLI Output (beautiful markdown formatting)
```

---

## Implementation Approach

### TDD (Test-Driven Development)
1. ✅ Read implementation card
2. ✅ Write tests first (red phase)
3. ✅ Implement to pass tests (green phase)
4. ✅ Refactor and polish (refactor phase)
5. ✅ Move to next card

### Execution Order
**Cards must be completed in sequence (dependencies)**

1. **CARD_001** - Foundation types (no dependencies)
2. **CARD_002** - Prompt templates (uses types)
3. **CARD_003** - Conversation manager (uses types + prompts)
4. **CARD_004** - LLM orchestrator (uses all above)
5. **CARD_005** - CLI command (uses orchestrator)

---

## Quick Start

### 1. Read Planning Documents
```bash
# Start here (big picture)
open PLAN.md

# Then implementation summary (quick reference)
open IMPLEMENTATION_SUMMARY.md

# Then individual cards (detailed specs)
open PLAN/CARD_001.md
```

### 2. Set Up Environment
```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies (already done in Phase 1-3)
uv pip install -e ".[dev]"

# Set API keys
export ANTHROPIC_API_KEY=your-actual-key-here
export OPENAI_API_KEY=your-actual-key-here  # Optional for testing
```

### 3. Begin Implementation
```bash
# Start with CARD_001
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# Create directory structure
mkdir -p src/cycling_ai/conversation
mkdir -p src/cycling_ai/prompts
mkdir -p tests/conversation
mkdir -p tests/prompts

# Create first file (following CARD_001)
touch src/cycling_ai/conversation/__init__.py
touch src/cycling_ai/conversation/types.py
touch tests/conversation/__init__.py
touch tests/conversation/test_types.py

# Write tests first (TDD)
# ... implement tests from CARD_001
# ... implement code to pass tests
# ... verify coverage > 90%
```

### 4. Validation After Each Card
```bash
# Run tests
pytest tests/conversation/test_types.py -v

# Check coverage
pytest --cov=src/cycling_ai/conversation tests/conversation/

# Type checking
mypy --strict src/cycling_ai/conversation/

# Linting
ruff check src/cycling_ai/conversation/
ruff format src/cycling_ai/conversation/
```

### 5. Final Integration (After CARD_005)
```bash
# Full test suite
pytest tests/ -v

# Coverage report
pytest --cov=src/cycling_ai --cov-report=html

# Manual testing
cycling-ai ask "How has my performance improved?" --profile path/to/profile.json
```

---

## Key Design Decisions

### 1. ReAct Pattern
- **Think**: LLM reasons about what data it needs
- **Act**: LLM calls tools to get data
- **Observe**: System provides tool results
- **Repeat**: Until LLM has enough information
- **Answer**: LLM provides final response

### 2. Context Management
- **System prompt**: Always includes athlete profile
- **Recent history**: Last 2-3 complete turns
- **Compression**: Drop oldest when over token limit
- **Max tokens**: Configurable budget (default 8000)

### 3. Tool Integration
- Uses existing Phase 3 ToolExecutor ✅
- Uses existing Phase 3 ToolRegistry ✅
- Uses existing Phase 2 provider adapters ✅
- **Zero changes needed to existing code!**

### 4. Multi-Provider Support
- Works with OpenAI, Anthropic, Gemini, Ollama
- Uses existing BaseProvider abstraction
- Provider selection via CLI flag
- Model override via CLI flag

---

## Success Criteria

### Functional
- [ ] User can ask: "How has my performance improved?"
- [ ] LLM automatically calls `analyze_performance` tool
- [ ] LLM interprets results correctly
- [ ] Response is natural language (not JSON)
- [ ] Works with all 4 providers
- [ ] Handles errors gracefully

### Quality
- [ ] Test coverage > 85%
- [ ] All tests pass
- [ ] mypy --strict passes
- [ ] No regressions in Phase 1-3
- [ ] Code follows existing patterns

### User Experience
- [ ] Beautiful Rich CLI output
- [ ] Progress indicators during execution
- [ ] Clear error messages
- [ ] Response time < 10s for typical queries

---

## Example Queries (After Phase 4A)

```bash
# Performance analysis
cycling-ai ask "How has my performance changed in the last 6 months?" -p profile.json

# Zone distribution
cycling-ai ask "Am I training with good polarization?" -p profile.json

# Training advice
cycling-ai ask "What should I focus on to improve my FTP?" -p profile.json

# Multi-tool workflow
cycling-ai ask "Analyze my performance and create a 12-week plan" -p profile.json

# Different provider
cycling-ai ask "How am I doing?" -p profile.json --provider openai

# Debug mode
cycling-ai ask "Test query" -p profile.json --show-tools
```

---

## Phase 4 Roadmap

### Phase 4A (Current) - Core LLM Orchestration
**Goal:** Single-shot natural language queries
**Time:** 2-3 days
**Status:** Planning Complete ✅

### Phase 4B - Interactive Coaching
**Goal:** Multi-turn conversational REPL
**Time:** 1 week
**Status:** Planned (not started)

Features:
- Interactive prompt with readline support
- Session save/resume
- Command system (/help, /save, /tools, /exit)
- Conversation history navigation

### Phase 4C - Advanced Features
**Goal:** Streaming, costs, optimization
**Time:** 1 week
**Status:** Planned (not started)

Features:
- Token-by-token streaming responses
- Cost estimation and budgets
- Rate limiting and retry logic
- Multi-tool optimization
- Enhanced error recovery

### Phase 4D - Polish & Validation
**Goal:** Production readiness
**Time:** 1 week
**Status:** Planned (not started)

Features:
- Real data testing (220+ activities)
- Performance optimization
- Comprehensive documentation
- Video demos
- Beta user testing

---

## Document Inventory

### Planning Documents
1. **PLAN.md** (15,000+ words)
   - Executive summary
   - Architecture diagrams
   - Component specifications
   - Testing strategy
   - Risk analysis
   - Key questions answered

2. **IMPLEMENTATION_SUMMARY.md** (4,000+ words)
   - Quick reference guide
   - Implementation checklist
   - File structure
   - Integration points
   - Getting started guide

### Implementation Cards
1. **CARD_001.md** - Conversation Types (data models)
2. **CARD_002.md** - Prompt Template System (LLM instructions)
3. **CARD_003.md** - Conversation Manager (state management)
4. **CARD_004.md** - LLM Orchestrator (core engine)
5. **CARD_005.md** - CLI "ask" Command (user interface)

**Total Planning Documentation:** ~25,000 words

---

## Questions?

Refer to:
1. **PLAN.md** - Why decisions were made
2. **IMPLEMENTATION_SUMMARY.md** - How to implement
3. **CARD_XXX.md** - What to implement
4. **Phase 1-3 docs** - Existing patterns

---

## Status: Ready for Implementation ✅

**Next Action:** Begin CARD_001 implementation

```bash
# Open CARD_001
open .claude/current_task/PLAN/CARD_001.md

# Create files
touch src/cycling_ai/conversation/types.py
touch tests/conversation/test_types.py

# Start TDD
# 1. Write tests (from CARD_001)
# 2. Run tests (they fail)
# 3. Implement code (to pass tests)
# 4. Refactor and polish
# 5. Move to CARD_002
```

---

**Planning Complete:** 2025-10-24
**Estimated Implementation Time:** 18-24 hours (Phase 4A)
**Total Time to Production (All Phases):** ~4 weeks

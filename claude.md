# Cycling AI Analysis - Claude Code Guide

**Project:** AI-powered cycling performance analysis API
**Status:** Production Ready
**Version:** 0.1.0

---

## Project Overview

This is a **production-ready Python application** that provides AI-powered cycling performance analysis through a **FastAPI REST API**. The API provides endpoints for:

1. **Performance Analysis** - Analyze cycling performance trends and metrics
2. **Training Plan Generation** - Create personalized training plans using LLM providers
3. **Power Zone Calculations** - Calculate and manage power training zones
4. **Athlete Profile Management** - Manage athlete profiles and settings

---

## Project Goals & Philosophy

### Primary Goals
1. **Make cycling performance analysis accessible** through a REST API
2. **Support multiple LLM providers** (Anthropic, OpenAI, Google Gemini, Ollama) for flexibility and cost optimization
3. **Maintain production-grade code quality** (type-safe, tested, well-documented)

### Design Principles
- **Type Safety First**: Full `mypy --strict` compliance throughout the codebase
- **Clean Architecture**: Separation of concerns, SOLID principles, clear abstractions
- **Provider Agnostic**: Easy to add new LLM providers via adapter pattern
- **Fail Fast**: Clear error messages, validation at boundaries

---

## Architecture Overview

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI REST API                         │
│  /api/v1/{analysis|plan|zones|profile}                       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  API Services       │         │  LLM Providers      │
│  (Business Logic)   │         │  (AI Integration)   │
└─────────┬───────────┘         └─────────┬───────────┘
          │                               │
          v                               v
┌──────────────────────────────────────────────────────┐
│              Core Business Logic                      │
│  • Performance analysis algorithms                    │
│  • Power zone calculations                           │
│  • Training plan generation                          │
│  • FIT file processing                               │
└──────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/cycling_ai/
├── api/                  # FastAPI REST API
│   ├── main.py          # FastAPI app entry point
│   ├── routers/         # API route handlers
│   │   ├── analysis.py  # Performance analysis endpoints
│   │   ├── plan.py      # Training plan endpoints
│   │   └── zones.py     # Power zone endpoints
│   ├── services/        # Business logic services
│   │   ├── ai_plan_service.py  # LLM-powered plan generation
│   │   └── analysis_service.py # Performance analysis
│   └── middleware/      # Auth and request handling
│
├── core/                 # Business logic (pure Python, no LLM)
│   ├── performance.py   # Performance analysis algorithms
│   ├── zones.py         # Power zone calculations
│   ├── training.py      # Training plan generation
│   ├── fit_processing.py # FIT file parsing
│   └── workout_builder.py
│
├── rag/                  # RAG (Retrieval Augmented Generation) - Future API integration
│   ├── embeddings.py    # EmbeddingFactory (local & API embeddings)
│   ├── vectorstore.py   # ChromaVectorStore wrapper
│   ├── manager.py       # RAGManager (two-vectorstore design)
│   └── indexing.py      # KnowledgeIndexer (markdown → chunks)
│
├── tools/                # Tool abstraction layer
│   ├── base.py          # Tool, ToolParameter, ToolExecutionResult
│   ├── registry.py      # Auto-discovery and registration
│   └── wrappers/        # Tool implementations
│
├── providers/           # LLM provider adapters
│   ├── base.py         # BaseProvider, ProviderConfig
│   ├── openai_provider.py
│   ├── anthropic_provider.py
│   ├── gemini_provider.py
│   └── ollama_provider.py
│
├── orchestration/       # API support modules
│   ├── prompt_loader.py         # Load and manage agent prompts
│   ├── rag_integration.py       # RAG prompt augmentation (future use)
│   └── phases/
│       └── training_planning_library.py  # Library-based workout selection
│
├── config/              # Configuration management
└── utils/               # Shared utilities
```

---

## Key Components

### 1. FastAPI REST API (`api/`)

**Purpose:** Provides RESTful endpoints for all cycling analysis features.

**Key Endpoints:**
- `POST /api/v1/analysis/performance` - Analyze performance trends
- `POST /api/v1/plan/generate` - Generate training plans
- `GET /api/v1/zones/{ftp}` - Calculate power zones
- `GET /health` - Health check endpoint

### 2. Provider System (`providers/`)

**Pattern:** Adapter pattern for LLM providers
- Common interface: `BaseProvider`
- Handles tool calling format conversion (each provider has different schemas)
- Configuration via `ProviderConfig`

**Supported Providers:**
- **Anthropic Claude** (Recommended) - Best tool calling, high quality
- **OpenAI GPT-4** - Reliable, more expensive
- **Google Gemini** - Best value, good quality
- **Ollama** - Local execution, free, privacy-focused

### 3. Core Business Logic (`core/`)

**Purpose:** Pure Python business logic without LLM dependencies

- `performance.py` - Performance analysis algorithms
- `zones.py` - Power zone calculations
- `training.py` - Training plan structures
- `fit_processing.py` - FIT file parsing
- `workout_builder.py` - Workout construction

### 4. RAG System (`rag/`) - Future API Integration

**Purpose:** Retrieval Augmented Generation for enhanced AI responses

**Note:** The RAG module is retained for future API integration. Potential use cases:
1. **Enhanced Training Plan Generation** - Use domain knowledge to improve plan quality
2. **Coaching Insights** - Ground AI responses in cycling science
3. **Knowledge-Based Q&A** - Allow users to ask questions grounded in training knowledge

**Key Components:**
- `EmbeddingFactory` - Supports multiple embedding providers (local, OpenAI)
- `ChromaVectorStore` - Wrapper around ChromaDB
- `RAGManager` - Coordinates retrieval across vectorstores
- `KnowledgeIndexer` - Indexes markdown files and JSON templates

---

## Important Patterns & Best Practices

### 1. Type Safety
**Always use type hints and maintain mypy --strict compliance**

```python
# Good
def analyze_performance(
    csv_path: Path,
    profile: AthleteProfile,
    period_months: int
) -> PerformanceAnalysis:
    ...

# Bad - no types
def analyze_performance(csv_path, profile, period_months):
    ...
```

### 2. Error Handling

**Fail fast with clear messages:**

```python
# Good
def validate_config(config: WorkflowConfig) -> None:
    if not config.csv_file_path.exists():
        raise ValueError(
            f"CSV file not found: {config.csv_file_path}\n"
            f"Please check the path and try again."
        )

# Bad - silent failure
def validate_config(config):
    if not config.csv_file_path.exists():
        return False
```

---

## Testing Strategy

### Test Coverage Goals
- **Unit tests**: 90%+ for core business logic
- **Integration tests**: All API endpoints, provider adapters

### Running Tests

```bash
# All tests (skips integration by default)
pytest

# With coverage report
pytest --cov=src/cycling_ai --cov-report=html

# Include integration tests (requires API keys)
pytest -m integration

# Type checking
mypy src/cycling_ai --strict
```

---

## Configuration & Environment

### Required Environment Variables

**For cloud providers:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
```

**For Supabase Auth:**
```bash
export SUPABASE_URL="https://..."
export SUPABASE_JWT_SECRET="..."
```

### Running the API

```bash
# Development
uvicorn cycling_ai.api.main:app --reload

# Production
uvicorn cycling_ai.api.main:app --host 0.0.0.0 --port 8000
```

---

## Contributing Guidelines

### Before Making Changes

1. **Read existing tests** to understand patterns
2. **Check type hints** are complete (`mypy --strict` must pass)
3. **Run full test suite** before committing
4. **Update documentation** for user-facing changes

### Code Style

- **Formatting:** Use `ruff format`
- **Linting:** Run `ruff check` (auto-fix with `--fix`)
- **Type checking:** `mypy src/cycling_ai --strict`
- **Line length:** 120 characters max
- **Imports:** Group by stdlib, third-party, local

### Commit Guidelines

```bash
# Good commit messages
"Add zone enrichment to data preparation phase"
"Fix: Handle missing FTP in athlete profile"
"Refactor: Extract tool result parsing to helper method"

# Bad commit messages
"fix stuff"
"updates"
"WIP"
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run full test suite: `pytest && mypy src/cycling_ai --strict`
4. Update documentation if needed
5. Create PR with clear description

---

## Quick Reference

### Common Commands

```bash
# Run API server
uvicorn cycling_ai.api.main:app --reload

# Run tests
pytest
pytest --cov=src/cycling_ai --cov-report=html
mypy src/cycling_ai --strict
ruff check src/cycling_ai

# Test API endpoints
curl http://localhost:8000/health
```

---

## Final Notes for Claude Code

When working on this project:

1. **Always maintain type safety** - Run `mypy --strict` before committing
2. **Write tests first** for new features (TDD approach)
3. **Keep business logic separate** - Core logic in `core/`, API in `api/`
4. **Document APIs well** - OpenAPI docs are generated automatically
5. **Test with real data** - Integration tests catch provider-specific issues

**Most Important:** This is a production system with real users. Code quality, test coverage, and clear documentation are non-negotiable.

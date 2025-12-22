# CLI Removal Plan

## Overview

This document outlines the removal of CLI-related code from the Python codebase while preserving all API functionality and the RAG module for future use. The CLI was used for local report generation and chat functionality, but all production features are now served through the FastAPI backend.

**Status:** Ready for execution
**Risk Level:** Low (verified no API dependencies on CLI)
**Estimated Time:** 30-60 minutes

---

## What We're Keeping

| Module | Reason |
|--------|--------|
| `src/cycling_ai/api/` | Production API |
| `src/cycling_ai/core/` | Business logic used by API |
| `src/cycling_ai/tools/` | Tool abstractions |
| `src/cycling_ai/providers/` | LLM providers |
| `src/cycling_ai/rag/` | **Future API integration** |
| `src/cycling_ai/orchestration/prompt_loader.py` | Used by API |
| `src/cycling_ai/orchestration/phases/training_planning_library.py` | Used by API |
| `src/cycling_ai/orchestration/rag_integration.py` | **Supports RAG module** |
| `data/vectorstore/` | **RAG data** |
| `docs/RAG_USAGE_GUIDE.md` | **RAG documentation** |

---

## Pre-Removal Verification

Before executing this plan, verify the API is working correctly:

```bash
# Run API tests to establish baseline
PYTHONPATH=src .venv/bin/pytest tests/api/ -v

# Verify current test count
PYTHONPATH=src .venv/bin/pytest tests/ -v --collect-only | tail -5
```

---

## Phase 1: Delete CLI Package

### Files to Delete

**CLI Main Package** (`src/cycling_ai/cli/`):

| File | Purpose | Safe to Delete |
|------|---------|----------------|
| `src/cycling_ai/cli/__init__.py` | Package init | ✅ Yes |
| `src/cycling_ai/cli/main.py` | CLI entry point (Click app) | ✅ Yes |
| `src/cycling_ai/cli/commands/__init__.py` | Commands package init | ✅ Yes |
| `src/cycling_ai/cli/commands/generate.py` | Multi-agent report generation | ✅ Yes |
| `src/cycling_ai/cli/commands/chat.py` | Conversational interface | ✅ Yes |
| `src/cycling_ai/cli/commands/analyze.py` | Direct analysis commands | ✅ Yes |
| `src/cycling_ai/cli/commands/plan.py` | Training plan commands | ✅ Yes |
| `src/cycling_ai/cli/commands/index.py` | RAG knowledge indexing | ✅ Yes |
| `src/cycling_ai/cli/commands/report.py` | Report generation | ✅ Yes |
| `src/cycling_ai/cli/commands/validate.py` | Data validation | ✅ Yes |
| `src/cycling_ai/cli/commands/zones.py` | Zone analysis | ✅ Yes |

**Command to execute:**
```bash
rm -rf src/cycling_ai/cli/
```

---

## Phase 2: Delete CLI Tests

### Test Files to Delete

| File | Tests For | Safe to Delete |
|------|-----------|----------------|
| `tests/cli/__init__.py` | Package init | ✅ Yes |
| `tests/cli/test_main.py` | CLI main entry | ✅ Yes |
| `tests/cli/test_generate.py` | Generate command | ✅ Yes |
| `tests/cli/test_chat.py` | Chat command | ✅ Yes |
| `tests/cli/test_analyze.py` | Analyze command | ✅ Yes |
| `tests/cli/test_plan.py` | Plan command | ✅ Yes |

**Command to execute:**
```bash
rm -rf tests/cli/
```

---

## Phase 3: Update pyproject.toml

### Remove CLI Entry Point

**Current configuration:**
```toml
[project.scripts]
cycling-ai = "cycling_ai.cli.main:main"
```

**Action:** Remove the entire `[project.scripts]` section.

### Remove CLI-Only Dependencies

Review and potentially remove these dependencies (CLI-only, not RAG):

| Dependency | Used By | Action |
|------------|---------|--------|
| `click` | CLI only | ✅ Remove |
| `rich` | CLI output formatting | ✅ Remove |
| `chromadb` | RAG vectorstore | ⛔ **Keep** |
| `sentence-transformers` | RAG embeddings | ⛔ **Keep** |

**Verification before removing:**
```bash
grep -r "import click" src/cycling_ai/ --include="*.py" | grep -v cli/
grep -r "from rich" src/cycling_ai/ --include="*.py" | grep -v cli/
```

---

## Phase 4: Clean Up Orchestration Module

### Files to KEEP

These orchestration files are used by the API or support RAG:

| File | Used By | Action |
|------|---------|--------|
| `src/cycling_ai/orchestration/prompt_loader.py` | API plan generation | ✅ Keep |
| `src/cycling_ai/orchestration/phases/training_planning_library.py` | API plan generation | ✅ Keep |
| `src/cycling_ai/orchestration/rag_integration.py` | RAG module | ✅ Keep |
| `src/cycling_ai/orchestration/__init__.py` | Package init | ✅ Keep |
| `src/cycling_ai/orchestration/phases/__init__.py` | Package init | ✅ Keep |

### Files to DELETE (CLI-Only)

| File | Purpose | Safe to Delete |
|------|---------|----------------|
| `src/cycling_ai/orchestration/multi_agent.py` | Multi-agent orchestrator (CLI generate) | ✅ Yes |
| `src/cycling_ai/orchestration/session.py` | Conversation session (CLI chat) | ✅ Yes |
| `src/cycling_ai/orchestration/agent.py` | LLM Agent (CLI workflows) | ✅ Yes |
| `src/cycling_ai/orchestration/executor.py` | Tool executor (CLI workflows) | ✅ Yes |
| `src/cycling_ai/orchestration/prompts.py` | Agent prompts (CLI generate) | ✅ Yes |
| `src/cycling_ai/orchestration/workflows/` | Workflow orchestration (CLI) | ✅ Yes (entire dir) |
| `src/cycling_ai/orchestration/phases/base_phase.py` | Base phase (CLI workflows) | ✅ Yes |
| `src/cycling_ai/orchestration/phases/data_preparation.py` | Data prep phase (CLI) | ✅ Yes |
| `src/cycling_ai/orchestration/phases/performance_analysis.py` | Analysis phase (CLI) | ✅ Yes |
| `src/cycling_ai/orchestration/phases/report_preparation.py` | Report phase (CLI) | ✅ Yes |

### Verification Before Deleting Orchestration Files

```bash
# Check what API imports from orchestration
grep -r "from cycling_ai\.orchestration" src/cycling_ai/api/ --include="*.py"

# Expected results (files to keep):
# - prompt_loader
# - training_planning_library

# Check what RAG imports from orchestration
grep -r "from cycling_ai\.orchestration" src/cycling_ai/rag/ --include="*.py"

# Expected: rag_integration.py is IN orchestration, not importing from it
```

---

## Phase 5: Update Documentation

### Files to Keep

| File | Action |
|------|--------|
| `docs/RAG_USAGE_GUIDE.md` | ✅ Keep (RAG retained for future use) |

### Files to Delete

| File | Action |
|------|--------|
| `docs/CLI_USAGE.md` | ✅ Delete if exists |

### Update CLAUDE.md

Remove CLI-related sections from `CLAUDE.md`:
- Remove "cycling-ai generate" command examples
- Remove "cycling-ai chat" command examples
- Remove CLI-related quick reference commands
- Keep RAG section (for future API integration)
- Update project overview to focus on API only

---

## Execution Checklist

Execute in order:

```bash
# 1. Verify API tests pass before changes
PYTHONPATH=src .venv/bin/pytest tests/api/ -v

# 2. Delete CLI package
rm -rf src/cycling_ai/cli/

# 3. Delete CLI tests
rm -rf tests/cli/

# 4. Delete CLI-only orchestration files
rm -f src/cycling_ai/orchestration/multi_agent.py
rm -f src/cycling_ai/orchestration/session.py
rm -f src/cycling_ai/orchestration/agent.py
rm -f src/cycling_ai/orchestration/executor.py
rm -f src/cycling_ai/orchestration/prompts.py
rm -rf src/cycling_ai/orchestration/workflows/
rm -f src/cycling_ai/orchestration/phases/base_phase.py
rm -f src/cycling_ai/orchestration/phases/data_preparation.py
rm -f src/cycling_ai/orchestration/phases/performance_analysis.py
rm -f src/cycling_ai/orchestration/phases/report_preparation.py

# 5. Delete corresponding orchestration tests (but keep rag tests)
# Review tests/orchestration/ and delete only CLI-related tests
# Keep any tests for prompt_loader, training_planning_library, rag_integration

# 6. Update pyproject.toml (remove [project.scripts] section and click/rich deps)
# Manual edit required

# 7. Verify API still works
PYTHONPATH=src .venv/bin/pytest tests/api/ -v

# 8. Verify RAG module still works
PYTHONPATH=src .venv/bin/pytest tests/rag/ -v

# 9. Run full remaining tests
PYTHONPATH=src .venv/bin/pytest tests/ -v

# 10. Type check
PYTHONPATH=src .venv/bin/mypy src/cycling_ai --strict
```

---

## Post-Removal Verification

### Required Checks

1. **API Tests Pass:**
   ```bash
   PYTHONPATH=src .venv/bin/pytest tests/api/ -v
   ```

2. **RAG Tests Pass:**
   ```bash
   PYTHONPATH=src .venv/bin/pytest tests/rag/ -v
   ```

3. **Type Checking Passes:**
   ```bash
   PYTHONPATH=src .venv/bin/mypy src/cycling_ai --strict
   ```

4. **No Broken Imports:**
   ```bash
   python -c "from cycling_ai.api import app; print('API imports OK')"
   python -c "from cycling_ai.orchestration.prompt_loader import PromptLoader; print('PromptLoader OK')"
   python -c "from cycling_ai.rag.manager import RAGManager; print('RAG imports OK')"
   ```

5. **Linting Passes:**
   ```bash
   .venv/bin/ruff check src/cycling_ai
   ```

6. **API Endpoint Tests (manual):**
   ```bash
   # Start the API
   uvicorn cycling_ai.api.main:app --reload

   # Test health endpoint
   curl http://localhost:8000/health
   ```

---

## Rollback Plan

If issues are discovered after removal:

```bash
# Restore from git
git checkout HEAD -- src/cycling_ai/cli/
git checkout HEAD -- tests/cli/
git checkout HEAD -- src/cycling_ai/orchestration/
git checkout HEAD -- tests/orchestration/
```

---

## Summary

### Files to Delete (Total: ~30 files)

- `src/cycling_ai/cli/` (14 files)
- `tests/cli/` (6 files)
- `src/cycling_ai/orchestration/` (partial, ~10 files - CLI workflow files only)
- `tests/orchestration/` (CLI-related tests only)

### Files to Keep

- `src/cycling_ai/api/` (all files)
- `src/cycling_ai/core/` (all files)
- `src/cycling_ai/tools/` (all files)
- `src/cycling_ai/providers/` (all files)
- `src/cycling_ai/rag/` (all files - **retained for future API integration**)
- `src/cycling_ai/orchestration/prompt_loader.py`
- `src/cycling_ai/orchestration/phases/training_planning_library.py`
- `src/cycling_ai/orchestration/rag_integration.py`
- `tests/api/` (all files)
- `tests/core/` (all files)
- `tests/tools/` (all files)
- `tests/providers/` (all files)
- `tests/rag/` (all files)
- `data/vectorstore/` (RAG data)
- `docs/RAG_USAGE_GUIDE.md`

### Dependencies to Remove from pyproject.toml

- `click` (CLI only)
- `rich` (CLI only)
- Remove `[project.scripts]` section

### Dependencies to KEEP

- `chromadb` (RAG)
- `sentence-transformers` (RAG)

---

## Future: RAG API Integration

The RAG module is retained for future integration with the API. Potential use cases:

1. **Enhanced Training Plan Generation** - Use domain knowledge to improve plan quality
2. **Coaching Insights** - Ground AI responses in cycling science
3. **Knowledge-Based Q&A** - Allow users to ask questions grounded in training knowledge

When ready to integrate, the RAG module (`src/cycling_ai/rag/`) and its integration helper (`src/cycling_ai/orchestration/rag_integration.py`) are ready to use.

---

## Notes

- This plan was created based on codebase analysis performed on December 23, 2025
- Verified that no API code imports from CLI modules
- RAG module retained for future API integration
- API uses only `prompt_loader.py` and `training_planning_library.py` from orchestration
- All other orchestration code is CLI-specific for multi-agent workflows

# CARD 1: Project Setup

**Status:** Pending
**Estimated Time:** 30 minutes
**Dependencies:** None

---

## Objective

Set up the foundational structure for the RAG module:
- Create directory structure
- Add LangChain dependencies
- Configure mypy for LangChain packages

---

## Tasks

### 1.1 Create Directory Structure

Create the following directories and files:

```bash
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag
mkdir -p /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag
```

Create `__init__.py` files:

```bash
touch /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/__init__.py
touch /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/__init__.py
```

Expected structure:
```
src/cycling_ai/rag/
├── __init__.py          # Empty for now, will export classes later
├── embeddings.py        # To be created in Card 2
├── vectorstore.py       # To be created in Card 3
└── manager.py           # To be created in Card 4

tests/rag/
├── __init__.py          # Empty
├── test_embeddings.py   # To be created in Card 2
├── test_vectorstore.py  # To be created in Card 3
└── test_manager.py      # To be created in Card 4
```

### 1.2 Add Dependencies to pyproject.toml

Edit `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/pyproject.toml`:

**In the `dependencies` array, add:**

```toml
# RAG dependencies (Phase 1)
"langchain>=0.1.0",
"langchain-community>=0.0.10",
"langchain-openai>=0.0.5",
"chromadb>=0.4.22",
"sentence-transformers>=2.2.2",
```

**Add after the existing `[[tool.mypy.overrides]]` sections:**

```toml
# RAG dependencies - ignore missing type stubs
[[tool.mypy.overrides]]
module = "langchain.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "langchain_core.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "langchain_community.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "langchain_openai.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "chromadb.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "sentence_transformers.*"
ignore_missing_imports = true
```

### 1.3 Install Dependencies

Run:

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement
pip install -e .
```

Verify installation:

```bash
python -c "import langchain; print(langchain.__version__)"
python -c "from langchain_community.embeddings import HuggingFaceEmbeddings; print('OK')"
python -c "from langchain_community.vectorstores import Chroma; print('OK')"
python -c "from langchain_openai import OpenAIEmbeddings; print('OK')"
python -c "import chromadb; print(chromadb.__version__)"
python -c "import sentence_transformers; print(sentence_transformers.__version__)"
```

All imports should succeed.

### 1.4 Create Placeholder Files

Create empty Python files with docstrings:

**`src/cycling_ai/rag/embeddings.py`:**
```python
"""
Embedding provider factory using LangChain.

This module provides a factory for creating LangChain embedding providers.
Uses HuggingFaceEmbeddings for local embeddings and OpenAIEmbeddings for cloud.
"""

# Implementation in Card 2
```

**`src/cycling_ai/rag/vectorstore.py`:**
```python
"""
ChromaVectorStore wrapper using LangChain.

This module provides a thin wrapper around LangChain's Chroma vectorstore
to support multi-collection management and our two-vectorstore design.
"""

# Implementation in Card 3
```

**`src/cycling_ai/rag/manager.py`:**
```python
"""
RAG Manager - Central interface for RAG operations.

This module orchestrates two vectorstores:
- Project vectorstore: Shared knowledge (domain, templates, workouts)
- User vectorstore: Athlete-specific history
"""

# Implementation in Card 4
```

---

## Acceptance Criteria

- [ ] Directory structure created (`src/cycling_ai/rag/`, `tests/rag/`)
- [ ] `__init__.py` files created in both directories
- [ ] Dependencies added to `pyproject.toml`
- [ ] Mypy overrides configured for LangChain packages
- [ ] Dependencies installed successfully (`pip install -e .`)
- [ ] All import verification commands pass
- [ ] Placeholder files created with docstrings
- [ ] `mypy src/cycling_ai/rag/` runs without errors (empty modules OK)

---

## Validation Commands

Run these commands to verify setup:

```bash
# Verify directory structure
ls -la /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/
ls -la /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/rag/

# Verify dependencies
python -c "import langchain; import chromadb; import sentence_transformers; print('All imports OK')"

# Verify mypy configuration
mypy src/cycling_ai/rag/ --strict

# Should pass (empty modules are valid)
```

---

## Notes

- This card is purely setup - no functional code yet
- LangChain download size: ~50MB (core packages)
- sentence-transformers first run will download model (~90MB for all-MiniLM-L6-v2)
- Chroma will create SQLite database on first use

---

## Time Estimate Breakdown

- Directory creation: 2 min
- Edit pyproject.toml: 5 min
- Install dependencies: 10 min (network dependent)
- Import verification: 3 min
- Create placeholder files: 5 min
- Run validation: 5 min

**Total: ~30 minutes**

# Phase 1 RAG Integration - Implementation Plan

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Ready for Execution
**Architect:** Task Implementation Preparation Agent

---

## Executive Summary

This plan implements **Phase 1: Foundation** of the RAG Integration (from `docs/RAG_INTEGRATION_PLAN.md`). The goal is to establish the foundational RAG infrastructure using **LangChain** as the framework, with local embeddings and Chroma vectorstore.

### Key Principle: Leverage LangChain

**CRITICAL:** We are **NOT** building embedding or vectorstore logic from scratch. Instead, we use battle-tested LangChain components:

- **Embeddings:** `langchain_community.embeddings.HuggingFaceEmbeddings` (local) + `langchain_openai.OpenAIEmbeddings`
- **Vectorstore:** `langchain_community.vectorstores.Chroma`
- **Our Code:** Thin wrappers to support our two-vectorstore design (project + user)

### Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    RAG Manager                          │
│  (Our abstraction - manages 2 vectorstores)            │
│                                                         │
│  project_vectorstore: ChromaVectorStore                │
│    ├─ domain_knowledge collection                     │
│    ├─ training_templates collection                   │
│    └─ workout_library collection                      │
│                                                         │
│  user_vectorstore: ChromaVectorStore                   │
│    └─ athlete_history collection                      │
└────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  ChromaVectorStore  │         │  EmbeddingFactory   │
│  (Thin wrapper)     │         │  (Provider factory) │
│                     │         │                     │
│  Uses LangChain:    │         │  Creates:           │
│  - Chroma           │         │  - HuggingFace      │
│  - Collection ops   │         │  - OpenAI           │
└─────────────────────┘         └─────────────────────┘
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│ langchain_community │         │ langchain_community │
│ .vectorstores       │         │ .embeddings         │
│ .Chroma             │         │ .HuggingFaceEmbeddings│
└─────────────────────┘         └─────────────────────┘
```

### Two-Vectorstore Design Rationale

**Why Two Separate Vectorstores?**

1. **Project Vectorstore** (`data/vectorstore/`) - Version Controlled
   - Domain knowledge (cycling science)
   - Training plan templates
   - Workout library
   - **Shared across all users**
   - **Ships with the application**

2. **User Vectorstore** (`~/.cycling-ai/athlete_history/`) - User-Specific
   - Athlete performance history
   - Past analyses and trends
   - Training plan outcomes
   - **Privacy-focused** (never leaves user's machine)
   - **Not version controlled**

This separation enables:
- Privacy: User data isolated from project data
- Portability: Project knowledge ships with code
- Maintainability: Clear ownership boundaries
- Performance: Smaller, targeted collections

---

## File Structure

```
src/cycling_ai/rag/
├── __init__.py                 # Exports: RAGManager, EmbeddingFactory, ChromaVectorStore
├── embeddings.py               # Embedding provider factory (uses LangChain)
├── vectorstore.py              # ChromaVectorStore wrapper (uses LangChain Chroma)
└── manager.py                  # RAGManager (orchestrates 2 vectorstores)

tests/rag/
├── __init__.py
├── test_embeddings.py          # Test embedding factory
├── test_vectorstore.py         # Test vectorstore wrapper
└── test_manager.py             # Test RAG manager
```

---

## Implementation Details

### 1. Embeddings Module (`rag/embeddings.py`)

**Purpose:** Factory for creating LangChain embedding providers

**Key Design:**
- Uses LangChain's existing implementations (NO custom embedding logic)
- Supports local (HuggingFace) and cloud (OpenAI) providers
- Type-safe factory pattern

**Class Structure:**

```python
from typing import Protocol
from langchain_core.embeddings import Embeddings
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_openai import OpenAIEmbeddings

class EmbeddingFactory:
    """Factory for creating LangChain embedding providers."""

    @staticmethod
    def create_local(
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    ) -> Embeddings:
        """
        Create local HuggingFace embedding provider.

        Uses LangChain's HuggingFaceEmbeddings with sentence-transformers.

        Args:
            model_name: HuggingFace model identifier

        Returns:
            LangChain Embeddings instance (384-dim for all-MiniLM-L6-v2)
        """
        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": "cpu"},  # CPU-only for portability
            encode_kwargs={"normalize_embeddings": True},
        )

    @staticmethod
    def create_openai(
        api_key: str | None = None,
        model: str = "text-embedding-3-small"
    ) -> Embeddings:
        """
        Create OpenAI embedding provider.

        Uses LangChain's OpenAIEmbeddings.

        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: OpenAI embedding model

        Returns:
            LangChain Embeddings instance (1536-dim for text-embedding-3-small)
        """
        return OpenAIEmbeddings(
            api_key=api_key,  # type: ignore
            model=model,
        )
```

**Why This Design?**
- Delegates all embedding logic to LangChain (battle-tested)
- Simple factory pattern (no custom base classes)
- Type-safe (returns `Embeddings` protocol from LangChain)
- Easy to extend (just add factory methods)

**Integration Points:**
- Used by `ChromaVectorStore` to initialize collections
- Used by `RAGManager` to embed queries

---

### 2. Vectorstore Module (`rag/vectorstore.py`)

**Purpose:** Thin wrapper around LangChain's Chroma vectorstore

**Key Design:**
- Uses `langchain_community.vectorstores.Chroma` directly
- Wrapper adds multi-collection management
- Supports our two-vectorstore pattern (project + user)

**Class Structure:**

```python
from pathlib import Path
from typing import Any
from langchain_core.embeddings import Embeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document


class ChromaVectorStore:
    """
    Wrapper around LangChain Chroma vectorstore.

    Manages multiple collections in a single Chroma instance.
    Supports our two-vectorstore design (project + user).
    """

    def __init__(
        self,
        persist_directory: Path,
        embedding_function: Embeddings,
    ) -> None:
        """
        Initialize Chroma vectorstore wrapper.

        Args:
            persist_directory: Directory for Chroma persistence
            embedding_function: LangChain Embeddings instance
        """
        self.persist_directory = persist_directory
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self.embedding_function = embedding_function

        # Collection cache: {collection_name: Chroma}
        self._collections: dict[str, Chroma] = {}

    def get_or_create_collection(
        self,
        collection_name: str,
    ) -> Chroma:
        """
        Get or create a Chroma collection.

        Uses LangChain's Chroma.from_documents or from_texts.

        Args:
            collection_name: Name of collection

        Returns:
            LangChain Chroma instance
        """
        if collection_name in self._collections:
            return self._collections[collection_name]

        # Create new collection using LangChain
        chroma = Chroma(
            collection_name=collection_name,
            embedding_function=self.embedding_function,
            persist_directory=str(self.persist_directory),
        )

        self._collections[collection_name] = chroma
        return chroma

    def add_documents(
        self,
        collection_name: str,
        documents: list[Document],
    ) -> list[str]:
        """
        Add documents to collection.

        Uses LangChain's Chroma.add_documents().

        Args:
            collection_name: Target collection
            documents: LangChain Document objects

        Returns:
            List of document IDs
        """
        collection = self.get_or_create_collection(collection_name)
        return collection.add_documents(documents)

    def similarity_search(
        self,
        collection_name: str,
        query: str,
        k: int = 5,
        filter: dict[str, Any] | None = None,
    ) -> list[Document]:
        """
        Search for similar documents.

        Uses LangChain's Chroma.similarity_search().

        Args:
            collection_name: Collection to search
            query: Search query
            k: Number of results
            filter: Metadata filter

        Returns:
            List of LangChain Documents
        """
        collection = self.get_or_create_collection(collection_name)
        return collection.similarity_search(
            query=query,
            k=k,
            filter=filter,
        )

    def similarity_search_with_score(
        self,
        collection_name: str,
        query: str,
        k: int = 5,
        filter: dict[str, Any] | None = None,
    ) -> list[tuple[Document, float]]:
        """
        Search with relevance scores.

        Uses LangChain's Chroma.similarity_search_with_score().

        Args:
            collection_name: Collection to search
            query: Search query
            k: Number of results
            filter: Metadata filter

        Returns:
            List of (Document, score) tuples
        """
        collection = self.get_or_create_collection(collection_name)
        return collection.similarity_search_with_score(
            query=query,
            k=k,
            filter=filter,
        )
```

**Why This Design?**
- Delegates all vectorstore operations to LangChain Chroma
- Adds collection management (our requirement)
- Minimal code (~100 lines vs. 500+ if implemented from scratch)
- Type-safe (uses LangChain's `Document` type)

---

### 3. RAG Manager Module (`rag/manager.py`)

**Purpose:** Main interface for RAG operations, orchestrates 2 vectorstores

**Key Design:**
- Manages project vectorstore (shared knowledge)
- Manages user vectorstore (athlete history)
- Routes queries to appropriate vectorstore
- Provides unified retrieval interface

**Class Structure:**

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from .vectorstore import ChromaVectorStore
from .embeddings import EmbeddingFactory


@dataclass
class RetrievalResult:
    """Result from RAG retrieval."""
    documents: list[str]
    metadata: list[dict[str, Any]]
    scores: list[float]
    query: str
    collection: str


class RAGManager:
    """
    Central interface for RAG operations.

    Manages two vectorstores:
    - Project vectorstore: Shared knowledge (domain, templates, workouts)
    - User vectorstore: Athlete-specific history
    """

    # Define which collections live in which vectorstore
    PROJECT_COLLECTIONS = {
        "domain_knowledge",
        "training_templates",
        "workout_library",
    }
    USER_COLLECTIONS = {"athlete_history"}

    def __init__(
        self,
        project_vectorstore_path: Path,
        user_vectorstore_path: Path | None = None,
        embedding_provider: str = "local",
        embedding_model: str | None = None,
    ) -> None:
        """
        Initialize RAG manager with two vectorstores.

        Args:
            project_vectorstore_path: Path to project vectorstore (data/vectorstore)
            user_vectorstore_path: Path to user vectorstore (~/.cycling-ai/athlete_history)
            embedding_provider: "local" or "openai"
            embedding_model: Model name (optional, uses defaults)
        """
        # Create embedding function
        self.embedding_function = self._create_embedding_function(
            provider=embedding_provider,
            model=embedding_model,
        )

        # Initialize project vectorstore (shared knowledge)
        self.project_vectorstore = ChromaVectorStore(
            persist_directory=project_vectorstore_path,
            embedding_function=self.embedding_function,
        )

        # Initialize user vectorstore (athlete history)
        user_path = user_vectorstore_path or (
            Path.home() / ".cycling-ai" / "athlete_history"
        )
        self.user_vectorstore = ChromaVectorStore(
            persist_directory=user_path,
            embedding_function=self.embedding_function,
        )

    def retrieve(
        self,
        query: str,
        collection: str,
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
        min_score: float = 0.0,
    ) -> RetrievalResult:
        """
        Retrieve relevant documents from specified collection.

        Automatically routes to project or user vectorstore based on collection.

        Args:
            query: Natural language query
            collection: Collection name (domain_knowledge, athlete_history, etc.)
            top_k: Number of documents to retrieve
            filter_metadata: Metadata filters
            min_score: Minimum similarity score (0-1)

        Returns:
            RetrievalResult with documents, metadata, scores
        """
        # Route to appropriate vectorstore
        vectorstore = self._get_vectorstore_for_collection(collection)

        # Search with scores
        results = vectorstore.similarity_search_with_score(
            collection_name=collection,
            query=query,
            k=top_k,
            filter=filter_metadata,
        )

        # Filter by score and extract data
        filtered_results = [
            (doc, score) for doc, score in results
            if score >= min_score
        ]

        documents = [doc.page_content for doc, _ in filtered_results]
        metadata = [doc.metadata for doc, _ in filtered_results]
        scores = [score for _, score in filtered_results]

        return RetrievalResult(
            documents=documents,
            metadata=metadata,
            scores=scores,
            query=query,
            collection=collection,
        )

    def _get_vectorstore_for_collection(
        self, collection: str
    ) -> ChromaVectorStore:
        """Route collection to appropriate vectorstore."""
        if collection in self.PROJECT_COLLECTIONS:
            return self.project_vectorstore
        elif collection in self.USER_COLLECTIONS:
            return self.user_vectorstore
        else:
            raise ValueError(
                f"Unknown collection: {collection}. "
                f"Must be one of: {self.PROJECT_COLLECTIONS | self.USER_COLLECTIONS}"
            )

    def _create_embedding_function(
        self, provider: str, model: str | None
    ) -> Embeddings:
        """Create embedding function using factory."""
        if provider == "local":
            return EmbeddingFactory.create_local(
                model_name=model or "sentence-transformers/all-MiniLM-L6-v2"
            )
        elif provider == "openai":
            return EmbeddingFactory.create_openai(
                model=model or "text-embedding-3-small"
            )
        else:
            raise ValueError(f"Unknown embedding provider: {provider}")
```

**Why This Design?**
- Clear separation: Project vs. user data
- Simple routing: Collection name determines vectorstore
- Type-safe: Uses LangChain types throughout
- Minimal code: Delegates heavy lifting to LangChain

---

## Testing Strategy

### Coverage Target: 90%+

We write tests for **our wrapper layer**, NOT for LangChain internals.

### Test Files

1. **`tests/rag/test_embeddings.py`** - Embedding factory tests
   - Test local embedding creation
   - Test OpenAI embedding creation
   - Test invalid provider handling

2. **`tests/rag/test_vectorstore.py`** - Vectorstore wrapper tests
   - Test collection creation
   - Test document addition
   - Test similarity search
   - Test metadata filtering

3. **`tests/rag/test_manager.py`** - RAG manager tests
   - Test two-vectorstore initialization
   - Test collection routing (project vs. user)
   - Test retrieval with filtering
   - Test score filtering

### Example Test Pattern

```python
def test_rag_manager_routes_to_project_vectorstore(tmp_path: Path):
    """Test that domain_knowledge routes to project vectorstore."""
    project_path = tmp_path / "project"
    user_path = tmp_path / "user"

    rag_manager = RAGManager(
        project_vectorstore_path=project_path,
        user_vectorstore_path=user_path,
        embedding_provider="local",
    )

    # Add document to domain_knowledge (project collection)
    doc = Document(
        page_content="Polarized training is 80% low intensity...",
        metadata={"category": "training_methodology"}
    )
    rag_manager.project_vectorstore.add_documents(
        collection_name="domain_knowledge",
        documents=[doc]
    )

    # Retrieve from domain_knowledge
    result = rag_manager.retrieve(
        query="polarized training model",
        collection="domain_knowledge",
        top_k=1
    )

    # Verify correct routing
    assert len(result.documents) == 1
    assert "polarized" in result.documents[0].lower()
    assert result.collection == "domain_knowledge"
```

---

## Dependencies

Add to `pyproject.toml`:

```toml
dependencies = [
    # ... existing dependencies ...

    # RAG dependencies (Phase 1)
    "langchain>=0.1.0",
    "langchain-community>=0.0.10",
    "langchain-openai>=0.0.5",
    "chromadb>=0.4.22",
    "sentence-transformers>=2.2.2",
]
```

**Dependency Rationale:**
- **langchain**: Core abstractions (Embeddings, Documents)
- **langchain-community**: HuggingFaceEmbeddings, Chroma
- **langchain-openai**: OpenAIEmbeddings
- **chromadb**: Vectorstore backend (embedded mode)
- **sentence-transformers**: Local embedding models

**Mypy Configuration:**

Add to `pyproject.toml`:

```toml
[[tool.mypy.overrides]]
module = "langchain.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "chromadb.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "sentence_transformers.*"
ignore_missing_imports = true
```

---

## Integration Points

### How This Integrates with Existing Code

**Phase 1 is standalone** - No changes to existing orchestration yet.

In **Phase 2** (not part of this plan), we'll integrate RAG into:
- `orchestration/multi_agent.py` - Add RAG prompt augmentation
- `cli/commands/generate.py` - Add `--enable-rag` flag

For now, we focus on:
1. Building the foundation (embeddings, vectorstore, manager)
2. Writing comprehensive tests
3. Ensuring type safety (mypy --strict)

---

## Implementation Order (TDD Approach)

### Card 1: Project Setup
- Create directory structure
- Add dependencies to pyproject.toml
- Configure mypy overrides

### Card 2: Embeddings Module
- Implement `EmbeddingFactory`
- Write tests (`test_embeddings.py`)
- Verify mypy --strict passes

### Card 3: Vectorstore Module
- Implement `ChromaVectorStore`
- Write tests (`test_vectorstore.py`)
- Verify mypy --strict passes

### Card 4: RAG Manager Module
- Implement `RAGManager`
- Write tests (`test_manager.py`)
- Verify mypy --strict passes

### Card 5: Integration Testing
- End-to-end test with both vectorstores
- Verify collection routing
- Performance validation

---

## Success Criteria

Phase 1 is complete when:

- [ ] All 3 modules implemented (`embeddings.py`, `vectorstore.py`, `manager.py`)
- [ ] All tests pass (pytest)
- [ ] Test coverage ≥90% for `rag/` module
- [ ] Type checking passes (mypy --strict)
- [ ] Can create Chroma collections via LangChain
- [ ] Can embed documents with HuggingFaceEmbeddings
- [ ] Can perform similarity search via LangChain Chroma
- [ ] Can retrieve top-k documents with metadata filtering
- [ ] Two-vectorstore routing works correctly
- [ ] Existing tests still pass (no regressions)

---

## Risk Mitigation

### Risk 1: LangChain API Changes
**Mitigation:** Pin versions in pyproject.toml, use stable LangChain 0.1.x

### Risk 2: Chroma Persistence Issues
**Mitigation:** Test persistence across restarts, verify directory structure

### Risk 3: Embedding Model Download
**Mitigation:** Document model download on first run, add caching notes

### Risk 4: Type Safety with LangChain
**Mitigation:** Use Protocol types, add mypy overrides where needed

---

## Next Steps After Phase 1

After Phase 1 completion, we proceed to:

**Phase 2: Knowledge Base Creation**
- Create domain knowledge markdown files
- Create training plan templates
- Implement indexing tools (`rag/indexing.py`)

**Phase 3: Orchestration Integration**
- Modify `multi_agent.py` to use RAG
- Add prompt augmentation logic
- Test with real workflows

This plan focuses ONLY on Phase 1 - establishing the foundation.

---

## Summary

This plan leverages **LangChain** to minimize code and maximize reliability:

- **~200 lines** of wrapper code (vs. 1000+ if built from scratch)
- **Battle-tested** components (LangChain Chroma, HuggingFaceEmbeddings)
- **Type-safe** (uses LangChain's Protocol types)
- **Testable** (mocking LangChain is straightforward)
- **Maintainable** (LangChain handles updates, we just adapt)

We write tests for **our logic** (routing, factory, two-vectorstore pattern), not for LangChain internals.

Ready to execute with confidence.

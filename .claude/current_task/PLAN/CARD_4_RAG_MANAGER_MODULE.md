# CARD 4: RAG Manager Module

**Status:** Pending
**Estimated Time:** 2.5 hours
**Dependencies:** Cards 2 (Embeddings) and 3 (Vectorstore)

---

## Objective

Implement the RAG Manager that orchestrates two vectorstores (project + user) and provides a unified retrieval interface.

**Key Innovation:** This is where our custom logic lives - routing queries to the appropriate vectorstore based on collection type.

---

## Implementation

### File: `src/cycling_ai/rag/manager.py`

```python
"""
RAG Manager - Central interface for RAG operations.

This module orchestrates two vectorstores:
- Project vectorstore: Shared knowledge (domain, templates, workouts)
- User vectorstore: Athlete-specific history

Examples:
    >>> from pathlib import Path
    >>> from cycling_ai.rag.manager import RAGManager
    >>>
    >>> # Initialize with two vectorstores
    >>> manager = RAGManager(
    ...     project_vectorstore_path=Path("./data/vectorstore"),
    ...     user_vectorstore_path=Path("~/.cycling-ai/athlete_history"),
    ...     embedding_provider="local"
    ... )
    >>>
    >>> # Retrieve from project knowledge
    >>> result = manager.retrieve(
    ...     query="polarized training model",
    ...     collection="domain_knowledge",
    ...     top_k=3
    ... )
    >>>
    >>> # Retrieve from user history
    >>> result = manager.retrieve(
    ...     query="my FTP progression",
    ...     collection="athlete_history",
    ...     top_k=5
    ... )
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .embeddings import EmbeddingFactory
from .vectorstore import ChromaVectorStore


@dataclass
class RetrievalResult:
    """
    Result from RAG retrieval.

    Attributes:
        documents: List of document contents
        metadata: List of metadata dicts (parallel to documents)
        scores: List of similarity scores (parallel to documents)
        query: Original query string
        collection: Collection name that was searched
    """
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

    The manager automatically routes queries to the appropriate vectorstore
    based on the collection name.
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
            project_vectorstore_path: Path to project vectorstore
                (typically: data/vectorstore/ in project root)
            user_vectorstore_path: Path to user vectorstore
                (typically: ~/.cycling-ai/athlete_history/)
                If None, defaults to ~/.cycling-ai/athlete_history/
            embedding_provider: "local" or "openai"
            embedding_model: Model name (optional, uses defaults)

        Examples:
            >>> from pathlib import Path
            >>> manager = RAGManager(
            ...     project_vectorstore_path=Path("./data/vectorstore"),
            ...     embedding_provider="local"
            ... )
        """
        # Create embedding function (shared across both vectorstores)
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
            collection: Collection name
                Project collections: domain_knowledge, training_templates, workout_library
                User collections: athlete_history
            top_k: Number of documents to retrieve
            filter_metadata: Metadata filters (e.g., {"category": "performance"})
            min_score: Minimum similarity score (0-1, higher = more similar)

        Returns:
            RetrievalResult with documents, metadata, scores

        Raises:
            ValueError: If collection name is unknown

        Examples:
            >>> # Retrieve from domain knowledge
            >>> result = manager.retrieve(
            ...     query="polarized training principles",
            ...     collection="domain_knowledge",
            ...     top_k=3,
            ...     filter_metadata={"category": "training_methodology"}
            ... )
            >>> for doc, score in zip(result.documents, result.scores):
            ...     print(f"Score: {score:.3f}")
            ...     print(f"Content: {doc[:100]}...")
            >>>
            >>> # Retrieve from athlete history
            >>> result = manager.retrieve(
            ...     query="FTP progression trends",
            ...     collection="athlete_history",
            ...     top_k=5
            ... )
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
        """
        Route collection to appropriate vectorstore.

        Project collections → project_vectorstore
        User collections → user_vectorstore

        Args:
            collection: Collection name

        Returns:
            Appropriate ChromaVectorStore instance

        Raises:
            ValueError: If collection name is unknown
        """
        if collection in self.PROJECT_COLLECTIONS:
            return self.project_vectorstore
        elif collection in self.USER_COLLECTIONS:
            return self.user_vectorstore
        else:
            all_collections = self.PROJECT_COLLECTIONS | self.USER_COLLECTIONS
            raise ValueError(
                f"Unknown collection: '{collection}'. "
                f"Must be one of: {sorted(all_collections)}"
            )

    def _create_embedding_function(
        self, provider: str, model: str | None
    ) -> Any:  # Returns Embeddings, avoiding import
        """
        Create embedding function using factory.

        Args:
            provider: "local" or "openai"
            model: Model name (optional)

        Returns:
            LangChain Embeddings instance

        Raises:
            ValueError: If provider is unknown
        """
        if provider == "local":
            return EmbeddingFactory.create_local(
                model_name=model or "sentence-transformers/all-MiniLM-L6-v2"
            )
        elif provider == "openai":
            return EmbeddingFactory.create_openai(
                model=model or "text-embedding-3-small"
            )
        else:
            raise ValueError(
                f"Unknown embedding provider: '{provider}'. "
                f"Must be 'local' or 'openai'."
            )
```

---

## Update Module Exports

### File: `src/cycling_ai/rag/__init__.py`

```python
"""
RAG (Retrieval Augmented Generation) module.

This module provides vectorstore-based retrieval for the Cycling AI Analysis system.

Key Components:
- RAGManager: Main interface for RAG operations
- ChromaVectorStore: LangChain Chroma wrapper
- EmbeddingFactory: Factory for creating embedding providers

Examples:
    >>> from cycling_ai.rag import RAGManager
    >>> from pathlib import Path
    >>>
    >>> manager = RAGManager(
    ...     project_vectorstore_path=Path("./data/vectorstore"),
    ...     embedding_provider="local"
    ... )
    >>>
    >>> result = manager.retrieve(
    ...     query="polarized training",
    ...     collection="domain_knowledge",
    ...     top_k=3
    ... )
"""

from .embeddings import EmbeddingFactory
from .manager import RAGManager, RetrievalResult
from .vectorstore import ChromaVectorStore

__all__ = [
    "RAGManager",
    "RetrievalResult",
    "ChromaVectorStore",
    "EmbeddingFactory",
]
```

---

## Tests

### File: `tests/rag/test_manager.py`

```python
"""
Tests for RAG Manager.

Tests cover:
- Two-vectorstore initialization
- Collection routing (project vs. user)
- Retrieval with filtering
- Score filtering
- Error handling
"""

from __future__ import annotations

from pathlib import Path

import pytest
from langchain_core.documents import Document

from cycling_ai.rag import RAGManager, RetrievalResult


class TestRAGManagerInit:
    """Test RAG Manager initialization."""

    def test_init_with_defaults(self, tmp_path: Path) -> None:
        """Test initialization with default user path."""
        project_path = tmp_path / "project"

        manager = RAGManager(
            project_vectorstore_path=project_path,
            embedding_provider="local",
        )

        assert manager.project_vectorstore is not None
        assert manager.user_vectorstore is not None
        assert project_path.exists()

    def test_init_with_custom_user_path(self, tmp_path: Path) -> None:
        """Test initialization with custom user path."""
        project_path = tmp_path / "project"
        user_path = tmp_path / "user"

        manager = RAGManager(
            project_vectorstore_path=project_path,
            user_vectorstore_path=user_path,
            embedding_provider="local",
        )

        assert manager.project_vectorstore.persist_directory == project_path
        assert manager.user_vectorstore.persist_directory == user_path
        assert project_path.exists()
        assert user_path.exists()

    def test_init_with_openai_provider(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test initialization with OpenAI embeddings."""
        # Set fake API key
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")

        project_path = tmp_path / "project"

        manager = RAGManager(
            project_vectorstore_path=project_path,
            embedding_provider="openai",
        )

        assert manager.embedding_function is not None

    def test_init_invalid_provider_raises(self, tmp_path: Path) -> None:
        """Test that invalid provider raises ValueError."""
        project_path = tmp_path / "project"

        with pytest.raises(ValueError) as exc_info:
            RAGManager(
                project_vectorstore_path=project_path,
                embedding_provider="invalid_provider",  # type: ignore
            )

        assert "Unknown embedding provider" in str(exc_info.value)


class TestCollectionRouting:
    """Test collection routing to appropriate vectorstore."""

    def test_routes_domain_knowledge_to_project(self, tmp_path: Path) -> None:
        """Test that domain_knowledge routes to project vectorstore."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        vectorstore = manager._get_vectorstore_for_collection("domain_knowledge")

        assert vectorstore is manager.project_vectorstore

    def test_routes_training_templates_to_project(self, tmp_path: Path) -> None:
        """Test that training_templates routes to project vectorstore."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        vectorstore = manager._get_vectorstore_for_collection("training_templates")

        assert vectorstore is manager.project_vectorstore

    def test_routes_workout_library_to_project(self, tmp_path: Path) -> None:
        """Test that workout_library routes to project vectorstore."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        vectorstore = manager._get_vectorstore_for_collection("workout_library")

        assert vectorstore is manager.project_vectorstore

    def test_routes_athlete_history_to_user(self, tmp_path: Path) -> None:
        """Test that athlete_history routes to user vectorstore."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        vectorstore = manager._get_vectorstore_for_collection("athlete_history")

        assert vectorstore is manager.user_vectorstore

    def test_unknown_collection_raises(self, tmp_path: Path) -> None:
        """Test that unknown collection raises ValueError."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        with pytest.raises(ValueError) as exc_info:
            manager._get_vectorstore_for_collection("unknown_collection")

        assert "Unknown collection" in str(exc_info.value)
        assert "unknown_collection" in str(exc_info.value)


class TestRetrieval:
    """Test retrieval operations."""

    def test_retrieve_from_project_vectorstore(self, tmp_path: Path) -> None:
        """Test retrieving from project vectorstore."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        # Add document to domain_knowledge (project collection)
        docs = [
            Document(
                page_content="Polarized training is 80% low intensity and 20% high intensity.",
                metadata={"category": "training_methodology"}
            )
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Retrieve
        result = manager.retrieve(
            query="polarized training model",
            collection="domain_knowledge",
            top_k=1
        )

        assert isinstance(result, RetrievalResult)
        assert len(result.documents) == 1
        assert "polarized" in result.documents[0].lower()
        assert result.collection == "domain_knowledge"
        assert result.query == "polarized training model"

    def test_retrieve_from_user_vectorstore(self, tmp_path: Path) -> None:
        """Test retrieving from user vectorstore."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        # Add document to athlete_history (user collection)
        docs = [
            Document(
                page_content="FTP increased from 250W to 265W over 3 months.",
                metadata={"athlete_id": "test123", "analysis_date": "2024-10-01"}
            )
        ]
        manager.user_vectorstore.add_documents("athlete_history", docs)

        # Retrieve
        result = manager.retrieve(
            query="FTP progression trends",
            collection="athlete_history",
            top_k=1
        )

        assert len(result.documents) == 1
        assert "FTP" in result.documents[0]
        assert result.collection == "athlete_history"

    def test_retrieve_with_metadata_filter(self, tmp_path: Path) -> None:
        """Test retrieval with metadata filtering."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add documents with different categories
        docs = [
            Document(
                page_content="Polarized training methodology.",
                metadata={"category": "training"}
            ),
            Document(
                page_content="FTP testing protocol.",
                metadata={"category": "testing"}
            ),
            Document(
                page_content="Sweet spot training intervals.",
                metadata={"category": "training"}
            ),
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Retrieve with filter
        result = manager.retrieve(
            query="training methods",
            collection="domain_knowledge",
            top_k=5,
            filter_metadata={"category": "training"}
        )

        # Should only return training documents
        assert len(result.documents) == 2
        assert all(meta["category"] == "training" for meta in result.metadata)

    def test_retrieve_with_min_score_filter(self, tmp_path: Path) -> None:
        """Test retrieval with minimum score filtering."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add documents
        docs = [
            Document(page_content="Cycling performance analysis."),
            Document(page_content="Swimming technique improvement."),
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Retrieve with high min_score (should filter out irrelevant)
        result = manager.retrieve(
            query="cycling performance",
            collection="domain_knowledge",
            top_k=2,
            min_score=0.5  # Require strong similarity
        )

        # Should only return highly relevant documents
        assert len(result.documents) >= 1
        assert all(score >= 0.5 for score in result.scores)

    def test_retrieve_top_k_limit(self, tmp_path: Path) -> None:
        """Test top-k retrieval limit."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        # Add many documents
        docs = [
            Document(page_content=f"Document number {i}")
            for i in range(10)
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        # Retrieve with k=3
        result = manager.retrieve(
            query="document",
            collection="domain_knowledge",
            top_k=3
        )

        assert len(result.documents) == 3
        assert len(result.metadata) == 3
        assert len(result.scores) == 3


class TestRetrievalResult:
    """Test RetrievalResult dataclass."""

    def test_retrieval_result_structure(self, tmp_path: Path) -> None:
        """Test RetrievalResult has expected structure."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        docs = [
            Document(
                page_content="Test content",
                metadata={"key": "value"}
            )
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        result = manager.retrieve(
            query="test",
            collection="domain_knowledge",
            top_k=1
        )

        # Verify structure
        assert hasattr(result, "documents")
        assert hasattr(result, "metadata")
        assert hasattr(result, "scores")
        assert hasattr(result, "query")
        assert hasattr(result, "collection")

        # Verify types
        assert isinstance(result.documents, list)
        assert isinstance(result.metadata, list)
        assert isinstance(result.scores, list)
        assert isinstance(result.query, str)
        assert isinstance(result.collection, str)

    def test_retrieval_result_parallel_lists(self, tmp_path: Path) -> None:
        """Test that documents, metadata, scores are parallel lists."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            embedding_provider="local",
        )

        docs = [
            Document(page_content=f"Doc {i}", metadata={"index": i})
            for i in range(3)
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", docs)

        result = manager.retrieve(
            query="doc",
            collection="domain_knowledge",
            top_k=3
        )

        # All lists should have same length
        assert len(result.documents) == len(result.metadata) == len(result.scores)

        # Verify parallel structure
        for i, (doc, meta, score) in enumerate(
            zip(result.documents, result.metadata, result.scores)
        ):
            assert isinstance(doc, str)
            assert isinstance(meta, dict)
            assert isinstance(score, float)


class TestEndToEndWorkflow:
    """Test complete end-to-end workflows."""

    def test_two_vectorstore_isolation(self, tmp_path: Path) -> None:
        """Test that project and user vectorstores are isolated."""
        manager = RAGManager(
            project_vectorstore_path=tmp_path / "project",
            user_vectorstore_path=tmp_path / "user",
            embedding_provider="local",
        )

        # Add to project vectorstore
        project_docs = [
            Document(page_content="Project knowledge about cycling.")
        ]
        manager.project_vectorstore.add_documents("domain_knowledge", project_docs)

        # Add to user vectorstore
        user_docs = [
            Document(page_content="User's personal cycling history.")
        ]
        manager.user_vectorstore.add_documents("athlete_history", user_docs)

        # Retrieve from project
        project_result = manager.retrieve(
            query="cycling",
            collection="domain_knowledge",
            top_k=1
        )

        # Retrieve from user
        user_result = manager.retrieve(
            query="cycling",
            collection="athlete_history",
            top_k=1
        )

        # Should get different documents
        assert "project knowledge" in project_result.documents[0].lower()
        assert "personal cycling history" in user_result.documents[0].lower()
```

---

## Acceptance Criteria

- [ ] `manager.py` implemented with `RAGManager` and `RetrievalResult`
- [ ] Two-vectorstore routing works correctly
- [ ] Collection routing validates collection names
- [ ] All tests in `test_manager.py` pass
- [ ] Test coverage ≥95% for `manager.py`
- [ ] `mypy --strict` passes with zero errors
- [ ] `__init__.py` exports all public classes
- [ ] Docstrings complete with examples

---

## Validation Commands

```bash
# Run tests
pytest tests/rag/test_manager.py -v

# Check coverage
pytest tests/rag/test_manager.py --cov=src/cycling_ai/rag/manager --cov-report=term-missing

# Type check entire module
mypy src/cycling_ai/rag/ --strict

# Integration test
python -c "
from pathlib import Path
from cycling_ai.rag import RAGManager
from langchain_core.documents import Document

manager = RAGManager(
    project_vectorstore_path=Path('./test_project'),
    user_vectorstore_path=Path('./test_user'),
    embedding_provider='local'
)

# Add to project vectorstore
project_docs = [Document(page_content='Domain knowledge', metadata={'category': 'test'})]
manager.project_vectorstore.add_documents('domain_knowledge', project_docs)

# Retrieve
result = manager.retrieve('knowledge', 'domain_knowledge', top_k=1)
print(f'Success: Retrieved {len(result.documents)} documents')
print(f'Routing: Collection {result.collection} → project vectorstore')
"
```

---

## Time Estimate Breakdown

- Write `manager.py`: 40 min
- Write `test_manager.py`: 70 min
- Update `__init__.py`: 5 min
- Run tests: 10 min
- Fix type errors: 20 min
- Documentation: 5 min

**Total: ~2.5 hours**

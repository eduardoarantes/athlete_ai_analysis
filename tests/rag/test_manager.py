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
        for doc, meta, score in zip(result.documents, result.metadata, result.scores):
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

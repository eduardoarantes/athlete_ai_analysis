"""
Tests for ChromaVectorStore wrapper.

Tests cover:
- Collection creation
- Document addition
- Similarity search
- Metadata filtering
- Persistence
"""

from __future__ import annotations

from pathlib import Path

import pytest
from langchain_core.documents import Document

from cycling_ai.rag.embeddings import EmbeddingFactory
from cycling_ai.rag.vectorstore import ChromaVectorStore


class TestChromaVectorStoreInit:
    """Test ChromaVectorStore initialization."""

    def test_init_creates_directory(self, tmp_path: Path) -> None:
        """Test that initialization creates persist directory."""
        persist_dir = tmp_path / "vectorstore"
        assert not persist_dir.exists()

        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=persist_dir,
            embedding_function=embeddings,
        )

        assert persist_dir.exists()
        assert persist_dir.is_dir()
        assert vectorstore.persist_directory == persist_dir

    def test_init_with_existing_directory(self, tmp_path: Path) -> None:
        """Test initialization with existing directory."""
        persist_dir = tmp_path / "existing"
        persist_dir.mkdir()

        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=persist_dir,
            embedding_function=embeddings,
        )

        assert vectorstore.persist_directory == persist_dir


class TestCollectionManagement:
    """Test collection creation and management."""

    def test_get_or_create_collection_new(self, tmp_path: Path) -> None:
        """Test creating a new collection."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        collection = vectorstore.get_or_create_collection("test_collection")

        assert collection is not None
        assert "test_collection" in vectorstore._collections

    def test_get_or_create_collection_existing(self, tmp_path: Path) -> None:
        """Test getting an existing collection."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        # Create collection
        collection1 = vectorstore.get_or_create_collection("test_collection")

        # Get same collection (should be cached)
        collection2 = vectorstore.get_or_create_collection("test_collection")

        assert collection1 is collection2  # Same object

    def test_multiple_collections(self, tmp_path: Path) -> None:
        """Test managing multiple collections."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        coll1 = vectorstore.get_or_create_collection("collection1")
        coll2 = vectorstore.get_or_create_collection("collection2")

        assert coll1 is not coll2
        assert len(vectorstore._collections) == 2
        assert "collection1" in vectorstore._collections
        assert "collection2" in vectorstore._collections


class TestDocumentOperations:
    """Test document addition and retrieval."""

    def test_add_documents_single(self, tmp_path: Path) -> None:
        """Test adding a single document."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        docs = [
            Document(
                page_content="Polarized training is 80% low intensity.",
                metadata={"category": "training_methodology"}
            )
        ]

        ids = vectorstore.add_documents("domain_knowledge", docs)

        assert isinstance(ids, list)
        assert len(ids) == 1

    def test_add_documents_multiple(self, tmp_path: Path) -> None:
        """Test adding multiple documents."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        docs = [
            Document(
                page_content="Polarized training is 80% low intensity.",
                metadata={"category": "training_methodology"}
            ),
            Document(
                page_content="FTP is functional threshold power.",
                metadata={"category": "testing"}
            ),
            Document(
                page_content="VO2max is maximum oxygen uptake.",
                metadata={"category": "physiology"}
            ),
        ]

        ids = vectorstore.add_documents("domain_knowledge", docs)

        assert len(ids) == 3

    def test_add_documents_empty_list_raises(self, tmp_path: Path) -> None:
        """Test that adding empty list raises ValueError."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        with pytest.raises(ValueError) as exc_info:
            vectorstore.add_documents("domain_knowledge", [])

        assert "empty documents list" in str(exc_info.value)


class TestSimilaritySearch:
    """Test similarity search operations."""

    def test_similarity_search_basic(self, tmp_path: Path) -> None:
        """Test basic similarity search."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        # Add documents
        docs = [
            Document(
                page_content="Polarized training is 80% low intensity.",
                metadata={"category": "training"}
            ),
            Document(
                page_content="FTP is functional threshold power.",
                metadata={"category": "testing"}
            ),
        ]
        vectorstore.add_documents("domain_knowledge", docs)

        # Search
        results = vectorstore.similarity_search(
            collection_name="domain_knowledge",
            query="polarized training model",
            k=1
        )

        assert len(results) == 1
        assert "polarized" in results[0].page_content.lower()

    def test_similarity_search_top_k(self, tmp_path: Path) -> None:
        """Test top-k retrieval."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        # Add documents
        docs = [
            Document(page_content=f"Document number {i}", metadata={"index": i})
            for i in range(10)
        ]
        vectorstore.add_documents("test_collection", docs)

        # Search with k=3
        results = vectorstore.similarity_search(
            collection_name="test_collection",
            query="document",
            k=3
        )

        assert len(results) == 3

    def test_similarity_search_with_metadata_filter(self, tmp_path: Path) -> None:
        """Test similarity search with metadata filtering."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        # Add documents with different categories
        docs = [
            Document(
                page_content="Polarized training is effective.",
                metadata={"category": "training"}
            ),
            Document(
                page_content="FTP testing protocols.",
                metadata={"category": "testing"}
            ),
            Document(
                page_content="Sweet spot training intervals.",
                metadata={"category": "training"}
            ),
        ]
        vectorstore.add_documents("domain_knowledge", docs)

        # Search with filter
        results = vectorstore.similarity_search(
            collection_name="domain_knowledge",
            query="training methods",
            k=5,
            filter={"category": "training"}
        )

        # Should only return training documents
        assert len(results) == 2
        assert all(doc.metadata["category"] == "training" for doc in results)

    def test_similarity_search_with_score(self, tmp_path: Path) -> None:
        """Test similarity search with scores."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        # Add documents
        docs = [
            Document(
                page_content="Polarized training is 80% low intensity.",
                metadata={"category": "training"}
            ),
            Document(
                page_content="FTP is functional threshold power.",
                metadata={"category": "testing"}
            ),
        ]
        vectorstore.add_documents("domain_knowledge", docs)

        # Search with scores
        results = vectorstore.similarity_search_with_score(
            collection_name="domain_knowledge",
            query="polarized training",
            k=2
        )

        assert len(results) == 2
        # Each result is (Document, score) tuple
        doc1, score1 = results[0]
        assert isinstance(doc1, Document)
        assert isinstance(score1, float)
        assert 0.0 <= score1 <= 1.0

        # First result should be most relevant
        assert "polarized" in doc1.page_content.lower()


class TestPersistence:
    """Test vectorstore persistence."""

    def test_persistence_across_instances(self, tmp_path: Path) -> None:
        """Test that data persists across vectorstore instances."""
        persist_dir = tmp_path / "vectorstore"
        embeddings = EmbeddingFactory.create_local()

        # Create first instance and add documents
        vectorstore1 = ChromaVectorStore(
            persist_directory=persist_dir,
            embedding_function=embeddings,
        )
        docs = [
            Document(
                page_content="Persistent document.",
                metadata={"test": "value"}
            )
        ]
        vectorstore1.add_documents("test_collection", docs)

        # Create second instance (should load persisted data)
        vectorstore2 = ChromaVectorStore(
            persist_directory=persist_dir,
            embedding_function=embeddings,
        )

        # Search should find document from first instance
        results = vectorstore2.similarity_search(
            collection_name="test_collection",
            query="persistent",
            k=1
        )

        assert len(results) == 1
        assert "persistent" in results[0].page_content.lower()


class TestDeleteCollection:
    """Test collection deletion."""

    def test_delete_collection(self, tmp_path: Path) -> None:
        """Test deleting a collection."""
        embeddings = EmbeddingFactory.create_local()
        vectorstore = ChromaVectorStore(
            persist_directory=tmp_path / "vectorstore",
            embedding_function=embeddings,
        )

        # Create and populate collection
        docs = [Document(page_content="Test document")]
        vectorstore.add_documents("test_collection", docs)

        assert "test_collection" in vectorstore._collections

        # Delete collection
        vectorstore.delete_collection("test_collection")

        assert "test_collection" not in vectorstore._collections

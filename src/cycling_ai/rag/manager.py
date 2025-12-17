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

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .embeddings import EmbeddingFactory
from .vectorstore import ChromaVectorStore

logger = logging.getLogger(__name__)


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
        user_path = user_vectorstore_path or (Path.home() / ".cycling-ai" / "athlete_history")
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
        logger.info(
            f"RAG: Initiating retrieval from '{collection}' "
            f"(query: '{query[:50]}...', top_k={top_k}, min_score={min_score})"
        )

        # Route to appropriate vectorstore
        vectorstore = self._get_vectorstore_for_collection(collection)

        # Search with scores
        results = vectorstore.similarity_search_with_score(
            collection_name=collection,
            query=query,
            k=top_k,
            filter=filter_metadata,
        )

        logger.debug(f"RAG: Raw retrieval found {len(results)} documents")

        # Filter by score and extract data
        filtered_results = [(doc, score) for doc, score in results if score >= min_score]

        if len(filtered_results) < len(results):
            logger.info(f"RAG: Filtered to {len(filtered_results)}/{len(results)} documents (min_score={min_score})")

        documents = [doc.page_content for doc, _ in filtered_results]
        metadata = [doc.metadata for doc, _ in filtered_results]
        scores = [score for _, score in filtered_results]

        if documents:
            logger.info(f"RAG: Retrieved {len(documents)} documents with scores: {[f'{s:.3f}' for s in scores]}")
        else:
            logger.warning(f"RAG: No documents retrieved from '{collection}'")

        return RetrievalResult(
            documents=documents,
            metadata=metadata,
            scores=scores,
            query=query,
            collection=collection,
        )

    def _get_vectorstore_for_collection(self, collection: str) -> ChromaVectorStore:
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
            raise ValueError(f"Unknown collection: '{collection}'. Must be one of: {sorted(all_collections)}")

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
            return EmbeddingFactory.create_local(model_name=model or "sentence-transformers/all-MiniLM-L6-v2")
        elif provider == "openai":
            return EmbeddingFactory.create_openai(model=model or "text-embedding-3-small")
        else:
            raise ValueError(f"Unknown embedding provider: '{provider}'. Must be 'local' or 'openai'.")

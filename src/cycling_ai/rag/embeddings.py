"""
Embedding provider factory using LangChain.

This module provides a factory for creating LangChain embedding providers.
Uses HuggingFaceEmbeddings for local embeddings and OpenAIEmbeddings for cloud.

Examples:
    >>> from cycling_ai.rag.embeddings import EmbeddingFactory
    >>>
    >>> # Create local embedding provider
    >>> local_embeddings = EmbeddingFactory.create_local()
    >>>
    >>> # Create OpenAI embedding provider
    >>> openai_embeddings = EmbeddingFactory.create_openai(api_key="sk-...")
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.embeddings import Embeddings


class EmbeddingFactory:
    """
    Factory for creating LangChain embedding providers.

    Supports:
    - Local embeddings via HuggingFace sentence-transformers
    - Cloud embeddings via OpenAI API
    """

    @staticmethod
    def create_local(
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
    ) -> Embeddings:
        """
        Create local HuggingFace embedding provider.

        Uses LangChain's HuggingFaceEmbeddings with sentence-transformers.
        Model is downloaded on first use (~90MB for all-MiniLM-L6-v2).

        Args:
            model_name: HuggingFace model identifier
                Default: all-MiniLM-L6-v2 (384 dimensions, fast, good quality)

        Returns:
            LangChain Embeddings instance

        Raises:
            ImportError: If sentence-transformers not installed

        Examples:
            >>> embeddings = EmbeddingFactory.create_local()
            >>> vector = embeddings.embed_query("Hello world")
            >>> len(vector)
            384
        """
        from langchain_community.embeddings import HuggingFaceEmbeddings

        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": "cpu"},  # CPU-only for portability
            encode_kwargs={"normalize_embeddings": True},  # L2 normalization
        )

    @staticmethod
    def create_openai(
        api_key: str | None = None,
        model: str = "text-embedding-3-small",
    ) -> Embeddings:
        """
        Create OpenAI embedding provider.

        Uses LangChain's OpenAIEmbeddings.

        Args:
            api_key: OpenAI API key. If None, reads from OPENAI_API_KEY env var
            model: OpenAI embedding model
                Default: text-embedding-3-small (1536 dimensions)
                Other options: text-embedding-3-large (3072 dimensions, slower)

        Returns:
            LangChain Embeddings instance

        Raises:
            ValueError: If api_key not provided and OPENAI_API_KEY not set
            ImportError: If openai package not installed

        Examples:
            >>> embeddings = EmbeddingFactory.create_openai()
            >>> vector = embeddings.embed_query("Hello world")
            >>> len(vector)
            1536
        """
        from langchain_openai import OpenAIEmbeddings

        # Validate API key
        effective_api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not effective_api_key:
            raise ValueError(
                "OpenAI API key required. Provide api_key parameter or set OPENAI_API_KEY environment variable."
            )

        return OpenAIEmbeddings(
            api_key=effective_api_key,
            model=model,
        )
